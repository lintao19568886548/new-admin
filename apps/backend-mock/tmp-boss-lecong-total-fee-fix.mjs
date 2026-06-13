import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import mysql from 'mysql2/promise';

const backendDir = resolve(import.meta.dirname);
const applyChanges = process.argv.includes('--apply');

const targetTotalFees = [
  { receiptAmount: 6439, tenantKeyword: '海腾世家', totalFee: 6439 },
  { receiptAmount: 9753, tenantKeyword: '李帆', totalFee: 9753 },
  { receiptAmount: 10_471.74, tenantKeyword: '李先勇', totalFee: 23_177 },
  { receiptAmount: 22_228.5, tenantKeyword: '李会(3楼', totalFee: 22_228.5 },
  { receiptAmount: 49_416.1, tenantKeyword: '李会(6楼', totalFee: 53_236.5 },
  { receiptAmount: 7173, tenantKeyword: '刘笑萍', totalFee: 7173 },
  { receiptAmount: 17_261, tenantKeyword: '刘笑萍', totalFee: 17_261 },
  { receiptAmount: 49_203, tenantKeyword: '姚东江', totalFee: 49_203 },
  { receiptAmount: 14_085, tenantKeyword: '孔琴', totalFee: 14_085 },
  { receiptAmount: 13_032, tenantKeyword: '衡龙', totalFee: 13_032 },
  { receiptAmount: 8793, tenantKeyword: '陈宇春', totalFee: 8793 },
  { receiptAmount: 9600, tenantKeyword: '赵红健', totalFee: 9601 },
  { receiptAmount: 11_429, tenantKeyword: '慎根林', totalFee: 11_429 },
  { receiptAmount: 7143, tenantKeyword: '朱爱媛', totalFee: 8730 },
  { receiptAmount: 4562, tenantKeyword: '梁志昌', totalFee: 4562 },
  { receiptAmount: 3966, tenantKeyword: '董振文', totalFee: 3966 },
];

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

function compact(value) {
  return String(value || '').replace(/\s+/g, '');
}

function summarize(rows) {
  const totalFee = rows.reduce((sum, item) => sum + cents(item.totalFee), 0);
  const receiptAmount = rows.reduce(
    (sum, item) => sum + cents(item.receiptAmount),
    0,
  );
  const remaining = rows.reduce(
    (sum, item) =>
      sum + Math.max(cents(item.totalFee) - cents(item.receiptAmount), 0),
    0,
  );

  return {
    billCount: rows.length,
    receiptAmount: yuan(receiptAmount),
    remaining: yuan(remaining),
    totalFee: yuan(totalFee),
  };
}

function viewBill(item) {
  return {
    billId: item.billId,
    financeId: item.financeId,
    receiptAmount: Number(item.receiptAmount || 0),
    receiptDate: item.receiptDate,
    tenantName: item.tenantName,
    totalFee: Number(item.totalFee || 0),
  };
}

async function main() {
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
            b.finance_id AS financeId,
            b.project_name AS projectName,
            b.tenant_name AS tenantName,
            b.total_fee AS totalFee,
            b.receive_amount AS receiptAmount,
            DATE_FORMAT(b.receipt_time, '%Y-%m-%d') AS receiptDate
          FROM amount_bill b
          WHERE b.park_id = ?
            AND (
              REPLACE(b.project_name, ' ', '') LIKE '%2026年6月份房租、2026年5月份水电%'
              OR REPLACE(b.project_name, ' ', '') LIKE '%2026年5月份水电、2026年6月份房租%'
            )
          ORDER BY b.bill_id ASC
        `,
        [park.parkId],
      );

      const unmatchedTargets = [];
      const updates = [];
      for (const target of targetTotalFees) {
        const matches = rows.filter(
          (item) =>
            compact(item.tenantName).includes(compact(target.tenantKeyword)) &&
            cents(item.receiptAmount) === cents(target.receiptAmount),
        );
        if (matches.length !== 1) {
          unmatchedTargets.push({
            matchCount: matches.length,
            target,
          });
          continue;
        }
        updates.push({
          bill: matches[0],
          totalFee: target.totalFee,
        });
      }

      const duplicateBillIds = updates
        .map((item) => item.bill.billId)
        .filter((id, index, all) => all.indexOf(id) !== index);
      if (duplicateBillIds.length > 0) {
        throw new Error(`重复匹配账单: ${[...new Set(duplicateBillIds)].join(', ')}`);
      }

      const backupPath = resolve(
        backendDir,
        'backups',
        `boss-lecong-total-fee-${new Date()
          .toISOString()
          .replaceAll(':', '-')
          .replaceAll('.', '-')}.json`,
      );
      writeFileSync(
        backupPath,
        JSON.stringify(
          {
            before: rows.map(viewBill),
            generatedAt: new Date().toISOString(),
            park,
            plannedUpdates: updates.map((item) => ({
              billId: item.bill.billId,
              currentTotalFee: Number(item.bill.totalFee || 0),
              nextTotalFee: item.totalFee,
              receiptAmount: Number(item.bill.receiptAmount || 0),
              tenantName: item.bill.tenantName,
            })),
            summaryBefore: summarize(rows),
            user,
          },
          null,
          2,
        ),
      );

      if (unmatchedTargets.length > 0) {
        throw new Error(
          `存在不能唯一匹配的应收行，未执行更新: ${JSON.stringify(unmatchedTargets)}`,
        );
      }

      if (updates.length !== targetTotalFees.length) {
        throw new Error(
          `匹配数量异常，计划 ${targetTotalFees.length} 条，实际 ${updates.length} 条`,
        );
      }

      if (applyChanges) {
        await db.beginTransaction();
        try {
          for (const update of updates) {
            await db.execute(
              `
                UPDATE amount_bill
                SET total_fee = ?,
                    update_time = NOW()
                WHERE bill_id = ?
              `,
              [update.totalFee, update.bill.billId],
            );
          }
          await db.commit();
        } catch (error) {
          await db.rollback();
          throw error;
        }
      }

      const [afterRows] = await db.query(
        `
          SELECT
            b.bill_id AS billId,
            b.finance_id AS financeId,
            b.tenant_name AS tenantName,
            b.total_fee AS totalFee,
            b.receive_amount AS receiptAmount,
            DATE_FORMAT(b.receipt_time, '%Y-%m-%d') AS receiptDate
          FROM amount_bill b
          WHERE b.bill_id IN (?)
          ORDER BY b.bill_id ASC
        `,
        [updates.map((item) => item.bill.billId)],
      );

      console.log(
        JSON.stringify(
          {
            applyChanges,
            backupPath,
            plannedUpdates: updates.map((item) => ({
              billId: item.bill.billId,
              currentTotalFee: Number(item.bill.totalFee || 0),
              nextTotalFee: item.totalFee,
              receiptAmount: Number(item.bill.receiptAmount || 0),
              tenantName: item.bill.tenantName,
            })),
            summaryAfter: summarize(afterRows),
            summaryBefore: summarize(rows),
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
