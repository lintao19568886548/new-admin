import type { PublicListingCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { extractStrictListingFromHtml } from './strict-listing-parser';

export const listingCfzxGuangdongAdapter: PublicListingCrawlerAdapter = {
  extractFromHtml: (html, sourceUrl) =>
    extractStrictListingFromHtml(html, sourceUrl, {
      areaLabels: ['厂房面积', '仓库面积', '建筑面积', '可租面积', '总面积'],
      cityLabels: ['城市', '区域', '地址', '所在城市', '所在地'],
      contactLabels: ['联系人', '经纪人', '顾问', '招商经理'],
      districtLabels: ['区域', '地址', '所在区域', '所在位置'],
      phoneLabels: ['联系电话', '电话', '手机', '咨询电话'],
      priceLabels: ['租金', '价格', '单价', '报价'],
      publishedLabels: ['发布时间', '更新时间', '发布于', '最近更新'],
      sourceSite: 'cfzx',
      titleSuffixPattern: /\s*[-_|].*(?:厂房在线|cfzx).*$/iu,
    }),
  listUrls: [
    'https://www.cfzx.com/xuqiu/',
    'https://www.cfzx.com/changfang/',
    'https://www.cfzx.com/cangku/',
    'https://www.cfzx.com/xiezilou/',
  ],
  opportunityType: 'SUPPLY',
  platformName: '厂房在线广东房源',
  sourceCode: 'PUBLIC_FACTORY_LISTING_CFZX_GD',
  sourceSite: 'cfzx',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['cfzx.com'])) {
      return false;
    }
    try {
      const { pathname } = new URL(sourceUrl);
      return (
        ['/xuqiu/', '/changfang/', '/cangku/', '/xiezilou/', '/detail/'].some(
          (prefix) => pathname.startsWith(prefix),
        ) && /^\/[^?#]+$/.test(pathname)
      );
    } catch {
      return false;
    }
  },
};
