import type { DemoCrawlerLead } from '../crawler-types';

export interface CrawlerAdapterContext {
  sourceCode: string;
  taskId: number;
}

export interface CrawlerAdapter {
  fetchLeads(context: CrawlerAdapterContext): Promise<DemoCrawlerLead[]>;
  sourceCode: string;
}
