import { describe, expect, it } from 'vitest';

import {
  buildAmountBillListSummary,
  enrichAmountBillPaymentInfo,
  filterAmountBillsByCollectionStatus,
} from '../amount-bill-list-summary';

describe('amount bill list summary', () => {
  it('classifies payment status and totals filtered bills', () => {
    const bills = [
      enrichAmountBillPaymentInfo({
        billId: 1,
        invoiceTax: 10,
        receiptAmount: 0,
        totalFee: 100,
      }),
      enrichAmountBillPaymentInfo({
        billId: 2,
        invoiceTax: 20,
        receiptAmount: 60,
        totalFee: 100,
      }),
      enrichAmountBillPaymentInfo({
        billId: 3,
        invoiceTax: 30,
        receiptAmount: 100,
        totalFee: 100,
      }),
      enrichAmountBillPaymentInfo({
        billId: 4,
        invoiceTax: 40,
        receiptAmount: 130,
        totalFee: 100,
      }),
    ];

    expect(bills.map((bill) => bill.collectionStatus)).toEqual([
      'unpaid',
      'partial',
      'paid',
      'overpaid',
    ]);

    const filteredBills = filterAmountBillsByCollectionStatus(bills, 'partial');
    expect(filteredBills.map((bill) => bill.billId)).toEqual([2]);
    const unreceivedBills = filterAmountBillsByCollectionStatus(
      bills,
      'unreceived',
    );
    expect(unreceivedBills.map((bill) => bill.billId)).toEqual([1, 2]);
    expect(buildAmountBillListSummary(bills)).toEqual({
      billCount: 4,
      invoiceTax: 100,
      overpaidAmount: 30,
      receiptAmount: 290,
      remainingAmount: 140,
      totalFee: 400,
    });
  });
});
