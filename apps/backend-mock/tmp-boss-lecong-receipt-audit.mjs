import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import mysql from 'mysql2/promise';

const backendDir = resolve(import.meta.dirname);
const applyChanges = process.argv.includes('--apply');

const expectedRows = [
  { tenantKeyword: '海腾世家', receiptAmount: 6439, receiptDate: '2026-05-11' },
  { tenantKeyword: '李帆', receiptAmount: 9753, receiptDate: '2026-05-10' },
  { tenantKeyword: '李先勇', receiptAmount: 10471.74, receiptDate: '2026-05-10' },
  { tenantKeyword: '李会', receiptAmount: 71644.6, receiptDate: '2026-05-09' },
  { tenantKeyword: '刘笑萍', receiptAmount: 24434, receiptDate: '2026-05-15' },
  { tenantKeyword: '姚东江', receiptAmount: 49203, receiptDate: '2026-05-09' },
  { tenantKeyword: '孔琴', receiptAmount: 14085, receiptDate: '2026-05-09' },
  { tenantKeyword: '衡龙', receiptAmount: 13032, receiptDate: '2026-05-05' },
  { tenantKeyword: '陈宇春', receiptAmount: 8793, receiptDate: '2026-05-09' },
  { tenantKeyword: '赵红健', receiptAmount: 9600, receiptDate: '2026-06-02' },
  { tenantKeyword: '慎根林', receiptAmount: 11429, receiptDate: '2026-05-10' },
  { tenantKeyword: '朱爱媛', receiptAmount: 7143, receiptDate: '2026-05-09' },
  { tenantKeyword: '梁志昌', receiptAmount: 4562, receiptDate: '2026-05-10' },
  { tenantKeyword: '董振文', receiptAmount: 3966, receiptDate: '2026-05-10' },
];

const manualBillSplits = {
  李会: [
    { receiptAmount: 22_228.5, tenantKeyword: '3楼' },
    { receiptAmount: 49_416.1, tenantKeyword: '6楼' },
  ],
};

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
  if (!dbName) return rawUrl;
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

function toSqlDateTime(date) {
  return `${date} 00:00:00`;
}

function summarizeBills(rows) {
  return {
    billCount: rows.length,
    receiptAmount: yuan(
      rows.reduce((sum, item) => sum + cents(item.receiptAmount), 0),
    ),
    totalFee: yuan(rows.reduce((sum, item) => sum + cents(item.totalFee), 0)),
  };
}

function billView(item) {
  return {
    billId: item.billId,
    financeId: item.financeId,
    projectName: item.projectName,
    receiptAmount: Number(item.receiptAmount || 0),
    receiptTime: item.receiptTime,
    tenantName: item.tenantName,
    totalFee: Number(item.totalFee || 0),
  };
}

function selectBillsForExpectedRow(row, candidates) {
  const normalized = row.tenantKeyword;
  const rows = candidates.filter((item) => item.tenantName?.includes(normalized));
  const manualSplits = manualBillSplits[normalized];
  if (manualSplits) {
    const targetUpdates = [];
    for (const split of manualSplits) {
      const matchedRows = rows.filter((item) =>
        compact(item.tenantName).includes(compact(split.tenantKeyword)),
      );
      if (matchedRows.length !== 1) {
        return {
          reason: 'manual split needs exact one bill per split',
          rows,
          targetUpdates: [],
        };
      }
      targetUpdates.push({
        bill: matchedRows[0],
        receiptAmount: split.receiptAmount,
        receiptDate: row.receiptDate,
      });
    }

    const splitTotal = targetUpdates.reduce(
      (sum, item) => sum + cents(item.receiptAmount),
      0,
    );
    if (splitTotal !== cents(row.receiptAmount)) {
      return {
        reason: 'manual split total mismatch',
        rows,
        targetUpdates: [],
      };
    }

    return {
      reason: 'manual split by boss merged row',
      rows,
      targetUpdates,
    };
  }

  const currentReceiptTotal = rows.reduce(
    (sum, item) => sum + cents(item.receiptAmount),
    0,
  );
  const expectedTotal = cents(row.receiptAmount);

  if (rows.length === 1) {
    return {
      reason: 'single tenant bill',
      rows,
      targetUpdates: [
        {
          bill: rows[0],
          receiptAmount: row.receiptAmount,
          receiptDate: row.receiptDate,
        },
      ],
    };
  }

  if (rows.length > 1 && currentReceiptTotal === expectedTotal) {
    return {
      reason: 'multiple bills already total expected amount',
      rows,
      targetUpdates: rows.map((bill) => ({
        bill,
        receiptAmount: Number(bill.receiptAmount || 0),
        receiptDate: row.receiptDate,
      })),
    };
  }

  if (rows.length > 1) {
    const zeroReceiptRows = rows.filter((item) => cents(item.receiptAmount) === 0);
    const currentNonZeroTotal = rows
      .filter((item) => cents(item.receiptAmount) > 0)
      .reduce((sum, item) => sum + cents(item.receiptAmount), 0);
    const missingTotal = expectedTotal - currentNonZeroTotal;
    const exactZeroBill = zeroReceiptRows.find(
      (item) => cents(item.totalFee) === missingTotal,
    );

    if (exactZeroBill) {
      return {
        reason: 'multiple bills with one exact missing zero-receipt bill',
        rows,
        targetUpdates: [
          ...rows
            .filter((item) => cents(item.receiptAmount) > 0)
            .map((bill) => ({
              bill,
              receiptAmount: Number(bill.receiptAmount || 0),
              receiptDate: row.receiptDate,
            })),
          {
            bill: exactZeroBill,
            receiptAmount: yuan(missingTotal),
            receiptDate: row.receiptDate,
          },
        ],
      };
    }
  }

  return {
    reason: 'needs manual mapping',
    rows,
    targetUpdates: [],
  };
}

async function main() {
  const env = loadEnvFile(resolve(backendDir, '.env'));
  const centerDb = await mysql.createConnection(parseDbUrl(env.CENTER_DATABASE_URL));
  try {
    const [users] = await centerDb.execute(
      `
        SELECT u.id, u.username, u.customer_type AS customerId, c.db_name AS dbName
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

      const [candidates] = await db.execute(
        `
          SELECT
            b.bill_id AS billId,
            b.finance_id AS financeId,
            b.project_name AS projectName,
            b.tenant_name AS tenantName,
            b.total_fee AS totalFee,
            b.receive_amount AS receiptAmount,
            b.receipt_time AS receiptTime,
            b.factory_rent AS factoryRent,
            b.ele_fee AS eleFee,
            b.water_fee AS waterFee,
            b.invoice_tax AS invoiceTax,
            b.service_fee AS serviceFee,
            b.management_fee AS managementFee,
            b.penalty_fee AS penaltyFee,
            f.amount AS financeAmount,
            f.transaction_time AS financeTime,
            f.is_deleted AS financeDeleted
          FROM amount_bill b
          LEFT JOIN finance f ON f.finance_id = b.finance_id
          WHERE b.park_id = ?
            AND (
              REPLACE(b.project_name, ' ', '') LIKE '%2026年6月份房租、2026年5月份水电%'
              OR REPLACE(b.project_name, ' ', '') LIKE '%2026年5月份水电、2026年6月份房租%'
            )
          ORDER BY b.bill_id ASC
        `,
        [park.parkId],
      );

      const allTargetUpdates = [];
      const audit = expectedRows.map((row) => {
        const selected = selectBillsForExpectedRow(row, candidates);
        allTargetUpdates.push(
          ...selected.targetUpdates.map((item) => ({
            ...item,
            expectedRow: row,
          })),
        );
        return {
          ...row,
          candidates: selected.rows.map(billView),
          candidatesSummary: summarizeBills(selected.rows),
          reason: selected.reason,
          targetUpdates: selected.targetUpdates.map((item) => ({
            billId: item.bill.billId,
            currentReceiptAmount: Number(item.bill.receiptAmount || 0),
            currentReceiptTime: item.bill.receiptTime,
            nextReceiptAmount: item.receiptAmount,
            nextReceiptDate: item.receiptDate,
            projectName: item.bill.projectName,
            tenantName: item.bill.tenantName,
          })),
        };
      });

      const blockedRows = audit.filter((item) => item.targetUpdates.length === 0);
      const duplicateTargetBillIds = allTargetUpdates
        .map((item) => item.bill.billId)
        .filter((id, index, all) => all.indexOf(id) !== index);
      if (duplicateTargetBillIds.length > 0) {
        throw new Error(
          `同一账单被匹配多次: ${[...new Set(duplicateTargetBillIds)].join(', ')}`,
        );
      }

      const backup = {
        audit,
        candidates: candidates.map((item) => ({
          ...billView(item),
          eleFee: Number(item.eleFee || 0),
          factoryRent: Number(item.factoryRent || 0),
          financeAmount: item.financeAmount,
          financeDeleted: item.financeDeleted,
          financeTime: item.financeTime,
          invoiceTax: Number(item.invoiceTax || 0),
          managementFee: Number(item.managementFee || 0),
          penaltyFee: Number(item.penaltyFee || 0),
          serviceFee: Number(item.serviceFee || 0),
          waterFee: Number(item.waterFee || 0),
        })),
        expectedTotal: yuan(
          expectedRows.reduce((sum, item) => sum + cents(item.receiptAmount), 0),
        ),
        generatedAt: new Date().toISOString(),
        park,
        user,
      };

      const backupPath = resolve(
        backendDir,
        'backups',
        `boss-lecong-receipts-${new Date()
          .toISOString()
          .replaceAll(':', '-')
          .replaceAll('.', '-')}.json`,
      );
      writeFileSync(backupPath, JSON.stringify(backup, null, 2));

      if (applyChanges && blockedRows.length > 0) {
        throw new Error(
          `存在不能唯一匹配的行，未执行补录: ${blockedRows
            .map((item) => item.tenantKeyword)
            .join(', ')}`,
        );
      }

      const applied = [];
      if (applyChanges) {
        await db.beginTransaction();
        try {
          for (const update of allTargetUpdates) {
            const bill = update.bill;
            const receiptTime = toSqlDateTime(update.receiptDate);
            const amount = update.receiptAmount;

            let financeId = bill.financeId;
            if (financeId) {
              await db.execute(
                `
                  UPDATE finance
                  SET amount = ?,
                      transaction_time = ?,
                      bill_name = ?,
                      bill_category = '账单收入',
                      transaction_type = '收入',
                      park_id = ?,
                      is_deleted = 0,
                      update_time = NOW()
                  WHERE finance_id = ?
                `,
                [amount, receiptTime, bill.projectName, park.parkId, financeId],
              );
            } else {
              const [insertResult] = await db.execute(
                `
                  INSERT INTO finance (
                    bill_name,
                    bill_category,
                    amount,
                    transaction_type,
                    transaction_time,
                    remark,
                    park_id,
                    status,
                    is_deleted,
                    create_time,
                    update_time
                  )
                  VALUES (?, '账单收入', ?, '收入', ?, ?, ?, 0, 0, NOW(), NOW())
                `,
                [
                  bill.projectName,
                  amount,
                  receiptTime,
                  `账单收款：${bill.tenantName || ''}`,
                  park.parkId,
                ],
              );
              financeId = insertResult.insertId;
            }

            await db.execute(
              `
                UPDATE amount_bill
                SET receive_amount = ?,
                    receipt_time = ?,
                    finance_id = ?,
                    update_time = NOW()
                WHERE bill_id = ?
              `,
              [amount, receiptTime, financeId, bill.billId],
            );

            applied.push({
              billId: bill.billId,
              financeId,
              receiptAmount: amount,
              receiptDate: update.receiptDate,
              tenantName: bill.tenantName,
            });
          }
          await db.commit();
        } catch (error) {
          await db.rollback();
          throw error;
        }
      }

      const selectedBillIds = allTargetUpdates.map((item) => item.bill.billId);
      let afterRows = [];
      if (selectedBillIds.length > 0) {
        const [rows] = await db.query(
          `
            SELECT
              b.bill_id AS billId,
              b.project_name AS projectName,
              b.tenant_name AS tenantName,
              b.total_fee AS totalFee,
              b.receive_amount AS receiptAmount,
              b.receipt_time AS receiptTime,
              b.finance_id AS financeId,
              f.amount AS financeAmount,
              f.transaction_time AS financeTime
            FROM amount_bill b
            LEFT JOIN finance f ON f.finance_id = b.finance_id
            WHERE b.bill_id IN (?)
            ORDER BY b.bill_id ASC
          `,
          [selectedBillIds],
        );
        afterRows = rows;
      }

      console.log(
        JSON.stringify(
          {
            applied,
            applyChanges,
            audit,
            backupPath,
            blockedRows: blockedRows.map((item) => item.tenantKeyword),
            expectedTotal: backup.expectedTotal,
            matchedSummaryAfter: summarizeBills(afterRows),
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
