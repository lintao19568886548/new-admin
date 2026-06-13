import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

const noopActions = new Set([
  'ignore_rounding_diff',
  'keep_project_name',
  'keep_total_fee',
  'keep_total_review_detail',
  'needs_manual_review',
  'not_duplicate',
  'record_as_overpayment',
  'resave_bill',
]);

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function parseArgs(argv) {
  const options = {
    apply: false,
    backupFile: '',
    databaseUrl: '',
    input: '',
  };

  for (const arg of argv.filter((item) => item !== '--')) {
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`未知参数: ${arg}`);
    }

    const [, key, value] = match;
    if (key === 'apply') {
      options.apply = stripWrappingQuotes(value) === 'true';
      continue;
    }

    if (key === 'backup-file') {
      options.backupFile = path.resolve(
        process.cwd(),
        stripWrappingQuotes(value),
      );
      continue;
    }

    if (key === 'database-url') {
      options.databaseUrl = stripWrappingQuotes(value);
      continue;
    }

    if (key === 'input') {
      options.input = path.resolve(process.cwd(), stripWrappingQuotes(value));
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  if (!options.input) {
    throw new Error('请传 --input=业务修复确认模板路径');
  }

  return options;
}

function createConnectionConfig(rawUrl) {
  const url = new URL(stripWrappingQuotes(rawUrl));
  return {
    acquireTimeout: 5000,
    connectTimeout: 5000,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
  };
}

function maskDatabaseUrl(rawUrl) {
  return String(rawUrl || '').replaceAll(
    /:\/\/([^:/?#]+):([^@/?#]+)@/g,
    '://$1:***@',
  );
}

function toAmount(value, fieldName) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new TypeError(`${fieldName} 不是有效金额`);
  }
  return Number(amount.toFixed(2));
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function flattenApprovedItems(template) {
  return Object.entries(template.items || {}).flatMap(([type, rows]) =>
    Array.isArray(rows)
      ? rows
          .filter((item) => item?.approved === true)
          .map((item) => ({ ...item, type: item.type || type }))
      : [],
  );
}

function assertAllowedAction(item) {
  if (!item.action) {
    throw new Error(
      `${item.type} billId=${item.current?.billId || ''} 未填写 action`,
    );
  }

  if (
    Array.isArray(item.allowedActions) &&
    item.allowedActions.length > 0 &&
    !item.allowedActions.includes(item.action)
  ) {
    throw new Error(
      `${item.type} billId=${item.current?.billId || ''} action 不在 allowedActions 内`,
    );
  }
}

function buildExecutablePlan(item) {
  assertAllowedAction(item);

  if (noopActions.has(item.action)) {
    return {
      action: item.action,
      billId: item.current?.billId,
      executable: false,
      reason: 'no-op action',
      type: item.type,
    };
  }

  if (item.action === 'fix_project_name') {
    const projectName = normalizeText(
      item.updates?.projectName || item.proposedProjectName,
    );
    if (!projectName) {
      throw new Error(
        `billId=${item.current?.billId} 缺少 updates.projectName`,
      );
    }
    return {
      action: item.action,
      billId: item.current.billId,
      executable: true,
      params: [projectName, item.current.billId],
      sql: 'UPDATE amount_bill SET project_name = ? WHERE bill_id = ?',
      type: item.type,
      updates: { projectName },
    };
  }

  if (item.action === 'set_total_fee_to_component_total') {
    const totalFee = toAmount(
      item.updates?.totalFee ?? item.current?.componentTotal,
      'totalFee',
    );
    return {
      action: item.action,
      billId: item.current.billId,
      executable: true,
      params: [totalFee, item.current.billId],
      sql: 'UPDATE amount_bill SET total_fee = ? WHERE bill_id = ?',
      type: item.type,
      updates: { totalFee },
    };
  }

  if (item.action === 'set_total_fee_to_receipt_amount') {
    const totalFee = toAmount(
      item.updates?.totalFee ?? item.current?.receiptAmount,
      'totalFee',
    );
    return {
      action: item.action,
      billId: item.current.billId,
      executable: true,
      params: [totalFee, item.current.billId],
      sql: 'UPDATE amount_bill SET total_fee = ? WHERE bill_id = ?',
      type: item.type,
      updates: { totalFee },
    };
  }

  if (item.action === 'set_ele_fee_to_detail_total') {
    const eleFee = toAmount(
      item.updates?.eleFee ?? item.current?.detailAmount,
      'eleFee',
    );
    return {
      action: item.action,
      billId: item.current.billId,
      executable: true,
      params: [eleFee, item.current.billId],
      sql: 'UPDATE amount_bill SET ele_fee = ? WHERE bill_id = ?',
      type: item.type,
      updates: { eleFee },
    };
  }

  if (item.action === 'set_water_fee_to_detail_total') {
    const waterFee = toAmount(
      item.updates?.waterFee ?? item.current?.detailAmount,
      'waterFee',
    );
    return {
      action: item.action,
      billId: item.current.billId,
      executable: true,
      params: [waterFee, item.current.billId],
      sql: 'UPDATE amount_bill SET water_fee = ? WHERE bill_id = ?',
      type: item.type,
      updates: { waterFee },
    };
  }

  throw new Error(
    `${item.type} billId=${item.current?.billId || ''} action=${item.action} 暂未支持自动执行`,
  );
}

async function assertBackupExists(options) {
  if (!options.apply) return;
  if (!options.backupFile) {
    throw new Error('--apply 必须同时传 --backup-file=备份文件路径');
  }
  await access(options.backupFile);
}

async function applyExecutablePlans(connection, plans) {
  await connection.beginTransaction();
  try {
    for (const plan of plans.filter((item) => item.executable)) {
      await connection.query(plan.sql, plan.params);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await assertBackupExists(options);

  const databaseUrl =
    options.databaseUrl ||
    stripWrappingQuotes(process.env.DATABASE_URL) ||
    stripWrappingQuotes(process.env.PUBLIC_DATABASE_URL);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未配置，请传 --database-url');
  }

  const template = JSON.parse(await readFile(options.input, 'utf8'));
  const approvedItems = flattenApprovedItems(template);
  const plans = approvedItems.map((item) => buildExecutablePlan(item));
  const executablePlans = plans.filter((item) => item.executable);

  if (options.apply && executablePlans.length > 0) {
    const connection = await mariadb.createConnection(
      createConnectionConfig(databaseUrl),
    );
    try {
      await applyExecutablePlans(connection, executablePlans);
    } finally {
      await connection.end().catch(() => undefined);
    }
  }

  console.log(
    JSON.stringify(
      {
        applied: options.apply,
        approvedCount: approvedItems.length,
        backupFile: options.backupFile || null,
        databaseUrl: maskDatabaseUrl(databaseUrl),
        executableCount: executablePlans.length,
        input: options.input,
        noopCount: plans.length - executablePlans.length,
        plans,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[repair-amount-bill-business-confirmed] 执行失败:', error);
  process.exitCode = 1;
});
