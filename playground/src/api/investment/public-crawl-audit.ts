import { requestClient } from '#/api/request';

export type PublicCrawlAuditMode = 'DRY_RUN' | string;
export type PublicCrawlAuditOpportunityType = 'DEMAND' | 'SUPPLY' | 'UNKNOWN';
export type PublicCrawlEffectiveScope =
  | 'collected'
  | 'raw'
  | 'reviewable'
  | 'strict';
export type PublicCrawlOpportunityType = 'DEMAND' | 'SUPPLY';

export interface PublicCrawlAuditCounts {
  guangdongValidCount: number;
  invalidCount?: number;
  missingHashOrDetailEvidenceCount: number;
  missingPublishedAtCount: number;
  missingSourceUrlCount: number;
  missingSupplyLocationCount?: number;
  nonGuangdongCount: number;
  outOfScopeCount?: number;
  proposedDowngradeCount?: number;
  sourceLostCount?: number;
  suspiciousPublishedAtCount: number;
  totalCount: number;
  unknownTimeCount?: number;
}

export interface PublicCrawlAuditTypeCounts extends PublicCrawlAuditCounts {
  opportunityType: PublicCrawlAuditOpportunityType | string;
  opportunityTypeLabel: string;
}

export interface PublicCrawlDashboardSummary {
  demandEffectiveRate?: null | number;
  failedPlatformCount: number;
  fetchSuccessRate?: null | number;
  guangdongDemandEffectiveCount: number;
  guangdongListingEffectiveCount: number;
  lastCrawledAt?: null | string;
  listingEffectiveRate?: null | number;
  nonGuangdongHiddenCount: number;
  nonGuangdongHiddenRate?: null | number;
  pendingVerifyCount: number;
  pendingVerifyOverdueCount?: null | number;
  platformCount: number;
  platformFetchedCount: number;
  platformSuccessCount: number;
  todayFetchedChange?: null | number;
  todayFetchedCount: number;
  totalEffectiveCount?: number;
  zeroFetchedPlatformCount: number;
}

export interface PublicCrawlPlatformDistributionItem {
  demandCount: number;
  fetchedCount?: number;
  hiddenCount: number;
  latestTaskStatus?: null | string;
  listingCount: number;
  percent?: null | number;
  platformCode: string;
  platformName: string;
  sourceCode?: null | string;
  totalCount: number;
  updatedCount?: number;
  upsertedCount?: number;
  zeroFetched?: boolean;
}

export interface PublicCrawlCityDistributionItem {
  cityCode?: null | string;
  cityName: string;
  demandCount: number;
  effectiveCount: number;
  listingCount: number;
  pendingVerifyCount: number;
  percent?: null | number;
  totalCount: number;
}

export interface PublicCrawlDashboardResult {
  cityDistribution: PublicCrawlCityDistributionItem[];
  platformDistribution: PublicCrawlPlatformDistributionItem[];
  summary: PublicCrawlDashboardSummary;
}

export interface PublicCrawlAuditSummary {
  auditMode: PublicCrawlAuditMode;
  dashboard?: PublicCrawlDashboardResult;
  dryRun: boolean;
  generatedAt: string;
  summary: PublicCrawlAuditCounts;
  typeStats: Record<string, PublicCrawlAuditTypeCounts>;
}

export interface PublicCrawlAuditIssueFlags {
  missingHashOrDetailEvidence: boolean;
  missingPublishedAt: boolean;
  missingSourceUrl: boolean;
  missingSupplyLocation: boolean;
  nonGuangdong: boolean;
  suspiciousPublishedAt: boolean;
}

export interface PublicCrawlAuditPreviewItem {
  areaText?: null | string;
  city?: null | string;
  createTime?: null | string;
  descriptionPreview?: null | string;
  detailJsonPreview?: null | string;
  district?: null | string;
  issueFlags: PublicCrawlAuditIssueFlags;
  issueReasons: string[];
  lastSyncedAt?: null | string;
  opportunityId: number;
  opportunityStatus?: null | string;
  opportunityType: PublicCrawlAuditOpportunityType | string;
  opportunityTypeLabel: string;
  publishedAt?: null | string;
  publishedDateText?: null | string;
  score?: null | number;
  sourceId?: null | string;
  sourceKey?: null | string;
  sourceSite?: null | string;
  sourceTable?: null | string;
  sourceUrl?: null | string;
  title?: null | string;
  updateTime?: null | string;
}

export interface PublicCrawlAuditPreview {
  auditMode: PublicCrawlAuditMode;
  dryRun: boolean;
  generatedAt: string;
  items: PublicCrawlAuditPreviewItem[];
  limit: number;
  totalPreviewCount: number;
}

export interface PublicCrawlEffectiveOpportunity {
  areaSqm?: null | number;
  areaText?: null | string;
  city?: null | string;
  contactName?: null | string;
  description?: null | string;
  detailJson?: null | Record<string, unknown>;
  district?: null | string;
  effectiveUntil?: null | string;
  industryText?: null | string;
  lastSyncedAt?: null | string;
  opportunityId: number | string;
  opportunityStatus: string;
  opportunityType: PublicCrawlOpportunityType;
  phoneNumber?: null | string;
  priceText?: null | string;
  publishedAgeLabel?: null | string;
  publishedAt?: null | string;
  publishedDateText?: null | string;
  score?: null | number;
  sourceCode?: null | string;
  sourceId?: null | number | string;
  sourceSite?: null | string;
  sourceTable?: null | string;
  sourceUrl: string;
  tagsJson?: null | string[] | unknown[];
  title?: null | string;
}

export interface PublicCrawlEffectiveListParams {
  city?: string;
  currentPage?: number;
  includeMeta?: boolean;
  includeTotal?: boolean;
  keyword?: string;
  opportunityType?: PublicCrawlOpportunityType | string;
  pageSize?: number;
  publishedAgeLabel?: string;
  scope?: PublicCrawlEffectiveScope;
  sourceSite?: string;
}

export interface PublicCrawlEffectiveStatsParams {
  city?: string;
  keyword?: string;
  opportunityType?: PublicCrawlOpportunityType | string;
  publishedAgeLabel?: string;
  scope?: PublicCrawlEffectiveScope;
  sourceSite?: string;
}

export interface PublicCrawlEffectiveStats {
  scope: PublicCrawlEffectiveScope;
  strictTotal: number;
  total: number;
}

export interface PublicCrawlEffectiveList {
  filters?: {
    publishedAgeLabels?: string[];
    sourceSites?: string[];
  };
  items: PublicCrawlEffectiveOpportunity[];
  page?: {
    currentPage: number;
    pageSize: number;
    total?: number;
  };
  scope?: 'collected' | 'reviewable' | 'strict';
  strictTotal?: number;
  total?: number;
  totalKnown?: boolean;
}

export interface PublicCrawlListResponse<T> {
  items: T[];
  page?: {
    currentPage: number;
    pageSize: number;
    total: number;
  };
  total: number;
}

export interface PublicCrawlCrawlerSource {
  adapterStatus?: 'CANDIDATE' | 'READY' | string;
  enabled: boolean;
  lastCrawledAt?: null | string;
  rateLimitPerMinute?: null | number;
  regionScopeJson?: null | string[];
  sourceCode: string;
  sourceId: number;
  sourceName: string;
  sourceType: string;
}

export interface PublicCrawlCrawlerTask {
  createdLeadCount: number;
  createTime?: null | string;
  errorMessage?: null | string;
  fetchedCount: number;
  finishedAt?: null | string;
  skippedCount: number;
  skipReason?: null | string;
  sourceCode?: null | string;
  sourceId: number;
  sourceName?: null | string;
  status: 'CANCELED' | 'FAILED' | 'PENDING' | 'RUNNING' | 'SUCCESS' | string;
  taskId: number;
  taskType: string;
  updatedLeadCount: number;
}

export async function getPublicCrawlAuditSummary(params?: {
  refresh?: boolean | number | string;
}) {
  return requestClient.get<PublicCrawlAuditSummary>(
    '/investment/radar/public-opportunity/audit-summary',
    {
      params,
      silentError: true,
    },
  );
}

export async function getPublicCrawlEffectiveList(
  params: PublicCrawlEffectiveListParams,
) {
  return requestClient.get<PublicCrawlEffectiveList>(
    '/investment/radar/public-opportunity/effective-list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getPublicCrawlEffectiveStats(
  params: PublicCrawlEffectiveStatsParams = {},
) {
  return requestClient.get<PublicCrawlEffectiveStats>(
    '/investment/radar/public-opportunity/effective-stats',
    {
      params,
      silentError: true,
    },
  );
}

export async function getPublicCrawlCrawlerSourceList() {
  return requestClient.get<PublicCrawlListResponse<PublicCrawlCrawlerSource>>(
    '/investment/radar/crawler-source/list',
    {
      silentError: true,
    },
  );
}

export async function getPublicCrawlCrawlerTaskList(params: {
  currentPage?: number;
  pageSize?: number;
  sourceId?: number;
  status?: string;
}) {
  return requestClient.get<PublicCrawlListResponse<PublicCrawlCrawlerTask>>(
    '/investment/radar/crawler-task/list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getPublicCrawlAuditPreview() {
  return requestClient.get<PublicCrawlAuditPreview>(
    '/investment/radar/public-opportunity/audit-preview',
    {
      silentError: true,
    },
  );
}

export interface PublicCrawlRepairResult {
  after: PublicCrawlAuditCounts;
  auditMode: 'APPLY' | 'DRY_RUN';
  before: PublicCrawlAuditCounts;
  downgradedCount: number;
  dryRun: boolean;
  generatedAt: string;
  limit: number;
  plannedDowngradeCount: number;
  previewItems: PublicCrawlAuditPreviewItem[];
  reasonCounts: Record<string, number>;
  repairedCount: number;
  scannedCount: number;
}

export async function repairPublicCrawlHistory(params: {
  dryRun?: boolean;
  limit?: number;
}) {
  return requestClient.post<PublicCrawlRepairResult>(
    '/investment/radar/public-opportunity/repair',
    params,
    {
      silentError: true,
    },
  );
}

export type PublicCrawlBatchMode = 'ALL' | 'DEMAND' | 'SUPPLY';

export interface PublicCrawlBatchRunPayload {
  batchSize?: number;
  continueOnError?: boolean;
  discoverList?: boolean;
  freshnessDays?: number;
  ignoreInterval?: boolean;
  maxConcurrency?: number;
  maxListPages?: number;
  maxRetryCount?: number;
  maxRounds?: number;
  mode?: PublicCrawlBatchMode;
  reprocessSuccess?: boolean;
  retryDelayMinutes?: number;
  staleReprocessMinutes?: number;
  targetCount?: number;
}

export interface PublicCrawlBatchPlatformResult {
  collectedEffectiveCount: number;
  discoveredUrlCount: number;
  effectiveCount: number;
  errorMessage?: null | string;
  failedReasonTop5: Array<{ count: number; reason: string }>;
  fetchedCount: number;
  fetchSuccessCount: number;
  opportunityType: PublicCrawlOpportunityType;
  roundIndex?: number;
  skippedCount: number;
  sourceCode: string;
  sourceName?: null | string;
  status: 'FAILED' | 'SUCCESS';
  taskId?: null | number;
  upsertedCount: number;
  yieldedEffective?: boolean;
  zeroOutput?: boolean;
}

export interface PublicCrawlBatchRunResult {
  finishedAt: string;
  items: PublicCrawlBatchPlatformResult[];
  maxRounds?: number;
  mode: PublicCrawlBatchMode;
  remainingCount?: number;
  roundCount?: number;
  sourceCodes: string[];
  startedAt: string;
  targetCount?: null | number;
  targetReached?: boolean;
  total: {
    collectedEffectiveCount: number;
    discoveredUrlCount: number;
    effectiveCount: number;
    failedPlatformCount: number;
    fetchedCount: number;
    fetchSuccessCount: number;
    hasEffectiveOutput?: boolean;
    hasUsefulOutput?: boolean;
    onlyZeroOutput?: boolean;
    platformCount: number;
    productivePlatformCount?: number;
    skippedCount: number;
    successPlatformCount: number;
    taskCount: number;
    upsertedCount: number;
    zeroOutputPlatformCount?: number;
  };
}

export async function runPublicCrawlBatch(
  data: PublicCrawlBatchRunPayload = {},
) {
  return requestClient.post<PublicCrawlBatchRunResult>(
    '/investment/radar/crawler-task/run-public-opportunity-batch',
    data,
    {
      silentError: true,
    },
  );
}
