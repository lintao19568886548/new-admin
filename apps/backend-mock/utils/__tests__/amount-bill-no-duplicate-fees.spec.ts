import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('amount bill fee display policy', () => {
  it('does not fold garbage/service fees into water/electricity display amounts', () => {
    const backendListSource = readFileSync(
      resolve(__dirname, '../../api/bill/amount/list.ts'),
      'utf8',
    );
    const pcListSource = readFileSync(
      resolve(
        __dirname,
        '../../../../playground/src/views/bill/amount/list.vue',
      ),
      'utf8',
    );
    const amountDataSource = readFileSync(
      resolve(
        __dirname,
        '../../../../playground/src/views/bill/amount/data.ts',
      ),
      'utf8',
    );
    const sheetSource = readFileSync(
      resolve(
        __dirname,
        '../../../../playground/src/views/bill/amount/modules/UniverSheet.vue',
      ),
      'utf8',
    );

    expect(backendListSource).not.toContain('waterFee +');
    expect(backendListSource).not.toContain('eleFee +');
    expect(amountDataSource).toContain("field: 'garbageFee'");
    expect(amountDataSource).toContain("field: 'serviceFee'");
    expect(pcListSource).toContain("'garbageFee'");
    expect(pcListSource).toContain("'serviceFee'");
    expect(sheetSource).toContain('billData.waterFee = waterAmount;');
    expect(sheetSource).not.toContain(
      'billData.waterFee = waterAmount + billData.garbageFee',
    );
  });
});
