import type * as ExcelJSTypes from 'exceljs';

import type { AmountBill } from './data';

import { requestClient } from '#/api/request';
import { retryImport } from '#/utils/retry-import';

const AI_REQUEST_TIMEOUT_MS = 420_000;
const MAX_FORMULA_CONTEXT_CHARS = 20_000;
const MAX_FORMULA_ROWS = 200;
const MAX_METER_NAME_LENGTH = 120;
const MAX_NAME_LENGTH = 60;
const MAX_PROJECT_NAME_LENGTH = 120;
const MAX_REMARK_LENGTH = 100;
const MAX_WORKBOOK_TEXT_CHARS = 80_000;
const MAX_WORKBOOK_TEXT_COLUMNS = 24;
const MAX_WORKBOOK_TEXT_ROWS = 800;
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

type ExcelJSModule = typeof ExcelJSTypes;

let excelJSImportPromise: null | Promise<ExcelJSModule> = null;

function loadExcelJS() {
  excelJSImportPromise ??= retryImport(() => import('exceljs'));
  return excelJSImportPromise;
}

export interface AmountBillLlmMeterItem {
  amount?: null | number | string;
  currentReading?: null | number | string;
  meterName?: string;
  monthlyUsage?: null | number | string;
  multiplier?: null | number | string;
  previousReading?: null | number | string;
  remark?: string;
  totalUsage?: null | number | string;
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

export interface AmountBillLlmAnalyzeResult extends AmountBillLlmResult {
  bills?: AmountBillLlmResult[];
}

interface FormulaRow {
  formulas: Partial<
    Record<'amount' | 'monthlyUsage' | 'totalUsage' | 'value', string>
  >;
  label: string;
  rowNumber: number;
  sheetName: string;
  values: string[];
}

interface FormulaContext {
  rows: FormulaRow[];
  summary: string;
  workbookText: string;
}

const FORMULA_FIELD_BY_COLUMN: Record<
  number,
  'amount' | 'monthlyUsage' | 'totalUsage' | 'value'
> = {
  2: 'value',
  4: 'monthlyUsage',
  6: 'totalUsage',
  8: 'amount',
};

function isFormulaText(value: unknown) {
  return String(value ?? '')
    .trim()
    .startsWith('=');
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (isFormulaText(value)) return undefined;
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
  return undefined;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).replaceAll(/\s+/g, ' ').trim();
}

function normalizeFormulaText(value: unknown) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.startsWith('=') ? text : `=${text}`;
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
      const previousReading = parseNumber(item.previousReading) ?? 0;
      const currentReading = parseNumber(item.currentReading) ?? 0;
      const multiplier = parseNumber(item.multiplier) ?? 1;
      const unitPrice = parseNumber(item.unitPrice) ?? 0;
      const monthlyUsage =
        parseNumber(item.monthlyUsage) ?? currentReading - previousReading;
      const totalUsage =
        parseNumber(item.totalUsage) ?? monthlyUsage * multiplier;
      return {
        amount: parseNumber(item.amount) ?? totalUsage * unitPrice,
        currentReading,
        meterName,
        monthlyUsage,
        multiplier,
        previousReading,
        remark: clipText(item.remark, MAX_REMARK_LENGTH),
        totalUsage,
        unitPrice,
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
        const monthlyUsage =
          parseNumber(item.monthlyUsage) ?? currentReading - previousReading;
        const totalUsage =
          parseNumber(item.totalUsage) ?? monthlyUsage * multiplier;
        const amount = parseNumber(item.amount) ?? totalUsage * unitPrice;
        const remark = clipText(item.remark, MAX_REMARK_LENGTH);
        const result: Record<string, any> = {
          currentReading: {
            originalText: String(item.currentReading ?? currentReading),
            value: currentReading,
          },
          meterName: {
            originalText: meterName,
            value: meterName,
          },
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
          unitPrice: {
            originalText: String(item.unitPrice ?? unitPrice),
            value: unitPrice,
          },
        };
        const computedFields = [
          ['monthlyUsage', item.monthlyUsage, monthlyUsage],
          ['totalUsage', item.totalUsage, totalUsage],
          ['amount', item.amount, amount],
        ] as const;
        for (const [field, originalValue, value] of computedFields) {
          const originalText = normalizeText(originalValue);
          if (!originalText) continue;
          result[field] = {
            originalText,
            value,
          };
        }
        return result;
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

function getCellFormula(cell: ExcelJSTypes.Cell) {
  const value = cell.value as any;
  if (!value || typeof value !== 'object') return '';
  return normalizeFormulaText(
    value.formula || value.sharedFormula || (cell as any).formula,
  );
}

function getCellDisplayText(cell: ExcelJSTypes.Cell) {
  const value = cell.value as any;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('result' in value && value.result !== undefined) {
      return normalizeText(value.result);
    }
    if (Array.isArray(value.richText)) {
      return normalizeText(
        value.richText.map((item: any) => item.text).join(''),
      );
    }
    if (value.text !== undefined) {
      return normalizeText(value.text);
    }
    if (value.hyperlink !== undefined && value.text !== undefined) {
      return normalizeText(value.text);
    }
  }
  return normalizeText((cell as any).text || value);
}

function getFormulaRowLabel(values: string[]) {
  return (
    values[0] ||
    values.find((value, index) => index < 3 && Boolean(value)) ||
    ''
  );
}

function buildFormulaContextSummary(rows: FormulaRow[]) {
  if (rows.length === 0) return '';
  const summary = JSON.stringify({
    note: 'Rows with Excel formulas parsed locally. Formula strings start with =.',
    rows: rows.slice(0, MAX_FORMULA_ROWS).map((row) => ({
      formulas: row.formulas,
      label: row.label,
      rowNumber: row.rowNumber,
      sheetName: row.sheetName,
      values: row.values.slice(0, 10),
    })),
  });
  return summary.slice(0, MAX_FORMULA_CONTEXT_CHARS);
}

function appendWorkbookTextLine(lines: string[], line: string) {
  const currentLength = lines.reduce((sum, item) => sum + item.length + 1, 0);
  if (currentLength + line.length + 1 > MAX_WORKBOOK_TEXT_CHARS) {
    return false;
  }
  lines.push(line);
  return true;
}

async function extractFormulaContext(
  file: File,
): Promise<FormulaContext | null> {
  try {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await file.arrayBuffer()) as any);

    const rows: FormulaRow[] = [];
    const workbookTextLines: string[] = [
      `Workbook: ${file.name || 'uploaded.xlsx'}`,
    ];
    let workbookTextRowCount = 0;
    workbook.worksheets.forEach((worksheet) => {
      if (workbookTextRowCount < MAX_WORKBOOK_TEXT_ROWS) {
        appendWorkbookTextLine(
          workbookTextLines,
          `\n# Sheet: ${worksheet.name}`,
        );
      }
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values: string[] = [];
        const formulas: FormulaRow['formulas'] = {};
        const maxColumn = Math.max(
          row.cellCount || row.actualCellCount || 0,
          10,
        );

        for (let columnNumber = 1; columnNumber <= maxColumn; columnNumber++) {
          const cell = row.getCell(columnNumber);
          values[columnNumber - 1] = getCellDisplayText(cell);

          const formula = getCellFormula(cell);
          if (!formula) continue;

          const field = FORMULA_FIELD_BY_COLUMN[columnNumber];
          if (field) {
            formulas[field] = formula;
          }
        }

        if (workbookTextRowCount < MAX_WORKBOOK_TEXT_ROWS) {
          const displayValues = values
            .slice(0, MAX_WORKBOOK_TEXT_COLUMNS)
            .map((value) => normalizeText(value));
          if (displayValues.some(Boolean)) {
            const line = `R${rowNumber}\t${displayValues.join('\t')}`;
            if (appendWorkbookTextLine(workbookTextLines, line)) {
              workbookTextRowCount += 1;
            } else {
              workbookTextRowCount = MAX_WORKBOOK_TEXT_ROWS;
            }
          }
        }

        if (rows.length >= MAX_FORMULA_ROWS) return;
        if (Object.keys(formulas).length === 0) return;

        rows.push({
          formulas,
          label: getFormulaRowLabel(values),
          rowNumber,
          sheetName: worksheet.name,
          values,
        });
      });
    });

    const summary = buildFormulaContextSummary(rows);
    const workbookText = workbookTextLines.join('\n').trim();
    return summary || workbookText ? { rows, summary, workbookText } : null;
  } catch (error) {
    console.warn('Failed to extract Excel formula context:', error);
    return null;
  }
}

function normalizeMatchText(value: unknown) {
  return normalizeText(value).replaceAll(/\s+/g, '').toLowerCase();
}

function findMatchingFormulaRow(
  rows: FormulaRow[],
  label: unknown,
  usedIndexes: Set<number>,
) {
  const normalizedLabel = normalizeMatchText(label);
  if (!normalizedLabel) return undefined;

  const exactIndex = rows.findIndex(
    (row, index) =>
      !usedIndexes.has(index) &&
      normalizeMatchText(row.label) === normalizedLabel,
  );
  if (exactIndex !== -1) {
    usedIndexes.add(exactIndex);
    return rows[exactIndex];
  }

  const fuzzyIndex = rows.findIndex((row, index) => {
    if (usedIndexes.has(index)) return false;
    const rowLabel = normalizeMatchText(row.label);
    return (
      rowLabel.length >= 2 &&
      (rowLabel.includes(normalizedLabel) || normalizedLabel.includes(rowLabel))
    );
  });
  if (fuzzyIndex !== -1) {
    usedIndexes.add(fuzzyIndex);
    return rows[fuzzyIndex];
  }
}

function mergeMeterFormulaRows(
  items: AmountBillLlmMeterItem[] | undefined,
  rows: FormulaRow[],
) {
  if (!Array.isArray(items) || items.length === 0 || rows.length === 0) {
    return items;
  }

  const usedIndexes = new Set<number>();
  return items.map((item) => {
    const formulaRow = findMatchingFormulaRow(
      rows,
      item.meterName,
      usedIndexes,
    );
    if (!formulaRow) return item;

    return {
      ...item,
      amount: formulaRow.formulas.amount || item.amount,
      monthlyUsage: formulaRow.formulas.monthlyUsage || item.monthlyUsage,
      totalUsage: formulaRow.formulas.totalUsage || item.totalUsage,
    };
  });
}

function mergeExtraProjectFormulaRows(
  items: AmountBillLlmResult['extraProjectItems'],
  rows: FormulaRow[],
) {
  if (!Array.isArray(items) || items.length === 0 || rows.length === 0) {
    return items;
  }

  const usedIndexes = new Set<number>();
  return items.map((item) => {
    const formulaRow = findMatchingFormulaRow(
      rows,
      item?.itemName,
      usedIndexes,
    );
    if (!formulaRow?.formulas.value) return item;
    return {
      ...item,
      value: formulaRow.formulas.value,
    };
  });
}

function mergeFormulaContext(
  result: AmountBillLlmAnalyzeResult | null,
  context: FormulaContext | null,
) {
  if (!result || !context?.rows.length) return result;
  if (Array.isArray(result.bills) && result.bills.length > 0) {
    return {
      ...result,
      bills: result.bills.map((bill) => ({
        ...bill,
        eleItems: mergeMeterFormulaRows(bill.eleItems, context.rows),
        extraProjectItems: mergeExtraProjectFormulaRows(
          bill.extraProjectItems,
          context.rows,
        ),
        waterItems: mergeMeterFormulaRows(bill.waterItems, context.rows),
      })),
    };
  }
  return {
    ...result,
    eleItems: mergeMeterFormulaRows(result.eleItems, context.rows),
    extraProjectItems: mergeExtraProjectFormulaRows(
      result.extraProjectItems,
      context.rows,
    ),
    waterItems: mergeMeterFormulaRows(result.waterItems, context.rows),
  };
}

export async function analyzeAmountBillExcel(
  file: File,
): Promise<AmountBillLlmAnalyzeResult | null> {
  const formulaContext = await extractFormulaContext(file);
  const result = await requestClient.upload<AmountBillLlmAnalyzeResult | null>(
    '/llm/amount-bill-analyze',
    {
      file,
      formulaContext: formulaContext?.summary ?? '',
      workbookText: formulaContext?.workbookText ?? '',
    },
    {
      timeout: AI_REQUEST_TIMEOUT_MS,
    },
  );

  return mergeFormulaContext(result, formulaContext);
}

function getLlmBills(result: AmountBillLlmAnalyzeResult) {
  const bills = Array.isArray(result.bills) ? result.bills : [];
  return bills.length > 0 ? bills : [result];
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

export function mapLlmResultToAmountBills(
  result: AmountBillLlmAnalyzeResult,
  parkOptions: Array<{ label: string; value: number | string }> = [],
): AmountBill[] {
  return getLlmBills(result)
    .map((bill) => mapLlmResultToAmountBill(bill, parkOptions))
    .filter((bill) => {
      return Boolean(
        String(bill.tenantName || '').trim() ||
        String(bill.projectName || '').trim() ||
        bill.parkId ||
        Number(bill.totalFee || 0) > 0 ||
        Number(bill.eleFee || 0) > 0 ||
        Number(bill.waterFee || 0) > 0 ||
        (bill.eleBills?.length ?? 0) > 0 ||
        (bill.waterBills?.length ?? 0) > 0,
      );
    });
}
