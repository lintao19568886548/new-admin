export const INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE = 'INTERNAL_CONTRACT_EXPIRY';
export const PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE =
  'PUBLIC_FACTORY_LISTING_CFZSW68';
export const PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE =
  'PUBLIC_OPPORTUNITY_99CFW';
export const DEMO_CRAWLER_SOURCE_CODE = PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE;
export const PUBLIC_OPPORTUNITY_FRESHNESS_DAYS = 180;
export const PUBLIC_OPPORTUNITY_TASK_BUDGET_MS = 90_000;
export const PUBLIC_BUSINESS_CHANGE_SOURCE_CODE =
  'PUBLIC_BUSINESS_CHANGE_API_CANDIDATE';
export const PUBLIC_EIA_NOTICE_SOURCE_CODE = 'PUBLIC_EIA_NOTICE_MEE_CANDIDATE';
export const PUBLIC_RECRUITMENT_SOURCE_CODE =
  'PUBLIC_RECRUITMENT_51JOB_CANDIDATE';
export const PUBLIC_TENDER_SOURCE_CODE = 'PUBLIC_TENDER_CCGP_CANDIDATE';
export const PUBLIC_MAP_POI_SOURCE_CODE = 'PUBLIC_MAP_POI_API_CANDIDATE';

export const GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES = [
  'PUBLIC_FACTORY_LISTING_99CFW_DG',
  'PUBLIC_FACTORY_LISTING_TOODC_DG',
  'PUBLIC_FACTORY_LISTING_SZAQFDC_DG',
  'PUBLIC_FACTORY_LISTING_FANG_DG',
  'PUBLIC_FACTORY_LISTING_TZGD_GD',
  'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD',
  'PUBLIC_FACTORY_LISTING_GDCFZS_GD',
  'PUBLIC_FACTORY_LISTING_SZCFW_GD',
  'PUBLIC_FACTORY_LISTING_SZKKW_GD',
  'PUBLIC_FACTORY_LISTING_HFDPT_GD',
  'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD',
  'PUBLIC_FACTORY_LISTING_YSOL_GD',
] as const;

export const PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES = [
  'PUBLIC_FACTORY_LISTING_99CFW_GD',
  'PUBLIC_FACTORY_LISTING_TOODC_GD',
  'PUBLIC_FACTORY_LISTING_FANG_GD',
] as const;

export const GENERIC_PUBLIC_DEMAND_SOURCE_CODES = [
  'PUBLIC_DEMAND_ZHAOSHANG_NET_GD',
] as const;

export const PUBLIC_DEMAND_PLATFORM_SOURCE_CODES = [
  'PUBLIC_DEMAND_99CFW_GD',
  ...GENERIC_PUBLIC_DEMAND_SOURCE_CODES,
] as const;

export const RETIRED_PUBLIC_OPPORTUNITY_SOURCE_CODES = [
  'PUBLIC_DEMAND_021CF_GD',
  'PUBLIC_DEMAND_CFZX_GD',
  'PUBLIC_DEMAND_CHANGFANGHOME_GD',
  'PUBLIC_DEMAND_ZGZSW_GD',
  'PUBLIC_FACTORY_LISTING_021CF_GD',
  'PUBLIC_FACTORY_LISTING_58_DG',
  'PUBLIC_FACTORY_LISTING_58_GD',
  'PUBLIC_FACTORY_LISTING_CANGXIAOER_DG',
  'PUBLIC_FACTORY_LISTING_CANGXIAOER_GD',
  'PUBLIC_FACTORY_LISTING_CFZX_GD',
  'PUBLIC_FACTORY_LISTING_CHANGFANGHOME_GD',
  'PUBLIC_FACTORY_LISTING_ZGZSW_GD',
] as const;

export const RETIRED_PUBLIC_OPPORTUNITY_SOURCE_SITES = [
  '021cf',
  '021cf.com',
  '58.com',
  'cangxiaoer',
  'cangxiaoer.com',
  'cfzx',
  'changfanghome',
  'changfanghome.com',
  'zgzsw',
] as const;

export const PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES = [
  PUBLIC_OPPORTUNITY_CRAWLER_SOURCE_CODE,
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  ...GENERIC_PUBLIC_FACTORY_LISTING_SOURCE_CODES,
  ...PUBLIC_FACTORY_LISTING_PLATFORM_SOURCE_CODES,
  ...PUBLIC_DEMAND_PLATFORM_SOURCE_CODES,
] as const;

export type CrawlerSourceType =
  | 'BUSINESS_CHANGE_API'
  | 'INTERNAL_CONTRACT'
  | 'MAP_POI_API'
  | 'PUBLIC_EIA_NOTICE'
  | 'PUBLIC_OPPORTUNITY'
  | 'PUBLIC_RECRUITMENT'
  | 'PUBLIC_TENDER';
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
  | 'INTERNAL_CONTRACT_EXPIRY'
  | 'MANUAL_EIA'
  | 'MANUAL_RECRUITMENT'
  | 'MANUAL_TENDER'
  | 'PUBLIC_FACTORY_LISTING_URL_BATCH'
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
  adapterStatus?: 'CANDIDATE' | 'READY';
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
    dailyRunHour?: number;
    enabled: boolean;
    envEnabled: boolean;
    intervalMs: number;
    lastError?: null | string;
    lastSkipReason?: null | string;
    lastTaskId?: null | number;
    lastTickFinishedAt?: null | string;
    lastTickStartedAt?: null | string;
    mode?: 'ALL' | 'DEMAND' | 'SUPPLY' | string;
    nextRunAt?: null | string;
    reason?: null | string;
    running: boolean;
    scheduleType?: 'DAILY' | string;
    startedAt?: null | string;
    stoppedAt?: null | string;
  };
  taskStatus: Record<string, number>;
}

export interface PublicOpportunityCrawlerRunOptions {
  batchSize?: number;
  discoverList?: boolean;
  freshnessDays?: number;
  ignoreInterval?: boolean;
  listDiscoveryDelayMs?: number;
  maxListPages?: number;
  maxRetryCount?: number;
  reprocessSuccess?: boolean;
  retryDelayMinutes?: number;
  sourceCode?: string;
  staleReprocessMinutes?: number;
}

export interface PublicSignalCrawlerEvidence {
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

export interface PublicSignalCrawlerLead {
  companyName: string;
  confidenceLevel: 'HIGH' | 'LOW' | 'MEDIUM';
  confidenceScore: number;
  crawledAt: string;
  demandType: 'EXPAND' | 'NEW_LINE' | 'RELOCATION' | 'RENT_FACTORY' | 'UNKNOWN';
  evidences: PublicSignalCrawlerEvidence[];
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
