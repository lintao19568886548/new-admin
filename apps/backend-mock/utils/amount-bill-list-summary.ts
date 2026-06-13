export type AmountBillCollectionStatus =
  | 'overpaid'
  | 'paid'
  | 'partial'
  | 'unpaid';

export interface AmountBillListSummary {
  billCount: number;
  invoiceTax: number;
  overpaidAmount: number;
  receiptAmount: number;
  remainingAmount: number;
  totalFee: number;
}

const COLLECTION_STATUS_LABELS: Record<AmountBillCollectionStatus, string> = {
  overpaid: '多收',
  paid: '已收款',
  partial: '部分收款',
  unpaid: '未收款',
};

function toAmountNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getAmountBillCollectionStatus(bill: {
  receiptAmount?: unknown;
  totalFee?: unknown;
}): AmountBillCollectionStatus {
  const receiptAmount = toAmountNumber(bill.receiptAmount);
  const totalFee = toAmountNumber(bill.totalFee);

  if (receiptAmount <= 0) {
    return 'unpaid';
  }

  if (receiptAmount > totalFee) {
    return 'overpaid';
  }

  if (receiptAmount < totalFee) {
    return 'partial';
  }

  return 'paid';
}

export function enrichAmountBillPaymentInfo<T extends Record<string, any>>(
  bill: T,
): T & {
  collectionStatus: AmountBillCollectionStatus;
  collectionStatusLabel: string;
  overpaidAmount: number;
  remainingAmount: number;
} {
  const totalFee = toAmountNumber(bill.totalFee);
  const receiptAmount = toAmountNumber(bill.receiptAmount);
  const collectionStatus = getAmountBillCollectionStatus({
    receiptAmount,
    totalFee,
  });

  return {
    ...bill,
    collectionStatus,
    collectionStatusLabel: COLLECTION_STATUS_LABELS[collectionStatus],
    overpaidAmount: Math.max(receiptAmount - totalFee, 0),
    remainingAmount: Math.max(totalFee - receiptAmount, 0),
  };
}

export function filterAmountBillsByCollectionStatus<
  T extends { collectionStatus?: string },
>(items: T[], collectionStatus?: string): T[] {
  if (!collectionStatus || collectionStatus === 'all') {
    return items;
  }

  if (collectionStatus === 'unreceived') {
    return items.filter((item) =>
      ['partial', 'unpaid'].includes(String(item.collectionStatus || '')),
    );
  }

  return items.filter((item) => item.collectionStatus === collectionStatus);
}

export function buildAmountBillListSummary(
  items: Array<{
    invoiceTax?: unknown;
    overpaidAmount?: unknown;
    receiptAmount?: unknown;
    remainingAmount?: unknown;
    totalFee?: unknown;
  }>,
): AmountBillListSummary {
  const summary: AmountBillListSummary = {
    billCount: 0,
    invoiceTax: 0,
    overpaidAmount: 0,
    receiptAmount: 0,
    remainingAmount: 0,
    totalFee: 0,
  };

  for (const item of items) {
    summary.billCount += 1;
    summary.invoiceTax += toAmountNumber(item.invoiceTax);
    summary.overpaidAmount += toAmountNumber(item.overpaidAmount);
    summary.receiptAmount += toAmountNumber(item.receiptAmount);
    summary.remainingAmount += toAmountNumber(item.remainingAmount);
    summary.totalFee += toAmountNumber(item.totalFee);
  }

  return {
    billCount: summary.billCount,
    invoiceTax: roundAmount(summary.invoiceTax),
    overpaidAmount: roundAmount(summary.overpaidAmount),
    receiptAmount: roundAmount(summary.receiptAmount),
    remainingAmount: roundAmount(summary.remainingAmount),
    totalFee: roundAmount(summary.totalFee),
  };
}
