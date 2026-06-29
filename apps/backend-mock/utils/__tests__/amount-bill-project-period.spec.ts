import { describe, expect, it } from 'vitest';

import {
  compareAmountBillProjectDesc,
  getAmountBillProjectPeriodError,
  getAmountBillProjectSortKey,
  getSingleProjectMonthSortKey,
} from '../amount-bill-project-period';

describe('amount bill project period sorting', () => {
  it('sorts by the rent month before secondary utility months', () => {
    const records = [
      {
        billId: 1,
        projectName: '2026年5月份房租、2026年6月份水电',
        receiptTime: new Date('2026-06-09T00:00:00'),
      },
      {
        billId: 2,
        projectName: '2026年6月份房租、2026年5月份水电',
        receiptTime: new Date('2026-06-09T00:00:00'),
      },
      {
        billId: 3,
        projectName: '2026年4月份水电、2026年5月份房租明细',
        receiptTime: new Date('2026-06-09T00:00:00'),
      },
    ];

    expect(
      records.sort(compareAmountBillProjectDesc).map((item) => item.billId),
    ).toEqual([2, 1, 3]);
  });

  it('attributes mixed rent and utility bills to the rent month', () => {
    expect(getSingleProjectMonthSortKey('2026年5月份房租水电')).toBe(
      2026 * 12 + 5,
    );
    expect(
      getSingleProjectMonthSortKey('2026年6月份房租、2026年5月份水电'),
    ).toBe(2026 * 12 + 6);
    expect(
      getSingleProjectMonthSortKey('2026年4月份水电、2026年5月份房租明细'),
    ).toBe(2026 * 12 + 5);
    expect(getSingleProjectMonthSortKey('房租水电')).toBeNull();
  });

  it('uses the rent month for dashboard and list period attribution', () => {
    expect(
      getAmountBillProjectSortKey({
        projectName: '2026年5月份水电费、2026年6月份房租',
      }),
    ).toBe(2026 * 12 + 6);
  });

  it('returns validation messages for missing or ambiguous project months', () => {
    expect(getAmountBillProjectPeriodError('2026年5月份房租水电')).toBeNull();
    expect(
      getAmountBillProjectPeriodError('2026年6月份房租、2026年5月份水电'),
    ).toBeNull();
    expect(getAmountBillProjectPeriodError('房租水电')).toBe(
      '项目名称必须包含账期年月，如 2026年5月份房租水电',
    );
    expect(
      getAmountBillProjectPeriodError('2026年6月份水电、2026年5月份物业费'),
    ).toBeNull();
    expect(
      getAmountBillProjectPeriodError('2026年6月份水费、2026年5月份电费'),
    ).toBe('项目名称只能包含一个水电账期月份，请将不同水电月份分开制单');
    expect(
      getAmountBillProjectPeriodError('2026年6月份房租、2026年5月份房租'),
    ).toBe('项目名称只能包含一个房租账期月份，请将不同房租月份分开制单');
  });
});
