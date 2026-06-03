import { describe, expect, it } from 'vitest';

import {
  AUTO_RENTAL_EXPENSE_REVENUE_EXCLUSION_WHERE,
  isAutoRentalExpenseFinanceRecord,
} from '../finance-revenue-policy';

describe('finance revenue policy', () => {
  it('builds one shared Prisma exclusion for automatic rental expense rows', () => {
    expect(AUTO_RENTAL_EXPENSE_REVENUE_EXCLUSION_WHERE).toEqual({
      billCategory: '其他费用',
      billName: '租金支出',
      transactionType: '支出',
    });
  });

  it('only excludes automatic rental expense rows from revenue stats', () => {
    expect(
      isAutoRentalExpenseFinanceRecord({
        billCategory: '其他费用',
        billName: '租金支出',
        transactionType: '支出',
      }),
    ).toBe(true);

    expect(
      isAutoRentalExpenseFinanceRecord({
        billCategory: '其他费用',
        billName: '租金支出',
        transactionType: '收入',
      }),
    ).toBe(false);
    expect(
      isAutoRentalExpenseFinanceRecord({
        billCategory: '其他费用',
        billName: '报销',
        transactionType: '支出',
      }),
    ).toBe(false);
  });
});
