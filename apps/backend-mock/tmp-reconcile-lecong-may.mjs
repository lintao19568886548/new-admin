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

function toMonthKey(year, month) {
  return year * 12 + month;
}

function compact(value) {
  return String(value || '').replace(/\s+/g, '');
}

function parseMonthReferences(value) {
  const text = compact(value);
  const refs = [];
  const separated = /((?:19|20)\d{2})[年/.-](0?[1-9]|1[0-2])月?份?/g;
  let match = separated.exec(text);
  while (match) {
    refs.push({
      end: match.index + match[0].length,
      key: toMonthKey(Number(match[1]), Number(match[2])),
      start: match.index,
    });
    match = separated.exec(text);
  }

  const compactPattern = /((?:19|20)\d{2})(0[1-9]|1[0-2])/g;
  match = compactPattern.exec(text);
  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    if (!refs.some((item) => start < item.end && end > item.start)) {
      refs.push({
        end,
        key: toMonthKey(Number(match[1]), Number(match[2])),
        start,
      });
    }
    match = compactPattern.exec(text);
  }
  return refs.sort((a, b) => a.start - b.start);
}

function parseKeywordMonthKeys(value, keywordPattern) {
  const text = compact(value);
  const refs = parseMonthReferences(value);
  const keys = [];
  for (let index = 0; index < refs.length; index += 1) {
    const current = refs[index];
    const next = refs[index + 1];
    const segment = text.slice(current.end, next?.start ?? text.length);
    if (keywordPattern.test(segment)) {
      keys.push(current.key);
    }
  }
  if (keys.length === 0) {
    for (const segment of text.split(/[、,，;；]/)) {
      if (!keywordPattern.test(segment)) continue;
      const segmentKeys = parseMonthReferences(segment).map((item) => item.key);
      if (segmentKeys.length === 1) {
        keys.push(segmentKeys[0]);
      }
    }
  }
  return [...new Set(keys)];
}

function getBelongMonthKey(projectName) {
  const allKeys = [
    ...new Set(parseMonthReferences(projectName).map((item) => item.key)),
  ];
  const utilityKeys = parseKeywordMonthKeys(
    projectName,
    /水费|电费|水[、,，]?电|用水|用电/,
  );
  if (utilityKeys.length === 1) return utilityKeys[0];
  const rentKeys = parseKeywordMonthKeys(projectName, /房租|租金|租赁费/);
  if (rentKeys.length === 1) return rentKeys[0];
  return allKeys.length === 1 ? allKeys[0] : null;
}

function money(value) {
  return Math.round(Number(value || 0) * 100);
}

function yuan(cents) {
  return Number((cents / 100).toFixed(2));
}

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
  if (!user) {
    throw new Error('未找到登录用户 17770113605');
  }

  const customerUrl = applyDatabaseName(env.DATABASE_URL, user.dbName);
  const db = await mysql.createConnection(parseDbUrl(customerUrl));
  try {
    const [[park]] = await db.execute(
      'SELECT park_id AS parkId, park_name AS parkName FROM park WHERE park_name = ? LIMIT 1',
      ['佛山乐从园区'],
    );
    if (!park) {
      throw new Error('未找到园区 佛山乐从园区');
    }

    const [bills] = await db.execute(
      `
        SELECT
          bill_id AS billId,
          project_name AS projectName,
          tenant_name AS tenantName,
          ele_fee AS eleFee,
          water_fee AS waterFee,
          factory_rent AS factoryRent,
          management_fee AS managementFee,
          garbage_fee AS garbageFee,
          service_fee AS serviceFee,
          receive_fee AS receiveFee,
          penalty_fee AS penaltyFee,
          invoice_tax AS invoiceTax,
          total_fee AS totalFee,
          receive_amount AS receiptAmount,
          receipt_time AS receiptTime,
          finance_id AS financeId
        FROM amount_bill
        WHERE park_id = ?
          AND project_name LIKE ?
        ORDER BY bill_id ASC
      `,
      [park.parkId, '%2026%'],
    );

    const targetKey = toMonthKey(2026, 5);
    const normalizedBills = bills
      .map((item) => ({
        ...item,
        belongMonthKey: getBelongMonthKey(item.projectName),
        eleFeeNumber: Number(item.eleFee || 0),
        factoryRentNumber: Number(item.factoryRent || 0),
        garbageFeeNumber: Number(item.garbageFee || 0),
        invoiceTaxNumber: Number(item.invoiceTax || 0),
        managementFeeNumber: Number(item.managementFee || 0),
        penaltyFeeNumber: Number(item.penaltyFee || 0),
        receiveFeeNumber: Number(item.receiveFee || 0),
        receiptAmountNumber: Number(item.receiptAmount || 0),
        serviceFeeNumber: Number(item.serviceFee || 0),
        totalFeeNumber: Number(item.totalFee || 0),
        waterFeeNumber: Number(item.waterFee || 0),
      }));
    const matchedBills = normalizedBills.filter(
      (item) => item.belongMonthKey === targetKey,
    );
    const containsMayBills = normalizedBills.filter((item) =>
      compact(item.projectName).includes('2026年5月'),
    );

    function summarize(rows) {
      const summary = rows.reduce(
        (acc, item) => {
          acc.count += 1;
          acc.eleFee += money(item.eleFeeNumber);
          acc.factoryRent += money(item.factoryRentNumber);
          acc.garbageFee += money(item.garbageFeeNumber);
          acc.invoiceTax += money(item.invoiceTaxNumber);
          acc.managementFee += money(item.managementFeeNumber);
          acc.penaltyFee += money(item.penaltyFeeNumber);
          acc.receiveFee += money(item.receiveFeeNumber);
          acc.receivable += money(item.totalFeeNumber);
          acc.received += money(item.receiptAmountNumber);
          acc.remaining += Math.max(
            money(item.totalFeeNumber) - money(item.receiptAmountNumber),
            0,
          );
          acc.serviceFee += money(item.serviceFeeNumber);
          acc.waterFee += money(item.waterFeeNumber);
          return acc;
        },
        {
          count: 0,
          eleFee: 0,
          factoryRent: 0,
          garbageFee: 0,
          invoiceTax: 0,
          managementFee: 0,
          penaltyFee: 0,
          receiveFee: 0,
          receivable: 0,
          received: 0,
          remaining: 0,
          serviceFee: 0,
          waterFee: 0,
        },
      );
      return {
        billCount: summary.count,
        eleFee: yuan(summary.eleFee),
        factoryRent: yuan(summary.factoryRent),
        garbageFee: yuan(summary.garbageFee),
        invoiceTax: yuan(summary.invoiceTax),
        managementFee: yuan(summary.managementFee),
        penaltyFee: yuan(summary.penaltyFee),
        receiveFee: yuan(summary.receiveFee),
        receivable: yuan(summary.receivable),
        received: yuan(summary.received),
        remaining: yuan(summary.remaining),
        serviceFee: yuan(summary.serviceFee),
        utilityFee: yuan(summary.eleFee + summary.waterFee),
        waterFee: yuan(summary.waterFee),
      };
    }

    function groupByProject(rows) {
      const map = new Map();
      for (const item of rows) {
        const key = item.projectName;
        const current =
          map.get(key) || {
            bills: [],
            projectName: key,
          };
        current.bills.push(item);
        map.set(key, current);
      }
      return [...map.values()].map((group) => ({
        detail: group.bills.map((item) => ({
          billId: item.billId,
          eleFee: item.eleFeeNumber,
          factoryRent: item.factoryRentNumber,
          garbageFee: item.garbageFeeNumber,
          invoiceTax: item.invoiceTaxNumber,
          managementFee: item.managementFeeNumber,
          penaltyFee: item.penaltyFeeNumber,
          receiveFee: item.receiveFeeNumber,
          receiptAmount: item.receiptAmountNumber,
          serviceFee: item.serviceFeeNumber,
          tenantName: item.tenantName,
          totalFee: item.totalFeeNumber,
          waterFee: item.waterFeeNumber,
        })),
        projectName: group.projectName,
        summary: summarize(group.bills),
      }));
    }

    const billSummary = summarize(matchedBills);
    const expectedReceivedCents = money(244_555.34);
    const currentReceivedCents = money(billSummary.received);
    const missingReceivedCents = expectedReceivedCents - currentReceivedCents;
    const zeroReceiptBills = matchedBills.filter(
      (item) => item.receiptAmountNumber === 0,
    );
    const subsetCandidates = [];
    for (let mask = 0; mask < 1 << zeroReceiptBills.length; mask += 1) {
      let sum = 0;
      const items = [];
      for (let index = 0; index < zeroReceiptBills.length; index += 1) {
        if ((mask >> index) & 1) {
          const item = zeroReceiptBills[index];
          sum += money(item.totalFeeNumber);
          items.push({
            billId: item.billId,
            tenantName: item.tenantName,
            totalFee: item.totalFeeNumber,
          });
        }
      }
      const diff = Math.abs(sum - missingReceivedCents);
      if (diff <= 100_000) {
        subsetCandidates.push({
          diff: yuan(diff),
          items,
          sum: yuan(sum),
        });
      }
    }
    subsetCandidates.sort((a, b) => a.diff - b.diff);

    const [financeRows] = await db.execute(
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
          AND park_id = ?
          AND transaction_type = '收入'
          AND transaction_time >= '2026-05-01 00:00:00'
          AND transaction_time < '2026-06-01 00:00:00'
        ORDER BY transaction_time ASC, finance_id ASC
      `,
      [park.parkId],
    );

    const financeIncomeCents = financeRows.reduce(
      (sum, item) => sum + money(item.amount),
      0,
    );

    console.log(
      JSON.stringify(
        {
          billDetail: matchedBills.map((item) => ({
            billId: item.billId,
            financeId: item.financeId,
            projectName: item.projectName,
            receiptAmount: item.receiptAmountNumber,
            receiptTime: item.receiptTime,
            tenantName: item.tenantName,
            totalFee: item.totalFeeNumber,
          })),
          billSummary: {
            billCount: billSummary.billCount,
            receivable: billSummary.receivable,
            received: billSummary.received,
            remaining: billSummary.remaining,
          },
          containsMayProjectGroups: groupByProject(containsMayBills),
          containsMayProjectSummary: summarize(containsMayBills),
          expectedCompare: {
            currentReceived: billSummary.received,
            expectedReceived: 244_555.34,
            missingReceived: yuan(missingReceivedCents),
            nearestZeroReceiptTotalFeeSubsets: subsetCandidates.slice(0, 5),
          },
          financeIncomeDetail: financeRows.map((item) => ({
            amount: Number(item.amount || 0),
            billCategory: item.billCategory,
            billName: item.billName,
            financeId: item.financeId,
            transactionTime: item.transactionTime,
          })),
          financeIncomeSummary: {
            count: financeRows.length,
            income: yuan(financeIncomeCents),
          },
          park,
          user,
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
