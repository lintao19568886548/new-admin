import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

const REIMBURSEMENT_FINANCE_BILL_CATEGORY = '其他费用';
const REIMBURSEMENT_FINANCE_TRANSACTION_TYPE = '支出';
const AMOUNT_BILL_FINANCE_BILL_CATEGORY = '账单收入';
const AMOUNT_BILL_FINANCE_TRANSACTION_TYPE = '收入';

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
    limit: 50,
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

function reimbursementRemark(id) {
  return `报销 #${id}`;
}

async function findReimbursementMismatches(connection, limit) {
  return connection.query(
    `
      SELECT
        r.id,
        r.purpose,
        r.amount,
        r.park_id AS parkId,
        COALESCE(r.create_time, r.date) AS transactionTime,
        COUNT(f.finance_id) AS financeCount,
        ROUND(COALESCE(SUM(f.amount), 0), 2) AS financeAmount
      FROM reimbursement r
      LEFT JOIN finance f
        ON f.is_deleted = 0
        AND f.transaction_type = ?
        AND f.remark = CONCAT('报销 #', r.id)
      WHERE r.is_deleted = 0 AND r.status = 1
      GROUP BY r.id, r.purpose, r.amount, r.park_id, r.create_time, r.date
      HAVING financeCount = 0
      ORDER BY r.id ASC
      LIMIT ?
    `,
    [REIMBURSEMENT_FINANCE_TRANSACTION_TYPE, limit],
  );
}

async function findAmountBillMismatches(connection, limit) {
  return connection.query(
    `
      SELECT
        b.bill_id AS billId,
        b.project_name AS projectName,
        b.tenant_name AS tenantName,
        b.park_id AS parkId,
        b.receive_amount AS receiptAmount,
        b.receipt_time AS receiptTime,
        b.finance_id AS financeId
      FROM amount_bill b
      LEFT JOIN finance f ON f.finance_id = b.finance_id
      WHERE b.receive_amount > 0
        AND b.receipt_time IS NOT NULL
        AND (
          b.finance_id IS NULL
          OR f.finance_id IS NULL
          OR f.is_deleted <> 0
          OR f.transaction_type <> ?
          OR ROUND(f.amount, 2) <> ROUND(b.receive_amount, 2)
        )
      ORDER BY b.bill_id ASC
      LIMIT ?
    `,
    [AMOUNT_BILL_FINANCE_TRANSACTION_TYPE, limit],
  );
}

async function repairReimbursements(connection, rows) {
  let repaired = 0;

  for (const row of rows) {
    await connection.beginTransaction();
    try {
      const existing = await connection.query(
        `
          SELECT finance_id AS financeId
          FROM finance
          WHERE transaction_type = ? AND remark = ?
          ORDER BY finance_id ASC
          LIMIT 1
        `,
        [REIMBURSEMENT_FINANCE_TRANSACTION_TYPE, reimbursementRemark(row.id)],
      );

      await connection.query(
        existing.length === 0
          ? `
            INSERT INTO finance
              (
                bill_name,
                bill_category,
                amount,
                transaction_type,
                transaction_time,
                remark,
                park_id,
                is_deleted
              )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          `
          : `
            UPDATE finance
            SET
              bill_name = ?,
              bill_category = ?,
              amount = ?,
              transaction_time = ?,
              park_id = ?,
              is_deleted = 0
            WHERE finance_id = ?
          `,
        existing.length === 0
          ? [
              row.purpose,
              REIMBURSEMENT_FINANCE_BILL_CATEGORY,
              row.amount,
              REIMBURSEMENT_FINANCE_TRANSACTION_TYPE,
              row.transactionTime || new Date(),
              reimbursementRemark(row.id),
              row.parkId,
            ]
          : [
              row.purpose,
              REIMBURSEMENT_FINANCE_BILL_CATEGORY,
              row.amount,
              row.transactionTime || new Date(),
              row.parkId,
              existing[0].financeId,
            ],
      );

      await connection.commit();
      repaired += 1;
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    }
  }

  return repaired;
}

async function repairAmountBills(connection, rows) {
  let repaired = 0;

  for (const row of rows) {
    await connection.beginTransaction();
    try {
      let financeId = row.financeId;
      if (financeId) {
        await connection.query(
          `
            UPDATE finance
            SET
              bill_name = ?,
              bill_category = ?,
              amount = ?,
              transaction_type = ?,
              transaction_time = ?,
              remark = ?,
              park_id = ?,
              is_deleted = 0
            WHERE finance_id = ?
          `,
          [
            row.projectName || '未知项目',
            AMOUNT_BILL_FINANCE_BILL_CATEGORY,
            row.receiptAmount,
            AMOUNT_BILL_FINANCE_TRANSACTION_TYPE,
            row.receiptTime,
            row.tenantName,
            row.parkId,
            financeId,
          ],
        );
      } else {
        const result = await connection.query(
          `
            INSERT INTO finance
              (
                bill_name,
                bill_category,
                amount,
                transaction_type,
                transaction_time,
                remark,
                park_id,
                is_deleted
              )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          `,
          [
            row.projectName || '未知项目',
            AMOUNT_BILL_FINANCE_BILL_CATEGORY,
            row.receiptAmount,
            AMOUNT_BILL_FINANCE_TRANSACTION_TYPE,
            row.receiptTime,
            row.tenantName,
            row.parkId,
          ],
        );
        financeId = Number(result.insertId);
      }

      await connection.query(
        'UPDATE amount_bill SET finance_id = ? WHERE bill_id = ?',
        [financeId, row.billId],
      );

      await connection.commit();
      repaired += 1;
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    }
  }

  return repaired;
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
    console.log(
      JSON.stringify(
        {
          apply: options.apply,
          databaseUrl: maskDatabaseUrl(databaseUrl),
          limit: options.limit,
        },
        null,
        2,
      ),
    );

    const reimbursementRows = await findReimbursementMismatches(
      connection,
      options.limit,
    );
    const amountBillRows = await findAmountBillMismatches(
      connection,
      options.limit,
    );

    console.log('\n## 待修复：已通过报销缺财务支出');
    console.log(JSON.stringify(toPlainRows(reimbursementRows), null, 2));
    console.log('\n## 待修复：已收款总账单缺/异常财务收入');
    console.log(JSON.stringify(toPlainRows(amountBillRows), null, 2));

    if (!options.apply) {
      console.log('\n当前为 dry-run，没有写库。确认后追加 --apply 执行修复。');
      return;
    }

    const repairedReimbursements = await repairReimbursements(
      connection,
      reimbursementRows,
    );
    const repairedAmountBills = await repairAmountBills(
      connection,
      amountBillRows,
    );

    console.log(
      JSON.stringify(
        {
          repairedAmountBills,
          repairedReimbursements,
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
  console.error('[repair-finance-consistency] 执行失败:', error);
  process.exitCode = 1;
});
