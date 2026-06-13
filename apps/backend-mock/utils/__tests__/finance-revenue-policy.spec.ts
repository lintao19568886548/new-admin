import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('finance revenue policy', () => {
  it('keeps dashboard revenue aligned with amount bill project months', () => {
    const dashboardRevenueSource = readFileSync(
      resolve(__dirname, '../../api/dashboard/revenue-stats.ts'),
      'utf8',
    );

    expect(dashboardRevenueSource).toContain('amountBill.findMany');
    expect(dashboardRevenueSource).toContain('getSingleProjectMonthSortKey');
    expect(dashboardRevenueSource).toContain('receivableTotal');
    expect(dashboardRevenueSource).toContain('receivedTotal');
    expect(dashboardRevenueSource).toContain('remainingTotal');
    expect(dashboardRevenueSource).not.toContain(
      'syncRentalExpenseFinanceRecords',
    );
  });

  it('keeps analytics revenue overview aligned with finance rows', () => {
    const analyticsRevenueSource = readFileSync(
      resolve(__dirname, '../../api/analytics/revenue-overview.ts'),
      'utf8',
    );

    expect(analyticsRevenueSource).toContain('transactionType');
    expect(analyticsRevenueSource).toContain('收入');
    expect(analyticsRevenueSource).toContain('支出');
    expect(analyticsRevenueSource).toContain('syncRentalExpenseFinanceRecords');
    expect(analyticsRevenueSource).not.toContain('AUTO_RENTAL_EXPENSE');
    expect(analyticsRevenueSource).not.toContain('finance-revenue-policy');
    expect(analyticsRevenueSource).not.toContain('billName:');
    expect(analyticsRevenueSource).not.toContain('billCategory:');
    expect(analyticsRevenueSource).not.toContain('NOT:');
  });

  it('documents that rental expense is a normal finance expense for revenue stats', () => {
    const rentalExpenseFinanceRecord = {
      amount: 2_184_251,
      billCategory: '其他费用',
      billName: '租金支出',
      transactionType: '支出',
    };

    expect(rentalExpenseFinanceRecord.transactionType).toBe('支出');
  });
});
