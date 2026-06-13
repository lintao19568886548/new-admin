import { readFileSync } from 'node:fs';

import mysql from 'mysql2/promise';

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
    if (commentIndex !== -1) {
      value = value.slice(0, commentIndex).trim();
    }
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

function parseMariaDbUrl(rawUrl) {
  const url = new URL(rawUrl);
  return {
    database: url.pathname.replace(/^\//, ''),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
  };
}

function addOneDay(dateText) {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

const env = loadEnvFile('.env');
const dbConfig = parseMariaDbUrl(env.DATABASE_URL);
const authorizedParkIds = [
  14, 17, 18, 21, 24, 25, 26, 28, 30, 31, 32, 33, 35, 40, 41,
];

async function queryRange(connection, startDate, endDate) {
  const startTime = `${startDate} 00:00:00`;
  const endExclusive = `${addOneDay(endDate)} 00:00:00`;
  const parkPlaceholders = authorizedParkIds.map(() => '?').join(',');

  const [rows] = await connection.execute(
    `
      SELECT
        finance_id AS financeId,
        bill_name AS billName,
        bill_category AS billCategory,
        transaction_type AS transactionType,
        amount,
        transaction_time AS transactionTime,
        park_id AS parkId
      FROM finance
      WHERE is_deleted = 0
        AND park_id IN (${parkPlaceholders})
        AND transaction_time >= ?
        AND transaction_time < ?
        AND transaction_type IN ('收入', '支出')
      ORDER BY transaction_time ASC, finance_id ASC
    `,
    [...authorizedParkIds, startTime, endExclusive],
  );

  const summary = rows.reduce(
    (acc, row) => {
      const amount = Number(row.amount || 0);
      if (row.transactionType === '收入') acc.income += amount;
      if (row.transactionType === '支出') acc.expense += amount;
      return acc;
    },
    { expense: 0, income: 0 },
  );

  const byTypeAndCategory = new Map();
  for (const row of rows) {
    const key = `${row.transactionType}|${row.billCategory}|${row.billName}`;
    const item =
      byTypeAndCategory.get(key) ||
      {
        amount: 0,
        billCategory: row.billCategory,
        billName: row.billName,
        count: 0,
        transactionType: row.transactionType,
      };
    item.amount += Number(row.amount || 0);
    item.count += 1;
    byTypeAndCategory.set(key, item);
  }

  return {
    detailRows: rows.map((row) => ({
      amount: Number(row.amount || 0),
      billCategory: row.billCategory,
      billName: row.billName,
      financeId: row.financeId,
      parkId: row.parkId,
      transactionTime: row.transactionTime,
      transactionType: row.transactionType,
    })),
    range: `${startDate} ~ ${endDate}`,
    summary: {
      expense: Number(summary.expense.toFixed(2)),
      income: Number(summary.income.toFixed(2)),
      profit: Number((summary.income - summary.expense).toFixed(2)),
    },
    typeCategorySummary: [...byTypeAndCategory.values()].map((item) => ({
      ...item,
      amount: Number(item.amount.toFixed(2)),
    })),
  };
}

const connection = await mysql.createConnection(dbConfig);
try {
  console.log(
    JSON.stringify(
      [
        await queryRange(connection, '2026-06-08', '2026-06-08'),
        await queryRange(connection, '2026-06-01', '2026-06-08'),
      ],
      null,
      2,
    ),
  );
} finally {
  await connection.end();
}
