import type { AmountBill } from './data';

import { requestClient } from '#/api/request';

const AI_REQUEST_TIMEOUT_MS = 300_000;
const MAX_METER_NAME_LENGTH = 120;
const MAX_NAME_LENGTH = 60;
const MAX_PROJECT_NAME_LENGTH = 120;
const MAX_REMARK_LENGTH = 100;
const TITLE_LIKE_KEYWORDS = [
  '明细',
  '通知单',
  '账单',
  '收费',
  '收款',
  '水电',
  '房租',
  '租金',
];

export interface AmountBillLlmMeterItem {
  currentReading?: null | number | string;
  meterName?: string;
  multiplier?: null | number | string;
  previousReading?: null | number | string;
  remark?: string;
  unitPrice?: null | number | string;
}

export interface AmountBillLlmResult {
  eleFee?: null | number | string;
  eleItems?: AmountBillLlmMeterItem[];
  extraProjectItems?: Array<{
    itemName?: string;
    value?: null | number | string;
  }>;
  factoryRent?: null | number | string;
  garbageFee?: null | number | string;
  invoiceTax?: null | number | string;
  managementFee?: null | number | string;
  parkName?: string;
  penaltyFee?: null | number | string;
  privateBankAccount?: {
    bank?: string;
    name?: string;
    number?: string;
  };
  projectName?: string;
  publicBankAccount?: {
    bank?: string;
    name?: string;
    number?: string;
  };
  receiptAmount?: null | number | string;
  receiptTime?: string;
  remark?: string;
  serviceFee?: null | number | string;
  tenantName?: string;
  totalFee?: null | number | string;
  waterFee?: null | number | string;
  waterItems?: AmountBillLlmMeterItem[];
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const cleaned = String(value).replaceAll(/[^\d.-]/g, '');
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? undefined : num;
}

function parseDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }
  return text;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).replaceAll(/\s+/g, ' ').trim();
}

function clipText(value: unknown, maxLength: number) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.slice(0, maxLength);
}

function looksLikeDocumentTitle(value: unknown) {
  const text = normalizeText(value).replaceAll(/\s+/g, '');
  if (!text) return false;

  return (
    TITLE_LIKE_KEYWORDS.some((keyword) => text.includes(keyword)) &&
    (/[、，,:：]/.test(text) || /\d{4}年|\d+月/.test(text))
  );
}

function sanitizeNameField(
  value: unknown,
  maxLength: number,
  options: { rejectDocumentTitle?: boolean } = {},
) {
  const text = clipText(value, maxLength);
  if (!text) return '';
  if (options.rejectDocumentTitle && looksLikeDocumentTitle(text)) {
    return '';
  }
  return text;
}

function toMeterRows(items: AmountBillLlmMeterItem[] = []) {
  return items
    .map((item) => {
      const meterName = sanitizeNameField(
        item.meterName,
        MAX_METER_NAME_LENGTH,
      );
      if (!meterName) return null;
      return {
        amount: 0,
        currentReading: parseNumber(item.currentReading) ?? 0,
        meterName,
        monthlyUsage: 0,
        multiplier: parseNumber(item.multiplier) ?? 1,
        previousReading: parseNumber(item.previousReading) ?? 0,
        remark: clipText(item.remark, MAX_REMARK_LENGTH),
        totalUsage: 0,
        unitPrice: parseNumber(item.unitPrice) ?? 0,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;
}

function toMeterItemJson(items: AmountBillLlmMeterItem[] = []) {
  return JSON.stringify(
    items
      .map((item) => {
        const meterName = sanitizeNameField(
          item.meterName,
          MAX_METER_NAME_LENGTH,
        );
        if (!meterName) return null;
        const previousReading = parseNumber(item.previousReading) ?? 0;
        const currentReading = parseNumber(item.currentReading) ?? 0;
        const multiplier = parseNumber(item.multiplier) ?? 1;
        const unitPrice = parseNumber(item.unitPrice) ?? 0;
        const remark = clipText(item.remark, MAX_REMARK_LENGTH);
        return {
          amount: { originalText: '0', value: 0 },
          currentReading: {
            originalText: String(item.currentReading ?? currentReading),
            value: currentReading,
          },
          meterName: {
            originalText: meterName,
            value: meterName,
          },
          monthlyUsage: { originalText: '0', value: 0 },
          multiplier: {
            originalText: String(item.multiplier ?? multiplier),
            value: multiplier,
          },
          previousReading: {
            originalText: String(item.previousReading ?? previousReading),
            value: previousReading,
          },
          remark: {
            originalText: remark,
            value: remark,
          },
          totalUsage: { originalText: '0', value: 0 },
          unitPrice: {
            originalText: String(item.unitPrice ?? unitPrice),
            value: unitPrice,
          },
        };
      })
      .filter(Boolean),
  );
}

function normalizeBankAccount(value: any) {
  if (!value || typeof value !== 'object') return undefined;
  const account = {
    bank: String(value.bank || '').trim(),
    name: String(value.name || '').trim(),
    number: String(value.number || '').trim(),
  };
  return Object.values(account).some(Boolean)
    ? JSON.stringify(account)
    : undefined;
}

function normalizeExtraProjectItems(
  items: AmountBillLlmResult['extraProjectItems'],
) {
  if (!Array.isArray(items) || items.length === 0) return undefined;

  const normalized = items
    .map((item) => {
      const itemName = String(item?.itemName || '').trim();
      if (!itemName) return null;
      const parsedValue = parseNumber(item?.value) ?? 0;
      return {
        itemName,
        originalText: String(item?.value ?? parsedValue),
        value: parsedValue,
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? JSON.stringify(normalized) : undefined;
}

export async function analyzeAmountBillExcel(
  file: File,
): Promise<AmountBillLlmResult | null> {
  return requestClient.upload(
    '/llm/amount-bill-analyze',
    { file },
    {
      timeout: AI_REQUEST_TIMEOUT_MS,
    },
  );
}

export function mapLlmResultToAmountBill(
  result: AmountBillLlmResult,
  parkOptions: Array<{ label: string; value: number | string }> = [],
): AmountBill {
  const eleItems = Array.isArray(result.eleItems) ? result.eleItems : [];
  const waterItems = Array.isArray(result.waterItems) ? result.waterItems : [];
  const eleRows = toMeterRows(eleItems);
  const waterRows = toMeterRows(waterItems);

  const rawProjectName = clipText(result.projectName, MAX_PROJECT_NAME_LENGTH);
  const projectName = sanitizeNameField(
    rawProjectName,
    MAX_PROJECT_NAME_LENGTH,
    {
      rejectDocumentTitle: true,
    },
  );
  const fallbackRemarkFromTitle =
    !projectName && looksLikeDocumentTitle(rawProjectName)
      ? rawProjectName
      : '';
  const parkName = sanitizeNameField(result.parkName, MAX_NAME_LENGTH, {
    rejectDocumentTitle: true,
  });
  const matchedPark = parkName
    ? parkOptions.find((park) => String(park.label).trim() === parkName)
    : undefined;
  const parkId = matchedPark ? Number(matchedPark.value) : undefined;

  return {
    eleBills: eleRows,
    eleFee: parseNumber(result.eleFee) ?? 0,
    eleItem: toMeterItemJson(eleItems),
    extraProjectItem: normalizeExtraProjectItems(result.extraProjectItems),
    factoryRent: parseNumber(result.factoryRent) ?? 0,
    garbageFee: parseNumber(result.garbageFee) ?? 0,
    invoiceTax: parseNumber(result.invoiceTax) ?? 0,
    managementFee: parseNumber(result.managementFee) ?? 0,
    parkId: Number.isFinite(parkId) ? parkId : undefined,
    penaltyFee: parseNumber(result.penaltyFee) ?? 0,
    privateBankAccount: normalizeBankAccount(result.privateBankAccount),
    projectName,
    publicBankAccount: normalizeBankAccount(result.publicBankAccount),
    receiptAmount: parseNumber(result.receiptAmount) ?? 0,
    receiptTime: parseDate(result.receiptTime),
    remark: clipText(
      result.remark || fallbackRemarkFromTitle,
      MAX_REMARK_LENGTH,
    ),
    serviceFee: parseNumber(result.serviceFee) ?? 0,
    tenantName: sanitizeNameField(result.tenantName, MAX_NAME_LENGTH, {
      rejectDocumentTitle: true,
    }),
    totalFee: parseNumber(result.totalFee) ?? 0,
    waterBills: waterRows,
    waterFee: parseNumber(result.waterFee) ?? 0,
    waterItem: toMeterItemJson(waterItems),
  };
}
