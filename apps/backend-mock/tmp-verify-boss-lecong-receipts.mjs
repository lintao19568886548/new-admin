import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import mysql from 'mysql2/promise';

const backendDir = resolve(import.meta.dirname);

function loadEnvFile(path) {
  const env = {};
  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    const commentIndex = value.indexOf(' #');
    if (commentIndex !== -1) value = value.slice(0, commentIndex).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseDbUrl(rawUrl) {
  const url = new URL(rawUrl);
  return {
    database: url.pathname.replace(/^\//, ''),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
  };
}

function applyDatabaseName(rawUrl, dbName) {
  const url = new URL(rawUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function yuan(value) {
  return Number((value / 100).toFixed(2));
}

const env = loadEnvFile(resolve(backendDir, '.env'));
const centerDb = await mysql.createConnection(parseDbUrl(env.CENTER_DATABASE_URL));
try {
  const [users] = await centerDb.execute(
    `
      SELECT u.username, c.db_name AS dbName
      FROM user u
      LEFT JOIN customer c ON c.customer_id = u.customer_type
      WHERE u.username = ? OR u.phone = ?
      LIMIT 1
    `,
    ['17770113605', '17770113605'],
  );
  const user = users[0];
  if (!user) throw new Error('未找到登录用户 17770113605');

  const db = await mysql.createConnection(
    parseDbUrl(applyDatabaseName(env.DATABASE_URL, user.dbName)),
  );
  try {
    const [[park]] = await db.execute(
      'SELECT park_id AS parkId, park_name AS parkName FROM park WHERE park_name = ? LIMIT 1',
      ['佛山乐从园区'],
    );
    if (!park) throw new Error('未找到园区 佛山乐从园区');

    const [rows] = await db.execute(
      `
        SELECT
          b.bill_id AS billId,
          b.tenant_name AS tenantName,
          b.project_name AS projectName,
          b.total_fee AS totalFee,
          b.receive_amount AS receiptAmount,
          DATE_FORMAT(b.receipt_time, '%Y-%m-%d') AS receiptDate,
          b.finance_id AS financeId,
          f.amount AS financeAmount,
          DATE_FORMAT(f.transaction_time, '%Y-%m-%d') AS financeDate
        FROM amount_bill b
        LEFT JOIN finance f ON f.finance_id = b.finance_id
        WHERE b.park_id = ?
          AND (
            REPLACE(b.project_name, ' ', '') LIKE '%2026年6月份房租、2026年5月份水电%'
            OR REPLACE(b.project_name, ' ', '') LIKE '%2026年5月份水电、2026年6月份房租%'
          )
        ORDER BY b.tenant_name, b.bill_id
      `,
      [park.parkId],
    );

    const [financeRows] = await db.execute(
      `
        SELECT
          finance_id AS financeId,
          bill_name AS billName,
          amount,
          DATE_FORMAT(transaction_time, '%Y-%m-%d') AS transactionDate
        FROM finance
        WHERE is_deleted = 0
          AND park_id = ?
          AND transaction_type = '收入'
          AND (
            REPLACE(bill_name, ' ', '') LIKE '%2026年6月份房租、2026年5月份水电%'
            OR REPLACE(bill_name, ' ', '') LIKE '%2026年5月份水电、2026年6月份房租%'
          )
        ORDER BY transaction_time, finance_id
      `,
      [park.parkId],
    );

    const receiptAmountCents = rows.reduce(
      (sum, item) => sum + cents(item.receiptAmount),
      0,
    );
    const totalFeeCents = rows.reduce(
      (sum, item) => sum + cents(item.totalFee),
      0,
    );
    const financeAmountCents = financeRows.reduce(
      (sum, item) => sum + cents(item.amount),
      0,
    );

    console.log(
      JSON.stringify(
        {
          billCount: rows.length,
          bills: rows.map((item) => ({
            billId: item.billId,
            financeAmount: Number(item.financeAmount || 0),
            financeDate: item.financeDate,
            financeId: item.financeId,
            projectName: item.projectName,
            receiptAmount: Number(item.receiptAmount || 0),
            receiptDate: item.receiptDate,
            tenantName: item.tenantName,
            totalFee: Number(item.totalFee || 0),
          })),
          financeCount: financeRows.length,
          financeIncome: yuan(financeAmountCents),
          receiptAmount: yuan(receiptAmountCents),
          totalFee: yuan(totalFeeCents),
        },
        null,
        2,
      ),
    );
  } finally {
    await db.end();
  }
} finally {
  await centerDb.end();
}
