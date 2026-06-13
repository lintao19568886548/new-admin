import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');
const defaultOutputDir = path.resolve(backendMockDir, 'reports');

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
    databaseUrl: '',
    limit: 50,
    outputDir: '',
  };

  for (const arg of argv.filter((item) => item !== '--')) {
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

    if (key === 'output-dir') {
      const outputDir = stripWrappingQuotes(value);
      options.outputDir =
        outputDir === 'default'
          ? outputDir
          : path.resolve(process.cwd(), outputDir);
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

function buildReportFileName() {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  return `amount-bill-anomalies-${timestamp}.json`;
}

async function queryCount(connection, sql, params = []) {
  const rows = await connection.query(sql, params);
  return Number(rows[0]?.count || 0);
}

async function collectSection(connection, section, limit) {
  const [count, rows] = await Promise.all([
    queryCount(connection, section.countSql, section.params || []),
    connection.query(`${section.sampleSql}\nLIMIT ?`, [
      ...(section.params || []),
      limit,
    ]),
  ]);

  return {
    count,
    key: section.key,
    rows: toPlainRows(rows),
    title: section.title,
  };
}

function parseJsonArray(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isPercentDisplayOriginalText(value) {
  const text = String(value ?? '').trim();
  return Boolean(text) && text.endsWith('%') && !text.startsWith('=');
}

function hasPercentReferenceLeakFormula(value) {
  const text = String(value ?? '').trim();
  return text.startsWith('=') && /%\$?[A-Z]{1,3}\$?\d+/i.test(text);
}

function hasPercentLiteralFormula(value) {
  const text = String(value ?? '').trim();
  return text.startsWith('=') && /\d+(?:\.\d+)?%/.test(text);
}

function getNestedOriginalTextEntries(bill, source, rawItems) {
  return parseJsonArray(rawItems).flatMap((item, itemIndex) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const rowName =
      item.itemName ||
      item.meterName?.value ||
      item.meterName?.originalText ||
      `第${itemIndex + 1}行`;

    if (
      'originalText' in item &&
      isPercentDisplayOriginalText(item.originalText)
    ) {
      return [
        {
          billId: bill.billId,
          fieldName: 'amount',
          originalText: item.originalText,
          projectName: bill.projectName,
          rowName,
          source,
          tenantName: bill.tenantName,
          value: item.value,
        },
      ];
    }

    return Object.entries(item)
      .filter(([, cell]) => {
        return (
          cell &&
          typeof cell === 'object' &&
          isPercentDisplayOriginalText(cell.originalText)
        );
      })
      .map(([fieldName, cell]) => ({
        billId: bill.billId,
        fieldName,
        originalText: cell.originalText,
        projectName: bill.projectName,
        rowName,
        source,
        tenantName: bill.tenantName,
        value: cell.value,
      }));
  });
}

function getNestedFormulaLeakEntries(bill, source, rawItems) {
  return parseJsonArray(rawItems).flatMap((item, itemIndex) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const rowName =
      item.itemName ||
      item.meterName?.value ||
      item.meterName?.originalText ||
      `第${itemIndex + 1}行`;

    if (
      'originalText' in item &&
      hasPercentReferenceLeakFormula(item.originalText)
    ) {
      return [
        {
          billId: bill.billId,
          fieldName: 'amount',
          originalText: item.originalText,
          projectName: bill.projectName,
          rowName,
          source,
          tenantName: bill.tenantName,
          value: item.value,
        },
      ];
    }

    return Object.entries(item)
      .filter(([, cell]) => {
        return (
          cell &&
          typeof cell === 'object' &&
          hasPercentReferenceLeakFormula(cell.originalText)
        );
      })
      .map(([fieldName, cell]) => ({
        billId: bill.billId,
        fieldName,
        originalText: cell.originalText,
        projectName: bill.projectName,
        rowName,
        source,
        tenantName: bill.tenantName,
        value: cell.value,
      }));
  });
}

function getNestedPercentFormulaEntries(bill, source, rawItems) {
  return parseJsonArray(rawItems).flatMap((item, itemIndex) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const rowName =
      item.itemName ||
      item.meterName?.value ||
      item.meterName?.originalText ||
      `第${itemIndex + 1}行`;

    if ('originalText' in item && hasPercentLiteralFormula(item.originalText)) {
      return [
        {
          billId: bill.billId,
          fieldName: 'amount',
          originalText: item.originalText,
          projectName: bill.projectName,
          rowName,
          source,
          tenantName: bill.tenantName,
          value: item.value,
        },
      ];
    }

    return Object.entries(item)
      .filter(([, cell]) => {
        return (
          cell &&
          typeof cell === 'object' &&
          hasPercentLiteralFormula(cell.originalText)
        );
      })
      .map(([fieldName, cell]) => ({
        billId: bill.billId,
        fieldName,
        originalText: cell.originalText,
        projectName: bill.projectName,
        rowName,
        source,
        tenantName: bill.tenantName,
        value: cell.value,
      }));
  });
}

async function collectOriginalTextPercentPollution(connection, limit) {
  const bills = await connection.query(`
    SELECT
      bill_id AS billId,
      project_name AS projectName,
      tenant_name AS tenantName,
      ele_item AS eleItem,
      water_item AS waterItem,
      project_amount_item AS extraProjectItem
    FROM amount_bill
    WHERE ele_item IS NOT NULL
      OR water_item IS NOT NULL
      OR project_amount_item IS NOT NULL
    ORDER BY bill_id DESC
  `);

  const rows = toPlainRows(bills).flatMap((bill) => [
    ...getNestedOriginalTextEntries(bill, 'eleItem', bill.eleItem),
    ...getNestedOriginalTextEntries(bill, 'waterItem', bill.waterItem),
    ...getNestedOriginalTextEntries(
      bill,
      'extraProjectItem',
      bill.extraProjectItem,
    ),
  ]);

  return {
    count: rows.length,
    key: 'originalTextPercentPollution',
    rows: rows.slice(0, limit),
    title: '金额 originalText 保存了百分比展示值',
  };
}

async function collectMalformedFormulaOriginalText(connection, limit) {
  const bills = await connection.query(`
    SELECT
      bill_id AS billId,
      project_name AS projectName,
      tenant_name AS tenantName,
      ele_item AS eleItem,
      water_item AS waterItem,
      project_amount_item AS extraProjectItem
    FROM amount_bill
    WHERE ele_item IS NOT NULL
      OR water_item IS NOT NULL
      OR project_amount_item IS NOT NULL
    ORDER BY bill_id DESC
  `);

  const rows = toPlainRows(bills).flatMap((bill) => [
    ...getNestedFormulaLeakEntries(bill, 'eleItem', bill.eleItem),
    ...getNestedFormulaLeakEntries(bill, 'waterItem', bill.waterItem),
    ...getNestedFormulaLeakEntries(
      bill,
      'extraProjectItem',
      bill.extraProjectItem,
    ),
  ]);

  return {
    count: rows.length,
    key: 'malformedFormulaOriginalText',
    rows: rows.slice(0, limit),
    title: '金额公式 originalText 疑似粘入多余单元格引用',
  };
}

async function collectPercentFormulaOriginalText(connection, limit) {
  const bills = await connection.query(`
    SELECT
      bill_id AS billId,
      project_name AS projectName,
      tenant_name AS tenantName,
      ele_item AS eleItem,
      water_item AS waterItem,
      project_amount_item AS extraProjectItem
    FROM amount_bill
    WHERE ele_item IS NOT NULL
      OR water_item IS NOT NULL
      OR project_amount_item IS NOT NULL
    ORDER BY bill_id DESC
  `);

  const rows = toPlainRows(bills).flatMap((bill) => [
    ...getNestedPercentFormulaEntries(bill, 'eleItem', bill.eleItem),
    ...getNestedPercentFormulaEntries(bill, 'waterItem', bill.waterItem),
    ...getNestedPercentFormulaEntries(
      bill,
      'extraProjectItem',
      bill.extraProjectItem,
    ),
  ]);

  return {
    count: rows.length,
    key: 'percentFormulaOriginalText',
    rows: rows.slice(0, limit),
    title: '金额公式 originalText 包含百分号字面量',
  };
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

  const sections = [
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill
        WHERE COALESCE(receive_amount, 0) <= 0
          AND receipt_time IS NOT NULL
      `,
      key: 'unpaidWithReceiptTime',
      sampleSql: `
        SELECT
          bill_id AS billId,
          project_name AS projectName,
          tenant_name AS tenantName,
          receive_amount AS receiptAmount,
          total_fee AS totalFee,
          receipt_time AS receiptTime
        FROM amount_bill
        WHERE COALESCE(receive_amount, 0) <= 0
          AND receipt_time IS NOT NULL
        ORDER BY receipt_time DESC, bill_id DESC
      `,
      title: '未收款但有收款时间',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill
        WHERE COALESCE(receive_amount, 0) > 0
          AND receipt_time IS NULL
      `,
      key: 'paidWithoutReceiptTime',
      sampleSql: `
        SELECT
          bill_id AS billId,
          project_name AS projectName,
          tenant_name AS tenantName,
          receive_amount AS receiptAmount,
          total_fee AS totalFee
        FROM amount_bill
        WHERE COALESCE(receive_amount, 0) > 0
          AND receipt_time IS NULL
        ORDER BY bill_id DESC
      `,
      title: '有收款金额但无收款时间',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill
        WHERE COALESCE(receive_amount, 0) > COALESCE(total_fee, 0)
      `,
      key: 'receiptOverTotal',
      sampleSql: `
        SELECT
          bill_id AS billId,
          project_name AS projectName,
          tenant_name AS tenantName,
          receive_amount AS receiptAmount,
          total_fee AS totalFee,
          ROUND(COALESCE(receive_amount, 0) - COALESCE(total_fee, 0), 2)
            AS overpaidAmount,
          receipt_time AS receiptTime
        FROM amount_bill
        WHERE COALESCE(receive_amount, 0) > COALESCE(total_fee, 0)
        ORDER BY overpaidAmount DESC, bill_id DESC
      `,
      title: '收款金额大于应收金额',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill b
        LEFT JOIN finance f ON f.finance_id = b.finance_id
        WHERE COALESCE(b.receive_amount, 0) > 0
          AND b.receipt_time IS NOT NULL
          AND (
            b.finance_id IS NULL
            OR f.finance_id IS NULL
            OR f.is_deleted <> 0
            OR f.transaction_type <> '收入'
            OR f.bill_category <> '账单收入'
            OR ROUND(COALESCE(f.amount, 0), 2)
              <> ROUND(COALESCE(b.receive_amount, 0), 2)
            OR DATE(f.transaction_time) <> DATE(b.receipt_time)
          )
      `,
      key: 'financeMismatch',
      sampleSql: `
        SELECT
          b.bill_id AS billId,
          b.project_name AS projectName,
          b.tenant_name AS tenantName,
          b.receive_amount AS receiptAmount,
          b.receipt_time AS receiptTime,
          b.finance_id AS financeId,
          f.amount AS financeAmount,
          f.transaction_time AS financeTransactionTime,
          f.transaction_type AS financeTransactionType,
          f.bill_category AS financeBillCategory,
          f.is_deleted AS financeDeleted
        FROM amount_bill b
        LEFT JOIN finance f ON f.finance_id = b.finance_id
        WHERE COALESCE(b.receive_amount, 0) > 0
          AND b.receipt_time IS NOT NULL
          AND (
            b.finance_id IS NULL
            OR f.finance_id IS NULL
            OR f.is_deleted <> 0
            OR f.transaction_type <> '收入'
            OR f.bill_category <> '账单收入'
            OR ROUND(COALESCE(f.amount, 0), 2)
              <> ROUND(COALESCE(b.receive_amount, 0), 2)
            OR DATE(f.transaction_time) <> DATE(b.receipt_time)
          )
        ORDER BY b.bill_id DESC
      `,
      title: '已收款账单与财务流水不一致',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM ele_bill
        WHERE TRIM(meter_name) = '合计'
      `,
      key: 'eleTotalRows',
      sampleSql: `
        SELECT
          ele_id AS eleId,
          bill_id AS billId,
          meter_name AS meterName,
          amount
        FROM ele_bill
        WHERE TRIM(meter_name) = '合计'
        ORDER BY bill_id DESC, ele_id DESC
      `,
      title: '电费明细保存了合计行',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM water_bill
        WHERE TRIM(meter_name) = '合计'
      `,
      key: 'waterTotalRows',
      sampleSql: `
        SELECT
          water_id AS waterId,
          bill_id AS billId,
          meter_name AS meterName,
          amount
        FROM water_bill
        WHERE TRIM(meter_name) = '合计'
        ORDER BY bill_id DESC, water_id DESC
      `,
      title: '水费明细保存了合计行',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill
        WHERE TRIM(COALESCE(project_name, '')) = ''
          OR TRIM(COALESCE(tenant_name, '')) = ''
          OR COALESCE(total_fee, 0) <= 0
      `,
      key: 'emptyOrZeroBills',
      sampleSql: `
        SELECT
          bill_id AS billId,
          project_name AS projectName,
          tenant_name AS tenantName,
          total_fee AS totalFee,
          receive_amount AS receiptAmount,
          create_time AS createTime
        FROM amount_bill
        WHERE TRIM(COALESCE(project_name, '')) = ''
          OR TRIM(COALESCE(tenant_name, '')) = ''
          OR COALESCE(total_fee, 0) <= 0
        ORDER BY bill_id DESC
      `,
      title: '空项目/空租户/零金额账单',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill
        WHERE (
            project_amount_item IS NULL
            OR TRIM(project_amount_item) = ''
            OR TRIM(project_amount_item) = '[]'
          )
          AND ABS(
            ROUND(COALESCE(total_fee, 0), 2)
            - ROUND(
              COALESCE(ele_fee, 0)
              + COALESCE(water_fee, 0)
              + COALESCE(factory_rent, 0)
              + COALESCE(management_fee, 0)
              + COALESCE(garbage_fee, 0)
              + COALESCE(service_fee, 0)
              + COALESCE(invoice_tax, 0)
              + COALESCE(penalty_fee, 0),
              2
            )
          ) > 0.01
      `,
      key: 'totalFeeComponentMismatch',
      sampleSql: `
        SELECT
          bill_id AS billId,
          project_name AS projectName,
          tenant_name AS tenantName,
          total_fee AS totalFee,
          ROUND(
            COALESCE(ele_fee, 0)
            + COALESCE(water_fee, 0)
            + COALESCE(factory_rent, 0)
            + COALESCE(management_fee, 0)
            + COALESCE(garbage_fee, 0)
            + COALESCE(service_fee, 0)
            + COALESCE(invoice_tax, 0)
            + COALESCE(penalty_fee, 0),
            2
          ) AS componentTotal,
          ROUND(
            COALESCE(total_fee, 0)
            - (
              COALESCE(ele_fee, 0)
              + COALESCE(water_fee, 0)
              + COALESCE(factory_rent, 0)
              + COALESCE(management_fee, 0)
              + COALESCE(garbage_fee, 0)
              + COALESCE(service_fee, 0)
              + COALESCE(invoice_tax, 0)
              + COALESCE(penalty_fee, 0)
            ),
            2
          ) AS diffAmount
        FROM amount_bill
        WHERE (
            project_amount_item IS NULL
            OR TRIM(project_amount_item) = ''
            OR TRIM(project_amount_item) = '[]'
          )
          AND ABS(
            ROUND(COALESCE(total_fee, 0), 2)
            - ROUND(
              COALESCE(ele_fee, 0)
              + COALESCE(water_fee, 0)
              + COALESCE(factory_rent, 0)
              + COALESCE(management_fee, 0)
              + COALESCE(garbage_fee, 0)
              + COALESCE(service_fee, 0)
              + COALESCE(invoice_tax, 0)
              + COALESCE(penalty_fee, 0),
              2
            )
          ) > 0.01
        ORDER BY ABS(diffAmount) DESC, bill_id DESC
      `,
      title: '应收总额与费用项合计不一致',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill b
        LEFT JOIN (
          SELECT
            bill_id,
            ROUND(SUM(COALESCE(amount, 0)), 2) AS detailAmount
          FROM ele_bill
          WHERE TRIM(COALESCE(meter_name, '')) <> '合计'
          GROUP BY bill_id
        ) d ON d.bill_id = b.bill_id
        WHERE ABS(
          ROUND(COALESCE(b.ele_fee, 0), 2)
          - ROUND(COALESCE(d.detailAmount, 0), 2)
        ) > 0.01
      `,
      key: 'eleFeeDetailMismatch',
      sampleSql: `
        SELECT
          b.bill_id AS billId,
          b.project_name AS projectName,
          b.tenant_name AS tenantName,
          b.ele_fee AS eleFee,
          COALESCE(d.detailAmount, 0) AS detailAmount,
          ROUND(
            COALESCE(b.ele_fee, 0) - COALESCE(d.detailAmount, 0),
            2
          ) AS diffAmount
        FROM amount_bill b
        LEFT JOIN (
          SELECT
            bill_id,
            ROUND(SUM(COALESCE(amount, 0)), 2) AS detailAmount
          FROM ele_bill
          WHERE TRIM(COALESCE(meter_name, '')) <> '合计'
          GROUP BY bill_id
        ) d ON d.bill_id = b.bill_id
        WHERE ABS(
          ROUND(COALESCE(b.ele_fee, 0), 2)
          - ROUND(COALESCE(d.detailAmount, 0), 2)
        ) > 0.01
        ORDER BY ABS(diffAmount) DESC, b.bill_id DESC
      `,
      title: '电费总账与电费明细合计不一致',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill b
        LEFT JOIN (
          SELECT
            bill_id,
            ROUND(SUM(COALESCE(amount, 0)), 2) AS detailAmount
          FROM water_bill
          WHERE TRIM(COALESCE(meter_name, '')) <> '合计'
          GROUP BY bill_id
        ) d ON d.bill_id = b.bill_id
        WHERE ABS(
          ROUND(COALESCE(b.water_fee, 0), 2)
          - ROUND(COALESCE(d.detailAmount, 0), 2)
        ) > 0.01
      `,
      key: 'waterFeeDetailMismatch',
      sampleSql: `
        SELECT
          b.bill_id AS billId,
          b.project_name AS projectName,
          b.tenant_name AS tenantName,
          b.water_fee AS waterFee,
          COALESCE(d.detailAmount, 0) AS detailAmount,
          ROUND(
            COALESCE(b.water_fee, 0) - COALESCE(d.detailAmount, 0),
            2
          ) AS diffAmount
        FROM amount_bill b
        LEFT JOIN (
          SELECT
            bill_id,
            ROUND(SUM(COALESCE(amount, 0)), 2) AS detailAmount
          FROM water_bill
          WHERE TRIM(COALESCE(meter_name, '')) <> '合计'
          GROUP BY bill_id
        ) d ON d.bill_id = b.bill_id
        WHERE ABS(
          ROUND(COALESCE(b.water_fee, 0), 2)
          - ROUND(COALESCE(d.detailAmount, 0), 2)
        ) > 0.01
        ORDER BY ABS(diffAmount) DESC, b.bill_id DESC
      `,
      title: '水费总账与水费明细合计不一致',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM amount_bill
        WHERE YEAR(create_time) >= 2026
          AND (
            project_name LIKE '%2024年%'
            OR project_name LIKE '%2023年%'
            OR project_name LIKE '%2022年%'
            OR project_name LIKE '%2021年%'
            OR project_name LIKE '%2020年%'
          )
      `,
      key: 'projectYearOutlier',
      sampleSql: `
        SELECT
          bill_id AS billId,
          project_name AS projectName,
          tenant_name AS tenantName,
          total_fee AS totalFee,
          receive_amount AS receiptAmount,
          create_time AS createTime
        FROM amount_bill
        WHERE YEAR(create_time) >= 2026
          AND (
            project_name LIKE '%2024年%'
            OR project_name LIKE '%2023年%'
            OR project_name LIKE '%2022年%'
            OR project_name LIKE '%2021年%'
            OR project_name LIKE '%2020年%'
          )
        ORDER BY create_time DESC, bill_id DESC
      `,
      title: '项目名年份疑似异常',
    },
    {
      countSql: `
        SELECT COUNT(*) AS count
        FROM (
          SELECT
            park_id,
            project_name,
            tenant_name,
            COUNT(*) AS duplicateCount
          FROM amount_bill
          GROUP BY park_id, project_name, tenant_name
          HAVING duplicateCount > 1
        ) t
      `,
      key: 'duplicateTenantProjectBills',
      sampleSql: `
        SELECT
          park_id AS parkId,
          project_name AS projectName,
          tenant_name AS tenantName,
          COUNT(*) AS duplicateCount,
          GROUP_CONCAT(bill_id ORDER BY bill_id DESC) AS billIds,
          ROUND(SUM(COALESCE(total_fee, 0)), 2) AS totalFee
        FROM amount_bill
        GROUP BY park_id, project_name, tenant_name
        HAVING duplicateCount > 1
        ORDER BY duplicateCount DESC, totalFee DESC
      `,
      title: '同园区/同项目/同租户疑似重复账单',
    },
  ];

  try {
    const results = [];
    for (const section of sections) {
      results.push(await collectSection(connection, section, options.limit));
    }
    results.push(
      await collectOriginalTextPercentPollution(connection, options.limit),
      await collectMalformedFormulaOriginalText(connection, options.limit),
      await collectPercentFormulaOriginalText(connection, options.limit),
    );

    const payload = {
      databaseUrl: maskDatabaseUrl(databaseUrl),
      generatedAt: new Date().toISOString(),
      limit: options.limit,
      mode: 'dry-run',
      sections: results,
    };

    if (options.outputDir) {
      const outputDir =
        options.outputDir === 'default' ? defaultOutputDir : options.outputDir;
      await mkdir(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, buildReportFileName());
      await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
      console.log(
        JSON.stringify(
          {
            outputPath,
            sections: results.map((section) => ({
              count: section.count,
              key: section.key,
              title: section.title,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await connection.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('[diagnose-amount-bill-anomalies] 执行失败:', error);
  process.exitCode = 1;
});
