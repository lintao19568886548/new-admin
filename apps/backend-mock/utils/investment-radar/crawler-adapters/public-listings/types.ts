import type { ParsedPublicOpportunity } from '../types';

export interface PublicListingDiscoveredDetailUrl {
  sourceTitle: null | string;
  sourceUrl: string;
}

export interface PublicListingCrawlerAdapter {
  extractDetailUrlsFromListHtml?: (
    html: string,
    listUrl: string,
  ) => PublicListingDiscoveredDetailUrl[];
  extractFromHtml: (
    html: string,
    sourceUrl: string,
    crawledAt?: Date,
  ) => ParsedPublicOpportunity;
  listUrls: string[];
  opportunityType: 'SUPPLY';
  platformName: string;
  sourceCode: string;
  sourceSite: string;
  validateDetailUrl: (sourceUrl: string) => boolean;
  validateListUrl?: (sourceUrl: string) => null | string;
}
