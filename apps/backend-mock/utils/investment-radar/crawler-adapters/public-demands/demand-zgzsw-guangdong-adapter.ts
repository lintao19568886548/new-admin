import type { PublicDemandCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { buildPublicDemandOpportunity } from './demand-parser';

export const demandZgzswGuangdongAdapter: PublicDemandCrawlerAdapter = {
  extractFromHtml: (html, sourceUrl) =>
    buildPublicDemandOpportunity({
      html,
      sourceSite: 'zgzsw',
      sourceUrl,
    }),
  listUrls: [
    'https://www.zgzsw.com/xuqiu/guangdong/',
    'https://guangdong.zgzsw.com/xuqiu/',
    'https://guangzhou.zgzsw.com/xuqiu/',
    'https://shenzhen.zgzsw.com/xuqiu/',
    'https://dongguan.zgzsw.com/xuqiu/',
    'https://foshan.zgzsw.com/xuqiu/',
    'https://huizhou.zgzsw.com/xuqiu/',
    'https://zhongshan.zgzsw.com/xuqiu/',
    'https://jiangmen.zgzsw.com/xuqiu/',
  ],
  opportunityType: 'DEMAND',
  platformName: '中工招商广东需求',
  sourceCode: 'PUBLIC_DEMAND_ZGZSW_GD',
  sourceSite: 'zgzsw',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['zgzsw.com'])) {
      return false;
    }
    try {
      const { pathname } = new URL(sourceUrl);
      if (
        !['/xuqiu/', '/info/', '/detail/'].some((prefix) =>
          pathname.startsWith(prefix),
        )
      ) {
        return false;
      }
      if (['/detail/', '/info/', '/xuqiu/'].includes(pathname)) {
        return false;
      }
      return (
        /^\/xuqiu\/(?:[a-z0-9-]+\/)?[\w-]+\.(?:html|htm)$/i.test(pathname) ||
        /^\/xuqiu\/\d+\/?$/i.test(pathname) ||
        /^\/(?:detail|info)\/[\w-]+(?:\.(?:html|htm))?$/i.test(pathname)
      );
    } catch {
      return false;
    }
  },
};
