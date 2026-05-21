import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listing58GuangdongAdapter } from '../public-listings/listing-58-guangdong-adapter';
import { listing99cfwGuangdongAdapter } from '../public-listings/listing-99cfw-guangdong-adapter';
import { listingCangxiaoerGuangdongAdapter } from '../public-listings/listing-cangxiaoer-guangdong-adapter';
import { listingCfzxGuangdongAdapter } from '../public-listings/listing-cfzx-guangdong-adapter';
import { listingFangGuangdongAdapter } from '../public-listings/listing-fang-guangdong-adapter';
import { listingToodcGuangdongAdapter } from '../public-listings/listing-toodc-guangdong-adapter';
import { listingZgzswGuangdongAdapter } from '../public-listings/listing-zgzsw-guangdong-adapter';

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
      adapter: listing58GuangdongAdapter,
      html: `
        <ul class="house-list">
          <li><a href="/cfcz/dg1800.shtml">东莞厚街独门独院厂房出租</a></li>
          <li><a href="https://dg.58.com/cangkucf/zs4200.shtml">中山火炬开发区仓库出租</a></li>
          <li><a href="https://dg.58.com/cangkucf/">厂房仓库列表页</a></li>
          <li><a href="https://example.com/cfcz/fake.shtml">外站房源</a></li>
        </ul>
      `,
      listUrl: 'https://dg.58.com/cangkucf/',
      expectedUrls: [
        'https://dg.58.com/cfcz/dg1800.shtml',
        'https://dg.58.com/cangkucf/zs4200.shtml',
      ],
    },
    {
      adapter: listing99cfwGuangdongAdapter,
      html: `
        <div class="list">
          <a class="title" href="/changfang/123456.html">东莞松山湖独院厂房出租</a>
          <a class="title" href="https://fs.99cfw.com/cangku/2600.html">佛山顺德仓库出租</a>
          <a href="/changfang/">厂房出租列表</a>
          <a href="https://www.99cfw.com/changfangxuqiu/900.html">需求详情</a>
        </div>
      `,
      listUrl: 'https://dg.99cfw.com/changfang/',
      expectedUrls: [
        'https://dg.99cfw.com/changfang/123456.html',
        'https://fs.99cfw.com/cangku/2600.html',
      ],
    },
    {
      adapter: listingCangxiaoerGuangdongAdapter,
      html: `
        <section>
          <a href="/d/cangku/sz-100.html">深圳宝安物流仓出租</a>
          <div data-detail-url="https://www.cangxiaoer.com/d/changfang/hz-200.html"></div>
          <a href="/cangku/cc440000-b1">广东仓库列表</a>
          <a href="https://example.com/d/changfang/fake.html">外站房源</a>
        </section>
      `,
      listUrl: 'https://www.cangxiaoer.com/cangku/cc440000-b1',
      expectedUrls: [
        'https://www.cangxiaoer.com/d/cangku/sz-100.html',
        'https://www.cangxiaoer.com/d/changfang/hz-200.html',
      ],
    },
    {
      adapter: listingToodcGuangdongAdapter,
      html: `
        <div id="app">
          <a href="/factory/abc">头等仓东莞长安厂房出租</a>
          <a href="https://gz.toodc.cn/warehouse/gz5800">广州黄埔高台仓库出租</a>
          <a href="/map/">地图找仓库</a>
          <a href="https://example.com/factory/fake">外站房源</a>
        </div>
      `,
      listUrl: 'https://dg.toodc.cn/map/u1',
      expectedUrls: [
        'https://dg.toodc.cn/factory/abc',
        'https://gz.toodc.cn/warehouse/gz5800',
      ],
    },
    {
      adapter: listingFangGuangdongAdapter,
      html: `
        <div class="fang-list">
          <a href="/cf/zu/3_100.html">东莞寮步厂房出租</a>
          <a href="https://zh.shop.fang.com/cf/zu/3_200.htm">珠海斗门工业园仓库出租</a>
          <script>
            window.__LIST__ = [{"title":"广州黄埔厂房","detailUrl":"https://gz.shop.fang.com/cf/zu/3_300.html"}]
          </script>
          <a href="/cf/zu/house/">厂房出租列表</a>
        </div>
      `,
      listUrl: 'https://dg.shop.fang.com/cf/zu/house/',
      expectedUrls: [
        'https://dg.shop.fang.com/cf/zu/3_100.html',
        'https://zh.shop.fang.com/cf/zu/3_200.htm',
        'https://gz.shop.fang.com/cf/zu/3_300.html',
      ],
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

  it.each([
    {
      adapter: listing99cfwGuangdongAdapter,
      html: `
        <article>
          <h1>东莞松山湖独院厂房出租 - 99厂房网</h1>
          <div>所在城市：东莞市</div>
          <div>区域：松山湖</div>
          <div>厂房面积：1200 平方米</div>
          <div>租金：18 元/㎡/月</div>
          <div>联系人：张先生</div>
          <div>电话：13800138000</div>
          <div>发布时间：1天前</div>
        </article>
      `,
      sourceUrl: 'https://dg.99cfw.com/changfang/123456.html',
      expected: {
        areaSqm: 1200,
        areaText: '1200 平方米',
        city: '东莞',
        contactName: '张先生',
        district: '松山湖',
        phoneNumber: '13800138000',
        priceText: '18 元/㎡/月',
        publishedAt: '2026-05-19T02:00:00.000Z',
        sourceSite: '99cfw',
        title: '东莞松山湖独院厂房出租',
      },
    },
    {
      adapter: listing99cfwGuangdongAdapter,
      html: `
        <main>
          <h1>佛山顺德仓库出租</h1>
          <p>地址：佛山市顺德区伦教工业园</p>
          <p>仓库面积：2600 ㎡</p>
          <p>价格：16 元/㎡/月</p>
          <p>联系人：陈经理</p>
          <p>手机号码：13922223333</p>
          <p>更新时间：2026-05-18</p>
        </main>
      `,
      sourceUrl: 'https://fs.99cfw.com/cangku/2600.html',
      expected: {
        areaSqm: 2600,
        areaText: '2600 ㎡',
        city: '佛山',
        contactName: '陈经理',
        district: '顺德',
        phoneNumber: '13922223333',
        priceText: '16 元/㎡/月',
        publishedAt: '2026-05-17T16:00:00.000Z',
        sourceSite: '99cfw',
        title: '佛山顺德仓库出租',
      },
    },
    {
      adapter: listing58GuangdongAdapter,
      html: `
        <section>
          <h1>东莞厚街独门独院厂房出租</h1>
          <div>区县商圈：东莞厚街</div>
          <div>面积：1800 平米</div>
          <div>租金：20 元/㎡/月</div>
          <div>联系人：李先生</div>
          <div>联系电话：13333334444</div>
          <div>更新时间：2026-05-14</div>
        </section>
      `,
      sourceUrl: 'https://dg.58.com/cfcz/dg1800.shtml',
      expected: {
        areaSqm: 1800,
        areaText: '1800 平米',
        city: '东莞',
        contactName: '李先生',
        district: '厚街',
        phoneNumber: '13333334444',
        priceText: '20 元/㎡/月',
        publishedAt: '2026-05-13T16:00:00.000Z',
        sourceSite: '58.com',
        title: '东莞厚街独门独院厂房出租',
      },
    },
    {
      adapter: listing58GuangdongAdapter,
      html: `
        <article>
          <h1>中山火炬开发区仓库出租</h1>
          <p>地址：中山市火炬开发区沿江东路</p>
          <p>仓库面积：4200 ㎡</p>
          <p>价格：17 元/㎡/月</p>
          <p>经纪人：黄经理</p>
          <p>电话：13211112222</p>
          <p>发布时间：2026-05-13 11:00</p>
        </article>
      `,
      sourceUrl: 'https://dg.58.com/cangkucf/zs4200.shtml',
      expected: {
        areaSqm: 4200,
        areaText: '4200 ㎡',
        city: '中山',
        contactName: '黄经理',
        district: '火炬开发区',
        phoneNumber: '13211112222',
        priceText: '17 元/㎡/月',
        publishedAt: '2026-05-13T03:00:00.000Z',
        sourceSite: '58.com',
        title: '中山火炬开发区仓库出租',
      },
    },
    {
      adapter: listingFangGuangdongAdapter,
      html: `
        <article>
          <h1>东莞寮步厂房出租 - 房天下</h1>
          <div>区域：东莞寮步</div>
          <div>建筑面积：1500 平方米</div>
          <div>租金：21 元/㎡/月</div>
          <div>联系人：何经理</div>
          <div>电话：13100001111</div>
          <div>发布时间：2026-05-12</div>
        </article>
      `,
      sourceUrl: 'https://dg.shop.fang.com/cf/zu/3_100.html',
      expected: {
        areaSqm: 1500,
        areaText: '1500 平方米',
        city: '东莞',
        contactName: '何经理',
        district: '寮步',
        phoneNumber: '13100001111',
        priceText: '21 元/㎡/月',
        publishedAt: '2026-05-11T16:00:00.000Z',
        sourceSite: 'fang.com',
        title: '东莞寮步厂房出租',
      },
    },
    {
      adapter: listingFangGuangdongAdapter,
      html: `
        <section>
          <h1>珠海斗门工业园仓库出租</h1>
          <dl>
            <dt>楼盘地址</dt><dd>珠海市斗门区白蕉镇</dd>
            <dt>面积</dt><dd>3600 ㎡</dd>
            <dt>单价</dt><dd>19 元/㎡/月</dd>
            <dt>经纪人</dt><dd>孙女士</dd>
            <dt>联系电话</dt><dd>13099998888</dd>
            <dt>更新时间</dt><dd>2026-05-11 10:45</dd>
          </dl>
        </section>
      `,
      sourceUrl: 'https://dg.shop.fang.com/cf/zu/3_200.htm',
      expected: {
        areaSqm: 3600,
        areaText: '3600 ㎡',
        city: '珠海',
        contactName: '孙女士',
        district: '斗门',
        phoneNumber: '13099998888',
        priceText: '19 元/㎡/月',
        publishedAt: '2026-05-11T02:45:00.000Z',
        sourceSite: 'fang.com',
        title: '珠海斗门工业园仓库出租',
      },
    },
    {
      adapter: listingToodcGuangdongAdapter,
      html: `
        <section class="detail">
          <h1>头等仓东莞长安厂房出租</h1>
          <p>地址：东莞市长安镇厦岗社区</p>
          <p>建筑面积：3000 ㎡</p>
          <p>价格：22 元/㎡/月</p>
          <p>顾问：刘先生</p>
          <p>联系电话：13700001111</p>
          <p>更新时间：2026-05-19</p>
        </section>
      `,
      sourceUrl: 'https://dg.toodc.cn/factory/abc',
      expected: {
        areaSqm: 3000,
        areaText: '3000 ㎡',
        city: '东莞',
        contactName: '刘先生',
        district: '长安',
        phoneNumber: '13700001111',
        priceText: '22 元/㎡/月',
        publishedAt: '2026-05-18T16:00:00.000Z',
        sourceSite: 'toodc.cn',
        title: '头等仓东莞长安厂房出租',
      },
    },
    {
      adapter: listingToodcGuangdongAdapter,
      html: `
        <html>
          <h1>广州黄埔高台仓库出租</h1>
          <ul>
            <li>所在区域：广州市黄埔区开发大道</li>
            <li>可租面积：5800 平方米</li>
            <li>租金：28 元/㎡/月</li>
            <li>联系人：王女士</li>
            <li>手机：13666668888</li>
            <li>发布时间：2026-05-17 15:20</li>
          </ul>
        </html>
      `,
      sourceUrl: 'https://gz.toodc.cn/warehouse/gz5800',
      expected: {
        areaSqm: 5800,
        areaText: '5800 平方米',
        city: '广州',
        contactName: '王女士',
        district: '黄埔',
        phoneNumber: '13666668888',
        priceText: '28 元/㎡/月',
        publishedAt: '2026-05-17T07:20:00.000Z',
        sourceSite: 'toodc.cn',
        title: '广州黄埔高台仓库出租',
      },
    },
    {
      adapter: listingCangxiaoerGuangdongAdapter,
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
      sourceUrl: 'https://www.cangxiaoer.com/d/cangku/sz-100.html',
      expected: {
        areaSqm: 4800,
        areaText: '4800 平米',
        city: '深圳',
        contactName: '赵经理',
        district: '宝安',
        phoneNumber: '13512345678',
        priceText: '35 元/㎡/月',
        publishedAt: '2026-05-15T16:00:00.000Z',
        sourceSite: 'cangxiaoer.com',
        title: '深圳宝安物流仓出租',
      },
    },
    {
      adapter: listingCangxiaoerGuangdongAdapter,
      html: `
        <article>
          <h1>惠州惠阳标准厂房出租</h1>
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
      sourceUrl: 'https://www.cangxiaoer.com/d/changfang/hz-200.html',
      expected: {
        areaSqm: 2000,
        areaText: '2000 ㎡',
        city: '惠州',
        contactName: '周先生',
        district: '惠阳',
        phoneNumber: '13400002222',
        priceText: '14 元/㎡/月',
        publishedAt: '2026-05-14T16:00:00.000Z',
        sourceSite: 'cangxiaoer.com',
        title: '惠州惠阳标准厂房出租',
      },
    },
    {
      adapter: listingCfzxGuangdongAdapter,
      html: `
        <article>
          <h1>广州黄埔独院厂房出租</h1>
          <div>所在城市：广州市</div>
          <div>所在区域：黄埔区</div>
          <div>厂房面积：2600 ㎡</div>
          <div>租金：25 元/㎡/月</div>
          <div>招商经理：林先生</div>
          <div>电话：13822223333</div>
          <div>发布时间：2026-05-20</div>
        </article>
      `,
      sourceUrl: 'https://www.cfzx.com/changfang/200.html',
      expected: {
        areaSqm: 2600,
        areaText: '2600 ㎡',
        city: '广州',
        contactName: '林先生',
        district: '黄埔',
        phoneNumber: '13822223333',
        priceText: '25 元/㎡/月',
        publishedAt: '2026-05-19T16:00:00.000Z',
        sourceSite: 'cfzx',
        title: '广州黄埔独院厂房出租',
      },
    },
    {
      adapter: listingCfzxGuangdongAdapter,
      html: `
        <section>
          <h1>深圳龙华标准仓库出租</h1>
          <p>城市：深圳市</p>
          <p>区域：龙华区</p>
          <p>仓库面积：4100 平方米</p>
          <p>价格：30 元/㎡/月</p>
          <p>顾问：何女士</p>
          <p>联系电话：13988887777</p>
          <p>更新于：2026-05-18 09:20</p>
        </section>
      `,
      sourceUrl: 'https://www.cfzx.com/cangku/201.html',
      expected: {
        areaSqm: 4100,
        areaText: '4100 平方米',
        city: '深圳',
        contactName: '何女士',
        district: '龙华',
        phoneNumber: '13988887777',
        priceText: '30 元/㎡/月',
        publishedAt: '2026-05-18T01:20:00.000Z',
        sourceSite: 'cfzx',
        title: '深圳龙华标准仓库出租',
      },
    },
    {
      adapter: listingZgzswGuangdongAdapter,
      html: `
        <article>
          <h1>东莞五金园区厂房出租</h1>
          <p>区域：东莞市厚街镇</p>
          <p>厂房面积：5000 ㎡</p>
          <p>价格：19 元/㎡/月</p>
          <p>招商经理：周总</p>
          <p>手机：13600002222</p>
          <p>发布时间：2026-05-19 16:30</p>
        </article>
      `,
      sourceUrl: 'https://www.zgzsw.com/changfang/301.html',
      expected: {
        areaSqm: 5000,
        areaText: '5000 ㎡',
        city: '东莞',
        contactName: '周总',
        district: '厚街',
        phoneNumber: '13600002222',
        priceText: '19 元/㎡/月',
        publishedAt: '2026-05-19T08:30:00.000Z',
        sourceSite: 'zgzsw',
        title: '东莞五金园区厂房出租',
      },
    },
    {
      adapter: listingZgzswGuangdongAdapter,
      html: `
        <section>
          <h1>佛山顺德仓库出租</h1>
          <dl>
            <dt>所在城市</dt><dd>佛山市</dd>
            <dt>区域</dt><dd>顺德区</dd>
            <dt>建筑面积</dt><dd>3600 ㎡</dd>
            <dt>单价</dt><dd>17 元/㎡/月</dd>
            <dt>联系人</dt><dd>黄先生</dd>
            <dt>联系电话</dt><dd>13799996666</dd>
            <dt>发布于</dt><dd>2026-05-18</dd>
          </dl>
        </section>
      `,
      sourceUrl: 'https://guangdong.zgzsw.com/cangku/302.html',
      expected: {
        areaSqm: 3600,
        areaText: '3600 ㎡',
        city: '佛山',
        contactName: '黄先生',
        district: '顺德',
        phoneNumber: '13799996666',
        priceText: '17 元/㎡/月',
        publishedAt: '2026-05-17T16:00:00.000Z',
        sourceSite: 'zgzsw',
        title: '佛山顺德仓库出租',
      },
    },
  ])(
    'extracts $expected.sourceSite listing accurately',
    ({ adapter, html, sourceUrl, expected }) => {
      const result = adapter.extractFromHtml(html, sourceUrl);

      expect(result).toMatchObject({
        ...expected,
        opportunityType: 'SUPPLY',
        sourceUrl,
      });
      expect(result.detailJson.responseHash).toHaveLength(64);
      expect(result.missingFields).toEqual([]);
    },
  );
});
