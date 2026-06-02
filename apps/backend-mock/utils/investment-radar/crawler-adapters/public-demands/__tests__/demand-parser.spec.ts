import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { demand99cfwGuangdongAdapter } from '../demand-99cfw-guangdong-adapter';
import { demandLocalPublicPageAdapter } from '../demand-local-public-page-adapter';

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
        <title>\u5E7F\u5DDE\u7535\u5B50\u4F01\u4E1A\u6C42\u79DF\u5382\u623F1000-1500\u5E73 - 99\u5382\u623F\u7F51</title>
        <meta name="description" content="\u5730\u70B9\uFF1A\u5E7F\u5DDE\u5E02\u9EC4\u57D4\u533A\uFF0C\u9700\u6C42\u9762\u79EF\uFF1A1000-1500\u5E73\uFF0C\u884C\u4E1A\uFF1A\u7535\u5B50\u4FE1\u606F\uFF0C\u8054\u7CFB\u4EBA\uFF1A\u674E\u7ECF\u7406\uFF0C\u7535\u8BDD\uFF1A13900139000\uFF0C\u53D1\u5E03\u65F6\u95F4\uFF1A2026-05-19">
        <h1>\u5E7F\u5DDE\u7535\u5B50\u4F01\u4E1A\u6C42\u79DF\u5382\u623F1000-1500\u5E73</h1>
        <p>\u5730\u70B9\uFF1A\u5E7F\u5DDE\u5E02\u9EC4\u57D4\u533A</p>
        <p>\u9700\u6C42\u9762\u79EF\uFF1A1000-1500\u5E73</p>
        <p>\u79DF\u91D1\u9884\u7B97\uFF1A30\u5143/\u5E73/\u6708\u4EE5\u5185</p>
        <p>\u6240\u5C5E\u884C\u4E1A\uFF1A\u7535\u5B50\u4FE1\u606F</p>
        <p>\u8054\u7CFB\u4EBA\uFF1A\u674E\u7ECF\u7406 13900139000</p>
        <p>\u53D1\u5E03\u65F6\u95F4\uFF1A2026-05-19</p>
      `,
      'https://gz.99cfw.com/changfangxuqiu/8899.html',
    );

    expect(result).toMatchObject({
      areaText: null,
      city: '\u5E7F\u5DDE',
      contactName: '\u674E\u7ECF\u7406',
      district: '\u5E7F\u5DDE\u5E02\u9EC4\u57D4\u533A',
      industryText: '\u7535\u5B50\u4FE1\u606F',
      opportunityType: 'DEMAND',
      phoneNumber: '13900139000',
      priceText: '30\u5143/\u5E73/\u6708\u4EE5\u5185',
      publishedAt: '2026-05-18T16:00:00.000Z',
      publishedDateText: '2026-05-19',
      sourceSite: '99cfw',
      sourceUrl: 'https://gz.99cfw.com/changfangxuqiu/8899.html',
      title:
        '\u5E7F\u5DDE\u7535\u5B50\u4F01\u4E1A\u6C42\u79DF\u5382\u623F1000-1500\u5E73',
    });
    expect(result.missingFields).toContain('areaText');
  });

  it('uses the crawler timestamp as the baseline for relative local demand time', () => {
    const result = demandLocalPublicPageAdapter.extractFromHtml(
      `
        <article>
          <h1>\u3010\u62DB\u5546\u9700\u6C42\u3011\u4F5B\u5C71\u98DF\u54C1\u4F01\u4E1A\u5BFB\u6807\u51C6\u5382\u623F</h1>
          <p>\u672C\u5730\u8BBA\u575B\u516C\u5F00\u62DB\u5546\u9700\u6C42\uFF1A\u4F01\u4E1A\u8BA1\u5212\u5728\u4F5B\u5C71\u5E02\u987A\u5FB7\u533A\u843D\u5730\u98DF\u54C1\u52A0\u5DE5\u9879\u76EE\u3002</p>
          <p>\u9700\u6C42\u9762\u79EF\uFF1A1800 \u5E73\u65B9\u7C73\uFF0C\u884C\u4E1A\uFF1A\u98DF\u54C1\u52A0\u5DE5\uFF0C\u8054\u7CFB\u4EBA\uFF1A\u9648\u7ECF\u7406\uFF0C\u7535\u8BDD\uFF1A13900139002\u3002</p>
          <p>\u53D1\u5E03\u65F6\u95F4\uFF1A\u4ECA\u5929 10:30</p>
        </article>
      `,
      'file:///C:/tmp/forum-demand.html',
      new Date('2026-05-19T23:40:00+08:00'),
    );

    expect(result).toMatchObject({
      areaText: '1800 \u5E73\u65B9\u7C73',
      city: '\u4F5B\u5C71',
      contactName: '\u9648\u7ECF\u7406',
      district: '\u4F5B\u5C71\u5E02\u987A\u5FB7\u533A',
      industryText: '\u98DF\u54C1\u52A0\u5DE5',
      opportunityType: 'DEMAND',
      phoneNumber: '13900139002',
      publishedAt: '2026-05-19T02:30:00.000Z',
      publishedDateText: '\u4ECA\u5929 10:30',
      sourceSite: 'local-public-page',
      title:
        '\u3010\u62DB\u5546\u9700\u6C42\u3011\u4F5B\u5C71\u98DF\u54C1\u4F01\u4E1A\u5BFB\u6807\u51C6\u5382\u623F',
    });
    expect(result.missingFields).toEqual([]);
  });
});
