import type { PublicDemandCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { buildPublicDemandOpportunity } from './demand-parser';

export const demandCfzxGuangdongAdapter: PublicDemandCrawlerAdapter = {
  extractFromHtml: (html, sourceUrl) =>
    buildPublicDemandOpportunity({
      html,
      sourceSite: 'cfzx',
      sourceUrl,
    }),
  listUrls: [
    'https://www.cfzx.com/xuqiu/',
    'https://www.cfzx.com/xuqiu/guangdong/',
    'https://www.cfzx.com/xuqiu/dongguan/',
    'https://www.cfzx.com/xuqiu/guangzhou/',
    'https://www.cfzx.com/xuqiu/shenzhen/',
    'https://www.cfzx.com/xuqiu/foshan/',
    'https://www.cfzx.com/xuqiu/huizhou/',
    'https://www.cfzx.com/xuqiu/zhongshan/',
    'https://www.cfzx.com/xuqiu/jiangmen/',
  ],
  opportunityType: 'DEMAND',
  platformName: '厂房在线广东需求',
  sourceCode: 'PUBLIC_DEMAND_CFZX_GD',
  sourceSite: 'cfzx',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['cfzx.com'])) {
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
        /^\/(?:info|detail)\/[\w-]+(?:\.(?:html|htm))?$/i.test(pathname) ||
        /^\/xuqiu\/(?:guangdong|dongguan|guangzhou|shenzhen|foshan|huizhou|zhongshan|jiangmen)\/[\w-]+\/?$/i.test(
          pathname,
        )
      );
    } catch {
      return false;
    }
  },
};
