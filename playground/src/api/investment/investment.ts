import type { InvestmentAgent } from '#/views/investment/agent/data';
import type { RadarLead } from '#/views/investment/radar/data';

import { requestClient } from '#/api/request';

export interface RadarLeadListParams {
  currentPage?: number;
  keyword?: string;
  pageSize?: number;
  parkId?: number;
  priorityLevel?: string;
  stage?: string;
}

export interface RadarListResponse<T> {
  filters?: {
    publishedAgeLabels?: string[];
    sourceSites?: string[];
  };
  items: T[];
  page?: {
    currentPage: number;
    pageSize: number;
    total: number;
  };
  total: number;
}

export interface RadarCollectTask {
  created: number;
  durationMs?: null | number;
  errorReason?: null | string;
  skipped: number;
  status: 'FAILED' | 'PENDING' | 'RUNNING' | 'SUCCESS';
  taskId: string;
  updated: number;
}

export interface RadarLeadImportFailItem {
  enterpriseName?: null | string;
  error: string;
  index?: number;
  rawData?: Record<string, unknown>;
  rowNumber?: number;
}

export interface RadarLeadImportResponse {
  failItems?: RadarLeadImportFailItem[];
  success: number;
}

export interface RadarOutreachTaskItem {
  channel: string;
  createTime?: null | string;
  phoneNumber?: null | string;
  replyContent?: null | string;
  replyStatus?: null | string;
  replyTime?: null | string;
  resultCode?: null | string;
  resultMessage?: null | string;
  scheduledAt?: null | string;
  sentAt?: null | string;
  sentByName?: null | string;
  status: string;
  taskId: number | string;
  taskType: string;
  templateCode?: null | string;
  updateTime?: null | string;
}

export interface RadarOutreachTaskListItem extends RadarOutreachTaskItem {
  contactName?: null | string;
  enterpriseName: string;
  latestContactTime?: null | string;
  latestSignalType?: null | string;
  leadId: number;
  parkName?: null | string;
  priorityLevel: string;
  stage: string;
  totalScore: number;
}

export interface RadarOutreachTaskDetail extends RadarOutreachTaskListItem {
  address?: null | string;
  city?: null | string;
  enterpriseId?: number;
  industryName?: null | string;
  intentArea?: null | number;
  intentScore: number;
  invalidReason?: null | string;
  latestSignalTime?: null | string;
  leadSource: string;
  matchScore: number;
  ownerName?: null | string;
  ownerUserId?: null | number;
  parkId?: null | number;
  reachableScore: number;
  registerCapital?: null | number;
  sourceFirst?: null | string;
  sourceLatest?: null | string;
  unifiedSocialCreditCode?: null | string;
}

export interface RadarOutreachTaskListParams {
  channel?: string;
  currentPage?: number;
  keyword?: string;
  pageSize?: number;
  priorityLevel?: string;
  replyStatus?: string;
  stage?: string;
  status?: string;
  taskType?: string;
}

export interface RadarOutreachTaskSummary {
  callTasks: number;
  failedTasks: number;
  pendingTasks: number;
  positiveReplies: number;
  repliedTasks: number;
  sentTasks: number;
  smsTasks: number;
  totalTasks: number;
}

export interface RadarLeadNavigationItem {
  enterpriseName: string;
  leadId: number;
  stage: string;
  totalScore: number;
}

export interface RadarLeadDetail {
  address?: null | string;
  city?: null | string;
  collectTask?:
    | null
    | (RadarCollectTask & {
        completedAt?: null | string;
        startedAt?: null | string;
        total?: number;
      });
  contactName?: null | string;
  createTime?: null | string;
  enterpriseId?: number;
  enterpriseName: string;
  industryName?: null | string;
  intentArea?: null | number;
  intentScore: number;
  invalidReason?: null | string;
  latestContactTime?: null | string;
  latestSignalTime?: null | string;
  latestSignalType?: null | string;
  leadId: number;
  leadSource: string;
  matchScore: number;
  navigation?: {
    nextLead?: null | RadarLeadNavigationItem;
    previousLead?: null | RadarLeadNavigationItem;
  };
  outreachSummary?: {
    count: number;
    latestSentAt?: null | string;
  };
  outreachTasks: RadarOutreachTaskItem[];
  ownerName?: null | string;
  ownerUserId?: null | number;
  parkId?: null | number;
  parkName?: null | string;
  phoneNumber?: null | string;
  priorityLevel: string;
  reachableScore: number;
  registerCapital?: null | number;
  sourceFirst?: null | string;
  sourceLatest?: null | string;
  stage: string;
  totalScore: number;
  unifiedSocialCreditCode?: null | string;
  updateTime?: null | string;
}

export interface PublicOpportunityItem {
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
  opportunityType: 'DEMAND' | 'SUPPLY';
  phoneNumber?: null | string;
  priceText?: null | string;
  publishedAgeLabel?: null | string;
  publishedAt?: null | string;
  publishedDateText?: null | string;
  score?: null | number;
  sourceId?: null | number | string;
  sourceSite?: null | string;
  sourceTable?: null | string;
  sourceUrl: string;
  tagsJson?: null | string[] | unknown[];
  title?: null | string;
}

export interface PublicOpportunityListParams {
  city?: string;
  currentPage?: number;
  keyword?: string;
  opportunityType?: string;
  pageSize?: number;
  publishedAgeLabel?: string;
  sourceSite?: string;
}

export interface PublicOpportunityManualPayload {
  areaText?: string;
  city?: string;
  contactName?: string;
  description?: string;
  district?: string;
  industryText?: string;
  opportunityType: 'DEMAND' | 'SUPPLY';
  phoneNumber?: string;
  priceText?: string;
  sourceSite?: string;
  sourceUrl?: string;
  title: string;
}

export interface PublicOpportunityManualResponse {
  created: boolean;
  opportunity: PublicOpportunityItem;
}

export type ExternalLeadConfidenceLevel = 'HIGH' | 'LOW' | 'MEDIUM';
export type ExternalLeadDemandType =
  | 'EXPAND'
  | 'NEW_LINE'
  | 'RELOCATION'
  | 'RENT_FACTORY'
  | 'UNKNOWN';
export type ExternalLeadStatus =
  | 'ASSIGNED'
  | 'FOLLOWING'
  | 'INVALID'
  | 'NEW'
  | 'PENDING_REVIEW'
  | 'VISITED'
  | 'WON';

export interface ExternalLead {
  companyName: string;
  confidenceLevel: ExternalLeadConfidenceLevel;
  confidenceScore: number;
  convertedAt?: null | string;
  convertedRadarLeadId?: null | number;
  crawledAt?: null | string;
  demandType: ExternalLeadDemandType;
  evidenceCount: number;
  firstSeenAt?: null | string;
  hitKeywords: string[];
  industryName?: null | string;
  invalidReason?: null | string;
  lastSeenAt?: null | string;
  leadId: number;
  leadTitle: string;
  ownerName?: null | string;
  ownerUserId?: null | number;
  regionCity?: null | string;
  regionDistrict?: null | string;
  regionProvince?: null | string;
  remark?: null | string;
  sourceId?: null | number;
  sourceName?: null | string;
  sourceTitle?: null | string;
  sourceType?: null | string;
  sourceUrl: string;
  status: ExternalLeadStatus;
  summary?: null | string;
  updateTime?: null | string;
}

export interface LeadEvidence {
  contentHash?: string;
  crawledAt?: null | string;
  evidenceId: number;
  evidenceType: 'BODY' | 'EIA' | 'NOTICE' | 'RECRUITMENT' | 'TITLE';
  leadId: number;
  matchedKeywords: string[];
  matchedSentences: string[];
  publishedAt?: null | string;
  rawText?: null | string;
  scoreDelta: number;
  sourceLink: string;
  sourceTitle: string;
}

export interface ExternalLeadDetail extends ExternalLead {
  evidences: LeadEvidence[];
}

export interface ExternalLeadListParams {
  confidenceLevel?: string;
  currentPage?: number;
  demandType?: string;
  industryName?: string;
  keyword?: string;
  pageSize?: number;
  regionCity?: string;
  sourceName?: string;
  status?: string;
}

export interface ExternalLeadUpdatePayload {
  invalidReason?: null | string;
  ownerUserId?: null | number;
  remark?: null | string;
  status?: ExternalLeadStatus;
}

export interface LeadEvidenceListResponse {
  items: LeadEvidence[];
  total: number;
}

export interface ExternalLeadConvertPayload {
  ownerUserId?: null | number;
  remark?: null | string;
}

export interface ExternalLeadConvertResponse {
  convertedAt?: null | string;
  externalLeadId: number;
  radarLeadId: number;
  reused?: boolean;
}

export type CrawlerTaskStatus =
  | 'CANCELED'
  | 'FAILED'
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS';
export type CrawlerTaskItemStatus =
  | 'FAILED'
  | 'PENDING'
  | 'RETRY_WAITING'
  | 'RUNNING'
  | 'SKIPPED'
  | 'SUCCESS';

export interface CrawlerSource {
  allowedPathsJson?: null | string[];
  baseUrl: string;
  blockedPathsJson?: null | string[];
  crawlIntervalMinutes: number;
  createTime?: null | string;
  enabled: boolean;
  keywordExcludeJson?: null | string[];
  keywordIncludeJson?: null | string[];
  lastCrawledAt?: null | string;
  rateLimitPerMinute: number;
  regionScopeJson?: null | string[];
  robotsUrl?: null | string;
  sourceCode: string;
  sourceId: number;
  sourceName: string;
  sourceType: string;
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
  createdLeadCount: number;
  createTime?: null | string;
  errorMessage?: null | string;
  failedItemCount?: number;
  fetchedCount: number;
  finishedAt?: null | string;
  maxRetryCount: number;
  nextRetryAt?: null | string;
  pendingItemCount?: number;
  requestConfigJson?: null | Record<string, unknown>;
  retryCount: number;
  retryWaitingItemCount?: number;
  skippedCount: number;
  skippedItemCount?: number;
  skipReason?: null | string;
  sourceCode?: null | string;
  sourceId: number;
  sourceName?: null | string;
  startedAt?: null | string;
  status: CrawlerTaskStatus;
  successItemCount?: number;
  taskId: number;
  taskType: string;
  updatedLeadCount: number;
  updateTime?: null | string;
}

export interface CrawlerTaskLog {
  createTime?: null | string;
  detailJson?: null | Record<string, unknown>;
  level: 'ERROR' | 'INFO' | 'WARN' | string;
  logId: number;
  message: string;
  stage: string;
  taskId: number;
}

export interface CrawlerTaskListParams {
  currentPage?: number;
  pageSize?: number;
  sourceId?: number;
  status?: string;
}

export interface CrawlerTaskLogListResponse {
  items: CrawlerTaskLog[];
  total: number;
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

export interface CrawlerTaskItemListParams {
  currentPage?: number;
  pageSize?: number;
  sourceId?: number;
  status?: string;
}

export interface CrawlerTaskItemListResponse {
  items: CrawlerTaskItem[];
  page?: {
    currentPage: number;
    pageSize: number;
    total: number;
  };
  total: number;
}

export interface CrawlerTaskItemRequeuePayload {
  itemIds?: number[];
  sourceCode?: string;
  sourceId?: number;
  statuses?: string[];
}

export interface CrawlerTaskItemRequeueResponse {
  requeuedCount: number;
  sourceId: number;
  status: 'PENDING';
}

export interface CrawlerTaskItemReclaimPayload {
  sourceCode?: string;
  sourceId?: number;
  staleMinutes?: number;
}

export interface CrawlerTaskItemReclaimResponse {
  reclaimedCount: number;
  sourceId: number;
  staleMinutes: number;
}

export interface CrawlerOpsSummary {
  itemStatus: Record<string, number>;
  latestFailedItems: CrawlerTaskItem[];
  latestTask: CrawlerTask | null;
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
  source: CrawlerSource | null;
  taskStatus: Record<string, number>;
}

export interface PublicOpportunityCrawlerRunPayload {
  batchSize?: number;
  discoverList?: boolean;
  freshnessDays?: number;
  maxRetryCount?: number;
  retryDelayMinutes?: number;
  sourceCode?: string;
}

export type SignalEventStatus = 'CONVERTED' | 'IGNORED' | 'NEW' | 'REVIEWED';
export type SignalEventType =
  | 'EIA_EXPAND'
  | 'FACTORY_RENT_DEMAND'
  | 'NEWS_EXPAND'
  | 'PUBLIC_FACTORY_DEMAND'
  | 'RECRUITMENT_EXPAND'
  | 'RELOCATION'
  | 'UNKNOWN';

export interface SignalEvidence {
  contentHash?: string;
  crawledAt?: null | string;
  eventId: number;
  evidenceId: number;
  evidenceType: string;
  matchedKeywords: string[];
  matchedSentences: string[];
  publishedAt?: null | string;
  rawText?: null | string;
  scoreDelta: number;
  sourceLink: string;
  sourceTitle?: null | string;
}

export interface SignalEvent {
  companyName: string;
  confidenceScore: number;
  contentHash?: string;
  createTime?: null | string;
  enterpriseId?: null | number;
  eventId: number;
  eventSummary?: null | string;
  eventTime?: null | string;
  eventTitle: string;
  eventType: SignalEventType;
  rawPayloadJson?: null | Record<string, unknown>;
  relatedExternalLeadId?: null | number;
  relatedRadarLeadId?: null | number;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  status: SignalEventStatus;
  updateTime?: null | string;
}

export interface SignalEventDetail extends SignalEvent {
  evidences: SignalEvidence[];
}

export interface SignalEventListParams {
  companyName?: string;
  currentPage?: number;
  eventType?: string;
  keyword?: string;
  pageSize?: number;
  sourceName?: string;
  sourceType?: string;
  status?: string;
}

export interface SignalEventUpdatePayload {
  status?: SignalEventStatus;
}

export interface SignalEvidenceListResponse {
  items: SignalEvidence[];
  total: number;
}

export interface SignalEventRebuildResponse {
  createdEventCount: number;
  createdEvidenceCount: number;
  totalSourceLeadCount: number;
  updatedEventCount: number;
  updatedEvidenceCount: number;
}

export interface SignalEventConvertPayload {
  ownerUserId?: null | number;
  remark?: null | string;
}

export interface SignalEventConvertResponse {
  eventId: number;
  radarLeadId: number;
  reused?: boolean;
}

export interface EnterpriseProfile {
  address?: null | string;
  businessScope?: null | string;
  companyName: string;
  createTime?: null | string;
  employeeScale?: null | string;
  enterpriseId?: null | number;
  industryName?: null | string;
  industryTags: string[];
  lastSignalTime?: null | string;
  latestIntentType?: null | string;
  profileCompleteness: number;
  profileId: number;
  regionCity?: null | string;
  regionDistrict?: null | string;
  regionProvince?: null | string;
  registeredCapital?: null | number;
  signalCount: number;
  unifiedSocialCreditCode?: null | string;
  updateTime?: null | string;
}

export interface EnterpriseTag {
  companyName: string;
  confidenceScore: number;
  createTime?: null | string;
  enterpriseId?: null | number;
  tagId: number;
  tagName: string;
  tagSource: string;
  tagType: string;
  updateTime?: null | string;
}

export interface EnterpriseProfileListParams {
  currentPage?: number;
  industryName?: string;
  keyword?: string;
  pageSize?: number;
  regionCity?: string;
}

export interface EnterpriseProfileRebuildResponse {
  createdProfileCount: number;
  createdTagCount: number;
  signalEventCount: number;
  sourceCompanyCount: number;
  updatedProfileCount: number;
  updatedTagCount: number;
}

export interface EnterpriseTagListResponse {
  items: EnterpriseTag[];
  total: number;
}

export interface EnterpriseProfileSignalListResponse {
  items: SignalEvent[];
  total: number;
}

export interface LeadScoreRule {
  createTime?: null | string;
  enabled: boolean;
  eventType?: null | SignalEventType | string;
  keywordJson: string[];
  ruleCode: string;
  ruleDescription?: null | string;
  ruleId: number;
  ruleName: string;
  scoreDelta: number;
  updateTime?: null | string;
}

export interface LeadScoreRuleListResponse {
  items: LeadScoreRule[];
  total: number;
}

export interface LeadScoreRuleUpdatePayload {
  enabled?: boolean;
  keywordJson?: null | string[];
  ruleDescription?: null | string;
  scoreDelta?: number;
}

export interface LeadScoreBreakdown {
  breakdownId: number;
  createTime?: null | string;
  eventId?: null | number;
  eventTitle?: null | string;
  eventType?: null | string;
  leadId: number;
  reason: string;
  ruleCode: string;
  ruleId: number;
  ruleName: string;
  scoreDelta: number;
}

export interface LeadScoreBreakdownListResponse {
  items: LeadScoreBreakdown[];
  total: number;
}

export interface RadarLeadScoreRecalculateResponse {
  breakdownCount: number;
  intentScore: number;
  leadId: number;
  matchedEventCount: number;
  priorityLevel: string;
  totalScore: number;
}

export interface DemoLeadScoreRecalculateResponse {
  items: RadarLeadScoreRecalculateResponse[];
  recalculatedCount: number;
  totalLeadCount: number;
}

export async function getInvestmentList(params: any) {
  return requestClient.get('/investment/list', { params });
}

export async function getInvestmentParkList(params?: any) {
  return requestClient.get('/investment/park-list', { params });
}

export async function getInvestmentDetail(billId: number) {
  return requestClient.get(`/investment/${billId}`);
}

export async function createInvestment(data: any) {
  return requestClient.post('/investment', data);
}

export async function updateInvestment(
  id: number | string,
  data: Partial<InvestmentAgent>,
) {
  return requestClient.put(`/investment/${id}`, data);
}

export async function deleteInvestment(billId: number) {
  return requestClient.delete(`/investment/${billId}`);
}

export async function getRadarLeadList(params: RadarLeadListParams) {
  return requestClient.get<RadarListResponse<RadarLead>>(
    '/investment/radar/lead/list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getRadarLeadDetail(leadId: number | string) {
  return requestClient.get<RadarLeadDetail>(
    `/investment/radar/lead/${leadId}`,
    {
      silentError: true,
    },
  );
}

export async function getRadarOutreachTaskList(
  params: RadarOutreachTaskListParams,
) {
  return requestClient.get<
    RadarListResponse<RadarOutreachTaskListItem> & {
      summary: RadarOutreachTaskSummary;
    }
  >('/investment/radar/outreach-task/list', {
    params,
    silentError: true,
  });
}

export async function getRadarOutreachTaskDetail(taskId: number | string) {
  return requestClient.get<RadarOutreachTaskDetail>(
    `/investment/radar/outreach-task/${taskId}`,
    {
      silentError: true,
    },
  );
}

export async function importRadarLeads(data: {
  items: Record<string, unknown>[];
}) {
  return requestClient.post<RadarLeadImportResponse>(
    '/investment/radar/lead/import',
    data,
  );
}

export async function importRadarLeadsFile(data: FormData) {
  return requestClient.post<RadarLeadImportResponse>(
    '/investment/radar/lead/import-file',
    data,
  );
}

export async function runRadarCollect() {
  return requestClient.post<{
    task: RadarCollectTask;
    taskId: string;
  }>('/investment/radar/collect/task', {});
}

export async function getRadarCollectTask(taskId: string) {
  return requestClient.get<RadarCollectTask>(
    `/investment/radar/collect/task/${taskId}`,
    {
      silentError: true,
    },
  );
}

export async function getEffectivePublicOpportunityList(
  params: PublicOpportunityListParams,
) {
  return requestClient.get<RadarListResponse<PublicOpportunityItem>>(
    '/investment/radar/public-opportunity/effective-list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getPublicOpportunityDetail(
  opportunityId: number | string,
) {
  return requestClient.get<PublicOpportunityItem>(
    `/investment/radar/public-opportunity/${opportunityId}`,
    {
      silentError: true,
    },
  );
}

export async function createManualPublicOpportunity(
  data: PublicOpportunityManualPayload,
) {
  return requestClient.post<PublicOpportunityManualResponse>(
    '/investment/radar/public-opportunity/manual',
    data,
  );
}

export async function getExternalLeadList(params: ExternalLeadListParams) {
  return requestClient.get<RadarListResponse<ExternalLead>>(
    '/investment/radar/external-lead/list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getExternalLeadDetail(leadId: number | string) {
  return requestClient.get<ExternalLeadDetail>(
    `/investment/radar/external-lead/${leadId}`,
    {
      silentError: true,
    },
  );
}

export async function updateExternalLead(
  leadId: number | string,
  data: ExternalLeadUpdatePayload,
) {
  return requestClient.put<{ leadId: number; status: ExternalLeadStatus }>(
    `/investment/radar/external-lead/${leadId}`,
    data,
  );
}

export async function getExternalLeadEvidenceList(leadId: number | string) {
  return requestClient.get<LeadEvidenceListResponse>(
    `/investment/radar/external-lead/${leadId}/evidence`,
    {
      silentError: true,
    },
  );
}

export async function convertExternalLeadToRadarLead(
  leadId: number | string,
  data: ExternalLeadConvertPayload = {},
) {
  return requestClient.post<ExternalLeadConvertResponse>(
    `/investment/radar/external-lead/${leadId}/convert`,
    data,
  );
}

export async function getCrawlerSourceList() {
  return requestClient.get<RadarListResponse<CrawlerSource>>(
    '/investment/radar/crawler-source/list',
    {
      silentError: true,
    },
  );
}

export async function updateCrawlerSource(
  sourceId: number | string,
  data: CrawlerSourceUpdatePayload,
) {
  return requestClient.put<CrawlerSource>(
    `/investment/radar/crawler-source/${sourceId}`,
    data,
  );
}

export async function enableCrawlerSource(sourceId: number | string) {
  return requestClient.post<CrawlerSource>(
    `/investment/radar/crawler-source/${sourceId}/enable`,
    {},
  );
}

export async function disableCrawlerSource(sourceId: number | string) {
  return requestClient.post<CrawlerSource>(
    `/investment/radar/crawler-source/${sourceId}/disable`,
    {},
  );
}

export async function getCrawlerTaskList(params: CrawlerTaskListParams) {
  return requestClient.get<RadarListResponse<CrawlerTask>>(
    '/investment/radar/crawler-task/list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getCrawlerOpsSummary(params?: {
  sourceCode?: string;
  sourceId?: number;
}) {
  return requestClient.get<CrawlerOpsSummary>(
    '/investment/radar/crawler-task/ops-summary',
    {
      params,
      silentError: true,
    },
  );
}

export async function startPublicOpportunityCrawlerScheduler() {
  return requestClient.post<CrawlerOpsSummary['scheduler']>(
    '/investment/radar/crawler-task/scheduler/start',
    {},
  );
}

export async function stopPublicOpportunityCrawlerScheduler() {
  return requestClient.post<CrawlerOpsSummary['scheduler']>(
    '/investment/radar/crawler-task/scheduler/stop',
    {},
  );
}

export async function getCrawlerTaskDetail(taskId: number | string) {
  return requestClient.get<CrawlerTask>(
    `/investment/radar/crawler-task/${taskId}`,
    {
      silentError: true,
    },
  );
}

export async function runCrawlerTask() {
  return requestClient.post<CrawlerTask>(
    '/investment/radar/crawler-task/run',
    {},
  );
}

export async function runPublicOpportunityCrawlerTask(
  data: PublicOpportunityCrawlerRunPayload = {},
) {
  return requestClient.post<CrawlerTask>(
    '/investment/radar/crawler-task/run-public-opportunity',
    data,
  );
}

export async function cancelCrawlerTask(taskId: number | string) {
  return requestClient.post<CrawlerTask>(
    `/investment/radar/crawler-task/${taskId}/cancel`,
    {},
  );
}

export async function getCrawlerTaskLogList(taskId: number | string) {
  return requestClient.get<CrawlerTaskLogListResponse>(
    `/investment/radar/crawler-task/${taskId}/log`,
    {
      silentError: true,
    },
  );
}

export async function getCrawlerTaskItemList(
  taskId: number | string,
  params: CrawlerTaskItemListParams,
) {
  return requestClient.get<CrawlerTaskItemListResponse>(
    `/investment/radar/crawler-task/${taskId}/item`,
    {
      params,
      silentError: true,
    },
  );
}

export async function requeueCrawlerTaskItems(
  data: CrawlerTaskItemRequeuePayload = {},
) {
  return requestClient.post<CrawlerTaskItemRequeueResponse>(
    '/investment/radar/crawler-task/item/requeue',
    data,
  );
}

export async function reclaimStaleCrawlerTaskItems(
  data: CrawlerTaskItemReclaimPayload = {},
) {
  return requestClient.post<CrawlerTaskItemReclaimResponse>(
    '/investment/radar/crawler-task/item/reclaim-stale-running',
    data,
  );
}

export async function getSignalEventList(params: SignalEventListParams) {
  return requestClient.get<RadarListResponse<SignalEvent>>(
    '/investment/radar/signal-event/list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getSignalEventDetail(eventId: number | string) {
  return requestClient.get<SignalEventDetail>(
    `/investment/radar/signal-event/${eventId}`,
    {
      silentError: true,
    },
  );
}

export async function updateSignalEvent(
  eventId: number | string,
  data: SignalEventUpdatePayload,
) {
  return requestClient.put<{ eventId: number; status: SignalEventStatus }>(
    `/investment/radar/signal-event/${eventId}`,
    data,
  );
}

export async function getSignalEventEvidenceList(eventId: number | string) {
  return requestClient.get<SignalEvidenceListResponse>(
    `/investment/radar/signal-event/${eventId}/evidence`,
    {
      silentError: true,
    },
  );
}

export async function rebuildSignalEventDemo() {
  return requestClient.post<SignalEventRebuildResponse>(
    '/investment/radar/signal-event/rebuild-demo',
    {},
  );
}

export async function convertSignalEventToRadarLead(
  eventId: number | string,
  data: SignalEventConvertPayload = {},
) {
  return requestClient.post<SignalEventConvertResponse>(
    `/investment/radar/signal-event/${eventId}/convert`,
    data,
  );
}

export async function getEnterpriseProfileList(
  params: EnterpriseProfileListParams,
) {
  return requestClient.get<RadarListResponse<EnterpriseProfile>>(
    '/investment/radar/enterprise-profile/list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getEnterpriseProfileDetail(profileId: number | string) {
  return requestClient.get<EnterpriseProfile>(
    `/investment/radar/enterprise-profile/${profileId}`,
    {
      silentError: true,
    },
  );
}

export async function getEnterpriseProfileSignals(profileId: number | string) {
  return requestClient.get<EnterpriseProfileSignalListResponse>(
    `/investment/radar/enterprise-profile/${profileId}/signals`,
    {
      silentError: true,
    },
  );
}

export async function getEnterpriseProfileTags(profileId: number | string) {
  return requestClient.get<EnterpriseTagListResponse>(
    `/investment/radar/enterprise-profile/${profileId}/tags`,
    {
      silentError: true,
    },
  );
}

export async function rebuildEnterpriseProfileDemo() {
  return requestClient.post<EnterpriseProfileRebuildResponse>(
    '/investment/radar/enterprise-profile/rebuild-demo',
    {},
  );
}

export async function getLeadScoreRuleList() {
  return requestClient.get<LeadScoreRuleListResponse>(
    '/investment/radar/score-rule/list',
    {
      silentError: true,
    },
  );
}

export async function updateLeadScoreRule(
  ruleId: number | string,
  data: LeadScoreRuleUpdatePayload,
) {
  return requestClient.put<LeadScoreRule>(
    `/investment/radar/score-rule/${ruleId}`,
    data,
  );
}

export async function recalculateRadarLeadScore(leadId: number | string) {
  return requestClient.post<RadarLeadScoreRecalculateResponse>(
    `/investment/radar/lead/${leadId}/recalculate-score`,
    {},
  );
}

export async function getRadarLeadScoreBreakdown(leadId: number | string) {
  return requestClient.get<LeadScoreBreakdownListResponse>(
    `/investment/radar/lead/${leadId}/score-breakdown`,
    {
      silentError: true,
    },
  );
}

export async function recalculateDemoLeadScores() {
  return requestClient.post<DemoLeadScoreRecalculateResponse>(
    '/investment/radar/lead/recalculate-demo-scores',
    {},
  );
}
