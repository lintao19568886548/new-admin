import type { PublicListingCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { extractListingDetailUrlsFromListHtml } from './listing-url-discovery';
import { extractStrictListingFromHtml } from './strict-listing-parser';

export const listingToodcGuangdongAdapter: PublicListingCrawlerAdapter = {
  extractDetailUrlsFromListHtml: (html, listUrl) =>
    extractListingDetailUrlsFromListHtml(html, listUrl, {
      validateDetailUrl: (sourceUrl) =>
        listingToodcGuangdongAdapter.validateDetailUrl(sourceUrl),
    }),
  extractFromHtml: (html, sourceUrl) =>
    extractStrictListingFromHtml(html, sourceUrl, {
      areaLabels: ['面积', '建筑面积', '可租面积', '仓库面积', '厂房面积'],
      cityLabels: ['所在城市', '城市', '地址', '位置', '区域'],
      contactLabels: ['联系人', '经纪人', '顾问', '招商经理'],
      districtLabels: ['所在区域', '区域', '地址', '位置'],
      phoneLabels: ['联系电话', '电话', '手机', '咨询电话'],
      priceLabels: ['租金', '价格', '单价', '参考价'],
      publishedLabels: ['发布时间', '更新时间', '更新于', '发布于'],
      sourceSite: 'toodc.cn',
      titleSuffixPattern: /\s*[-_|].*(?:头等仓|toodc).*$/iu,
    }),
  listUrls: [
    'https://dg.toodc.cn/',
    'https://dg.toodc.cn/map/u1',
    'https://gz.toodc.cn/',
    'https://sz.toodc.cn/',
    'https://fs.toodc.cn/',
    'https://hz.toodc.cn/',
    'https://zs.toodc.cn/',
  ],
  opportunityType: 'SUPPLY',
  platformName: '头等仓广东房源',
  sourceCode: 'PUBLIC_FACTORY_LISTING_TOODC_GD',
  sourceSite: 'toodc.cn',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['toodc.cn'])) {
      return false;
    }
    try {
      const { pathname } = new URL(sourceUrl);
      return (
        [
          '/factory/',
          '/map/',
          '/project/',
          '/warehouse/',
          '/park/',
          '/fangyuan/',
        ].some((prefix) => pathname.startsWith(prefix)) &&
        !/\/(?:map|factory|warehouse|project|park|fangyuan)\/?$/i.test(pathname)
      );
    } catch {
      return false;
    }
  },
};
