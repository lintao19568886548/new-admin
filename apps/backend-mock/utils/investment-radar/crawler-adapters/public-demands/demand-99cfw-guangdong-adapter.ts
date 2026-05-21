import type { PublicDemandCrawlerAdapter } from './types';

import { isAllowedHost } from '../public-parser-utils';
import { buildPublicDemandOpportunity } from './demand-parser';

export const demand99cfwGuangdongAdapter: PublicDemandCrawlerAdapter = {
  extractFromHtml: (html, sourceUrl) =>
    buildPublicDemandOpportunity({
      html,
      sourceSite: '99cfw',
      sourceUrl,
    }),
  listUrls: [
    'https://www.99cfw.com/xuqiu/',
    'https://www.99cfw.com/changfangxuqiu/',
    'https://www.99cfw.com/cangkuqiu/',
    'https://dg.99cfw.com/xuqiu/0_1_0_0_0/',
    'https://gz.99cfw.com/xuqiu/0_1_0_0_0/',
    'https://sz.99cfw.com/xuqiu/0_1_0_0_0/',
    'https://www.99cfw.com/changfangxuqiu/3_0_0_0_1/3929gz/',
    'https://www.99cfw.com/changfangxuqiu/3_0_0_0_1/3930sz/',
    'https://www.99cfw.com/changfangxuqiu/3_0_0_0_1/3931dg/',
    'https://www.99cfw.com/changfangxuqiu/3_0_0_0_1/3932fs/',
    'https://dg.99cfw.com/changfangxuqiu/',
    'https://gz.99cfw.com/changfangxuqiu/',
    'https://sz.99cfw.com/changfangxuqiu/',
    'https://fs.99cfw.com/changfangxuqiu/',
    'https://zs.99cfw.com/changfangxuqiu/',
    'https://hz.99cfw.com/changfangxuqiu/',
    'https://jm.99cfw.com/changfangxuqiu/',
    'https://zh.99cfw.com/changfangxuqiu/',
  ],
  opportunityType: 'DEMAND',
  platformName: '99厂房网广东需求',
  sourceCode: 'PUBLIC_DEMAND_99CFW_GD',
  sourceSite: '99cfw',
  validateDetailUrl: (sourceUrl) => {
    if (!isAllowedHost(sourceUrl, ['99cfw.com'])) {
      return false;
    }
    try {
      const { pathname } = new URL(sourceUrl);
      const demandPrefixes = ['xuqiu', 'changfangxuqiu', 'cangkuqiu'];
      const firstPathToken = pathname.split('/').find(Boolean) || '';
      if (!demandPrefixes.includes(firstPathToken)) {
        return false;
      }
      if (
        demandPrefixes.some(
          (prefix) => pathname === `/${prefix}/` || pathname === `/${prefix}`,
        )
      ) {
        return false;
      }
      return (
        /^\/(?:xuqiu|changfangxuqiu|cangkuqiu)\/(?:[a-z]{2}\/)?[\w-]+\.(?:html|htm)$/i.test(
          pathname,
        ) ||
        /^\/(?:xuqiu|changfangxuqiu|cangkuqiu)\/(?:[a-z]{2}\/)?\d+\/?$/i.test(
          pathname,
        )
      );
    } catch {
      return false;
    }
  },
};
