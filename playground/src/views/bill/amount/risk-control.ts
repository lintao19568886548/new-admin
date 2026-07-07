import type { AmountBill } from './data';

export const AMOUNT_BILL_AI_SPLIT_MODE = 'tenant-bill';
export const AMOUNT_BILL_AI_SPLIT_MODE_LABEL = '按客户/租户拆分';
export const AMOUNT_BILL_RECONCILIATION_TOLERANCE = 0.5;

export type AmountBillRiskSeverity = 'error' | 'warning';

export interface AmountBillRiskIssue {
  actual?: number;
  code: string;
  difference?: number;
  expected?: number;
  message: string;
  severity: AmountBillRiskSeverity;
  title: string;
}

export interface AmountBillRiskResult {
  errors: AmountBillRiskIssue[];
  issues: AmountBillRiskIssue[];
  status: 'error' | 'ok' | 'warning';
  warnings: AmountBillRiskIssue[];
}

const STANDARD_FEE_FIELD_LABELS: Array<[keyof AmountBill, string]> = [
  ['eleFee', '电费'],
  ['waterFee', '水费'],
  ['factoryRent', '厂房租金'],
  ['managementFee', '基本管理费'],
  ['garbageFee', '垃圾处理费'],
  ['serviceFee', '服务费'],
  ['invoiceTax', '开票税金'],
  ['penaltyFee', '滞纳金'],
];

const STANDARD_FEE_ITEM_NAMES = new Set([
  '厂房租金',
  '垃圾处理费',
  '垃圾管理费',
  '基本管理费',
  '开票税金',
  '服务费',
  '本月收费金额',
  '水费',
  '滞纳金',
  '电费',
]);

function toAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  return `${roundMoney(value).toFixed(2)} 元`;
}

function sumItemAmount(items: unknown) {
  if (!Array.isArray(items)) {
    return 0;
  }

  let sum = 0;
  for (const item of items) {
    sum += toAmount((item as Record<string, unknown>)?.amount);
  }

  return roundMoney(sum);
}

function isStandardFeeItem(itemName: string) {
  const normalized = itemName.trim();
  if (!normalized) {
    return true;
  }

  if (STANDARD_FEE_ITEM_NAMES.has(normalized)) {
    return true;
  }

  return normalized.includes('厂房租金');
}

function sumExtraFeeItems(extraProjectItem: unknown) {
  const text = String(extraProjectItem || '').trim();
  if (!text) {
    return 0;
  }

  try {
    const items = JSON.parse(text) as Array<{
      itemName?: string;
      value?: unknown;
    }>;
    if (!Array.isArray(items)) {
      return 0;
    }

    let sum = 0;
    for (const item of items) {
      const itemName = String(item?.itemName || '').trim();
      if (!itemName || isStandardFeeItem(itemName)) {
        continue;
      }
      sum += toAmount(item?.value);
    }

    return roundMoney(sum);
  } catch {
    return 0;
  }
}

function pushReconciliationIssue(
  issues: AmountBillRiskIssue[],
  params: {
    actual: number;
    code: string;
    expected: number;
    title: string;
  },
  tolerance: number,
) {
  const actual = roundMoney(params.actual);
  const expected = roundMoney(params.expected);
  const difference = roundMoney(actual - expected);
  const absDifference = Math.abs(difference);

  if (absDifference === 0) {
    return;
  }

  const severity: AmountBillRiskSeverity =
    absDifference > tolerance ? 'error' : 'warning';
  issues.push({
    actual,
    code: params.code,
    difference,
    expected,
    message: `${params.title}不一致：账单金额 ${formatMoney(
      expected,
    )}，校验金额 ${formatMoney(actual)}，差额 ${formatMoney(absDifference)}`,
    severity,
    title: params.title,
  });
}

export function checkAmountBillReconciliation(
  bill: Partial<AmountBill>,
  tolerance = AMOUNT_BILL_RECONCILIATION_TOLERANCE,
): AmountBillRiskResult {
  const issues: AmountBillRiskIssue[] = [];
  const eleDetailAmount = sumItemAmount(bill.eleBills);
  const waterDetailAmount = sumItemAmount(bill.waterBills);

  pushReconciliationIssue(
    issues,
    {
      actual: eleDetailAmount,
      code: 'ele_detail_total_mismatch',
      expected: toAmount(bill.eleFee),
      title: '电费明细合计',
    },
    tolerance,
  );
  pushReconciliationIssue(
    issues,
    {
      actual: waterDetailAmount,
      code: 'water_detail_total_mismatch',
      expected: toAmount(bill.waterFee),
      title: '水费明细合计',
    },
    tolerance,
  );

  let standardFeeTotal = 0;
  for (const [field] of STANDARD_FEE_FIELD_LABELS) {
    standardFeeTotal += toAmount(bill[field]);
  }
  const expectedTotal = roundMoney(
    standardFeeTotal + sumExtraFeeItems(bill.extraProjectItem),
  );

  pushReconciliationIssue(
    issues,
    {
      actual: expectedTotal,
      code: 'total_fee_mismatch',
      expected: toAmount(bill.totalFee),
      title: '费用合计',
    },
    tolerance,
  );

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  let status: AmountBillRiskResult['status'] = 'ok';
  if (errors.length > 0) {
    status = 'error';
  } else if (warnings.length > 0) {
    status = 'warning';
  }

  return {
    errors,
    issues,
    status,
    warnings,
  };
}

export function checkAmountBillRiskWarnings(
  bill: Partial<AmountBill>,
): AmountBillRiskIssue[] {
  const issues: AmountBillRiskIssue[] = [];
  const totalFee = toAmount(bill.totalFee);
  const receiptAmount = toAmount(bill.receiptAmount);
  const factoryRent = toAmount(bill.factoryRent);
  const eleFee = toAmount(bill.eleFee);
  const waterFee = toAmount(bill.waterFee);

  if (totalFee > 0 && totalFee < 500) {
    issues.push({
      code: 'low_total_fee',
      message: `本月收费金额 ${formatMoney(totalFee)}，低于 500 元`,
      severity: 'warning',
      title: '低金额提醒',
    });
  }

  if (factoryRent === 0 && (eleFee > 0 || waterFee > 0)) {
    issues.push({
      code: 'utility_only_bill',
      message: '厂房租金为 0，但存在水电费',
      severity: 'warning',
      title: '仅水电费账单',
    });
  }

  if (receiptAmount > totalFee && totalFee > 0) {
    issues.push({
      code: 'receipt_over_total',
      message: `收款金额 ${formatMoney(receiptAmount)} 超过应收 ${formatMoney(
        totalFee,
      )}`,
      severity: 'warning',
      title: '多收提醒',
    });
  }

  if (receiptAmount === 0) {
    issues.push({
      code: 'no_receipt',
      message: '当前账单收款金额为 0',
      severity: 'warning',
      title: '未收提醒',
    });
  }

  return issues;
}
