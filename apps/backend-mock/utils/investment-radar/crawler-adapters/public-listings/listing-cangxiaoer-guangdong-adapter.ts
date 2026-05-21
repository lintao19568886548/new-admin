import type { PublicListingCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { extractListingDetailUrlsFromListHtml } from './listing-url-discovery';
import { extractStrictListingFromHtml } from './strict-listing-parser';

export const listingCangxiaoerGuangdongAdapter: PublicListingCrawlerAdapter = {
  extractDetailUrlsFromListHtml: (html, listUrl) =>
    extractListingDetailUrlsFromListHtml(html, listUrl, {
      validateDetailUrl: (sourceUrl) =>
        listingCangxiaoerGuangdongAdapter.validateDetailUrl(sourceUrl),
    }),
  extractFromHtml: (html, sourceUrl) =>
    extractStrictListingFromHtml(html, sourceUrl, {
      areaLabels: ['总面积', '可租面积', '建筑面积', '仓库面积', '厂房面积'],
      cityLabels: ['城市', '所在城市', '地址', '位置', '区域'],
      contactLabels: ['联系人', '经纪人', '顾问', '招商主管'],
      districtLabels: ['区域', '地址', '位置', '所在区域'],
      phoneLabels: ['联系电话', '电话', '手机', '咨询电话', '热线'],
      priceLabels: ['租金', '价格', '参考价', '报价'],
      publishedLabels: ['更新时间', '发布时间', '发布于'],
      sourceSite: 'cangxiaoer.com',
      titleSuffixPattern: /\s*[-_|].*仓小二.*$/u,
    }),
  listUrls: [
    'https://www.cangxiaoer.com/changfang/cc440000-b1',
    'https://www.cangxiaoer.com/cangku/cc440000-b1',
    'https://guangdong.cangxiaoer.com/',
  ],
  opportunityType: 'SUPPLY',
  platformName: '仓小二广东房源',
  sourceCode: 'PUBLIC_FACTORY_LISTING_CANGXIAOER_GD',
  sourceSite: 'cangxiaoer.com',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['cangxiaoer.com'])) {
      return false;
    }
    try {
      const { pathname } = new URL(sourceUrl);
      return (
        /^\/d\/(?:cangku|changfang)\/[\w-]+\.html$/i.test(pathname) ||
        /^\/(?:cangku|changfang)\/[\w-]+\.html$/i.test(pathname) ||
        ['/d/cangku/', '/d/changfang/', '/d/yuanqu/'].some((prefix) =>
          pathname.startsWith(prefix),
        )
      );
    } catch {
      return false;
    }
  },
};
