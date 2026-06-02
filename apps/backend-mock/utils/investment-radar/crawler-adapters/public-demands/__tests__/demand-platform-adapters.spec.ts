import { describe, expect, it } from 'vitest';

import { demand99cfwGuangdongAdapter } from '../demand-99cfw-guangdong-adapter';

describe('guangdong public demand platform adapters', () => {
  it('accepts only Guangdong-scoped 99cfw demand detail URLs', () => {
    expect(
      demand99cfwGuangdongAdapter.validateDetailUrl(
        'https://dg.99cfw.com/xuqiu/zryzsawsrySwx.htm',
      ),
    ).toBe(true);
    expect(
      demand99cfwGuangdongAdapter.validateDetailUrl(
        'https://www.99cfw.com/changfangxuqiu/gz/8899',
      ),
    ).toBe(true);
    expect(
      demand99cfwGuangdongAdapter.validateDetailUrl(
        'https://www.99cfw.com/xuqiu/huizhou/abc-100.html',
      ),
    ).toBe(true);

    expect(
      demand99cfwGuangdongAdapter.validateDetailUrl(
        'https://xa.99cfw.com/xuqiu/zryzbtK.htm',
      ),
    ).toBe(false);
    expect(
      demand99cfwGuangdongAdapter.validateDetailUrl(
        'https://www.99cfw.com/changfangxuqiu/hangzhou/8899',
      ),
    ).toBe(false);
    expect(
      demand99cfwGuangdongAdapter.validateDetailUrl(
        'https://www.99cfw.com/changfangxuqiu/3929/',
      ),
    ).toBe(false);
  });

  it('keeps province and city demand list URLs crawlable', () => {
    expect(
      demand99cfwGuangdongAdapter.validateListUrl?.(
        'https://www.99cfw.com/changfangxuqiu/3929/',
      ),
    ).toBeNull();
    expect(
      demand99cfwGuangdongAdapter.validateListUrl?.(
        'https://www.99cfw.com/changfangxuqiu/0_0_0_0_2/3929/',
      ),
    ).toBeNull();
    expect(
      demand99cfwGuangdongAdapter.validateListUrl?.(
        'https://dg.99cfw.com/xuqiu/0_1_0_0_2/',
      ),
    ).toBeNull();
    expect(
      demand99cfwGuangdongAdapter.validateListUrl?.(
        'https://www.99cfw.com/changfangxuqiu/3916/',
      ),
    ).toBe('URL_LIST_PATH_NOT_ALLOWED');
  });
});
