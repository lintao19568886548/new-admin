import {
  parseProjectMonthSortKey,
  parseProjectMonthSortKeys,
} from './amount-bill-project-period';

type FinanceBillNameSortRecord = {
  billName?: null | string;
  createTime?: Date | null;
  financeId?: null | number;
  transactionTime?: Date | null;
};

function normalizeBillName(value: unknown) {
  return String(value || '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function toMonthSortKey(year: number, month: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return year * 12 + month;
}

function getDateMonthSortKey(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return toMonthSortKey(date.getFullYear(), date.getMonth() + 1);
}

function getTime(value: unknown) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function getFinanceBillNameSortKey(record: FinanceBillNameSortRecord) {
  return (
    parseProjectMonthSortKey(record.billName) ??
    getDateMonthSortKey(record.transactionTime) ??
    getDateMonthSortKey(record.createTime)
  );
}

export function compareFinanceBillNameDesc(
  a: FinanceBillNameSortRecord,
  b: FinanceBillNameSortRecord,
) {
  const aParsedBillKeys = parseProjectMonthSortKeys(a.billName);
  const bParsedBillKeys = parseProjectMonthSortKeys(b.billName);
  const aHasBillMonth = aParsedBillKeys.length > 0;
  const bHasBillMonth = bParsedBillKeys.length > 0;

  if (aHasBillMonth !== bHasBillMonth) {
    return aHasBillMonth ? -1 : 1;
  }

  if (aHasBillMonth && bHasBillMonth) {
    const maxLength = Math.max(aParsedBillKeys.length, bParsedBillKeys.length);
    for (let index = 0; index < maxLength; index += 1) {
      const aKey = aParsedBillKeys[index] ?? 0;
      const bKey = bParsedBillKeys[index] ?? 0;
      if (aKey !== bKey) {
        return bKey - aKey;
      }
    }
  }

  if (!aHasBillMonth && !bHasBillMonth) {
    const aFallbackKey = getFinanceBillNameSortKey(a);
    const bFallbackKey = getFinanceBillNameSortKey(b);
    if (
      aFallbackKey !== null &&
      bFallbackKey !== null &&
      aFallbackKey !== bFallbackKey
    ) {
      return bFallbackKey - aFallbackKey;
    }
  }

  const transactionTimeDiff =
    getTime(b.transactionTime) - getTime(a.transactionTime);
  if (transactionTimeDiff !== 0) {
    return transactionTimeDiff;
  }

  const createTimeDiff = getTime(b.createTime) - getTime(a.createTime);
  if (createTimeDiff !== 0) {
    return createTimeDiff;
  }

  return Number(b.financeId || 0) - Number(a.financeId || 0);
}

export function normalizeFinanceBillName(value: unknown) {
  return normalizeBillName(value);
}
