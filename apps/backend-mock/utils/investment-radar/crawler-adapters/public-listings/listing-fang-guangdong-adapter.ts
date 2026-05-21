import type { PublicListingCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { extractListingDetailUrlsFromListHtml } from './listing-url-discovery';
import { extractStrictListingFromHtml } from './strict-listing-parser';

export const listingFangGuangdongAdapter: PublicListingCrawlerAdapter = {
  extractDetailUrlsFromListHtml: (html, listUrl) =>
    extractListingDetailUrlsFromListHtml(html, listUrl, {
      validateDetailUrl: (sourceUrl) =>
        listingFangGuangdongAdapter.validateDetailUrl(sourceUrl),
    }),
  extractFromHtml: (html, sourceUrl) =>
    extractStrictListingFromHtml(html, sourceUrl, {
      areaLabels: ['建筑面积', '面积', '厂房面积', '占地面积', '可租面积'],
      cityLabels: ['城市', '区域', '地址', '楼盘地址', '项目地址'],
      contactLabels: ['联系人', '经纪人', '置业顾问', '招商经理'],
      districtLabels: ['区域', '地址', '楼盘地址', '项目地址', '所在区域'],
      phoneLabels: ['电话', '联系电话', '手机', '咨询电话'],
      priceLabels: ['租金', '价格', '单价', '均价', '参考价'],
      publishedLabels: ['发布时间', '更新时间', '发布于', '开盘时间'],
      sourceSite: 'fang.com',
      titleSuffixPattern: /\s*[-_|].*(?:房天下|fang\.com).*$/iu,
    }),
  listUrls: ['https://dg.shop.fang.com/cf/zu/house/'],
  opportunityType: 'SUPPLY',
  platformName: '房天下广东厂房房源',
  sourceCode: 'PUBLIC_FACTORY_LISTING_FANG_GD',
  sourceSite: 'fang.com',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['fang.com'])) {
      return false;
    }
    try {
      const { hostname, pathname } = new URL(sourceUrl);
      if (
        !/^(?:dg|gz|sz|fs|hz|zs|zh|jm|zq)\.shop\.fang\.com$/i.test(hostname)
      ) {
        return false;
      }
      return (
        ['/cf/', '/changfang/', '/fangyuan/', '/house/', '/industrial/'].some(
          (prefix) => pathname.startsWith(prefix),
        ) && /^\/[^?#]+(?:\.html|\.htm)$/i.test(pathname)
      );
    } catch {
      return false;
    }
  },
};
