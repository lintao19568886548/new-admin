export const DEMO_CRAWLER_SOURCE_CODE = 'DEMO_EXTERNAL_LEAD';
export const PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE =
  'PUBLIC_FACTORY_LISTING_CFZSW68';
export const PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE =
  'PUBLIC_OPPORTUNITY_99CFW';

export type CrawlerSourceType = 'DEMO' | 'PUBLIC_OPPORTUNITY';
export type CrawlerTaskItemStatus =
  | 'FAILED'
  | 'PENDING'
  | 'RETRY_WAITING'
  | 'RUNNING'
  | 'SKIPPED'
  | 'SUCCESS';
export type CrawlerTaskStatus =
  | 'CANCELED'
  | 'FAILED'
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS';
export type CrawlerTaskType =
  | 'MANUAL_DEMO'
  | 'PUBLIC_OPPORTUNITY_DISCOVER'
  | 'PUBLIC_OPPORTUNITY_URL_BATCH';
export type CrawlerTaskLogLevel = 'ERROR' | 'INFO' | 'WARN';
export type CrawlerTaskLogStage =
  | 'ADAPTER'
  | 'DISCOVER'
  | 'FETCH'
  | 'FINISH'
  | 'ITEM_FAIL'
  | 'ITEM_SUCCESS'
  | 'POLICY_SKIP'
  | 'QUEUE'
  | 'RATE_LIMIT'
  | 'ROBOTS_CHECK'
  | 'SOURCE_VALIDATE'
  | 'UPSERT_LEAD';

export interface CrawlerSource {
  allowedPathsJson: null | string[];
  baseUrl: string;
  blockedPathsJson: null | string[];
  crawlIntervalMinutes: number;
  createTime?: null | string;
  enabled: boolean;
  keywordExcludeJson: null | string[];
  keywordIncludeJson: null | string[];
  lastCrawledAt?: null | string;
  rateLimitPerMinute: number;
  regionScopeJson: null | string[];
  robotsUrl: null | string;
  sourceCode: string;
  sourceId: number;
  sourceName: string;
  sourceType: CrawlerSourceType | string;
  updateTime?: null | string;
}

export interface CrawlerSourceUpdatePayload {
  allowedPathsJson?: null | string[];
  blockedPathsJson?: null | string[];
  crawlIntervalMinutes?: number;
  enabled?: boolean;
  keywordExcludeJson?: null | string[];
  keywordIncludeJson?: null | string[];
  rateLimitPerMinute?: number;
  regionScopeJson?: null | string[];
  robotsUrl?: null | string;
}

export interface CrawlerTask {
  crawlEndedAt?: null | string;
  crawlStartedAt?: null | string;
  createTime?: null | string;
  createdLeadCount: number;
  errorMessage?: null | string;
  failedItemCount?: number;
  fetchedCount: number;
  finishedAt?: null | string;
  maxRetryCount: number;
  nextRetryAt?: null | string;
  pendingItemCount?: number;
  rateLimited?: boolean;
  requestConfigJson?: null | Record<string, unknown>;
  retryCount: number;
  retryWaitingItemCount?: number;
  skippedCount: number;
  skippedItemCount?: number;
  skipReason?: null | string;
  sourceCode?: null | string;
  sourceId: number;
  sourceName?: null | string;
  successItemCount?: number;
  startedAt?: null | string;
  status: CrawlerTaskStatus;
  taskId: number;
  taskType: CrawlerTaskType | string;
  updateTime?: null | string;
  updatedLeadCount: number;
}

export interface CrawlerTaskLog {
  createTime?: null | string;
  detailJson?: null | Record<string, unknown>;
  level: CrawlerTaskLogLevel | string;
  logId: number;
  message: string;
  stage: CrawlerTaskLogStage | string;
  taskId: number;
}

export interface CrawlerTaskItem {
  createTime?: null | string;
  itemId: number;
  lastError?: null | string;
  lastFinishedAt?: null | string;
  lastHttpStatus?: null | number;
  lastStartedAt?: null | string;
  lastSuccessAt?: null | string;
  lastTaskId?: null | number;
  maxRetryCount: number;
  nextRetryAt?: null | string;
  publishedAt?: null | string;
  retryCount: number;
  skipReason?: null | string;
  sourceId: number;
  sourceRefId?: null | number;
  sourceRefType?: null | string;
  sourceUrl: string;
  status: CrawlerTaskItemStatus | string;
  updateTime?: null | string;
}

export interface CrawlerTaskListParams {
  currentPage: number;
  pageSize: number;
  sourceId?: number;
  status?: string;
}

export interface CrawlerSourceListResult {
  items: CrawlerSource[];
  total: number;
}

export interface CrawlerTaskListResult {
  items: CrawlerTask[];
  page: {
    currentPage: number;
    pageSize: number;
    total: number;
  };
  total: number;
}

export interface CrawlerTaskItemListParams {
  currentPage: number;
  pageSize: number;
  sourceId?: number;
  status?: string;
  taskId?: number;
}

export interface CrawlerTaskItemListResult {
  items: CrawlerTaskItem[];
  page: {
    currentPage: number;
    pageSize: number;
    total: number;
  };
  total: number;
}

export interface CrawlerTaskItemRequeueResult {
  requeuedCount: number;
  sourceId: number;
  status: 'PENDING';
}

export interface CrawlerTaskItemReclaimResult {
  reclaimedCount: number;
  sourceId: number;
  staleMinutes: number;
}

export interface CrawlerOpsSummary {
  itemStatus: Record<string, number>;
  latestFailedItems: CrawlerTaskItem[];
  latestTask: CrawlerTask | null;
  source: CrawlerSource | null;
  scheduler: {
    active: boolean;
    canRunNow: boolean;
    enabled: boolean;
    envEnabled: boolean;
    intervalMs: number;
    lastError?: null | string;
    lastSkipReason?: null | string;
    lastTaskId?: null | number;
    lastTickFinishedAt?: null | string;
    lastTickStartedAt?: null | string;
    nextRunAt?: null | string;
    reason?: null | string;
    running: boolean;
    startedAt?: null | string;
    stoppedAt?: null | string;
  };
  taskStatus: Record<string, number>;
}

export interface PublicOpportunityCrawlerRunOptions {
  batchSize?: number;
  discoverList?: boolean;
  freshnessDays?: number;
  maxRetryCount?: number;
  retryDelayMinutes?: number;
  sourceCode?: string;
}

export interface DemoCrawlerEvidence {
  crawledAt?: null | string;
  evidenceType: 'BODY' | 'EIA' | 'NOTICE' | 'RECRUITMENT' | 'TITLE';
  matchedKeywords: string[];
  matchedSentences: string[];
  publishedAt?: null | string;
  rawText: string;
  scoreDelta: number;
  sourceLink: string;
  sourceTitle: string;
}

export interface DemoCrawlerLead {
  companyName: string;
  confidenceLevel: 'HIGH' | 'LOW' | 'MEDIUM';
  confidenceScore: number;
  crawledAt: string;
  demandType: 'EXPAND' | 'NEW_LINE' | 'RELOCATION' | 'RENT_FACTORY' | 'UNKNOWN';
  evidences: DemoCrawlerEvidence[];
  hitKeywords: string[];
  industryName?: string;
  leadTitle: string;
  regionCity?: string;
  regionDistrict?: string;
  regionProvince?: string;
  sourceTitle: string;
  sourceUrl: string;
  summary: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}
