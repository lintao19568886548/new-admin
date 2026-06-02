import { describe, expect, it } from 'vitest';

import { listingCangxiaoerGuangdongAdapter } from '../listing-cangxiaoer-guangdong-adapter';

describe('guangdong listing platform adapter url policies', () => {
  it('keeps cangxiaoer discovery on guangdong detail evidence', () => {
    const html = `
      <a href="/d/cangku/sz-baoan-4800.html">深圳宝安仓库出租</a>
      <a href="https://www.cangxiaoer.com/d/changfang/hz-huiyang-2000.html">惠州惠阳厂房出租</a>
      <a href="https://sh.cangxiaoer.com/d/cangku/sh-1200.html">上海仓库出租</a>
      <a href="/cangku/cc440000-b1">广东仓库列表</a>
    `;

    expect(
      listingCangxiaoerGuangdongAdapter
        .extractDetailUrlsFromListHtml?.(
          html,
          'https://www.cangxiaoer.com/cangku/cc440000-b1',
        )
        .map((item) => item.sourceUrl),
    ).toEqual([
      'https://www.cangxiaoer.com/d/cangku/sz-baoan-4800.html',
      'https://www.cangxiaoer.com/d/changfang/hz-huiyang-2000.html',
    ]);

    expect(
      listingCangxiaoerGuangdongAdapter.validateDetailUrl(
        'https://www.cangxiaoer.com/d/cangku/sz-baoan-4800.html',
      ),
    ).toBe(true);
    expect(
      listingCangxiaoerGuangdongAdapter.validateDetailUrl(
        'https://sh.cangxiaoer.com/d/cangku/sh-1200.html',
      ),
    ).toBe(false);
    expect(
      listingCangxiaoerGuangdongAdapter.validateDetailUrl(
        'https://www.cangxiaoer.com/cangku/cc440000-b1',
      ),
    ).toBe(false);
  });
});
