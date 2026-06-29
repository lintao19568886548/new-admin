import { describe, expect, it } from 'vitest';

import {
  buildAmountBillListSummary,
  enrichAmountBillPaymentInfo,
  filterAmountBillsByCollectionStatus,
  getAmountBillSummaryBalanceDifference,
  isAmountBillSummaryBalanced,
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
      balanceDifference: 0,
      billCount: 4,
      invoiceTax: 100,
      isBalanced: true,
      overpaidAmount: 30,
      receiptAmount: 290,
      remainingAmount: 140,
      totalFee: 400,
    });
  });

  it('keeps receivable balance invariant for all parks and each park group', () => {
    const bills = [
      enrichAmountBillPaymentInfo({
        billId: 1,
        invoiceTax: 10.12,
        parkId: 1,
        receiptAmount: 100,
        totalFee: 100,
      }),
      enrichAmountBillPaymentInfo({
        billId: 2,
        invoiceTax: 20.34,
        parkId: 1,
        receiptAmount: 40,
        totalFee: 90,
      }),
      enrichAmountBillPaymentInfo({
        billId: 3,
        invoiceTax: 30.56,
        parkId: 2,
        receiptAmount: 120.86,
        totalFee: 120,
      }),
      enrichAmountBillPaymentInfo({
        billId: 4,
        invoiceTax: 40.78,
        parkId: 2,
        receiptAmount: 0,
        totalFee: 88.88,
      }),
      enrichAmountBillPaymentInfo({
        billId: 5,
        invoiceTax: 0,
        parkId: 3,
        receiptAmount: 199.99,
        totalFee: 200,
      }),
    ];

    const allParksSummary = buildAmountBillListSummary(bills);

    expect(isAmountBillSummaryBalanced(allParksSummary)).toBe(true);
    expect(getAmountBillSummaryBalanceDifference(allParksSummary)).toBe(0);
    expect(allParksSummary).toMatchObject({
      balanceDifference: 0,
      isBalanced: true,
    });

    const billsByPark = new Map<number, typeof bills>();
    for (const bill of bills) {
      const parkBills = billsByPark.get(bill.parkId) || [];
      parkBills.push(bill);
      billsByPark.set(bill.parkId, parkBills);
    }

    for (const parkBills of billsByPark.values()) {
      const parkSummary = buildAmountBillListSummary(parkBills);

      expect(parkSummary.isBalanced).toBe(true);
      expect(parkSummary.balanceDifference).toBe(0);
      expect(parkSummary.totalFee).toBe(
        Math.round(
          (parkSummary.receiptAmount +
            parkSummary.remainingAmount -
            parkSummary.overpaidAmount) *
            100,
        ) / 100,
      );
    }
  });
});
