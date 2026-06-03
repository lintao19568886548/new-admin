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

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
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

async function queryOne(connection, sql, params = []) {
  const rows = await connection.query(sql, params);
  return rows[0] || {};
}

async function main() {
  const databaseUrl =
    stripWrappingQuotes(process.env.DATABASE_URL) ||
    stripWrappingQuotes(process.env.PUBLIC_DATABASE_URL);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未配置');
  }

  const connection = await mariadb.createConnection(
    createConnectionConfig(databaseUrl),
  );

  try {
    const revenueAfterExcludingAutoRent = await connection.query(`
      SELECT
        transaction_type AS transactionType,
        COUNT(*) AS count,
        ROUND(SUM(amount), 2) AS amount
      FROM finance
      WHERE is_deleted = 0
        AND transaction_time >= '2026-01-01'
        AND transaction_time < '2027-01-01'
        AND NOT (
          transaction_type = '支出'
          AND bill_name = '租金支出'
          AND bill_category = '其他费用'
        )
      GROUP BY transaction_type
      ORDER BY transaction_type
    `);

    const reimbursementMismatch = await queryOne(
      connection,
      `
        SELECT
          COUNT(*) AS count,
          ROUND(COALESCE(SUM(t.amount), 0), 2) AS amount
        FROM (
          SELECT
            r.id,
            r.amount,
            COUNT(f.finance_id) AS financeCount,
            COALESCE(SUM(f.amount), 0) AS financeAmount
          FROM reimbursement r
          LEFT JOIN finance f
            ON f.is_deleted = 0
            AND f.transaction_type = '支出'
            AND f.remark = CONCAT('报销 #', r.id)
          WHERE r.is_deleted = 0 AND r.status = 1
          GROUP BY r.id, r.amount
          HAVING financeCount <> 1
            OR ROUND(COALESCE(SUM(f.amount), 0), 2) <> ROUND(r.amount, 2)
        ) t
      `,
    );

    const amountBillMismatch = await queryOne(
      connection,
      `
        SELECT
          COUNT(*) AS count,
          ROUND(COALESCE(SUM(b.receive_amount), 0), 2) AS amount
        FROM amount_bill b
        LEFT JOIN finance f ON f.finance_id = b.finance_id
        WHERE b.receive_amount > 0
          AND b.receipt_time IS NOT NULL
          AND (
            b.finance_id IS NULL
            OR f.finance_id IS NULL
            OR f.is_deleted <> 0
            OR f.transaction_type <> '收入'
            OR ROUND(f.amount, 2) <> ROUND(b.receive_amount, 2)
          )
      `,
    );

    const duplicateFinance = await queryOne(
      connection,
      `
        SELECT COUNT(*) AS count
        FROM (
          SELECT
            bill_name,
            bill_category,
            transaction_type,
            park_id,
            transaction_time,
            amount,
            remark,
            COUNT(*) AS duplicateCount
          FROM finance
          WHERE is_deleted = 0
          GROUP BY
            bill_name,
            bill_category,
            transaction_type,
            park_id,
            transaction_time,
            amount,
            remark
          HAVING duplicateCount > 1
        ) t
      `,
    );

    const amountBill102 = await queryOne(
      connection,
      `
        SELECT
          b.bill_id AS billId,
          b.receive_amount AS receiptAmount,
          b.finance_id AS financeId,
          f.amount AS financeAmount,
          f.transaction_type AS transactionType
        FROM amount_bill b
        LEFT JOIN finance f ON f.finance_id = b.finance_id
        WHERE b.bill_id = 102
      `,
    );

    const checks = [
      {
        name: '已通过报销与财务支出一致',
        ok: toNumber(reimbursementMismatch.count) === 0,
        value: reimbursementMismatch,
      },
      {
        name: '已收款总账单与财务收入一致',
        ok: toNumber(amountBillMismatch.count) === 0,
        value: amountBillMismatch,
      },
      {
        name: '财务流水无完全重复签名',
        ok: toNumber(duplicateFinance.count) === 0,
        value: duplicateFinance,
      },
      {
        name: '历史账单 102 已绑定财务收入',
        ok:
          toNumber(amountBill102.financeId) > 0 &&
          amountBill102.transactionType === '收入' &&
          toNumber(amountBill102.receiptAmount) ===
            toNumber(amountBill102.financeAmount),
        value: amountBill102,
      },
    ];

    console.log('\n## 排除自动租金后的 2026 年营收口径');
    console.log(
      JSON.stringify(toPlainRows(revenueAfterExcludingAutoRent), null, 2),
    );

    console.log('\n## 验证项');
    for (const check of checks) {
      console.log(
        JSON.stringify(
          {
            name: check.name,
            ok: check.ok,
            value: Object.fromEntries(
              Object.entries(check.value).map(([key, value]) => [
                key,
                toPlainValue(value),
              ]),
            ),
          },
          null,
          2,
        ),
      );
    }

    if (checks.some((check) => !check.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await connection.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('[verify-finance-fixes] 执行失败:', error);
  process.exitCode = 1;
});
