import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

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
    databaseUrl: '',
    limit: 20,
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
    if (key === 'database-url') {
      options.databaseUrl = stripWrappingQuotes(value);
      continue;
    }

    if (key === 'limit') {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new Error('--limit 必须是正整数');
      }
      options.limit = limit;
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
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

function toPlainValue(value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toPlainRows(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, toPlainValue(value)]),
    ),
  );
}

async function queryCount(connection, sql) {
  const rows = await connection.query(sql);
  return Number(rows[0]?.count || 0);
}

async function collectPreview(connection, options) {
  const [unpaidReceiptRows, eleTotalRows, waterTotalRows] = await Promise.all([
    connection.query(
      `
        SELECT
          bill_id AS billId,
          project_name AS projectName,
          tenant_name AS tenantName,
          receive_amount AS receiptAmount,
          receipt_time AS receiptTime
        FROM amount_bill
        WHERE COALESCE(receive_amount, 0) <= 0
          AND receipt_time IS NOT NULL
        ORDER BY receipt_time DESC, bill_id DESC
        LIMIT ?
      `,
      [options.limit],
    ),
    connection.query(
      `
        SELECT
          ele_id AS eleId,
          bill_id AS billId,
          meter_name AS meterName,
          amount
        FROM ele_bill
        WHERE TRIM(meter_name) = '合计'
        ORDER BY bill_id DESC, ele_id DESC
        LIMIT ?
      `,
      [options.limit],
    ),
    connection.query(
      `
        SELECT
          water_id AS waterId,
          bill_id AS billId,
          meter_name AS meterName,
          amount
        FROM water_bill
        WHERE TRIM(meter_name) = '合计'
        ORDER BY bill_id DESC, water_id DESC
        LIMIT ?
      `,
      [options.limit],
    ),
  ]);

  const [unpaidReceiptCount, eleTotalCount, waterTotalCount] =
    await Promise.all([
      queryCount(
        connection,
        `
          SELECT COUNT(*) AS count
          FROM amount_bill
          WHERE COALESCE(receive_amount, 0) <= 0
            AND receipt_time IS NOT NULL
        `,
      ),
      queryCount(
        connection,
        `
          SELECT COUNT(*) AS count
          FROM ele_bill
          WHERE TRIM(meter_name) = '合计'
        `,
      ),
      queryCount(
        connection,
        `
          SELECT COUNT(*) AS count
          FROM water_bill
          WHERE TRIM(meter_name) = '合计'
        `,
      ),
    ]);

  return {
    eleTotalRows: {
      count: eleTotalCount,
      rows: toPlainRows(eleTotalRows),
    },
    unpaidReceiptTimeRows: {
      count: unpaidReceiptCount,
      rows: toPlainRows(unpaidReceiptRows),
    },
    waterTotalRows: {
      count: waterTotalCount,
      rows: toPlainRows(waterTotalRows),
    },
  };
}

async function applySafeRepairs(connection) {
  await connection.beginTransaction();
  try {
    const clearReceiptResult = await connection.query(`
      UPDATE amount_bill
      SET receipt_time = NULL
      WHERE COALESCE(receive_amount, 0) <= 0
        AND receipt_time IS NOT NULL
    `);

    const deleteEleTotalResult = await connection.query(`
      DELETE FROM ele_bill
      WHERE TRIM(meter_name) = '合计'
    `);

    const deleteWaterTotalResult = await connection.query(`
      DELETE FROM water_bill
      WHERE TRIM(meter_name) = '合计'
    `);

    await connection.commit();

    return {
      clearedUnpaidReceiptTime: Number(clearReceiptResult.affectedRows || 0),
      deletedEleTotalRows: Number(deleteEleTotalResult.affectedRows || 0),
      deletedWaterTotalRows: Number(deleteWaterTotalResult.affectedRows || 0),
    };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl =
    options.databaseUrl ||
    stripWrappingQuotes(process.env.DATABASE_URL) ||
    stripWrappingQuotes(process.env.PUBLIC_DATABASE_URL);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未配置，请传 --database-url');
  }

  const connection = await mariadb.createConnection(
    createConnectionConfig(databaseUrl),
  );

  try {
    const preview = await collectPreview(connection, options);
    const result = {
      apply: options.apply,
      databaseUrl: maskDatabaseUrl(databaseUrl),
      generatedAt: new Date().toISOString(),
      limit: options.limit,
      preview,
      repaired: null,
    };

    if (options.apply) {
      result.repaired = await applySafeRepairs(connection);
    }

    console.log(JSON.stringify(result, null, 2));

    if (!options.apply) {
      console.log('\n当前为 dry-run，没有写库。确认后追加 --apply 执行修复。');
    }
  } finally {
    await connection.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('[repair-amount-bill-safe-anomalies] 执行失败:', error);
  process.exitCode = 1;
});
