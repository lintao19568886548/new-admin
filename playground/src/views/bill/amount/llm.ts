import type { AmountBill } from './data';

import * as ExcelJS from 'exceljs';

import { requestClient } from '#/api/request';

const MAX_CHAR_LENGTH = 25_000;
const MAX_ROWS_PER_SHEET = 200;
const AI_REQUEST_TIMEOUT_MS = 120_000;

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

function normalizeCell(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) {
    return cell.toISOString();
  }
  if (typeof cell === 'object') {
    const anyCell = cell as any;
    if (Array.isArray(anyCell.richText)) {
      return anyCell.richText.map((item: any) => item?.text || '').join('');
    }
    if (typeof anyCell.text === 'string') {
      return anyCell.text;
    }
    if (anyCell.result !== undefined && anyCell.result !== null) {
      return String(anyCell.result);
    }
    if (typeof anyCell.formula === 'string' && anyCell.formula.trim()) {
      return `=${anyCell.formula}`;
    }
    if (typeof anyCell.hyperlink === 'string') {
      return String(anyCell.text || anyCell.hyperlink);
    }
  }
  return String(cell);
}

async function extractWorkbookText(file: File): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const fileBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(fileBuffer);

  const blocks: string[] = [];

  for (const worksheet of workbook.worksheets) {
    const rows: string[] = [];
    let captured = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (captured >= MAX_ROWS_PER_SHEET) return;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const cells = values
        .map((cell) => normalizeCell(cell).trim())
        .slice(0, 20);

      if (cells.every((cell) => !cell)) return;
      rows.push(`${rowNumber}\t${cells.join('\t')}`);
      captured += 1;
    });

    if (rows.length > 0) {
      blocks.push(`### 工作表: ${worksheet.name}\n${rows.join('\n')}`);
    }
  }

  const text = blocks.join('\n\n');
  if (!text.trim()) {
    throw new Error('Excel 文件内容为空或无法解析');
  }
  return text.length > MAX_CHAR_LENGTH ? text.slice(0, MAX_CHAR_LENGTH) : text;
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

function toMeterRows(items: AmountBillLlmMeterItem[] = []) {
  return items
    .map((item) => {
      const meterName = String(item.meterName || '').trim();
      if (!meterName) return null;
      return {
        amount: 0,
        currentReading: parseNumber(item.currentReading) ?? 0,
        meterName,
        monthlyUsage: 0,
        multiplier: parseNumber(item.multiplier) ?? 1,
        previousReading: parseNumber(item.previousReading) ?? 0,
        remark: String(item.remark || '').trim(),
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
        const meterName = String(item.meterName || '').trim();
        if (!meterName) return null;
        const previousReading = parseNumber(item.previousReading) ?? 0;
        const currentReading = parseNumber(item.currentReading) ?? 0;
        const multiplier = parseNumber(item.multiplier) ?? 1;
        const unitPrice = parseNumber(item.unitPrice) ?? 0;
        const remark = String(item.remark || '').trim();
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
  const workbookText = await extractWorkbookText(file);
  return requestClient.post(
    '/llm/amount-bill-analyze',
    {
      workbookText,
    },
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

  const parkName = String(result.parkName || '').trim();
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
    projectName: String(result.projectName || '').trim(),
    publicBankAccount: normalizeBankAccount(result.publicBankAccount),
    receiptAmount: parseNumber(result.receiptAmount) ?? 0,
    receiptTime: parseDate(result.receiptTime),
    remark: String(result.remark || '').trim(),
    serviceFee: parseNumber(result.serviceFee) ?? 0,
    tenantName: String(result.tenantName || '').trim(),
    totalFee: parseNumber(result.totalFee) ?? 0,
    waterBills: waterRows,
    waterFee: parseNumber(result.waterFee) ?? 0,
    waterItem: toMeterItemJson(waterItems),
  };
}
