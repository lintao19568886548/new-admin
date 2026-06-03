import { describe, expect, it, vi } from 'vitest';

import {
  buildReimbursementFinanceRemark,
  softDeleteReimbursementFinanceRecords,
  syncApprovedReimbursementFinanceRecord,
} from '../reimbursement-finance';

function createMockTransaction(existingFinanceIds: number[] = []) {
  return {
    finance: {
      create: vi.fn().mockResolvedValue({ financeId: 99 }),
      findMany: vi
        .fn()
        .mockResolvedValue(
          existingFinanceIds.map((financeId) => ({ financeId })),
        ),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    financeImage: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe('reimbursement finance sync', () => {
  it('uses a stable remark to link reimbursement and finance rows', () => {
    expect(buildReimbursementFinanceRemark(123)).toBe('报销 #123');
  });

  it('updates one existing finance row and soft-deletes duplicates', async () => {
    const tx = createMockTransaction([11, 12]);

    const financeId = await syncApprovedReimbursementFinanceRecord(tx, {
      amount: 88.5,
      createTime: new Date('2026-06-01T10:00:00+08:00'),
      id: 123,
      images: [{ image: { imgUrl: '/a.png' } }, { url: '/b.png' }, {}],
      parkId: 7,
      purpose: '维修报销',
    });

    expect(financeId).toBe(11);
    expect(tx.finance.create).not.toHaveBeenCalled();
    expect(tx.finance.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 88.5,
        billCategory: '其他费用',
        billName: '维修报销',
        isDeleted: false,
        parkId: 7,
        remark: '报销 #123',
        transactionType: '支出',
      }),
      where: {
        financeId: 11,
      },
    });
    expect(tx.finance.updateMany).toHaveBeenCalledWith({
      data: {
        isDeleted: true,
      },
      where: {
        financeId: {
          in: [12],
        },
      },
    });
    expect(tx.financeImage.deleteMany).toHaveBeenCalledWith({
      where: {
        financeId: 11,
      },
    });
    expect(tx.financeImage.createMany).toHaveBeenCalledWith({
      data: [
        { financeId: 11, url: '/a.png' },
        { financeId: 11, url: '/b.png' },
      ],
    });
  });

  it('creates one finance row when approved reimbursement has no finance row', async () => {
    const tx = createMockTransaction();

    const financeId = await syncApprovedReimbursementFinanceRecord(tx, {
      amount: 36,
      id: 124,
      images: [],
      parkId: 8,
      purpose: '采购报销',
    });

    expect(financeId).toBe(99);
    expect(tx.finance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 36,
        billName: '采购报销',
        parkId: 8,
        remark: '报销 #124',
        transactionType: '支出',
      }),
      select: {
        financeId: true,
      },
    });
  });

  it('soft-deletes finance rows linked to a deleted approved reimbursement', async () => {
    const tx = createMockTransaction();

    await softDeleteReimbursementFinanceRecords(tx, 125);

    expect(tx.finance.updateMany).toHaveBeenCalledWith({
      data: {
        isDeleted: true,
      },
      where: {
        isDeleted: false,
        remark: '报销 #125',
        transactionType: '支出',
      },
    });
  });
});
