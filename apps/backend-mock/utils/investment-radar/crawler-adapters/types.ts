import type { DemoCrawlerLead } from '../crawler-types';

export interface CrawlerAdapterContext {
  sourceCode: string;
  taskId: number;
}

export interface CrawlerAdapter {
  fetchLeads: (context: CrawlerAdapterContext) => Promise<DemoCrawlerLead[]>;
  sourceCode: string;
}

export type ParsedOpportunityType = 'DEMAND' | 'SUPPLY';

export interface ParsedPublicOpportunityDetailJson {
  extractionPolicy: 'STRICT_DETAIL_PAGE_LABELS_ONLY';
  missingFields: string[];
  publishedDateTextRaw: null | string;
  responseHash: string;
}

export interface ParsedPublicOpportunity {
  areaText: null | string;
  city: null | string;
  contactName: null | string;
  description: null | string;
  detailJson: ParsedPublicOpportunityDetailJson;
  district: null | string;
  industryText: null | string;
  missingFields: string[];
  opportunityType: ParsedOpportunityType;
  phoneNumber: null | string;
  priceText: null | string;
  publishedAt: null | string;
  publishedDateText: null | string;
  sourceSite: string;
  sourceUrl: string;
  title: null | string;
}
