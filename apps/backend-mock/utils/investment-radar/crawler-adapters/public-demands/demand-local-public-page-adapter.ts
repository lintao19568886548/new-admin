import type { PublicDemandCrawlerAdapter } from './types';

import { buildPublicDemandOpportunity } from './demand-parser';

const LOCAL_PUBLIC_PAGE_HOSTS = new Set(['0.0.0.0', '127.0.0.1', 'localhost']);
const LOCAL_PUBLIC_PAGE_PROTOCOLS = new Set(['file:', 'http:', 'https:']);

function isLocalPublicPageUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    if (!LOCAL_PUBLIC_PAGE_PROTOCOLS.has(url.protocol)) {
      return false;
    }
    return (
      url.protocol === 'file:' ||
      LOCAL_PUBLIC_PAGE_HOSTS.has(url.hostname) ||
      url.hostname.endsWith('.local')
    );
  } catch {
    return sourceUrl.startsWith('/') || /^[a-z]:[\\/]/i.test(sourceUrl);
  }
}

export const demandLocalPublicPageAdapter: PublicDemandCrawlerAdapter = {
  extractFromHtml: (html, sourceUrl) =>
    buildPublicDemandOpportunity({
      html,
      sourceSite: 'local-public-page',
      sourceUrl,
    }),
  listUrls: [],
  opportunityType: 'DEMAND',
  platformName: '本地公开需求页',
  sourceCode: 'PUBLIC_DEMAND_LOCAL_PAGE',
  sourceSite: 'local-public-page',
  validateDetailUrl: isLocalPublicPageUrl,
};
