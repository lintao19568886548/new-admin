import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

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
    databaseUrl: '',
  };

  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`未知参数: ${arg}`);
    }
    const [, key, value] = match;
    if (key === 'database-url') {
      options.databaseUrl = stripWrappingQuotes(value);
      continue;
    }
    throw new Error(`未知参数: ${arg}`);
  }

  return options;
}

function parseDbUrl(rawUrl) {
  return new URL(stripWrappingQuotes(rawUrl));
}

function maskDatabaseUrl(rawUrl) {
  return String(rawUrl || '').replaceAll(
    /:\/\/([^:/?#]+):([^@/?#]+)@/g,
    '://$1:***@',
  );
}

function createConnectionConfig(rawUrl) {
  const url = parseDbUrl(rawUrl);
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

async function runQuery(connection, title, sql, params = []) {
  const rows = await connection.query(sql, params);
  console.log(`\n## ${title}`);
  console.log(JSON.stringify(toPlainRows(rows), null, 2));
}

async function main() {
  const options = parseArgs(normalizeArgv(process.argv.slice(2)));
  const databaseUrl =
    options.databaseUrl || stripWrappingQuotes(process.env.PUBLIC_DATABASE_URL);

  if (!databaseUrl) {
    throw new Error('PUBLIC_DATABASE_URL 未配置，请传 --database-url');
  }

  const connection = await mariadb.createConnection(
    createConnectionConfig(databaseUrl),
  );

  try {
    console.log(
      JSON.stringify(
        {
          databaseUrl: maskDatabaseUrl(databaseUrl),
        },
        null,
        2,
      ),
    );

    await runQuery(
      connection,
      '财务流水按类型/分类汇总',
      `
        SELECT
          transaction_type AS transactionType,
          bill_category AS billCategory,
          COUNT(*) AS count,
          ROUND(SUM(amount), 2) AS amount
        FROM finance
        WHERE is_deleted = 0
        GROUP BY transaction_type, bill_category
        ORDER BY transaction_type, bill_category
      `,
    );

    await runQuery(
      connection,
      '完全重复的财务流水签名 TOP 30',
      `
        SELECT
          bill_name AS billName,
          bill_category AS billCategory,
          transaction_type AS transactionType,
          park_id AS parkId,
          DATE_FORMAT(transaction_time, '%Y-%m-%d %H:%i:%s') AS transactionTime,
          amount,
          remark,
          COUNT(*) AS count
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
        HAVING COUNT(*) > 1
        ORDER BY count DESC, amount DESC
        LIMIT 30
      `,
    );

    await runQuery(
      connection,
      '2026 年财务流水按类型/分类/名称汇总 TOP 30',
      `
        SELECT
          transaction_type AS transactionType,
          bill_category AS billCategory,
          bill_name AS billName,
          COUNT(*) AS count,
          ROUND(SUM(amount), 2) AS amount
        FROM finance
        WHERE is_deleted = 0
          AND transaction_time >= '2026-01-01'
          AND transaction_time < '2027-01-01'
        GROUP BY transaction_type, bill_category, bill_name
        ORDER BY amount DESC
        LIMIT 30
      `,
    );

    await runQuery(
      connection,
      '自动租金支出总量',
      `
        SELECT
          COUNT(*) AS count,
          ROUND(SUM(amount), 2) AS amount,
          MIN(transaction_time) AS minTime,
          MAX(transaction_time) AS maxTime
        FROM finance
        WHERE is_deleted = 0
          AND transaction_type = '支出'
          AND bill_name = '租金支出'
      `,
    );

    await runQuery(
      connection,
      '自动租金支出占 2026 年支出比例',
      `
        SELECT
          ROUND(
            SUM(CASE WHEN bill_name = '租金支出' THEN amount ELSE 0 END),
            2
          ) AS autoRentExpense,
          ROUND(SUM(amount), 2) AS totalExpense,
          ROUND(
            SUM(CASE WHEN bill_name = '租金支出' THEN amount ELSE 0 END)
              / NULLIF(SUM(amount), 0)
              * 100,
            2
          ) AS percent
        FROM finance
        WHERE is_deleted = 0
          AND transaction_type = '支出'
          AND transaction_time >= '2026-01-01'
          AND transaction_time < '2027-01-01'
      `,
    );

    await runQuery(
      connection,
      '排除自动租金后的 2026 年营收口径',
      `
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
      `,
    );

    await runQuery(
      connection,
      '支出型租赁合同按园区汇总 TOP 30',
      `
        SELECT
          rt.park_id AS parkId,
          p.park_name AS parkName,
          COUNT(*) AS tenantCount,
          ROUND(SUM(rt.rental_amount), 2) AS monthlyRent,
          MIN(rt.contract_start) AS minContractStart,
          MAX(rt.contract_end) AS maxContractEnd
        FROM rental_tenant rt
        LEFT JOIN park p ON p.park_id = rt.park_id
        WHERE rt.is_deleted = 0
          AND rt.transaction_type = 0
          AND rt.rental_amount > 0
        GROUP BY rt.park_id, p.park_name
        ORDER BY monthlyRent DESC
        LIMIT 30
      `,
    );

    await runQuery(
      connection,
      '已通过报销汇总',
      `
        SELECT
          COUNT(*) AS reimbursementCount,
          ROUND(COALESCE(SUM(amount), 0), 2) AS reimbursementAmount
        FROM reimbursement
        WHERE is_deleted = 0 AND status = 1
      `,
    );

    await runQuery(
      connection,
      '已通过报销缺少/异常财务支出总量',
      `
        SELECT
          COUNT(*) AS count,
          ROUND(SUM(t.amount), 2) AS amount
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

    await runQuery(
      connection,
      '已通过报销与财务支出不一致 TOP 50',
      `
        SELECT
          r.id AS reimbursementId,
          r.purpose,
          r.amount AS reimbursementAmount,
          r.park_id AS parkId,
          COUNT(f.finance_id) AS financeCount,
          ROUND(COALESCE(SUM(f.amount), 0), 2) AS financeAmount
        FROM reimbursement r
        LEFT JOIN finance f
          ON f.is_deleted = 0
          AND f.transaction_type = '支出'
          AND f.remark = CONCAT('报销 #', r.id)
        WHERE r.is_deleted = 0 AND r.status = 1
        GROUP BY r.id, r.purpose, r.amount, r.park_id
        HAVING financeCount <> 1
          OR ROUND(COALESCE(SUM(f.amount), 0), 2) <> ROUND(r.amount, 2)
        ORDER BY financeCount DESC, reimbursementAmount DESC
        LIMIT 50
      `,
    );

    await runQuery(
      connection,
      '同一个报销生成多条财务支出 TOP 30',
      `
        SELECT
          remark,
          COUNT(*) AS count,
          ROUND(SUM(amount), 2) AS amount
        FROM finance
        WHERE is_deleted = 0
          AND transaction_type = '支出'
          AND remark REGEXP '^报销 #[0-9]+$'
        GROUP BY remark
        HAVING COUNT(*) > 1
        ORDER BY count DESC, amount DESC
        LIMIT 30
      `,
    );

    await runQuery(
      connection,
      '总账单收款与财务收入绑定情况',
      `
        SELECT
          COUNT(*) AS billCount,
          SUM(
            CASE
              WHEN receive_amount > 0 AND receipt_time IS NOT NULL THEN 1
              ELSE 0
            END
          ) AS receiptedBillCount,
          SUM(
            CASE
              WHEN receive_amount > 0
                AND receipt_time IS NOT NULL
                AND finance_id IS NULL THEN 1
              ELSE 0
            END
          ) AS receiptedMissingFinanceCount
        FROM amount_bill
      `,
    );

    await runQuery(
      connection,
      '已收款总账单缺少/异常财务收入总量',
      `
        SELECT
          COUNT(*) AS count,
          ROUND(SUM(b.receive_amount), 2) AS receiptAmount
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

    await runQuery(
      connection,
      '已收款总账单与财务收入不一致 TOP 50',
      `
        SELECT
          b.bill_id AS billId,
          b.project_name AS projectName,
          b.receive_amount AS receiptAmount,
          b.receipt_time AS receiptTime,
          b.finance_id AS financeId,
          f.amount AS financeAmount,
          f.transaction_time AS financeTime,
          f.transaction_type AS financeType,
          f.bill_category AS financeCategory
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
        ORDER BY b.receipt_time DESC
        LIMIT 50
      `,
    );

    await runQuery(
      connection,
      '财务流水来源绑定情况',
      `
        SELECT
          SUM(CASE WHEN ab.bill_id IS NOT NULL THEN 1 ELSE 0 END)
            AS linkedAmountBillFinance,
          SUM(CASE WHEN f.remark REGEXP '^报销 #[0-9]+$' THEN 1 ELSE 0 END)
            AS reimbursementRemarkFinance,
          SUM(CASE WHEN f.bill_name = '租金支出' THEN 1 ELSE 0 END)
            AS autoRentFinance,
          COUNT(*) AS totalFinance
        FROM finance f
        LEFT JOIN amount_bill ab ON ab.finance_id = f.finance_id
        WHERE f.is_deleted = 0
      `,
    );

    await runQuery(
      connection,
      '疑似同一总账单手工重复录入财务收入 TOP 50',
      `
        SELECT
          b.bill_id AS billId,
          b.project_name AS projectName,
          b.receive_amount AS receiptAmount,
          DATE_FORMAT(b.receipt_time, '%Y-%m-%d %H:%i:%s') AS receiptTime,
          b.finance_id AS linkedFinanceId,
          COUNT(f.finance_id) AS matchingFinanceCount,
          GROUP_CONCAT(f.finance_id ORDER BY f.finance_id) AS financeIds
        FROM amount_bill b
        JOIN finance f
          ON f.is_deleted = 0
          AND f.transaction_type = '收入'
          AND f.amount = b.receive_amount
          AND f.transaction_time = b.receipt_time
          AND f.park_id <=> b.park_id
        WHERE b.receive_amount > 0 AND b.receipt_time IS NOT NULL
        GROUP BY
          b.bill_id,
          b.project_name,
          b.receive_amount,
          b.receipt_time,
          b.finance_id
        HAVING COUNT(f.finance_id) > 1
        ORDER BY matchingFinanceCount DESC, receiptAmount DESC
        LIMIT 50
      `,
    );

    await runQuery(
      connection,
      '自动租金支出完全重复 TOP 50',
      `
        SELECT
          remark,
          park_id AS parkId,
          DATE_FORMAT(transaction_time, '%Y-%m-%d %H:%i:%s') AS transactionTime,
          amount,
          COUNT(*) AS count
        FROM finance
        WHERE is_deleted = 0
          AND transaction_type = '支出'
          AND bill_name = '租金支出'
        GROUP BY remark, park_id, transaction_time, amount
        HAVING COUNT(*) > 1
        ORDER BY count DESC, amount DESC
        LIMIT 50
      `,
    );

    await runQuery(
      connection,
      '自动租金支出按园区/月汇总',
      `
        SELECT
          park_id AS parkId,
          DATE_FORMAT(transaction_time, '%Y-%m') AS period,
          COUNT(*) AS count,
          ROUND(SUM(amount), 2) AS amount
        FROM finance
        WHERE is_deleted = 0
          AND transaction_type = '支出'
          AND bill_name = '租金支出'
        GROUP BY park_id, DATE_FORMAT(transaction_time, '%Y-%m')
        ORDER BY period DESC, parkId
        LIMIT 80
      `,
    );
  } finally {
    await connection.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('[diagnose-finance-consistency] 执行失败:', error);
  process.exitCode = 1;
});
