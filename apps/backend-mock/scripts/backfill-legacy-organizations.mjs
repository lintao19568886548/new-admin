import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const SPECIAL_CUSTOMER_IDS = new Set(['center', 'default', 'public']);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

function shouldPrintHelp(argv) {
  return argv.includes('--help') || argv.includes('-h');
}

function printHelp() {
  console.log(`回填 legacy 租户 synthetic organization

用法:
  pnpm -F @vben/backend-mock run organization:backfill-legacy
  pnpm -F @vben/backend-mock run organization:backfill-legacy -- --customer-id=customer_a
  pnpm -F @vben/backend-mock run organization:backfill-legacy -- --execute --confirmation=backfill_legacy_org:...

参数:
  --customer-id=<id>    可选，只预览/回填指定旧租户
  --owner-center-user-id=<id> 可选，异常数据时覆盖自动识别的 center owner
  --execute             执行写入；不传时只预览并输出 confirmation
  --confirmation=<text> 执行写入时必填，必须匹配预览输出的 confirmation
  --include-disabled    包含 customer.status<>1 的租户
  --help, -h            输出帮助

说明:
  - 脚本只补 center.organization / organization_member / organization_tenant_mapping。
  - 默认从旧租户业务库里最早创建的 active Super 账号推导 organization owner。
  - 旧租户 active 非 Super 且有 center 映射的账号会补为普通 member。
  - 缺少 center 映射的旧租户账号不会硬补，会列入 skippedMembers。
  - 已存在 organization_tenant_mapping 但缺 active owner 时，会只补 owner。
  - 不修改租户业务库，不迁移角色，不改 payment/provisioning 流程。
  - 已存在 organization_tenant_mapping 且无需补成员的 customer 会跳过。`);
}

function parseArgs(argv) {
  const options = {
    confirmation: '',
    customerId: '',
    execute: false,
    includeDisabled: false,
    ownerCenterUserId: null,
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    if (arg === '--include-disabled') {
      options.includeDisabled = true;
      continue;
    }

    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`未知参数: ${arg}`);
    }

    const [, key, value] = match;
    if (key === 'confirmation') {
      options.confirmation = String(value || '').trim();
      continue;
    }
    if (key === 'customer-id') {
      options.customerId = normalizeCustomerId(value);
      continue;
    }
    if (key === 'owner-center-user-id') {
      options.ownerCenterUserId = normalizePositiveInteger(value);
      if (!options.ownerCenterUserId) {
        throw new Error(`owner-center-user-id 不合法: ${value}`);
      }
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  return options;
}

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function requireEnv(name) {
  const value = stripWrappingQuotes(process.env[name]);
  if (!value) {
    throw new Error(`${name} 未配置`);
  }
  return value;
}

function optionalEnv(name) {
  return stripWrappingQuotes(process.env[name]);
}

function parseDbUrl(rawUrl) {
  return new URL(stripWrappingQuotes(rawUrl));
}

function createConnectionConfig(rawUrl) {
  const url = parseDbUrl(rawUrl);
  return {
    acquireTimeout: 5000,
    connectTimeout: 5000,
    connectionLimit: 1,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
  };
}

async function openConnection(rawUrl) {
  return mariadb.createConnection(createConnectionConfig(rawUrl));
}

function applyDatabaseName(rawUrl, dbName) {
  const normalizedDbName = normalizeDatabaseName(dbName);
  const url = parseDbUrl(rawUrl);
  url.pathname = `/${normalizedDbName}`;
  return url.toString();
}

function resolveCustomerDbUrl(customer) {
  const customerId = normalizeCustomerId(customer.customerId);
  const dbName = String(customer.dbName || '').trim();

  const template = optionalEnv('CUSTOMER_DATABASE_URL_TEMPLATE');
  if (template) {
    if (!template.includes('{customerId}')) {
      throw new Error('CUSTOMER_DATABASE_URL_TEMPLATE 缺少 {customerId}');
    }
    const resolved = template.replaceAll('{customerId}', customerId);
    return dbName ? applyDatabaseName(resolved, dbName) : resolved;
  }

  const databaseUrl = requireEnv('DATABASE_URL');
  if (dbName) {
    return applyDatabaseName(databaseUrl, dbName);
  }

  const url = parseDbUrl(databaseUrl);
  const prefix = process.env.CUSTOMER_DB_PREFIX || 'customer_';
  url.pathname = `/${prefix}${customerId}`;
  return url.toString();
}

function normalizeCustomerId(value) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId) || customerId.length > 50) {
    throw new Error(`customerId 不合法: ${customerId || '(empty)'}`);
  }
  if (SPECIAL_CUSTOMER_IDS.has(customerId)) {
    throw new Error(`不允许回填特殊库: ${customerId}`);
  }
  return customerId;
}

function normalizeDatabaseName(value) {
  const dbName = String(value || '').trim();
  if (!dbName || !/^\w+$/.test(dbName) || dbName.length > 100) {
    throw new Error(`数据库名不合法: ${dbName || '(empty)'}`);
  }
  return dbName;
}

function normalizePositiveInteger(value) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function toIso(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildOrganizationName(customer) {
  return (
    String(customer.name || '').trim() ||
    String(customer.companyShortName || '').trim() ||
    customer.customerId
  );
}

function buildConfirmation(plan) {
  const digest = createHash('sha256')
    .update(
      JSON.stringify(
        plan.map((item) => ({
          action: item.action,
          city: item.city,
          companyShortName: item.companyShortName,
          customerId: item.customerId,
          dbName: item.dbName,
          existingOrganizationId: item.existingOrganizationId,
          members: item.members?.map((member) => ({
            centerUserId: member.centerUserId,
            memberRole: member.memberRole,
            sourceUserId: member.sourceUserId,
          })),
          name: item.name,
          ownerCenterUserId: item.ownerCenterUserId,
          ownerSourceUserId: item.ownerSourceUserId,
        })),
      ),
    )
    .digest('hex')
    .slice(0, 12);
  return `backfill_legacy_org:${digest}`;
}

async function assertOwnerExists(connection, ownerCenterUserId) {
  if (!ownerCenterUserId) {
    return;
  }
  const rows = await connection.query(
    'SELECT id FROM user WHERE id = ? LIMIT 1',
    [ownerCenterUserId],
  );
  if (rows.length === 0) {
    throw new Error(`owner center user 不存在: ${ownerCenterUserId}`);
  }
}

async function findCenterUserById(connection, centerUserId) {
  const rows = await connection.query(
    'SELECT id, username, status FROM user WHERE id = ? LIMIT 1',
    [centerUserId],
  );
  return rows[0] || null;
}

async function findCenterUserByUsername(connection, username) {
  const rows = await connection.query(
    'SELECT id, username, status FROM user WHERE username = ? LIMIT 2',
    [username],
  );
  if (rows.length > 1) {
    throw new Error(`center 用户名重复，无法推导 owner: ${username}`);
  }
  return rows[0] || null;
}

async function listCustomers(connection, options) {
  const where = ["customer_id NOT IN ('center', 'default', 'public')"];
  const params = [];

  if (options.customerId) {
    where.push('customer_id = ?');
    params.push(options.customerId);
  }
  if (!options.includeDisabled) {
    where.push('status = 1');
  }

  return await connection.query(
    `
      SELECT
        customer_id AS customerId,
        name,
        city,
        company_short_name AS companyShortName,
        status,
        db_name AS dbName,
        create_time AS createTime
      FROM customer
      WHERE ${where.join(' AND ')}
      ORDER BY customer_id ASC
    `,
    params,
  );
}

async function findExistingMapping(connection, customerId) {
  const rows = await connection.query(
    `
      SELECT
        organization_id AS organizationId,
        status,
        legacy
      FROM organization_tenant_mapping
      WHERE target_customer_id = ?
      LIMIT 1
    `,
    [customerId],
  );
  return rows[0] || null;
}

async function findPrimaryTenantSuper(customer) {
  const customerId = normalizeCustomerId(customer.customerId);
  const tenantConnection = await openConnection(resolveCustomerDbUrl(customer));
  try {
    const rows = await tenantConnection.query(
      `
        SELECT DISTINCT
          user.id,
          user.username,
          user.create_time AS createTime
        FROM user
        INNER JOIN user_role ON user_role.user_id = user.id
        INNER JOIN role ON role.role_id = user_role.role_id
        WHERE user.status = 1
          AND role.status = 1
          AND role.name = 'Super'
        ORDER BY user.create_time IS NULL ASC, user.create_time ASC, user.id ASC
        LIMIT 1
      `,
    );
    if (rows.length === 0) {
      throw new Error(`旧租户 ${customerId} 未找到 active Super 账号`);
    }
    return {
      createTime: toIso(rows[0].createTime),
      customerUserId: Number(rows[0].id),
      username: String(rows[0].username || '').trim(),
    };
  } finally {
    await tenantConnection.end().catch(() => undefined);
  }
}

async function listTenantUsersWithCenterMapping(connection, customer) {
  const customerId = normalizeCustomerId(customer.customerId);
  const primarySuper = await findPrimaryTenantSuper(customer);
  const tenantConnection = await openConnection(resolveCustomerDbUrl(customer));
  try {
    const rows = await tenantConnection.query(
      `
        SELECT
          user.id,
          user.username
        FROM user
        WHERE user.status = 1
        ORDER BY user.id ASC
      `,
    );

    const members = [];
    const skippedMembers = [];
    for (const row of rows) {
      const sourceUserId = Number(row.id);
      const username = String(row.username || '').trim();
      const mapping = await findOwnerMapping(
        connection,
        customerId,
        sourceUserId,
      );
      if (!mapping) {
        skippedMembers.push({
          reason: 'missing_center_mapping',
          sourceUserId,
          username,
        });
        continue;
      }

      const centerUser = await findCenterUserById(
        connection,
        Number(mapping.centerUserId),
      );
      if (!centerUser || Number(centerUser.status ?? 1) !== 1) {
        skippedMembers.push({
          centerUserId: Number(mapping.centerUserId),
          reason: 'inactive_or_missing_center_user',
          sourceUserId,
          username,
        });
        continue;
      }

      members.push({
        centerUserId: Number(centerUser.id),
        memberRole:
          sourceUserId === Number(primarySuper.customerUserId)
            ? 'owner'
            : 'member',
        ownerSource: 'mapping',
        sourceUserId,
        username: String(centerUser.username || username),
      });
    }

    return { members, skippedMembers };
  } finally {
    await tenantConnection.end().catch(() => undefined);
  }
}

async function findOwnerMapping(connection, customerId, customerUserId) {
  const rows = await connection.query(
    `
      SELECT
        center_user_id AS centerUserId,
        customer_user_id AS customerUserId
      FROM user_tenant_mapping
      WHERE customer_id = ?
        AND customer_user_id = ?
      LIMIT 1
    `,
    [customerId, Number(customerUserId)],
  );
  return rows[0] || null;
}

async function findCenterUserCustomerMapping(
  connection,
  customerId,
  centerUserId,
) {
  const rows = await connection.query(
    `
      SELECT
        center_user_id AS centerUserId,
        customer_user_id AS customerUserId
      FROM user_tenant_mapping
      WHERE customer_id = ?
        AND center_user_id = ?
      LIMIT 1
    `,
    [customerId, Number(centerUserId)],
  );
  return rows[0] || null;
}

async function assertOwnerCenterMappingAvailable(
  connection,
  customerId,
  owner,
) {
  const existing = await findCenterUserCustomerMapping(
    connection,
    customerId,
    owner.ownerCenterUserId,
  );
  if (
    existing &&
    Number(existing.customerUserId) !== Number(owner.ownerSourceUserId)
  ) {
    throw new Error(
      `center 用户 ${owner.ownerCenterUserId} 已映射到旧租户 ${customerId} 的其他账号`,
    );
  }
}

async function resolveLegacyOwner(connection, customer, options) {
  const customerId = normalizeCustomerId(customer.customerId);
  const tenantSuper = await findPrimaryTenantSuper(customer);
  if (!tenantSuper.username) {
    throw new Error(`旧租户 ${customerId} 的 Super 账号缺少 username`);
  }

  const mapping = await findOwnerMapping(
    connection,
    customerId,
    tenantSuper.customerUserId,
  );
  if (mapping) {
    const centerUser = await findCenterUserById(
      connection,
      Number(mapping.centerUserId),
    );
    if (!centerUser || Number(centerUser.status ?? 1) !== 1) {
      throw new Error(
        `旧租户 ${customerId} 的 Super 映射到停用或不存在的 center 用户`,
      );
    }
    const owner = {
      ownerCenterUserId: Number(centerUser.id),
      ownerSource: 'mapping',
      ownerSourceUserId: tenantSuper.customerUserId,
      ownerUsername: String(centerUser.username || tenantSuper.username),
    };
    await assertOwnerCenterMappingAvailable(connection, customerId, owner);
    return owner;
  }

  const centerUser = options.ownerCenterUserId
    ? await findCenterUserById(connection, options.ownerCenterUserId)
    : await findCenterUserByUsername(connection, tenantSuper.username);
  if (!centerUser || Number(centerUser.status ?? 1) !== 1) {
    throw new Error(
      `旧租户 ${customerId} 的 Super 账号未映射到 active center 用户: ${tenantSuper.username}`,
    );
  }

  const owner = {
    ownerCenterUserId: Number(centerUser.id),
    ownerSource: options.ownerCenterUserId ? 'override' : 'username',
    ownerSourceUserId: tenantSuper.customerUserId,
    ownerUsername: String(centerUser.username || tenantSuper.username),
  };
  await assertOwnerCenterMappingAvailable(connection, customerId, owner);
  return owner;
}

async function resolveLegacyMembers(connection, customer, options) {
  const customerId = normalizeCustomerId(customer.customerId);
  const owner = await resolveLegacyOwner(connection, customer, options);
  const { members: mappedMembers, skippedMembers } =
    await listTenantUsersWithCenterMapping(connection, customer);
  const skippedNonOwnerMembers = skippedMembers.filter(
    (member) => Number(member.sourceUserId) !== Number(owner.ownerSourceUserId),
  );
  const byCenterUserId = new Map();

  for (const member of mappedMembers) {
    const isOwner =
      Number(member.centerUserId) === Number(owner.ownerCenterUserId) ||
      Number(member.sourceUserId) === Number(owner.ownerSourceUserId);
    byCenterUserId.set(Number(member.centerUserId), {
      centerUserId: Number(member.centerUserId),
      memberRole: isOwner ? 'owner' : 'member',
      ownerSource: isOwner ? owner.ownerSource : member.ownerSource,
      sourceUserId: Number(member.sourceUserId),
      username: member.username,
    });
  }

  byCenterUserId.set(Number(owner.ownerCenterUserId), {
    centerUserId: Number(owner.ownerCenterUserId),
    memberRole: 'owner',
    ownerSource: owner.ownerSource,
    sourceUserId: Number(owner.ownerSourceUserId),
    username: owner.ownerUsername,
  });

  const members = [...byCenterUserId.values()].sort((left, right) => {
    if (left.memberRole !== right.memberRole) {
      return left.memberRole === 'owner' ? -1 : 1;
    }
    return Number(left.sourceUserId) - Number(right.sourceUserId);
  });
  const ownerMembers = members.filter(
    (member) => member.memberRole === 'owner',
  );
  if (ownerMembers.length !== 1) {
    throw new Error(
      `旧租户 ${customerId} 推导出的 organization owner 数量异常`,
    );
  }

  return {
    members,
    owner: ownerMembers[0],
    skippedMembers: skippedNonOwnerMembers,
  };
}

async function listActiveOrganizationMembers(connection, organizationId) {
  return await connection.query(
    `
      SELECT
        center_user_id AS centerUserId,
        member_role AS memberRole,
        source_customer_id AS sourceCustomerId,
        source_user_id AS sourceUserId
      FROM organization_member
      WHERE organization_id = ?
        AND status = 'active'
      ORDER BY id ASC
    `,
    [Number(organizationId)],
  );
}

function findMembersToEnsure(desiredMembers, existingMembers) {
  const existingByCenterUserId = new Map(
    existingMembers.map((member) => [Number(member.centerUserId), member]),
  );
  return desiredMembers.filter((member) => {
    const existing = existingByCenterUserId.get(Number(member.centerUserId));
    if (!existing) {
      return true;
    }
    return member.memberRole === 'owner' && existing.memberRole !== 'owner';
  });
}

async function buildPlan(connection, options) {
  await assertOwnerExists(connection, options.ownerCenterUserId);

  const customers = await listCustomers(connection, options);
  const plan = [];

  for (const customer of customers) {
    const customerId = normalizeCustomerId(customer.customerId);
    const existingMapping = await findExistingMapping(connection, customerId);
    if (existingMapping) {
      const existingMembers = await listActiveOrganizationMembers(
        connection,
        existingMapping.organizationId,
      );
      const existingOwner = existingMembers.filter(
        (member) => member.memberRole === 'owner',
      );
      if (existingOwner.length > 1) {
        throw new Error(
          `organization ${existingMapping.organizationId} 存在多个 active owner`,
        );
      }

      const legacyMembers = await resolveLegacyMembers(
        connection,
        customer,
        options,
      );
      if (
        existingOwner[0] &&
        Number(existingOwner[0].centerUserId) !==
          Number(legacyMembers.owner.centerUserId)
      ) {
        throw new Error(
          `organization ${existingMapping.organizationId} 的 active owner 与旧租户 Super 不一致`,
        );
      }
      const membersToEnsure = findMembersToEnsure(
        legacyMembers.members,
        existingMembers,
      );
      if (membersToEnsure.length > 0) {
        plan.push({
          action: 'ensure_legacy_members',
          customerId,
          dbName: customer.dbName || null,
          existingOrganizationId: Number(existingMapping.organizationId),
          mappingStatus: existingMapping.status,
          members: membersToEnsure,
          ownerCenterUserId: legacyMembers.owner.centerUserId,
          ownerSource: legacyMembers.owner.ownerSource,
          ownerSourceUserId: legacyMembers.owner.sourceUserId,
          ownerUsername: legacyMembers.owner.username,
          skippedMembers: legacyMembers.skippedMembers,
        });
        continue;
      }

      plan.push({
        action: 'skip_existing_mapping',
        customerId,
        existingMemberCount: existingMembers.length,
        existingOwnerCenterUserId: existingOwner[0]
          ? Number(existingOwner[0].centerUserId)
          : null,
        existingOrganizationId: Number(existingMapping.organizationId),
        mappingStatus: existingMapping.status,
        skippedMembers: legacyMembers.skippedMembers,
      });
      continue;
    }

    const legacyMembers = await resolveLegacyMembers(
      connection,
      customer,
      options,
    );
    plan.push({
      action: 'create_legacy_org',
      city: customer.city || null,
      companyShortName: customer.companyShortName || null,
      customerCreateTime: toIso(customer.createTime),
      customerId,
      customerStatus: Number(customer.status),
      dbName: customer.dbName || null,
      name: buildOrganizationName({
        companyShortName: customer.companyShortName,
        customerId,
        name: customer.name,
      }),
      members: legacyMembers.members,
      ownerCenterUserId: legacyMembers.owner.centerUserId,
      ownerSource: legacyMembers.owner.ownerSource,
      ownerSourceUserId: legacyMembers.owner.sourceUserId,
      ownerUsername: legacyMembers.owner.username,
      skippedMembers: legacyMembers.skippedMembers,
    });
  }

  return plan;
}

function summarizePlan(plan) {
  const membersToEnsure = plan
    .filter(
      (item) =>
        item.action === 'create_legacy_org' ||
        item.action === 'ensure_legacy_members',
    )
    .reduce((total, item) => total + (item.members?.length || 0), 0);
  const skippedMembers = plan.reduce(
    (total, item) => total + (item.skippedMembers?.length || 0),
    0,
  );

  return {
    create: plan.filter((item) => item.action === 'create_legacy_org').length,
    ensureMembers: plan.filter(
      (item) => item.action === 'ensure_legacy_members',
    ).length,
    membersToEnsure,
    skipExistingMapping: plan.filter(
      (item) => item.action === 'skip_existing_mapping',
    ).length,
    skippedMembers,
    total: plan.length,
  };
}

async function ensureMemberMapping(connection, item, member) {
  if (!member.centerUserId || !member.sourceUserId) {
    return;
  }

  await connection.query(
    `
      INSERT INTO user_tenant_mapping
        (
          center_user_id,
          customer_id,
          customer_user_id,
          db_name,
          create_time,
          update_time
        )
      VALUES
        (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        customer_user_id = VALUES(customer_user_id),
        db_name = VALUES(db_name),
        update_time = NOW()
    `,
    [
      member.centerUserId,
      item.customerId,
      member.sourceUserId,
      item.dbName || null,
    ],
  );
}

async function ensureMemberMembership(
  connection,
  item,
  organizationId,
  member,
) {
  await ensureMemberMapping(connection, item, member);
  await connection.query(
    `
      INSERT INTO organization_member
        (
          organization_id,
          center_user_id,
          source_customer_id,
          source_user_id,
          member_role,
          status,
          joined_at,
          create_time,
          update_time
        )
      VALUES
        (?, ?, ?, ?, ?, 'active', NOW(), NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        source_customer_id = VALUES(source_customer_id),
        source_user_id = VALUES(source_user_id),
        member_role = VALUES(member_role),
        status = 'active',
        update_time = NOW()
    `,
    [
      organizationId,
      member.centerUserId,
      item.customerId,
      member.sourceUserId || null,
      member.memberRole,
    ],
  );
}

async function ensureLegacyMembers(connection, item, organizationId) {
  for (const member of item.members || []) {
    await ensureMemberMembership(connection, item, organizationId, member);
  }
}

async function executePlan(connection, plan) {
  const results = [];
  await connection.beginTransaction();
  try {
    for (const item of plan) {
      if (item.action === 'ensure_legacy_members') {
        await ensureLegacyMembers(
          connection,
          item,
          item.existingOrganizationId,
        );
        await connection.query(
          `
            UPDATE organization
            SET created_by_center_user_id = COALESCE(created_by_center_user_id, ?),
                update_time = NOW()
            WHERE id = ?
          `,
          [item.ownerCenterUserId, item.existingOrganizationId],
        );
        results.push(item);
        continue;
      }

      if (item.action !== 'create_legacy_org') {
        results.push(item);
        continue;
      }

      const organizationResult = await connection.query(
        `
          INSERT INTO organization
            (
              name,
              city,
              company_short_name,
              source_customer_id,
              status,
              created_by_center_user_id,
              legacy,
              create_time,
              update_time
            )
          VALUES
            (?, ?, ?, ?, 'active', ?, 1, NOW(), NOW())
        `,
        [
          item.name,
          item.city,
          item.companyShortName,
          item.customerId,
          item.ownerCenterUserId,
        ],
      );
      const organizationId = Number(organizationResult.insertId);

      await ensureLegacyMembers(connection, item, organizationId);

      await connection.query(
        `
          INSERT INTO organization_tenant_mapping
            (
              organization_id,
              target_customer_id,
              target_db_name,
              tenant_provisioning_job_id,
              status,
              legacy,
              create_time,
              update_time
            )
          VALUES
            (?, ?, ?, NULL, 'active', 1, NOW(), NOW())
        `,
        [organizationId, item.customerId, item.dbName],
      );

      results.push({
        ...item,
        organizationId,
      });
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  }

  return results;
}

async function main() {
  const argv = normalizeArgv(process.argv.slice(2));
  if (shouldPrintHelp(argv)) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  const connection = await openConnection(requireEnv('CENTER_DATABASE_URL'));
  try {
    const plan = await buildPlan(connection, options);
    const confirmation = buildConfirmation(plan);
    const summary = summarizePlan(plan);

    if (!options.execute) {
      console.log(
        JSON.stringify(
          {
            confirmation,
            dryRun: true,
            plan,
            summary,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (options.confirmation !== confirmation) {
      throw new Error(
        `confirmation 不匹配，请使用预览输出的 confirmation: ${confirmation}`,
      );
    }

    const results = await executePlan(connection, plan);
    console.log(
      JSON.stringify(
        {
          confirmation,
          dryRun: false,
          results,
          summary: summarizePlan(results),
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(
    '[organization:backfill-legacy] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
