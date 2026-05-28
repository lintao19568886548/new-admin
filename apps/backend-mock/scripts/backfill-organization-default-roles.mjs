import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const DEFAULT_ROLE_NAME = '员工';
const DEFAULT_ROLE_REMARK = '组织默认成员角色；默认不授予菜单或权限码';

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
  console.log(`回填组织默认员工角色和成员 user_role 绑定

用法:
  pnpm -F @vben/backend-mock run organization:backfill-default-roles
  pnpm -F @vben/backend-mock run organization:backfill-default-roles -- --organization-id=1
  pnpm -F @vben/backend-mock run organization:backfill-default-roles -- --execute --confirmation=backfill_org_default_roles:...

参数:
  --organization-id=<id> 可选，只预览/回填指定组织
  --source-customer-id=<id> 可选，只预览/回填指定来源库，默认 public
  --execute             执行写入；不传时只预览并输出 confirmation
  --confirmation=<text> 执行写入时必填，必须匹配预览输出的 confirmation
  --help, -h            输出帮助

说明:
  - 脚本补业务库 role(scope=organization, name=员工, organization_id=?)。
  - 普通 active 成员如果没有组织角色，则绑定默认员工角色。
  - owner 不绑定员工角色，owner 迁移时映射为目标租户 Super。
  - 默认员工角色不授予 menu/code/park 权限。`);
}

function parseArgs(argv) {
  const options = {
    confirmation: '',
    execute: false,
    organizationId: null,
    sourceCustomerId: 'public',
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
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
    if (key === 'organization-id') {
      options.organizationId = normalizePositiveInteger(value);
      if (!options.organizationId) {
        throw new Error(`organization-id 不合法: ${value}`);
      }
      continue;
    }
    if (key === 'source-customer-id') {
      options.sourceCustomerId = normalizeCustomerId(value);
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

  if (customerId === 'public') {
    const publicUrl = optionalEnv('PUBLIC_DATABASE_URL');
    if (!publicUrl) {
      throw new Error('PUBLIC_DATABASE_URL 未配置，无法回填 public 组织角色');
    }
    return dbName ? applyDatabaseName(publicUrl, dbName) : publicUrl;
  }

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

function numberOrNull(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function buildConfirmation(plan) {
  const digest = createHash('sha256')
    .update(
      JSON.stringify(
        plan.map((item) => ({
          action: item.action,
          centerUserId: item.centerUserId,
          defaultRoleId: item.defaultRoleId,
          organizationId: item.organizationId,
          sourceCustomerId: item.sourceCustomerId,
          sourceUserId: item.sourceUserId,
        })),
      ),
    )
    .digest('hex')
    .slice(0, 12);
  return `backfill_org_default_roles:${digest}`;
}

async function listOrganizations(centerConnection, options) {
  const where = ["o.status = 'active'"];
  const params = [];

  if (options.organizationId) {
    where.push('o.id = ?');
    params.push(options.organizationId);
  }
  if (options.sourceCustomerId) {
    where.push('o.source_customer_id = ?');
    params.push(options.sourceCustomerId);
  }

  return await centerConnection.query(
    `
      SELECT
        o.id,
        o.source_customer_id AS sourceCustomerId,
        c.db_name AS dbName
      FROM organization o
      LEFT JOIN customer c ON c.customer_id = o.source_customer_id
      WHERE ${where.join(' AND ')}
      ORDER BY o.id ASC
    `,
    params,
  );
}

async function getDefaultRole(customerConnection, organizationId) {
  const rows = await customerConnection.query(
    `
      SELECT role_id AS roleId
      FROM role
      WHERE scope = 'organization'
        AND organization_id = ?
        AND name = ?
      ORDER BY role_id ASC
      LIMIT 1
    `,
    [organizationId, DEFAULT_ROLE_NAME],
  );
  return rows[0] ? Number(rows[0].roleId) : null;
}

async function listActiveMembers(centerConnection, organization) {
  return await centerConnection.query(
    `
      SELECT
        member.center_user_id AS centerUserId,
        member.source_user_id AS sourceUserId,
        mapping.customer_user_id AS mappedSourceUserId,
        member.member_role AS memberRole,
        center_user.username AS username
      FROM organization_member member
      INNER JOIN user center_user ON center_user.id = member.center_user_id
      LEFT JOIN user_tenant_mapping mapping
        ON mapping.center_user_id = member.center_user_id
       AND mapping.customer_id = member.source_customer_id
      WHERE member.organization_id = ?
        AND member.source_customer_id = ?
        AND member.status = 'active'
        AND center_user.status = 1
      ORDER BY member.id ASC
    `,
    [Number(organization.id), organization.sourceCustomerId],
  );
}

async function resolveSourceUserId(customerConnection, member) {
  const explicitSourceUserId = numberOrNull(member.sourceUserId);
  if (explicitSourceUserId) {
    const rows = await customerConnection.query(
      'SELECT id FROM user WHERE id = ? AND status = 1 LIMIT 1',
      [explicitSourceUserId],
    );
    if (rows[0]) {
      return explicitSourceUserId;
    }
  }

  const mappedSourceUserId = numberOrNull(member.mappedSourceUserId);
  if (mappedSourceUserId) {
    const rows = await customerConnection.query(
      'SELECT id FROM user WHERE id = ? AND status = 1 LIMIT 1',
      [mappedSourceUserId],
    );
    if (rows[0]) {
      return mappedSourceUserId;
    }
  }

  const username = String(member.username || '').trim();
  if (!username) {
    return null;
  }

  const rows = await customerConnection.query(
    'SELECT id FROM user WHERE username = ? AND status = 1 LIMIT 1',
    [username],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function hasOrganizationRole(customerConnection, organizationId, userId) {
  const rows = await customerConnection.query(
    `
      SELECT user_role.id
      FROM user_role
      INNER JOIN role ON role.role_id = user_role.role_id
      WHERE user_role.user_id = ?
        AND role.scope = 'organization'
        AND role.organization_id = ?
      LIMIT 1
    `,
    [userId, organizationId],
  );
  return rows.length > 0;
}

async function buildPlanForOrganization(centerConnection, organization) {
  const sourceCustomerId = normalizeCustomerId(organization.sourceCustomerId);
  const customerConnection = await openConnection(
    resolveCustomerDbUrl({
      customerId: sourceCustomerId,
      dbName: organization.dbName || null,
    }),
  );
  try {
    const organizationId = Number(organization.id);
    const defaultRoleId = await getDefaultRole(
      customerConnection,
      organizationId,
    );
    const plan = [];

    if (!defaultRoleId) {
      plan.push({
        action: 'create_default_role',
        organizationId,
        roleName: DEFAULT_ROLE_NAME,
        sourceCustomerId,
      });
    }

    const members = await listActiveMembers(centerConnection, {
      id: organizationId,
      sourceCustomerId,
    });
    for (const member of members) {
      if (String(member.memberRole || '') === 'owner') {
        continue;
      }

      const sourceUserId = await resolveSourceUserId(
        customerConnection,
        member,
      );
      if (!sourceUserId) {
        plan.push({
          action: 'skip_missing_source_user',
          centerUserId: Number(member.centerUserId),
          organizationId,
          sourceCustomerId,
        });
        continue;
      }

      const hasRole = await hasOrganizationRole(
        customerConnection,
        organizationId,
        sourceUserId,
      );
      if (hasRole) {
        continue;
      }

      plan.push({
        action: 'bind_default_role',
        centerUserId: Number(member.centerUserId),
        defaultRoleId,
        organizationId,
        sourceCustomerId,
        sourceUserId,
      });
    }

    return plan;
  } finally {
    await customerConnection.end().catch(() => undefined);
  }
}

async function buildPlan(centerConnection, options) {
  const organizations = await listOrganizations(centerConnection, options);
  const plan = [];
  for (const organization of organizations) {
    plan.push(
      ...(await buildPlanForOrganization(centerConnection, organization)),
    );
  }
  return plan;
}

function summarizePlan(plan) {
  return {
    bindDefaultRole: plan.filter((item) => item.action === 'bind_default_role')
      .length,
    createDefaultRole: plan.filter(
      (item) => item.action === 'create_default_role',
    ).length,
    skipMissingSourceUser: plan.filter(
      (item) => item.action === 'skip_missing_source_user',
    ).length,
    total: plan.length,
  };
}

function groupPlan(plan) {
  const grouped = new Map();
  for (const item of plan) {
    if (item.action === 'skip_missing_source_user') {
      continue;
    }

    const key = `${item.sourceCustomerId}:${item.organizationId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        items: [],
        organizationId: item.organizationId,
        sourceCustomerId: item.sourceCustomerId,
      });
    }
    grouped.get(key).items.push(item);
  }
  return [...grouped.values()];
}

async function findOrganization(centerConnection, organizationId) {
  const rows = await centerConnection.query(
    `
      SELECT
        o.id,
        o.source_customer_id AS sourceCustomerId,
        c.db_name AS dbName
      FROM organization o
      LEFT JOIN customer c ON c.customer_id = o.source_customer_id
      WHERE o.id = ?
      LIMIT 1
    `,
    [organizationId],
  );
  return rows[0] || null;
}

async function ensureDefaultRole(customerConnection, organizationId) {
  const existingRoleId = await getDefaultRole(
    customerConnection,
    organizationId,
  );
  if (existingRoleId) {
    return existingRoleId;
  }

  const result = await customerConnection.query(
    `
      INSERT INTO role
        (name, remark, status, parent_id, organization_id, scope, create_time, update_time)
      VALUES
        (?, ?, 1, NULL, ?, 'organization', NOW(), NOW())
    `,
    [DEFAULT_ROLE_NAME, DEFAULT_ROLE_REMARK, organizationId],
  );
  return Number(result.insertId);
}

async function executePlanGroup(centerConnection, group) {
  const organization = await findOrganization(
    centerConnection,
    group.organizationId,
  );
  if (!organization) {
    throw new Error(`组织不存在: ${group.organizationId}`);
  }

  const customerConnection = await openConnection(
    resolveCustomerDbUrl({
      customerId: group.sourceCustomerId,
      dbName: organization.dbName || null,
    }),
  );
  await customerConnection.beginTransaction();
  try {
    const defaultRoleId = await ensureDefaultRole(
      customerConnection,
      group.organizationId,
    );
    const results = [];

    for (const item of group.items) {
      if (item.action === 'create_default_role') {
        results.push({
          ...item,
          defaultRoleId,
        });
        continue;
      }

      if (item.action !== 'bind_default_role') {
        continue;
      }

      const sourceUserId = Number(item.sourceUserId);
      const hasRole = await hasOrganizationRole(
        customerConnection,
        group.organizationId,
        sourceUserId,
      );
      if (!hasRole) {
        await customerConnection.query(
          `
            INSERT INTO user_role
              (user_id, role_id, create_time, update_time)
            VALUES
              (?, ?, NOW(), NOW())
          `,
          [sourceUserId, defaultRoleId],
        );
      }

      await centerConnection.query(
        `
          UPDATE organization_member
          SET source_user_id = ?, update_time = NOW()
          WHERE organization_id = ?
            AND center_user_id = ?
            AND source_customer_id = ?
            AND status = 'active'
        `,
        [
          sourceUserId,
          group.organizationId,
          Number(item.centerUserId),
          group.sourceCustomerId,
        ],
      );

      results.push({
        ...item,
        defaultRoleId,
      });
    }

    await customerConnection.commit();
    return results;
  } catch (error) {
    await customerConnection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await customerConnection.end().catch(() => undefined);
  }
}

async function executePlan(centerConnection, plan) {
  const results = [];
  for (const group of groupPlan(plan)) {
    results.push(...(await executePlanGroup(centerConnection, group)));
  }
  results.push(
    ...plan.filter((item) => item.action === 'skip_missing_source_user'),
  );
  return results;
}

async function main() {
  const argv = normalizeArgv(process.argv.slice(2));
  if (shouldPrintHelp(argv)) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  const centerConnection = await openConnection(
    requireEnv('CENTER_DATABASE_URL'),
  );
  try {
    const plan = await buildPlan(centerConnection, options);
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

    const results = await executePlan(centerConnection, plan);
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
    await centerConnection.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(
    '[organization:backfill-default-roles] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
