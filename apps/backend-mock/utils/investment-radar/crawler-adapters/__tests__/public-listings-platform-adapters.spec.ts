import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listing99cfwGuangdongAdapter } from '../public-listings/listing-99cfw-guangdong-adapter';
import { listingCangxiaoerGuangdongAdapter } from '../public-listings/listing-cangxiaoer-guangdong-adapter';
import { listingFangGuangdongAdapter } from '../public-listings/listing-fang-guangdong-adapter';
import { listingToodcGuangdongAdapter } from '../public-listings/listing-toodc-guangdong-adapter';

describe('guangdong public listing adapters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T10:00:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    {
      adapter: listing99cfwGuangdongAdapter,
      expectedUrls: [
        'https://dg.99cfw.com/changfang/123456.html',
        'https://fs.99cfw.com/cangku/2600.html',
      ],
      html: `
        <a class="title" href="/changfang/123456.html">东莞松山湖独院厂房出租</a>
        <a class="title" href="https://fs.99cfw.com/cangku/2600.html">佛山顺德仓库出租</a>
        <a href="/changfang/">厂房列表</a>
        <a href="https://www.99cfw.com/changfangxuqiu/900.html">需求详情</a>
      `,
      listUrl: 'https://dg.99cfw.com/changfang/',
    },
    {
      adapter: listingCangxiaoerGuangdongAdapter,
      expectedUrls: [
        'https://www.cangxiaoer.com/d/cangku/sz-100.html',
        'https://www.cangxiaoer.com/d/changfang/hz-200.html',
      ],
      html: `
        <a href="/d/cangku/sz-100.html">深圳宝安物流仓出租</a>
        <div data-detail-url="https://www.cangxiaoer.com/d/changfang/hz-200.html"></div>
        <a href="/cangku/cc440000-b1">广东仓库列表</a>
      `,
      listUrl: 'https://www.cangxiaoer.com/cangku/cc440000-b1',
    },
    {
      adapter: listingToodcGuangdongAdapter,
      expectedUrls: [
        'https://dg.toodc.cn/factory/abc',
        'https://gz.toodc.cn/warehouse/gz5800',
      ],
      html: `
        <a href="/factory/abc">头等仓东莞长安厂房出租</a>
        <a href="https://gz.toodc.cn/warehouse/gz5800">广州黄埔高台仓库出租</a>
        <a href="/map/">地图找仓库</a>
      `,
      listUrl: 'https://dg.toodc.cn/map/u1',
    },
    {
      adapter: listingFangGuangdongAdapter,
      expectedUrls: [
        'https://dg.shop.fang.com/cf/zu/3_100.html',
        'https://zh.shop.fang.com/cf/zu/3_200.htm',
        'https://gz.shop.fang.com/cf/zu/3_300.html',
      ],
      html: `
        <a href="/cf/zu/3_100.html">东莞寮步厂房出租</a>
        <a href="https://zh.shop.fang.com/cf/zu/3_200.htm">珠海斗门仓库出租</a>
        <script>
          window.__LIST__ = [{"title":"广州黄埔厂房","detailUrl":"https://gz.shop.fang.com/cf/zu/3_300.html"}]
        </script>
        <a href="/cf/zu/house/">厂房出租列表</a>
      `,
      listUrl: 'https://dg.shop.fang.com/cf/zu/house/',
    },
  ])(
    'discovers $adapter.sourceSite detail urls from list html',
    ({ adapter, expectedUrls, html, listUrl }) => {
      expect(adapter.extractDetailUrlsFromListHtml).toBeDefined();

      const result = adapter.extractDetailUrlsFromListHtml?.(html, listUrl);

      expect(result?.map((item) => item.sourceUrl)).toEqual(expectedUrls);
      expect(
        result?.every((item) => adapter.validateDetailUrl(item.sourceUrl)),
      ).toBe(true);
    },
  );
});
