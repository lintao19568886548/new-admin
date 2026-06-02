import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { demand99cfwGuangdongAdapter } from '../public-demands/demand-99cfw-guangdong-adapter';
import { demandLocalPublicPageAdapter } from '../public-demands/demand-local-public-page-adapter';
import { listing99cfwGuangdongAdapter } from '../public-listings/listing-99cfw-guangdong-adapter';
import { listingCangxiaoerGuangdongAdapter } from '../public-listings/listing-cangxiaoer-guangdong-adapter';
import { listingCfzsw68Adapter } from '../public-listings/listing-cfzsw68-adapter';
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

  it('keeps only retained listing platform adapters available in parser tests', () => {
    expect(
      [
        listing99cfwGuangdongAdapter,
        listingCangxiaoerGuangdongAdapter,
        listingCfzsw68Adapter,
        listingFangGuangdongAdapter,
        listingToodcGuangdongAdapter,
      ].map((adapter) => adapter.sourceCode),
    ).toEqual([
      'PUBLIC_FACTORY_LISTING_99CFW_GD',
      'PUBLIC_FACTORY_LISTING_CANGXIAOER_GD',
      'PUBLIC_FACTORY_LISTING_CFZSW68',
      'PUBLIC_FACTORY_LISTING_FANG_GD',
      'PUBLIC_FACTORY_LISTING_TOODC_GD',
    ]);
  });

  it('extracts strict detail fields from a retained 99cfw listing sample', () => {
    const result = listing99cfwGuangdongAdapter.extractFromHtml(
      `
        <html>
          <head><title>东莞松山湖独院厂房出租 - 99厂房网</title></head>
          <body>
            <h1>东莞松山湖独院厂房出租</h1>
            <div class="house-info">
              <p>区域：东莞市松山湖</p>
              <p>面积：1200 平方米</p>
              <p>租金：18 元/平/月</p>
              <p>联系人：张先生</p>
              <p>电话：13800138000</p>
              <p>发布时间：2026-05-20 09:30</p>
            </div>
          </body>
        </html>
      `,
      'https://dg.99cfw.com/changfang/123456.html',
    );

    expect(result).toMatchObject({
      areaText: '1200 平方米',
      city: '东莞',
      contactName: '张先生',
      district: '松山湖',
      opportunityType: 'SUPPLY',
      phoneNumber: '13800138000',
      priceText: '18 元/平/月',
      publishedDateText: '2026-05-20 09:30',
      sourceSite: '99cfw',
      title: '东莞松山湖独院厂房出租',
    });
    expect(result.detailJson.extractionPolicy).toBe(
      'STRICT_DETAIL_PAGE_LABELS_ONLY',
    );
    expect(result.detailJson.responseHash).toHaveLength(64);
    expect(result.missingFields).toEqual([]);
  });
});

describe('guangdong public demand adapters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T10:00:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('extracts demand fields with DEMAND opportunity type', () => {
    const result = demand99cfwGuangdongAdapter.extractFromHtml(
      `
        <title>东莞电子企业求租厂房 - 99厂房网</title>
        <h1>东莞电子企业求租厂房</h1>
        <div>需求城市：东莞市</div>
        <div>需求面积：2000 平方米</div>
        <div>预算：30 万元</div>
        <div>行业：电子制造</div>
        <div>联系人：李经理</div>
        <div>电话：13900139000</div>
        <div>发布时间：1天前</div>
      `,
      'https://www.99cfw.com/changfangxuqiu/8899.html',
    );

    expect(result).toMatchObject({
      areaText: '2000 平方米',
      city: '东莞',
      contactName: '李经理',
      industryText: '电子制造',
      opportunityType: 'DEMAND',
      phoneNumber: '13900139000',
      priceText: '30 万元',
      publishedDateText: '1天前',
      sourceSite: '99cfw',
      sourceUrl: 'https://www.99cfw.com/changfangxuqiu/8899.html',
      title: '东莞电子企业求租厂房',
    });
    expect(result.publishedAt).toBe('2026-05-19T02:00:00.000Z');
    expect(result.detailJson.responseHash).toHaveLength(64);
    expect(result.missingFields).toEqual([]);
  });

  it('extracts local public demand page fields without a platform host', () => {
    const result = demandLocalPublicPageAdapter.extractFromHtml(
      `
        <article>
          <h1>广州食品企业求租标准厂房</h1>
          <p>需求城市：广州市黄埔区</p>
          <p>需求面积：1800 平方米</p>
          <p>预算：面议</p>
          <p>所属行业：食品加工</p>
          <p>联系人：陈经理</p>
          <p>电话：13900139002</p>
          <p>发布时间：2026年5月20日 10:30</p>
        </article>
      `,
      'file:///C:/tmp/public-demand.html',
    );

    expect(result).toMatchObject({
      areaText: '1800 平方米',
      city: '广州',
      contactName: '陈经理',
      industryText: '食品加工',
      opportunityType: 'DEMAND',
      phoneNumber: '13900139002',
      priceText: '面议',
      sourceSite: 'local-public-page',
      sourceUrl: 'file:///C:/tmp/public-demand.html',
      title: '广州食品企业求租标准厂房',
    });
    expect(result.missingFields).toEqual([]);
  });
});
