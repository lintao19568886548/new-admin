import { describe, expect, it } from 'vitest';

import { validateAndNormalizeAmountBillData } from '../../api/bill/amount/utils';

describe('amount bill save validation', () => {
  it('rejects empty required fields and invalid amounts', () => {
    expect(validateAndNormalizeAmountBillData({ totalFee: 100 })).toBe(
      '项目名称不能为空',
    );
    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年6月份房租',
        totalFee: 100,
      }),
    ).toBe('租户不能为空');
    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年6月份房租',
        tenantName: 'A租户',
        totalFee: 0,
      }),
    ).toBe('本月收费金额必须大于0');
    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年6月份房租',
        receiptAmount: -1,
        tenantName: 'A租户',
        totalFee: 100,
      }),
    ).toBe('收款金额不能为负数');
  });

  it('normalizes unpaid receipt fields and requires paid receipt time', () => {
    const unpaidBill = {
      projectName: '2026年6月份房租',
      receiptAmount: 0,
      receiptTime: '2026-06-10T00:00:00.000Z',
      tenantName: 'A租户',
      totalFee: 100,
    };

    expect(validateAndNormalizeAmountBillData(unpaidBill)).toBeNull();
    expect(unpaidBill.receiptAmount).toBe(0);
    expect(unpaidBill.receiptTime).toBeNull();

    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年6月份房租',
        receiptAmount: 10,
        tenantName: 'A租户',
        totalFee: 100,
      }),
    ).toBe('已填写收款金额时，必须填写收款时间');
  });

  it('requires a clear rent billing month', () => {
    expect(
      validateAndNormalizeAmountBillData({
        projectName: '房租水电',
        tenantName: 'A租户',
        totalFee: 100,
      }),
    ).toBe('项目名称必须包含账期年月，如 2026年5月份房租水电');

    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年6月份房租、2026年5月份水电',
        tenantName: 'A租户',
        totalFee: 100,
      }),
    ).toBeNull();

    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年6月份水电、2026年5月份物业费',
        tenantName: 'A租户',
        totalFee: 100,
      }),
    ).toBeNull();

    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年6月份水费、2026年5月份电费',
        tenantName: 'A租户',
        totalFee: 100,
      }),
    ).toBe('项目名称只能包含一个水电账期月份，请将不同水电月份分开制单');

    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年6月份房租、2026年5月份房租',
        tenantName: 'A租户',
        totalFee: 100,
      }),
    ).toBe('项目名称只能包含一个房租账期月份，请将不同房租月份分开制单');

    expect(
      validateAndNormalizeAmountBillData({
        projectName: '2026年5月份房租水电',
        tenantName: 'A租户',
        totalFee: 100,
      }),
    ).toBeNull();
  });
});
