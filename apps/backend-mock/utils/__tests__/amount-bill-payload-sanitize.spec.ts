import { describe, expect, it } from 'vitest';

import { sanitizeAmountBillPayload } from '../../api/bill/amount/utils';

describe('amount bill payload sanitize', () => {
  it('removes total and blank meter rows from bill details', () => {
    const payload = sanitizeAmountBillPayload({
      eleBills: [
        { amount: 1200, meterName: '车间用电', remark: '正常' },
        { amount: 120, meterName: '合计', remark: '不应入库' },
        { amount: 0, meterName: '   ', remark: '空行' },
        null,
      ],
      waterBills: [
        { amount: 75, meterName: '车间用水' },
        { amount: 82.5, meterName: '合计' },
      ],
    });

    expect(payload.eleBills).toEqual([
      { amount: 1200, meterName: '车间用电', remark: '正常' },
    ]);
    expect(payload.waterBills).toEqual([
      { amount: 75, meterName: '车间用水', remark: null },
    ]);
  });
});
