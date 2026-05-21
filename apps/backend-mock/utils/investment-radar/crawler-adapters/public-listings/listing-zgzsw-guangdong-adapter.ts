import type { PublicListingCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { extractStrictListingFromHtml } from './strict-listing-parser';

export const listingZgzswGuangdongAdapter: PublicListingCrawlerAdapter = {
  extractFromHtml: (html, sourceUrl) =>
    extractStrictListingFromHtml(html, sourceUrl, {
      areaLabels: ['厂房面积', '仓库面积', '建筑面积', '可租面积', '总面积'],
      cityLabels: ['城市', '区域', '地址', '所在城市', '所在地'],
      contactLabels: ['联系人', '经纪人', '顾问', '招商经理'],
      districtLabels: ['区域', '地址', '所在区域', '所在位置'],
      phoneLabels: ['联系电话', '电话', '手机', '咨询电话'],
      priceLabels: ['租金', '价格', '单价', '报价'],
      publishedLabels: ['发布时间', '更新时间', '发布于', '最近更新'],
      sourceSite: 'zgzsw',
      titleSuffixPattern: /\s*[-_|].*(?:中工招商|zgzsw).*$/iu,
    }),
  listUrls: [
    'https://www.zgzsw.com/xuqiu/',
    'https://guangdong.zgzsw.com/xuqiu/',
    'https://www.zgzsw.com/changfang/',
    'https://www.zgzsw.com/cangku/',
  ],
  opportunityType: 'SUPPLY',
  platformName: '中工招商广东房源',
  sourceCode: 'PUBLIC_FACTORY_LISTING_ZGZSW_GD',
  sourceSite: 'zgzsw',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['zgzsw.com'])) {
      return false;
    }
    try {
      const { pathname } = new URL(sourceUrl);
      return (
        ['/changfang/', '/cangku/', '/xiezilou/', '/detail/'].some((prefix) =>
          pathname.startsWith(prefix),
        ) && /^\/[^?#]+$/.test(pathname)
      );
    } catch {
      return false;
    }
  },
};
