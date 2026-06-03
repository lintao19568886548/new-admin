import { describe, expect, it, vi } from 'vitest';

import { deleteAmountBillsByIds } from '../../api/bill/amount/delete-utils';
import { upsertFinanceRecord } from '../../api/bill/amount/utils';

function createMockTransaction() {
  return {
    amountBill: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([
        { billId: 1, financeId: 11 },
        { billId: 2, financeId: null },
      ]),
    },
    eleBill: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    finance: {
      create: vi.fn().mockResolvedValue({ financeId: 99 }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    waterBill: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe('amount bill finance sync', () => {
  it('soft-deletes finance row when a paid bill becomes unpaid', async () => {
    const tx = createMockTransaction();

    const financeId = await upsertFinanceRecord(
      tx,
      {
        parkId: 7,
        projectName: 'A项目',
        receiptAmount: 0,
        receiptTime: null,
        tenantName: 'A租户',
      },
      11,
    );

    expect(financeId).toBeNull();
    expect(tx.finance.update).toHaveBeenCalledWith({
      data: {
        isDeleted: true,
      },
      where: {
        financeId: 11,
      },
    });
  });

  it('updates and restores the existing finance row when a bill is paid again', async () => {
    const tx = createMockTransaction();

    const financeId = await upsertFinanceRecord(
      tx,
      {
        parkId: 7,
        projectName: 'A项目',
        receiptAmount: 1200.5,
        receiptTime: '2026-06-01T10:00:00+08:00',
        tenantName: 'A租户',
      },
      11,
    );

    expect(financeId).toBe(11);
    expect(tx.finance.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 1200.5,
        billCategory: '账单收入',
        billName: 'A项目',
        isDeleted: false,
        parkId: 7,
        remark: 'A租户',
        transactionType: '收入',
      }),
      where: {
        financeId: 11,
      },
    });
  });

  it('soft-deletes linked finance rows when amount bills are deleted', async () => {
    const tx = createMockTransaction();

    const result = await deleteAmountBillsByIds(tx, [1, 2]);

    expect(result).toEqual({
      deletedBillCount: 2,
      deletedFinanceCount: 1,
    });
    expect(tx.finance.updateMany).toHaveBeenCalledWith({
      data: {
        isDeleted: true,
      },
      where: {
        financeId: {
          in: [11],
        },
      },
    });
  });
});
