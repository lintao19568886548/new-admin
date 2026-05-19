import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const SPECIAL_CUSTOMER_IDS = new Set(['center', 'default', 'public']);
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

function shouldPrintHelp(argv) {
  return argv.length === 0 || argv.includes('--help') || argv.includes('-h');
}

function printHelp() {
  console.log(`迁移旧租户会员期限为人工权益流水

用法:
  pnpm -F @vben/backend-mock run vip-membership:migrate-legacy -- --center-user-id=1
  pnpm -F @vben/backend-mock run vip-membership:migrate-legacy -- --customer-id=tenant_a --center-user-id=1
  pnpm -F @vben/backend-mock run vip-membership:migrate-legacy -- --center-user-id=1 --execute --confirmation=migrate_legacy_vip:...

参数:
  --customer-id=<id>       可选，只迁移指定租户；不传时扫描全部非 center/default/public 租户
  --center-user-id=<id>    可选，人工权益归属中心用户；不传时写入 NULL
  --execute                执行写入；不传时只预览并输出 confirmation
  --confirmation=<text>    执行写入时必填，必须匹配预览输出的 confirmation
  --include-disabled       包含 customer.status<>1 的租户
  --help, -h               输出帮助

说明:
  脚本只读取现有 center.vip_membership.expire_at，并为旧租户生成 manual_legacy_<customerId> 权益流水。
  迁移写入的 expire_at/end_at 会归一到该日期的东八区 00:00:00。
  不会创建 vip_membership_payment，因此不会伪造微信支付订单。
  已存在真实支付权益流水的租户会跳过，避免覆盖支付系统接管后的状态。`);
}

function parseArgs(argv) {
  const options = {
    centerUserId: null,
    confirmation: '',
    customerId: '',
    execute: false,
    includeDisabled: false,
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
    if (key === 'center-user-id') {
      options.centerUserId = normalizePositiveInteger(value);
      if (!options.centerUserId) {
        throw new Error(`center-user-id 不合法: ${value}`);
      }
      continue;
    }
    if (key === 'confirmation') {
      options.confirmation = value.trim();
      continue;
    }
    if (key === 'customer-id') {
      options.customerId = normalizeCustomerId(value);
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

function normalizeCustomerId(value) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId) || customerId.length > 50) {
    throw new Error(`customerId 不合法: ${customerId}`);
  }
  if (SPECIAL_CUSTOMER_IDS.has(customerId)) {
    throw new Error(`不允许迁移特殊库: ${customerId}`);
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

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value) {
  return toDate(value)?.toISOString();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatUtcDateTime(value) {
  const date = toDate(value);
  if (!date) {
    return null;
  }
  return [
    date.getUTCFullYear(),
    '-',
    pad(date.getUTCMonth() + 1),
    '-',
    pad(date.getUTCDate()),
    ' ',
    pad(date.getUTCHours()),
    ':',
    pad(date.getUTCMinutes()),
    ':',
    pad(date.getUTCSeconds()),
  ].join('');
}

function formatChinaDateTime(value) {
  const date = toDate(value);
  if (!date) {
    return undefined;
  }
  const chinaTime = new Date(date.getTime() + CHINA_TIME_OFFSET_MS);
  return [
    chinaTime.getUTCFullYear(),
    '-',
    pad(chinaTime.getUTCMonth() + 1),
    '-',
    pad(chinaTime.getUTCDate()),
    ' ',
    pad(chinaTime.getUTCHours()),
    ':',
    pad(chinaTime.getUTCMinutes()),
    ':',
    pad(chinaTime.getUTCSeconds()),
    '+08:00',
  ].join('');
}

function toChinaStartOfDay(value) {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  const chinaTime = new Date(date.getTime() + CHINA_TIME_OFFSET_MS);
  return new Date(
    Date.UTC(
      chinaTime.getUTCFullYear(),
      chinaTime.getUTCMonth(),
      chinaTime.getUTCDate(),
    ) - CHINA_TIME_OFFSET_MS,
  );
}

function minDate(...values) {
  const dates = values.map((value) => toDate(value)).filter(Boolean);
  if (dates.length === 0) {
    return new Date();
  }
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function buildManualOutTradeNo(customerId) {
  const outTradeNo = `manual_legacy_${customerId}`;
  if (outTradeNo.length > 64) {
    throw new Error(
      `生成的 out_trade_no 超过 64 字符，请缩短 customerId: ${customerId}`,
    );
  }
  return outTradeNo;
}

function isManualLegacyOutTradeNo(outTradeNo) {
  return String(outTradeNo || '').startsWith('manual_legacy_');
}

function buildConfirmation(plan) {
  const digest = createHash('sha256')
    .update(
      JSON.stringify(
        plan.map((item) => ({
          action: item.action,
          centerUserId: item.centerUserId,
          customerId: item.customerId,
          expireAt: item.expireAt,
          outTradeNo: item.outTradeNo,
          startAt: item.startAt,
          summaryStatusAfterMigration: item.summaryStatusAfterMigration,
        })),
      ),
    )
    .digest('hex')
    .slice(0, 12);
  return `migrate_legacy_vip:${digest}`;
}

function buildOutput(payload) {
  return JSON.stringify(payload, null, 2);
}

async function getCenterUser(connection, centerUserId) {
  if (!centerUserId) {
    return null;
  }
  const rows = await connection.query(
    `
      SELECT id, username, real_name AS realName, status
      FROM \`user\`
      WHERE id = ?
      LIMIT 1
    `,
    [centerUserId],
  );
  return rows[0] || null;
}

async function listLegacyMembershipRows(connection, options) {
  const where = ["c.customer_id NOT IN ('center', 'default', 'public')"];
  const params = [];

  if (!options.includeDisabled) {
    where.push('c.status = 1');
  }

  if (options.customerId) {
    where.push('c.customer_id = ?');
    params.push(options.customerId);
  }

  return connection.query(
    `
      SELECT
        c.customer_id AS customerId,
        c.name AS customerName,
        c.city,
        c.company_short_name AS companyShortName,
        c.status AS customerStatus,
        c.db_name AS dbName,
        c.create_time AS customerCreateTime,
        m.status AS membershipStatus,
        m.expire_at AS expireAt,
        m.last_payer_center_user_id AS lastPayerCenterUserId,
        m.last_out_trade_no AS lastOutTradeNo,
        m.last_transaction_id AS lastTransactionId,
        m.create_time AS membershipCreateTime
      FROM customer c
      LEFT JOIN vip_membership m ON m.customer_id = c.customer_id
      WHERE ${where.join(' AND ')}
      ORDER BY c.customer_id ASC
    `,
    params,
  );
}

async function listEntitlements(connection, customerIds) {
  if (customerIds.length === 0) {
    return [];
  }
  const placeholders = customerIds.map(() => '?').join(', ');
  return connection.query(
    `
      SELECT
        id,
        customer_id AS customerId,
        center_user_id AS centerUserId,
        out_trade_no AS outTradeNo,
        amount_total AS amountTotal,
        duration_months AS durationMonths,
        start_at AS startAt,
        end_at AS endAt,
        status
      FROM vip_membership_entitlement
      WHERE customer_id IN (${placeholders})
      ORDER BY end_at DESC, id DESC
    `,
    customerIds,
  );
}

function groupEntitlementsByCustomer(entitlements) {
  const map = new Map();
  for (const entitlement of entitlements) {
    const customerId = String(entitlement.customerId || '');
    const list = map.get(customerId) || [];
    list.push(entitlement);
    map.set(customerId, list);
  }
  return map;
}

function buildPlan(rows, entitlementsByCustomer, options) {
  const now = new Date();
  return rows.map((row) => {
    const customerId = String(row.customerId || '');
    const rawExpireAt = toDate(row.expireAt);
    const expireAt = toChinaStartOfDay(row.expireAt);
    const centerUserId =
      normalizePositiveInteger(row.lastPayerCenterUserId) ||
      options.centerUserId;
    const outTradeNo = buildManualOutTradeNo(customerId);
    const entitlements = entitlementsByCustomer.get(customerId) || [];
    const manualEntitlement = entitlements.find(
      (entitlement) => entitlement.outTradeNo === outTradeNo,
    );
    const paidEntitlement = entitlements.find(
      (entitlement) =>
        entitlement.status === 'active' &&
        !isManualLegacyOutTradeNo(entitlement.outTradeNo),
    );
    const basePayload = {
      centerUserId,
      companyShortName: row.companyShortName || undefined,
      customerId,
      customerName: row.customerName || undefined,
      customerStatus: Number(row.customerStatus),
      dbName: row.dbName || undefined,
      expireAt: toIso(expireAt),
      expireAtChinaTime: formatChinaDateTime(expireAt),
      lastPayerCenterUserId:
        normalizePositiveInteger(row.lastPayerCenterUserId) || undefined,
      membershipStatus: row.membershipStatus || undefined,
      outTradeNo,
      sourceExpireAt: toIso(rawExpireAt),
      sourceExpireAtChinaTime: formatChinaDateTime(rawExpireAt),
    };

    if (!row.membershipStatus) {
      return {
        ...basePayload,
        action: 'skip_missing_membership',
        reason: 'center.vip_membership 尚无该租户记录',
      };
    }

    if (!expireAt) {
      return {
        ...basePayload,
        action: 'skip_missing_membership_expire_at',
        reason: 'center.vip_membership 缺少 expire_at',
      };
    }

    if (paidEntitlement) {
      return {
        ...basePayload,
        action: 'skip_paid_entitlement_exists',
        existingEntitlement: {
          endAt: toIso(paidEntitlement.endAt),
          id: Number(paidEntitlement.id),
          outTradeNo: paidEntitlement.outTradeNo,
        },
        reason: '已存在真实支付权益流水，跳过旧数据迁移',
      };
    }

    const startAt = minDate(
      row.membershipCreateTime,
      row.customerCreateTime,
      expireAt,
    );
    const status = expireAt.getTime() > now.getTime() ? 'active' : 'inactive';
    const action = manualEntitlement ? 'update_manual_entitlement' : 'insert';

    return {
      ...basePayload,
      action,
      existingEntitlement: manualEntitlement
        ? {
            endAt: toIso(manualEntitlement.endAt),
            id: Number(manualEntitlement.id),
            outTradeNo: manualEntitlement.outTradeNo,
            startAt: toIso(manualEntitlement.startAt),
          }
        : undefined,
      startAt: startAt.toISOString(),
      summaryStatusAfterMigration: status,
    };
  });
}

function summarizePlan(plan) {
  const summary = {
    scannedTenants: plan.length,
    toInsert: 0,
    toSkip: 0,
    toUpdate: 0,
  };
  for (const item of plan) {
    if (item.action === 'insert') {
      summary.toInsert += 1;
    } else if (item.action === 'update_manual_entitlement') {
      summary.toUpdate += 1;
    } else {
      summary.toSkip += 1;
    }
  }
  return summary;
}

async function applyItem(connection, item) {
  const expireAt = toDate(item.expireAt);
  const startAt = toDate(item.startAt);
  if (!expireAt || !startAt) {
    throw new Error(`迁移计划缺少有效时间: ${item.customerId}`);
  }
  const expireAtSql = formatUtcDateTime(expireAt);
  const startAtSql = formatUtcDateTime(startAt);

  if (item.action === 'insert') {
    await connection.query(
      `
        INSERT INTO vip_membership_entitlement (
          customer_id,
          center_user_id,
          out_trade_no,
          transaction_id,
          amount_total,
          duration_months,
          start_at,
          end_at,
          status,
          create_time,
          update_time
        )
        VALUES (?, ?, ?, NULL, 0, 0, ?, ?, 'active', NOW(), NOW())
      `,
      [
        item.customerId,
        item.centerUserId || null,
        item.outTradeNo,
        startAtSql,
        expireAtSql,
      ],
    );
  } else if (item.action === 'update_manual_entitlement') {
    await connection.query(
      `
        UPDATE vip_membership_entitlement
        SET
          center_user_id = ?,
          amount_total = 0,
          duration_months = 0,
          start_at = ?,
          end_at = ?,
          status = 'active',
          transaction_id = NULL,
          refunded_at = NULL,
          refunded_out_refund_no = NULL,
          update_time = NOW()
        WHERE out_trade_no = ?
      `,
      [item.centerUserId || null, startAtSql, expireAtSql, item.outTradeNo],
    );
  } else {
    return;
  }

  await connection.query(
    `
      UPDATE vip_membership
      SET
        status = ?,
        expire_at = ?,
        last_payer_center_user_id = ?,
        last_out_trade_no = ?,
        last_transaction_id = NULL,
        update_time = NOW()
      WHERE customer_id = ?
    `,
    [
      item.summaryStatusAfterMigration,
      expireAtSql,
      item.centerUserId || null,
      item.outTradeNo,
      item.customerId,
    ],
  );
}

async function main() {
  const argv = normalizeArgv(process.argv.slice(2));
  if (shouldPrintHelp(argv)) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  const dbUrl = parseDbUrl(requireEnv('CENTER_DATABASE_URL'));
  const connection = await mariadb.createConnection({
    database: dbUrl.pathname.replace(/^\//, ''),
    host: dbUrl.hostname,
    password: decodeURIComponent(dbUrl.password),
    port: dbUrl.port ? Number(dbUrl.port) : 3306,
    user: decodeURIComponent(dbUrl.username),
  });

  try {
    const fallbackCenterUser = await getCenterUser(
      connection,
      options.centerUserId,
    );
    if (options.centerUserId && !fallbackCenterUser) {
      throw new Error(`--center-user-id=${options.centerUserId} 不存在`);
    }

    const rows = await listLegacyMembershipRows(connection, options);
    const customerIds = rows.map((row) => String(row.customerId || ''));
    const entitlements = await listEntitlements(connection, customerIds);
    const plan = buildPlan(
      rows,
      groupEntitlementsByCustomer(entitlements),
      options,
    );
    const summary = summarizePlan(plan);
    const confirmation = buildConfirmation(plan);
    const executablePlan = plan.filter((item) =>
      ['insert', 'update_manual_entitlement'].includes(item.action),
    );

    console.log(
      buildOutput({
        confirmation,
        execute: options.execute,
        fallbackCenterUser,
        filters: {
          customerId: options.customerId || undefined,
          includeDisabled: options.includeDisabled,
        },
        plan,
        preview: !options.execute,
        summary,
      }),
    );

    if (!options.execute) {
      console.log(
        '预览模式，未写入。确认无误后追加 --execute 和 --confirmation 执行。',
      );
      return;
    }

    if (options.confirmation !== confirmation) {
      throw new Error(`确认串不匹配，请使用 --confirmation=${confirmation}`);
    }

    await connection.beginTransaction();
    try {
      for (const item of executablePlan) {
        await applyItem(connection, item);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    console.log(
      buildOutput({
        applied: executablePlan.length,
        confirmation,
        execute: true,
        message: '旧租户会员期限已迁移为人工权益流水。',
      }),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
