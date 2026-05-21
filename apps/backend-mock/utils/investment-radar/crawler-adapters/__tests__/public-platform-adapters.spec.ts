import type { PublicListingCrawlerAdapter } from '../public-listings/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { demand99cfwGuangdongAdapter } from '../public-demands/demand-99cfw-guangdong-adapter';
import { demandCfzxGuangdongAdapter } from '../public-demands/demand-cfzx-guangdong-adapter';
import { demandLocalPublicPageAdapter } from '../public-demands/demand-local-public-page-adapter';
import { demandZgzswGuangdongAdapter } from '../public-demands/demand-zgzsw-guangdong-adapter';
import { listing58GuangdongAdapter } from '../public-listings/listing-58-guangdong-adapter';
import { listing99cfwGuangdongAdapter } from '../public-listings/listing-99cfw-guangdong-adapter';
import { listingCangxiaoerGuangdongAdapter } from '../public-listings/listing-cangxiaoer-guangdong-adapter';
import { listingFangGuangdongAdapter } from '../public-listings/listing-fang-guangdong-adapter';
import { listingToodcGuangdongAdapter } from '../public-listings/listing-toodc-guangdong-adapter';

interface ListingSample {
  adapter: PublicListingCrawlerAdapter;
  expected: {
    areaText: string;
    city: string;
    contactName: string;
    district: string;
    phoneNumber: string;
    priceText: string;
    publishedDateText: string;
    sourceSite: string;
    title: string;
  };
  html: string;
  invalidUrl: string;
  validUrl: string;
}

const listingSamples: ListingSample[] = [
  {
    adapter: listing99cfwGuangdongAdapter,
    expected: {
      areaText: '1200 平方米',
      city: '东莞',
      contactName: '张先生',
      district: '松山湖',
      phoneNumber: '13800138000',
      priceText: '18 元/㎡/月',
      publishedDateText: '2026-05-20 09:30',
      sourceSite: '99cfw',
      title: '东莞松山湖独院厂房出租',
    },
    html: `
      <html>
        <head><title>东莞松山湖独院厂房出租 - 99厂房网</title></head>
        <body>
          <h1>东莞松山湖独院厂房出租</h1>
          <div class="house-info">
            <p>区域：东莞市松山湖</p>
            <p>面积：1200 平方米</p>
            <p>租金：18 元/㎡/月</p>
            <p>联系人：张先生</p>
            <p>电话：13800138000</p>
            <p>发布时间：2026-05-20 09:30</p>
          </div>
        </body>
      </html>
    `,
    invalidUrl: 'https://example.com/changfang/123456.html',
    validUrl: 'https://dg.99cfw.com/changfang/123456.html',
  },
  {
    adapter: listing99cfwGuangdongAdapter,
    expected: {
      areaText: '2600 ㎡',
      city: '佛山',
      contactName: '陈经理',
      district: '顺德',
      phoneNumber: '13922223333',
      priceText: '16 元/㎡/月',
      publishedDateText: '2026-05-18',
      sourceSite: '99cfw',
      title: '佛山顺德单一层仓库出租',
    },
    html: `
      <article>
        <h1>佛山顺德单一层仓库出租</h1>
        <dl>
          <dt>地址</dt><dd>佛山市顺德区伦教工业区</dd>
          <dt>仓库面积</dt><dd>2600 ㎡</dd>
          <dt>价格</dt><dd>16 元/㎡/月</dd>
          <dt>联系人</dt><dd>陈经理</dd>
          <dt>联系电话</dt><dd>13922223333</dd>
          <dt>更新时间</dt><dd>2026-05-18</dd>
        </dl>
      </article>
    `,
    invalidUrl: 'https://dg.99cfw.com/changfang/',
    validUrl: 'https://fs.99cfw.com/cangku/fs2600.html',
  },
  {
    adapter: listingToodcGuangdongAdapter,
    expected: {
      areaText: '3000 ㎡',
      city: '东莞',
      contactName: '刘先生',
      district: '长安',
      phoneNumber: '13700001111',
      priceText: '22 元/㎡/月',
      publishedDateText: '2026-05-19',
      sourceSite: 'toodc.cn',
      title: '头等仓东莞长安厂房出租',
    },
    html: `
      <section class="detail">
        <h1>头等仓东莞长安厂房出租</h1>
        <p>地址：东莞市长安镇厦岗社区</p>
        <p>建筑面积：3000 ㎡</p>
        <p>价格：22 元/㎡/月</p>
        <p>经纪人：刘先生</p>
        <p>联系电话：13700001111</p>
        <p>更新时间：2026-05-19</p>
      </section>
    `,
    invalidUrl: 'https://example.com/factory/abc',
    validUrl: 'https://dg.toodc.cn/factory/abc',
  },
  {
    adapter: listingToodcGuangdongAdapter,
    expected: {
      areaText: '5800 平方米',
      city: '广州',
      contactName: '王女士',
      district: '黄埔',
      phoneNumber: '13666668888',
      priceText: '28 元/㎡/月',
      publishedDateText: '2026-05-17 15:20',
      sourceSite: 'toodc.cn',
      title: '广州黄埔高台仓库出租',
    },
    html: `
      <html>
        <head>
          <meta property="og:title" content="广州黄埔高台仓库出租 - 头等仓">
        </head>
        <body>
          <ul>
            <li>所在区域：广州市黄埔区开发大道</li>
            <li>可租面积：5800 平方米</li>
            <li>租金：28 元/㎡/月</li>
            <li>联系人：王女士</li>
            <li>手机：13666668888</li>
            <li>发布时间：2026-05-17 15:20</li>
          </ul>
        </body>
      </html>
    `,
    invalidUrl: 'https://dg.toodc.cn/news/abc',
    validUrl: 'https://gz.toodc.cn/warehouse/gz5800',
  },
  {
    adapter: listingCangxiaoerGuangdongAdapter,
    expected: {
      areaText: '4800 平米',
      city: '深圳',
      contactName: '赵经理',
      district: '宝安',
      phoneNumber: '13512345678',
      priceText: '35 元/㎡/月',
      publishedDateText: '2026-05-16',
      sourceSite: 'cangxiaoer.com',
      title: '深圳宝安物流仓出租',
    },
    html: `
      <main>
        <h1>深圳宝安物流仓出租</h1>
        <div>区域：深圳市宝安区福永街道</div>
        <div>总可租面积：4800 平米</div>
        <div>参考价：35 元/㎡/月</div>
        <div>顾问：赵经理</div>
        <div>咨询电话：13512345678</div>
        <div>更新时间：2026-05-16</div>
      </main>
    `,
    invalidUrl: 'https://example.com/d/changfang/sz-100.html',
    validUrl: 'https://www.cangxiaoer.com/d/cangku/sz-100.html',
  },
  {
    adapter: listingCangxiaoerGuangdongAdapter,
    expected: {
      areaText: '2000 ㎡',
      city: '惠州',
      contactName: '周先生',
      district: '惠阳',
      phoneNumber: '13400002222',
      priceText: '14 元/㎡/月',
      publishedDateText: '2026-05-15',
      sourceSite: 'cangxiaoer.com',
      title: '惠州惠阳标准厂房出租',
    },
    html: `
      <article>
        <h2>惠州惠阳标准厂房出租</h2>
        <table>
          <tr><th>地址</th><td>惠州市惠阳区秋长街道</td></tr>
          <tr><th>厂房面积</th><td>2000 ㎡</td></tr>
          <tr><th>租金</th><td>14 元/㎡/月</td></tr>
          <tr><th>联系人</th><td>周先生</td></tr>
          <tr><th>联系电话</th><td>13400002222</td></tr>
          <tr><th>发布于</th><td>2026-05-15</td></tr>
        </table>
      </article>
    `,
    invalidUrl: 'https://www.cangxiaoer.com/news/hz-200.html',
    validUrl: 'https://www.cangxiaoer.com/d/changfang/hz-200.html',
  },
  {
    adapter: listing58GuangdongAdapter,
    expected: {
      areaText: '1800 平米',
      city: '东莞',
      contactName: '李先生',
      district: '厚街',
      phoneNumber: '13333334444',
      priceText: '20 元/㎡/月',
      publishedDateText: '2026-05-14',
      sourceSite: '58.com',
      title: '东莞厚街独门独院厂房出租',
    },
    html: `
      <html>
        <head><title>东莞厚街独门独院厂房出租 - 58同城</title></head>
        <body>
          <h1>东莞厚街独门独院厂房出租</h1>
          <ul>
            <li>区县商圈：东莞厚街</li>
            <li>面积：1800 平米</li>
            <li>租金：20 元/㎡/月</li>
            <li>联系人：李先生</li>
            <li>联系电话：13333334444</li>
            <li>更新时间：2026-05-14</li>
          </ul>
        </body>
      </html>
    `,
    invalidUrl: 'https://ganji.com/cfcz/dg1800.shtml',
    validUrl: 'https://dg.58.com/cfcz/dg1800.shtml',
  },
  {
    adapter: listing58GuangdongAdapter,
    expected: {
      areaText: '4200 ㎡',
      city: '中山',
      contactName: '黄经理',
      district: '火炬开发区',
      phoneNumber: '13211112222',
      priceText: '17 元/㎡/月',
      publishedDateText: '2026-05-13 11:00',
      sourceSite: '58.com',
      title: '中山火炬开发区仓库出租',
    },
    html: `
      <section>
        <h1>中山火炬开发区仓库出租</h1>
        <p>地      址：中山市火炬开发区沿江东路</p>
        <p>仓库面积：4200 ㎡</p>
        <p>价格：17 元/㎡/月</p>
        <p>经纪人：黄经理</p>
        <p>电话：13211112222</p>
        <p>发布时间：2026-05-13 11:00</p>
      </section>
    `,
    invalidUrl: 'https://dg.58.com/job/123.shtml',
    validUrl: 'https://dg.58.com/cangkucf/zs4200.shtml',
  },
  {
    adapter: listingFangGuangdongAdapter,
    expected: {
      areaText: '1500 平方米',
      city: '东莞',
      contactName: '何经理',
      district: '寮步',
      phoneNumber: '13100001111',
      priceText: '21 元/㎡/月',
      publishedDateText: '2026-05-12',
      sourceSite: 'fang.com',
      title: '东莞寮步厂房出租',
    },
    html: `
      <html>
        <head><title>东莞寮步厂房出租 - 房天下</title></head>
        <body>
          <h1>东莞寮步厂房出租</h1>
          <div class="trl-item">区域：东莞寮步</div>
          <div class="trl-item">建筑面积：1500 平方米</div>
          <div class="trl-item">租金：21 元/㎡/月</div>
          <div class="trl-item">联系人：何经理</div>
          <div class="trl-item">电话：13100001111</div>
          <div class="trl-item">发布时间：2026-05-12</div>
        </body>
      </html>
    `,
    invalidUrl: 'https://dg.shop.fang.com/news/100.html',
    validUrl: 'https://dg.shop.fang.com/cf/zu/3_100.html',
  },
  {
    adapter: listingFangGuangdongAdapter,
    expected: {
      areaText: '3600 ㎡',
      city: '珠海',
      contactName: '孙女士',
      district: '斗门',
      phoneNumber: '13099998888',
      priceText: '19 元/㎡/月',
      publishedDateText: '2026-05-11 10:45',
      sourceSite: 'fang.com',
      title: '珠海斗门工业园仓库出租',
    },
    html: `
      <article>
        <h1>珠海斗门工业园仓库出租</h1>
        <dl>
          <dt>楼盘地址</dt><dd>珠海市斗门区白蕉镇</dd>
          <dt>面积</dt><dd>3600 ㎡</dd>
          <dt>单价</dt><dd>19 元/㎡/月</dd>
          <dt>经纪人</dt><dd>孙女士</dd>
          <dt>联系电话</dt><dd>13099998888</dd>
          <dt>更新时间</dt><dd>2026-05-11 10:45</dd>
        </dl>
      </article>
    `,
    invalidUrl: 'https://dg.shop.fang.com/cf/zu/',
    validUrl: 'https://dg.shop.fang.com/cf/zu/3_200.htm',
  },
];

describe('guangdong public listing adapters', () => {
  it.each(listingSamples)(
    'extracts strict detail fields from $expected.sourceSite sample $expected.title',
    ({ adapter, expected, html, validUrl }) => {
      const result = adapter.extractFromHtml(html, validUrl);

      expect(result).toMatchObject({
        ...expected,
        opportunityType: 'SUPPLY',
      });
      expect(result.detailJson.extractionPolicy).toBe(
        'STRICT_DETAIL_PAGE_LABELS_ONLY',
      );
      expect(result.detailJson.responseHash).toHaveLength(64);
      expect(result.missingFields).toEqual([]);
    },
  );

  it.each(listingSamples)(
    'keeps $expected.sourceSite missing fields explicit instead of inventing data',
    ({ adapter, validUrl }) => {
      const result = adapter.extractFromHtml(
        `
          <html>
            <body>
              <h1>只有标题的厂房出租</h1>
              <p>正文里出现东莞、1800 平方米、13800138000，但没有详情页字段标签。</p>
            </body>
          </html>
        `,
        validUrl,
      );

      expect(result.title).toBe('只有标题的厂房出租');
      expect(result.city).toBeNull();
      expect(result.areaText).toBeNull();
      expect(result.phoneNumber).toBeNull();
      expect(result.priceText).toBeNull();
      expect(result.publishedDateText).toBeNull();
      expect(result.missingFields).toEqual(
        expect.arrayContaining([
          'city',
          'district',
          'areaText',
          'priceText',
          'contactName',
          'phoneNumber',
          'publishedDateText',
        ]),
      );
      expect(result.detailJson.missingFields).toEqual(result.missingFields);
    },
  );

  it.each(listingSamples)(
    'rejects non-platform detail urls for $expected.sourceSite',
    ({ adapter, invalidUrl, validUrl }) => {
      expect(adapter.validateDetailUrl(invalidUrl)).toBe(false);
      expect(adapter.validateDetailUrl(validUrl)).toBe(true);
    },
  );
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

  it('extracts 99cfw demand fields from mixed table labels', () => {
    const result = demand99cfwGuangdongAdapter.extractFromHtml(
      `
        <h1>深圳新能源企业求租厂房</h1>
        <table>
          <tr><th>所在城市</th><td>深圳市宝安区</td></tr>
          <tr><th>面积需求</th><td>3500-5000 ㎡</td></tr>
          <tr><th>价格预算</th><td>25 元/㎡/月以内</td></tr>
          <tr><th>产业类型</th><td>新能源</td></tr>
          <tr><th>联系人姓名</th><td>王女士</td></tr>
          <tr><th>联系方式</th><td>138-0013-8001</td></tr>
          <tr><th>发布日期</th><td>2026/05/20</td></tr>
        </table>
      `,
      'https://sz.99cfw.com/changfangxuqiu/9001.html',
    );

    expect(result).toMatchObject({
      areaText: '3500-5000 ㎡',
      city: '深圳',
      contactName: '王女士',
      industryText: '新能源',
      phoneNumber: '13800138001',
      priceText: '25 元/㎡/月以内',
      publishedAt: '2026-05-19T16:00:00.000Z',
      publishedDateText: '2026/05/20',
      sourceUrl: 'https://sz.99cfw.com/changfangxuqiu/9001.html',
      title: '深圳新能源企业求租厂房',
    });
    expect(result.missingFields).toEqual([]);
  });

  it.each([
    [demandCfzxGuangdongAdapter, 'https://www.cfzx.com/xuqiu/100.html', 'cfzx'],
    [
      demandZgzswGuangdongAdapter,
      'https://guangdong.zgzsw.com/xuqiu/100.html',
      'zgzsw',
    ],
  ])(
    'extracts demand fields from secondary demand adapter',
    (adapter, url, sourceSite) => {
      const result = adapter.extractFromHtml(
        `
        <h1>佛山物流企业求租仓库</h1>
        <p>所在地：佛山市顺德区</p>
        <p>求租面积：5000 平米</p>
        <p>租金预算：60 万元</p>
        <p>行业：物流仓储</p>
        <p>信息发布：2026-05-18</p>
      `,
        url,
      );

      expect(result.opportunityType).toBe('DEMAND');
      expect(result.city).toBe('佛山');
      expect(result.areaText).toBe('5000 平米');
      expect(result.industryText).toBe('物流仓储');
      expect(result.phoneNumber).toBeNull();
      expect(result.publishedAt).toBe('2026-05-17T16:00:00.000Z');
      expect(result.sourceSite).toBe(sourceSite);
      expect(result.sourceUrl).toBe(url);
      expect(result.missingFields).toEqual([]);
    },
  );

  it('extracts cfzx demand fields from table labels and converts hour-relative publish time', () => {
    const result = demandCfzxGuangdongAdapter.extractFromHtml(
      `
        <h1>广州智能制造企业求租厂房</h1>
        <table>
          <tr><th>需求区域</th><td>广州市增城区</td></tr>
          <tr><th>厂房面积</th><td>2800 ㎡</td></tr>
          <tr><th>期望价格</th><td>18-22 元/㎡/月</td></tr>
          <tr><th>行业类型</th><td>智能制造</td></tr>
          <tr><th>联 系 人</th><td>刘先生</td></tr>
          <tr><th>联系手机</th><td>137-0000-1111</td></tr>
          <tr><th>更新时间</th><td>3小时前</td></tr>
        </table>
      `,
      'https://www.cfzx.com/xuqiu/200.html',
    );

    expect(result).toMatchObject({
      areaText: '2800 ㎡',
      city: '广州',
      contactName: '刘先生',
      industryText: '智能制造',
      opportunityType: 'DEMAND',
      phoneNumber: '13700001111',
      priceText: '18-22 元/㎡/月',
      publishedAt: '2026-05-19T23:00:00.000Z',
      publishedDateText: '3小时前',
      sourceSite: 'cfzx',
      sourceUrl: 'https://www.cfzx.com/xuqiu/200.html',
      title: '广州智能制造企业求租厂房',
    });
    expect(result.district).toBe('广州市增城区');
    expect(result.missingFields).toEqual([]);
  });

  it('extracts zgzsw demand fields from separated label lines', () => {
    const result = demandZgzswGuangdongAdapter.extractFromHtml(
      `
        <article>
          <h1>东莞五金企业求租生产空间</h1>
          <dl>
            <dt>求租城市</dt><dd>东莞市厚街镇</dd>
            <dt>需求体量</dt><dd>1200-1800 平米</dd>
            <dt>总价预算</dt><dd>45 万元</dd>
            <dt>项目行业</dt><dd>五金加工</dd>
            <dt>称呼</dt><dd>周总</dd>
            <dt>手机号码</dt><dd>13600002222</dd>
            <dt>发布于</dt><dd>2026-05-19 16:30</dd>
          </dl>
        </article>
      `,
      'https://guangdong.zgzsw.com/xuqiu/200.html',
    );

    expect(result).toMatchObject({
      areaText: '1200-1800 平米',
      city: '东莞',
      contactName: '周总',
      industryText: '五金加工',
      opportunityType: 'DEMAND',
      phoneNumber: '13600002222',
      priceText: '45 万元',
      publishedAt: '2026-05-19T08:30:00.000Z',
      publishedDateText: '2026-05-19 16:30',
      sourceSite: 'zgzsw',
      sourceUrl: 'https://guangdong.zgzsw.com/xuqiu/200.html',
      title: '东莞五金企业求租生产空间',
    });
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
          <p>发布时间：2026年05月20日 10:30</p>
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
      publishedDateText: '2026年05月20日 10:30',
      sourceSite: 'local-public-page',
      sourceUrl: 'file:///C:/tmp/public-demand.html',
      title: '广州食品企业求租标准厂房',
    });
    expect(result.missingFields).toEqual([]);
    expect(
      demandLocalPublicPageAdapter.validateDetailUrl('https://example.com/a'),
    ).toBe(false);
    expect(
      demandLocalPublicPageAdapter.validateDetailUrl(
        'http://localhost:3000/public-demand.html',
      ),
    ).toBe(true);
  });

  it('does not convert missing demand fields into fake text', () => {
    const result = demand99cfwGuangdongAdapter.extractFromHtml(
      '<p>珠三角附近考虑生产空间。</p>',
      'https://www.99cfw.com/changfangxuqiu/empty.html',
    );

    expect(result.title).toBeNull();
    expect(result.city).toBeNull();
    expect(result.areaText).toBeNull();
    expect(result.contactName).toBeNull();
    expect(result.phoneNumber).toBeNull();
    expect(result.industryText).toBeNull();
    expect(result.missingFields).toEqual(
      expect.arrayContaining([
        'title',
        'city',
        'areaText',
        'publishedDateText',
      ]),
    );
  });
});
