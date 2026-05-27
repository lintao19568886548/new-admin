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
  --owner-center-user-id=<id> 可选，指定 synthetic organization owner
  --execute             执行写入；不传时只预览并输出 confirmation
  --confirmation=<text> 执行写入时必填，必须匹配预览输出的 confirmation
  --include-disabled    包含 customer.status<>1 的租户
  --help, -h            输出帮助

说明:
  - 脚本只补 center.organization / organization_member / organization_tenant_mapping。
  - 不修改租户业务库，不迁移角色，不改 payment/provisioning 流程。
  - 已存在 organization_tenant_mapping 的 customer 会跳过。`);
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
          name: item.name,
          ownerCenterUserId: item.ownerCenterUserId,
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

async function buildPlan(connection, options) {
  await assertOwnerExists(connection, options.ownerCenterUserId);

  const customers = await listCustomers(connection, options);
  const plan = [];

  for (const customer of customers) {
    const customerId = normalizeCustomerId(customer.customerId);
    const existingMapping = await findExistingMapping(connection, customerId);
    if (existingMapping) {
      plan.push({
        action: 'skip_existing_mapping',
        customerId,
        existingOrganizationId: Number(existingMapping.organizationId),
        mappingStatus: existingMapping.status,
      });
      continue;
    }

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
      ownerCenterUserId: options.ownerCenterUserId,
    });
  }

  return plan;
}

function summarizePlan(plan) {
  return {
    create: plan.filter((item) => item.action === 'create_legacy_org').length,
    skipExistingMapping: plan.filter(
      (item) => item.action === 'skip_existing_mapping',
    ).length,
    total: plan.length,
  };
}

async function executePlan(connection, plan) {
  const results = [];
  await connection.beginTransaction();
  try {
    for (const item of plan) {
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

      if (item.ownerCenterUserId) {
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
              (?, ?, ?, NULL, 'owner', 'active', NOW(), NOW(), NOW())
          `,
          [organizationId, item.ownerCenterUserId, item.customerId],
        );
      }

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
