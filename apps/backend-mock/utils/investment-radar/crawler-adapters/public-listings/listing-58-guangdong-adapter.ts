import type { PublicListingCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { extractListingDetailUrlsFromListHtml } from './listing-url-discovery';
import { extractStrictListingFromHtml } from './strict-listing-parser';

const GUANGDONG_58_HOST_PATTERN =
  /(?:^|\.)(?:(?:dg|gz|sz|fs|hz|zs|zh|jm|zq)\.)?58\.com$/i;

export const listing58GuangdongAdapter: PublicListingCrawlerAdapter = {
  extractDetailUrlsFromListHtml: (html, listUrl) =>
    extractListingDetailUrlsFromListHtml(html, listUrl, {
      validateDetailUrl: (sourceUrl) =>
        listing58GuangdongAdapter.validateDetailUrl(sourceUrl),
    }),
  extractFromHtml: (html, sourceUrl) =>
    extractStrictListingFromHtml(html, sourceUrl, {
      areaLabels: ['面积', '建筑面积', '厂房面积', '仓库面积', '占地面积'],
      cityLabels: ['城市', '区域', '地址', '地      址', '区县商圈', '位置'],
      contactLabels: ['联系人', '经纪人', '商家', '负责人'],
      districtLabels: ['区域', '区县商圈', '地址', '地      址', '位置'],
      phoneLabels: ['联系电话', '电话', '手机', '联系商家'],
      priceLabels: ['租金', '价格', '售价', '月租'],
      publishedLabels: ['更新时间', '发布时间', '发布于', '最近更新'],
      sourceSite: '58.com',
      titleSuffixPattern: /\s*[-_|].*(?:58同城|58\.com).*$/iu,
    }),
  listUrls: [
    'https://www.58.com/dg/cfcz-7-dg/',
    'https://www.58.com/dg/cfcz-9-dg/',
    'https://dg.58.com/cangkucf/',
  ],
  opportunityType: 'SUPPLY',
  platformName: '58同城广东厂房仓库房源',
  sourceCode: 'PUBLIC_FACTORY_LISTING_58_GD',
  sourceSite: '58.com',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['58.com'])) {
      return false;
    }
    try {
      const { hostname, pathname } = new URL(sourceUrl);
      if (!GUANGDONG_58_HOST_PATTERN.test(hostname)) {
        return false;
      }
      return /^\/(?:cangku|cangkucf|cfcz|changfang|fangchan|tudi|xiezilou)\/[^?#]+\.(?:shtml|html)$/i.test(
        pathname,
      );
    } catch {
      return false;
    }
  },
};
