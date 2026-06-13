import { describe, expect, it } from 'vitest';

import { compareFinanceBillNameDesc } from '../finance-bill-name-period';

describe('finance bill name period sorting', () => {
  it('sorts by the leading business month before secondary months', () => {
    const records = [
      {
        billName: '2026年5月份房租、2026年6月份水电',
        financeId: 1,
        transactionTime: new Date('2026-06-09T00:00:00'),
      },
      {
        billName: '2026年6月份房租、2026年5月份水电',
        financeId: 2,
        transactionTime: new Date('2026-06-09T00:00:00'),
      },
      {
        billName: '2026年4月份水电、2026年5月份房租明细',
        financeId: 3,
        transactionTime: new Date('2026-06-09T00:00:00'),
      },
    ];

    expect(
      records.sort(compareFinanceBillNameDesc).map((item) => item.financeId),
    ).toEqual([2, 1, 3]);
  });

  it('sorts parsed bill month descending before older months', () => {
    const records = [
      {
        billName: '2026年5月租金',
        financeId: 1,
        transactionTime: new Date('2026-05-10T00:00:00'),
      },
      {
        billName: '2026年6月租金',
        financeId: 2,
        transactionTime: new Date('2026-06-10T00:00:00'),
      },
      {
        billName: '2026年4月租金',
        financeId: 3,
        transactionTime: new Date('2026-04-10T00:00:00'),
      },
    ];

    expect(
      records.sort(compareFinanceBillNameDesc).map((item) => item.billName),
    ).toEqual(['2026年6月租金', '2026年5月租金', '2026年4月租金']);
  });

  it('sorts by all parsed months when the newest month is the same', () => {
    const records = [
      {
        billName: '2026年5月份房租、2024年4月份水电',
        financeId: 1,
        transactionTime: new Date('2026-05-20T00:00:00'),
      },
      {
        billName: '2026年5月份房租、2026年4月份水电',
        financeId: 2,
        transactionTime: new Date('2026-05-10T00:00:00'),
      },
      {
        billName: '2026年5月份房租、2025年4月份水电',
        financeId: 3,
        transactionTime: new Date('2026-05-15T00:00:00'),
      },
    ];

    expect(
      records.sort(compareFinanceBillNameDesc).map((item) => item.billName),
    ).toEqual([
      '2026年5月份房租、2026年4月份水电',
      '2026年5月份房租、2025年4月份水电',
      '2026年5月份房租、2024年4月份水电',
    ]);
  });

  it('falls back to transaction time when bill name has no month', () => {
    const records = [
      {
        billName: '物业维修',
        financeId: 1,
        transactionTime: new Date('2026-05-10T00:00:00'),
      },
      {
        billName: '零星收入',
        financeId: 2,
        transactionTime: new Date('2026-06-10T00:00:00'),
      },
    ];

    expect(
      records.sort(compareFinanceBillNameDesc).map((item) => item.billName),
    ).toEqual(['零星收入', '物业维修']);
  });
});
