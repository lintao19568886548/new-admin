import type { ParsedPublicOpportunity } from '../types';

export interface PublicDemandCrawlerAdapter {
  extractFromHtml: (html: string, sourceUrl: string) => ParsedPublicOpportunity;
  listUrls: string[];
  opportunityType: 'DEMAND';
  platformName: string;
  sourceCode: string;
  sourceSite: string;
  validateDetailUrl: (sourceUrl: string) => boolean;
}
