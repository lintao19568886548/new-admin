import { describe, expect, it } from 'vitest';

import { buildFinanceAmountWhere } from '../finance-query';

describe('finance query', () => {
  it('parses inclusive amount comparisons before single-character operators', () => {
    expect(buildFinanceAmountWhere('>=100')).toEqual({ gte: 100 });
    expect(buildFinanceAmountWhere('<=200')).toEqual({ lte: 200 });
  });

  it('parses exclusive, range, exact, and empty amount filters', () => {
    expect(buildFinanceAmountWhere('>100')).toEqual({ gt: 100 });
    expect(buildFinanceAmountWhere('<200')).toEqual({ lt: 200 });
    expect(buildFinanceAmountWhere('100-200')).toEqual({
      gte: 100,
      lte: 200,
    });
    expect(buildFinanceAmountWhere('150')).toBe(150);
    expect(buildFinanceAmountWhere('')).toBeUndefined();
  });
});
