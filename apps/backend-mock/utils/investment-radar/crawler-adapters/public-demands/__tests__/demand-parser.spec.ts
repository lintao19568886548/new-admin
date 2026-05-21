import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { demand99cfwGuangdongAdapter } from '../demand-99cfw-guangdong-adapter';
import { demandCfzxGuangdongAdapter } from '../demand-cfzx-guangdong-adapter';
import { demandLocalPublicPageAdapter } from '../demand-local-public-page-adapter';
import { demandZgzswGuangdongAdapter } from '../demand-zgzsw-guangdong-adapter';

describe('public demand parser', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T10:00:00+08:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('extracts 99cfw Guangdong demand fields from detail text and meta description', () => {
    const result = demand99cfwGuangdongAdapter.extractFromHtml(
      `
        <title>广州电子企业求租厂房1000-1500㎡ - 99厂房网</title>
        <meta name="description" content="地点：广州市黄埔区，需求面积：1000-1500㎡，行业：电子信息，联系人：李经理，电话：13900139000，发布时间：2026-05-19">
        <h1>广州电子企业求租厂房1000-1500㎡</h1>
        <p>地点：广州市黄埔区</p>
        <p>期望租赁面积：1000-1500㎡</p>
        <p>租金预算：30元/㎡/月以内</p>
        <p>所属行业：电子信息</p>
        <p>联系人：李经理 13900139000</p>
        <p>发布时间：2026-05-19</p>
      `,
      'https://gz.99cfw.com/changfangxuqiu/8899.html',
    );

    expect(result).toMatchObject({
      areaText: '1000-1500㎡',
      city: '广州',
      contactName: '李经理',
      district: '广州市黄埔区',
      industryText: '电子信息',
      opportunityType: 'DEMAND',
      phoneNumber: '13900139000',
      priceText: '30元/㎡/月以内',
      publishedAt: '2026-05-18T16:00:00.000Z',
      publishedDateText: '2026-05-19',
      sourceSite: '99cfw',
      sourceUrl: 'https://gz.99cfw.com/changfangxuqiu/8899.html',
      title: '广州电子企业求租厂房1000-1500㎡',
    });
    expect(result.missingFields).toEqual([]);
  });

  it('extracts 99cfw demand fields from compact xuqiu page text without company name', () => {
    const result = demand99cfwGuangdongAdapter.extractFromHtml(
      `
        <title>东莞求租1000方厂房,租金面议 - 99厂房网</title>
        <div class="title">东莞求租1000方厂房</div>
        <ul>
          <li>需求区域 东莞市凤岗镇</li>
          <li>面积范围 1000 方</li>
          <li>预算价格 面议</li>
          <li>所属产业 电子</li>
          <li>联络人 张先生</li>
          <li>联系电话 暂无</li>
          <li>最近更新 1天前</li>
        </ul>
      `,
      'https://dg.99cfw.com/xuqiu/zryzsawsrySwx.htm',
    );

    expect(result).toMatchObject({
      areaText: '1000 方',
      city: '东莞',
      contactName: '张先生',
      district: '东莞市凤岗镇',
      industryText: '电子',
      phoneNumber: null,
      priceText: '面议',
      publishedAt: '2026-05-19T02:00:00.000Z',
      publishedDateText: '1天前',
      sourceUrl: 'https://dg.99cfw.com/xuqiu/zryzsawsrySwx.htm',
      title: '东莞求租1000方厂房',
    });
    expect(result.missingFields).toEqual([]);
  });

  it('extracts 厂房在线 demand fields from table labels and relative published time', () => {
    const result = demandCfzxGuangdongAdapter.extractFromHtml(
      `
        <h1>深圳新能源企业求租生产空间</h1>
        <table>
          <tr><th>需求区域</th><td>深圳市宝安区</td></tr>
          <tr><th>用房面积</th><td>3500-5000 m2</td></tr>
          <tr><th>期望租金</th><td>25元/m2/月</td></tr>
          <tr><th>产业类型</th><td>新能源</td></tr>
          <tr><th>联系人姓名</th><td>王女士</td></tr>
          <tr><th>联系电话</th><td>138-0013-8001</td></tr>
          <tr><th>更新时间</th><td>3小时前</td></tr>
        </table>
      `,
      'https://www.cfzx.com/xuqiu/shenzhen/100.html',
    );

    expect(result).toMatchObject({
      areaText: '3500-5000 m2',
      city: '深圳',
      contactName: '王女士',
      district: '深圳市宝安区',
      industryText: '新能源',
      phoneNumber: '13800138001',
      priceText: '25元/m2/月',
      publishedAt: '2026-05-19T23:00:00.000Z',
      publishedDateText: '3小时前',
      sourceSite: 'cfzx',
      title: '深圳新能源企业求租生产空间',
    });
    expect(result.missingFields).toEqual([]);
  });

  it('extracts 厂房在线 demand fields from inline colon-separated content', () => {
    const result = demandCfzxGuangdongAdapter.extractFromHtml(
      `
        <article>
          <h2>惠州医疗器械客户求租洁净厂房</h2>
          <p>意向区域：惠州市惠阳区；意向面积：2200-2600平方米；承受租金：18元/平方米/月；需求行业：医疗器械；姓名：赵经理；手机号码：139-2222-3333；发布时间：20260519</p>
        </article>
      `,
      'https://www.cfzx.com/xuqiu/huizhou/8800',
    );

    expect(result).toMatchObject({
      areaText: '2200-2600平方米',
      city: '惠州',
      contactName: '赵经理',
      district: '惠州市惠阳区',
      industryText: '医疗器械',
      phoneNumber: '13922223333',
      priceText: '18元/平方米/月',
      publishedAt: '2026-05-18T16:00:00.000Z',
      publishedDateText: '20260519',
      sourceSite: 'cfzx',
      title: '惠州医疗器械客户求租洁净厂房',
    });
    expect(result.missingFields).toEqual([]);
  });

  it('extracts 中工招商 demand fields from json-ld plus visible content', () => {
    const result = demandZgzswGuangdongAdapter.extractFromHtml(
      `
        <script type="application/ld+json">
          {
            "@type": "Article",
            "headline": "东莞五金企业求租厂房",
            "description": "求租区域：东莞市厚街镇；需求面积：1200-1800平方米；行业：五金加工；联系人：周总；手机：13600002222；发布时间：2026-05-19 16:30"
          }
        </script>
        <article>
          <h1>东莞五金企业求租厂房</h1>
          <p>求租区域：东莞市厚街镇</p>
          <p>需求体量：1200-1800平方米</p>
          <p>总价预算：45万元</p>
          <p>项目行业：五金加工</p>
          <p>称呼：周总</p>
          <p>手机号码：13600002222</p>
          <p>发布于：2026-05-19 16:30</p>
        </article>
      `,
      'https://dongguan.zgzsw.com/xuqiu/200.html',
    );

    expect(result).toMatchObject({
      areaText: '1200-1800平方米',
      city: '东莞',
      contactName: '周总',
      district: '东莞市厚街镇',
      industryText: '五金加工',
      phoneNumber: '13600002222',
      priceText: '45万元',
      publishedAt: '2026-05-19T08:30:00.000Z',
      sourceSite: 'zgzsw',
      title: '东莞五金企业求租厂房',
    });
    expect(result.missingFields).toEqual([]);
  });

  it('extracts 中工招商 demand fields from detail text with hour-relative time', () => {
    const result = demandZgzswGuangdongAdapter.extractFromHtml(
      `
        <section>
          <h1>中山自动化项目求租厂房</h1>
          <div>选址区域 中山市火炬开发区</div>
          <div>计划面积 3000 至 4500 ㎡</div>
          <div>单价预算 20-25元/㎡/月</div>
          <div>所属行业 自动化</div>
          <div>联络人 黄女士</div>
          <div>电话 138 8888 9999</div>
          <div>发布时间 3小时前</div>
        </section>
      `,
      'https://zhongshan.zgzsw.com/xuqiu/3000/',
    );

    expect(result).toMatchObject({
      areaText: '3000 至 4500 ㎡',
      city: '中山',
      contactName: '黄女士',
      district: '中山市火炬开发区',
      industryText: '自动化',
      phoneNumber: '13888889999',
      priceText: '20-25元/㎡/月',
      publishedAt: '2026-05-19T23:00:00.000Z',
      publishedDateText: '3小时前',
      sourceSite: 'zgzsw',
      title: '中山自动化项目求租厂房',
    });
    expect(result.missingFields).toEqual([]);
  });

  it('extracts stable local forum demand text without platform host', () => {
    const result = demandLocalPublicPageAdapter.extractFromHtml(
      `
        <article>
          <h1>【招商需求】佛山食品企业寻标准厂房</h1>
          <p>本地论坛公开招商需求：企业计划在佛山市顺德区落地食品加工项目。</p>
          <p>需求面积：1800 平方米，行业：食品加工，联系人：陈经理，电话：13900139002。</p>
          <p>发布时间：今天 10:30</p>
        </article>
      `,
      'file:///C:/tmp/forum-demand.html',
    );

    expect(result).toMatchObject({
      areaText: '1800 平方米',
      city: '佛山',
      contactName: '陈经理',
      district: '佛山市顺德区',
      industryText: '食品加工',
      opportunityType: 'DEMAND',
      phoneNumber: '13900139002',
      publishedDateText: '今天 10:30',
      sourceSite: 'local-public-page',
      title: '【招商需求】佛山食品企业寻标准厂房',
    });
    expect(result.missingFields).toEqual([]);
  });

  it('does not mark unknown demand location as Guangdong', () => {
    const result = demandLocalPublicPageAdapter.extractFromHtml(
      `
        <article>
          <h1>电子企业求租厂房</h1>
          <p>需求面积：2000平方米，行业：电子信息，联系人：赵经理，电话：13900139003。</p>
          <p>发布时间：2026-05-20</p>
        </article>
      `,
      'https://example.local/forum/unknown-demand.html',
    );

    expect(result.city).toBeNull();
    expect(result.district).toBeNull();
    expect(result.missingFields).toEqual(expect.arrayContaining(['city']));
  });

  it('accepts common Guangdong demand detail URL patterns', () => {
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
        'https://dg.99cfw.com/xuqiu/0_1_0_0_0/',
      ),
    ).toBe(false);
    expect(
      demandCfzxGuangdongAdapter.validateDetailUrl(
        'https://www.cfzx.com/xuqiu/huizhou/8800',
      ),
    ).toBe(true);
    expect(
      demandCfzxGuangdongAdapter.validateDetailUrl(
        'https://www.cfzx.com/xuqiu/shenzhen/100/',
      ),
    ).toBe(true);
    expect(
      demandCfzxGuangdongAdapter.validateDetailUrl(
        'https://www.cfzx.com/xuqiu/',
      ),
    ).toBe(false);
    expect(
      demandZgzswGuangdongAdapter.validateDetailUrl(
        'https://zhongshan.zgzsw.com/xuqiu/3000/',
      ),
    ).toBe(true);
    expect(
      demandZgzswGuangdongAdapter.validateDetailUrl(
        'https://dongguan.zgzsw.com/xuqiu/200/',
      ),
    ).toBe(true);
    expect(
      demandZgzswGuangdongAdapter.validateDetailUrl(
        'https://dongguan.zgzsw.com/xuqiu/',
      ),
    ).toBe(false);
  });
});
