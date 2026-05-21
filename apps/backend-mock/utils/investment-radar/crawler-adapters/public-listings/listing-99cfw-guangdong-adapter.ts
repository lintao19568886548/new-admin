import type { PublicListingCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { extractListingDetailUrlsFromListHtml } from './listing-url-discovery';
import { extractStrictListingFromHtml } from './strict-listing-parser';

export const listing99cfwGuangdongAdapter: PublicListingCrawlerAdapter = {
  extractDetailUrlsFromListHtml: (html, listUrl) =>
    extractListingDetailUrlsFromListHtml(html, listUrl, {
      validateDetailUrl: (sourceUrl) =>
        listing99cfwGuangdongAdapter.validateDetailUrl(sourceUrl),
    }),
  extractFromHtml: (html, sourceUrl) =>
    extractStrictListingFromHtml(html, sourceUrl, {
      areaLabels: ['厂房面积', '仓库面积', '占地面积', '可租面积'],
      cityLabels: ['城市', '所在城市', '区域', '地址', '所在位置'],
      contactLabels: ['联系人', '联 系 人', '经纪人', '招商经理'],
      districtLabels: ['区域', '地址', '地段', '所在位置'],
      phoneLabels: ['联系电话', '电话', '手机号码', '联系手机'],
      priceLabels: ['租金', '价格', '厂房租金', '仓库租金', '报价'],
      publishedLabels: ['发布时间', '更新时间', '信息发布', '发布于'],
      sourceSite: '99cfw',
      titleSuffixPattern: /\s*[-_|].*99厂房网.*$/u,
    }),
  listUrls: [
    'https://dg.99cfw.com/changfang/',
    'https://dg.99cfw.com/cangku/',
    'https://gz.99cfw.com/changfang/',
    'https://sz.99cfw.com/changfang/',
    'https://fs.99cfw.com/changfang/',
    'https://hz.99cfw.com/changfang/',
    'https://zs.99cfw.com/changfang/',
    'https://zh.99cfw.com/changfang/',
    'https://jm.99cfw.com/changfang/',
  ],
  opportunityType: 'SUPPLY',
  platformName: '99厂房网广东房源',
  sourceCode: 'PUBLIC_FACTORY_LISTING_99CFW_GD',
  sourceSite: '99cfw',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['99cfw.com'])) {
      return false;
    }
    try {
      const { hostname, pathname } = new URL(sourceUrl);
      if (!/^(?:www|dg|gz|sz|fs|hz|zs|zh|jm|zq)\.99cfw\.com$/i.test(hostname)) {
        return false;
      }
      return /^\/(?:changfang|cangku|yuanqu|tudi|xiezilou)\/[\w-]+\.(?:html|htm)$/i.test(
        pathname,
      );
    } catch {
      return false;
    }
  },
};
