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
  scope?: 'collected' | 'raw' | 'reviewable' | 'strict';
  strictTotal?: number;
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

export interface ContactRestrictionListParams {
  currentPage?: number;
  keyword?: string;
  pageSize?: number;
  restrictionType?: string;
  status?: string;
}

export interface ContactRestrictionListItem {
  contactName?: null | string;
  createTime?: null | string;
  enterpriseId?: null | number;
  enterpriseName?: null | string;
  leadId?: null | number;
  parkName?: null | string;
  phoneNumber?: null | string;
  reason?: null | string;
  restrictionId: number;
  restrictionType: string;
  status: string;
  updateTime?: null | string;
}

export interface ContactRestrictionSummary {
  activeRestrictions: number;
  blacklistRestrictions: number;
  negativeReplyRestrictions: number;
  releasedRestrictions: number;
  totalRestrictions: number;
  unsubscribedRestrictions: number;
}

export interface ReleaseContactRestrictionResponse {
  restrictionId: number;
  status: string;
}

export interface RadarFollowRecord {
  content?: null | string;
  createTime?: null | string;
  followResult: string;
  followType: string;
  nextAction?: null | string;
  nextFollowTime?: null | string;
  operatorName?: null | string;
  recordId: number;
}

export interface RadarLeadSop {
  assignmentRecords: RadarAssignmentRecord[];
  followRecords: RadarFollowRecord[];
  reminders: RadarSopReminder[];
  visitRecords: RadarVisitRecord[];
}

export interface RadarAssignmentRecord {
  assignmentSource?: null | string;
  assignReason?: null | string;
  createTime?: null | string;
  ownerName?: null | string;
}

export interface RadarSopReminder {
  createTime?: null | string;
  description?: null | string;
  dueTime?: null | string;
  handledTime?: null | string;
  reminderId: number;
  reminderStatus: string;
  reminderType: string;
  title: string;
}

export interface RadarVisitRecord {
  actualTime?: null | string;
  createTime?: null | string;
  factoryFloorId?: null | number;
  feedback?: null | string;
  operatorName?: null | string;
  scheduledTime?: null | string;
  visitId: number;
  visitorName?: null | string;
  visitorPhone?: null | string;
  visitStatus: string;
}

export interface RadarAnalysisFunnel {
  activeLeads: number;
  contactedLeads: number;
  contactRate: number;
  dealLeads: number;
  dealRate: number;
  highPriorityLeads: number;
  repliedLeads: number;
  replyRate: number;
  totalLeads: number;
  visitLeads: number;
  visitRate: number;
}

export interface RadarAnalysisChannelStat {
  channel: string;
  dealLeads?: number;
  dealRate?: number;
  positiveRate: number;
  positiveReplies: number;
  repliedTasks: number;
  replyRate: number;
  sentTasks: number;
  totalTasks: number;
  visitLeads?: number;
  visitRate?: number;
}

export interface RadarAnalysisTemplateStat {
  dealLeads?: number;
  dealRate?: number;
  positiveRate: number;
  positiveReplies: number;
  repliedTasks: number;
  replyRate: number;
  templateCode: string;
  templateName: string;
  totalTasks: number;
  visitLeads?: number;
  visitRate?: number;
}

export interface RadarAnalysisSopStats {
  followCount: number;
  overdueReminders: number;
  pendingReminders: number;
  visitCount: number;
}

export interface RadarAnalysisSourceStat {
  conversionRate: number;
  convertedLeads: number;
  evidenceCount: number;
  highConfidenceLeads: number;
  sourceName: string;
  sourceType: string;
  totalLeads: number;
}

export interface RadarAnalysisSignalTypeStat {
  contactRate: number;
  convertedEvents: number;
  dealLeads: number;
  dealRate: number;
  eventType: string;
  radarLeads: number;
  totalEvents: number;
  visitLeads: number;
  visitRate: number;
}

export interface RadarAnalysisOwnerStat {
  contactedLeads: number;
  contactRate: number;
  dealLeads: number;
  dealRate: number;
  firstContactAvgHours: number;
  firstContactTimelyLeads?: number;
  firstContactTimelyRate?: number;
  followCount: number;
  ownerName: string;
  ownerUserId?: null | number;
  totalLeads: number;
  visitCount: number;
}

export interface RadarAnalysisSuggestion {
  content: string;
  level: 'danger' | 'success' | 'warning' | string;
  title: string;
}

export interface RadarAnalysisSummary {
  channelStats: RadarAnalysisChannelStat[];
  funnel: RadarAnalysisFunnel;
  generatedAt?: string;
  ownerStats: RadarAnalysisOwnerStat[];
  signalTypeStats: RadarAnalysisSignalTypeStat[];
  sopStats: RadarAnalysisSopStats;
  sourceStats: RadarAnalysisSourceStat[];
  suggestions: RadarAnalysisSuggestion[];
  templateStats: RadarAnalysisTemplateStat[];
}

export interface CreateRadarFollowPayload {
  content?: string;
  followResult?: string;
  followType?: string;
  nextAction?: string;
  nextFollowTime?: string;
}

export interface CreateRadarVisitPayload {
  factoryFloorId?: number;
  feedback?: string;
  scheduledTime: string;
  visitorName?: string;
  visitorPhone?: string;
}

export interface CompleteRadarVisitPayload {
  actualTime?: string;
  feedback: string;
}

export interface RadarSalesUser {
  activeLeadCount: number;
  parkName?: null | string;
  userId: number;
  userName: string;
}

export interface RadarSalesUserListParams {
  keyword?: string;
  parkId?: number;
}

export interface RadarLeadOwnerAssignPayload {
  assignReason?: string;
  ownerUserId: number;
}

export interface RadarLeadOwnerAssignResponse {
  leadId: number;
  ownerName: string;
  ownerUserId: number;
  stage: string;
}

export interface RadarLeadClosePayload {
  reason?: string;
  stage: 'DEAL' | 'INVALID' | string;
}

export interface RadarLeadCloseResponse {
  invalidReason?: null | string;
  leadId: number;
  stage: string;
  updateTime?: string;
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
  hasDetailEvidence?: boolean;
  industryText?: null | string;
  isGuangdong?: boolean;
  lastSyncedAt?: null | string;
  opportunityId: number | string;
  opportunityStatus: string;
  opportunityType: 'DEMAND' | 'SUPPLY';
  phoneNumber?: null | string;
  priceText?: null | string;
  publishedAgeLabel?: null | string;
  publishedAt?: null | string;
  publishedDateText?: null | string;
  qualityGrade?: null | string;
  score?: null | number;
  sourceCode?: null | string;
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
  includeMeta?: boolean;
  includeTotal?: boolean;
  keyword?: string;
  opportunityType?: string;
  pageSize?: number;
  publishedAgeLabel?: string;
  scope?: 'collected' | 'raw' | 'reviewable' | 'strict';
  sourceSite?: string;
}

export interface PublicOpportunityListResponse {
  filters?: {
    publishedAgeLabels?: string[];
    sourceSites?: string[];
  };
  items: PublicOpportunityItem[];
  page?: {
    currentPage: number;
    pageSize: number;
    total?: number;
  };
  scope?: 'collected' | 'raw' | 'reviewable' | 'strict';
  strictTotal?: number;
  total?: number;
  totalKnown?: boolean;
}

export interface PublicOpportunityEffectiveStats {
  scope?: 'collected' | 'reviewable' | 'strict';
  strictTotal?: number;
  total: number;
}

export interface PublicOpportunityEffectiveOptions {
  filters: {
    publishedAgeLabels?: string[];
    sourceSites?: string[];
  };
  scope?: 'collected' | 'reviewable' | 'strict';
}

export interface PublicOpportunityCrawlerProgressSource {
  itemStatus: Record<string, number>;
  latestTask: null | {
    createdLeadCount: number;
    errorMessage?: null | string;
    fetchedCount: number;
    finishedAt?: null | string;
    skippedCount: number;
    startedAt?: null | string;
    status: CrawlerTaskStatus | string;
    taskId: number;
    updatedLeadCount: number;
  };
  sourceCode: string;
  sourceId: number;
  sourceName: string;
}

export interface PublicOpportunityCrawlerProgress {
  note: 'crawler_progress_only_not_effective_counts' | string;
  opportunityType?: null | string;
  sourceCount: number;
  sources: PublicOpportunityCrawlerProgressSource[];
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

export interface PublicOpportunityQualityResult {
  city: null | string;
  missingFields: string[];
  reasons: string[];
  status: string;
}

export interface PublicDemandPageParsePayload {
  html: string;
  sourceSite?: string;
  sourceUrl: string;
}

export interface PublicDemandPageParsedOpportunity {
  areaText?: null | string;
  city?: null | string;
  contactName?: null | string;
  description?: null | string;
  detailJson?: null | Record<string, unknown>;
  district?: null | string;
  industryText?: null | string;
  missingFields?: string[];
  opportunityType: 'DEMAND';
  phoneNumber?: null | string;
  priceText?: null | string;
  publishedAt?: null | string;
  publishedDateText?: null | string;
  sourceSite: string;
  sourceUrl: string;
  title?: null | string;
}

export interface PublicDemandPageParseResponse {
  accepted: boolean;
  created: boolean;
  opportunity: null | PublicOpportunityItem;
  parsed: PublicDemandPageParsedOpportunity;
  qualityResult: null | PublicOpportunityQualityResult;
  skipReason: null | string;
}

export interface PublicOpportunityUrlImportPayload {
  maxRetryCount?: number;
  requeueExisting?: boolean;
  sourceCode: string;
  urls?: string[];
  urlText?: string;
}

export interface PublicOpportunityUrlImportRejectedItem {
  index: number;
  reason: string;
  sourceUrl: string;
}

export interface PublicOpportunityUrlImportResponse {
  acceptedCount: number;
  acceptedUrls: string[];
  duplicateInputCount: number;
  opportunityType: 'DEMAND' | 'SUPPLY';
  rejectedCount: number;
  rejectedItems: PublicOpportunityUrlImportRejectedItem[];
  seed: {
    createdCount: number;
    updatedCount: number;
  };
  source: {
    enabled: boolean;
    sourceCode: string;
    sourceId: number;
    sourceName: string;
  };
  sourceCode: string;
  sourceId: number;
  sourceName: string;
  totalInputCount: number;
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
  sourceType?: string;
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
  adapterStatus?: 'CANDIDATE' | 'READY';
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
  source: CrawlerSource | null;
  taskStatus: Record<string, number>;
}

export interface PublicOpportunityCrawlerRunPayload {
  batchSize?: number;
  discoverList?: boolean;
  freshnessDays?: number;
  ignoreInterval?: boolean;
  maxRetryCount?: number;
  reprocessSuccess?: boolean;
  retryDelayMinutes?: number;
  sourceCode?: string;
  staleReprocessMinutes?: number;
}

export interface RadarAcquisitionAnalytics {
  funnel: {
    companyLeadTotal: number;
    conversionRate: number;
    convertedToRadar: number;
    signalConversionRate: number;
    signalConvertedEvents: number;
    signalEventTotal: number;
  };
  signalTypeConversion: RadarAnalysisSignalTypeStat[];
  sourceConversion: RadarAnalysisSourceStat[];
}

export interface RadarChannelAnalyticsItem extends RadarAnalysisChannelStat {
  sendRate?: number;
}

export type RadarTemplateAnalyticsItem = RadarAnalysisTemplateStat;

export interface RadarPipelineRebuildResult {
  assignedLeadCount: number;
  createdOutreachTaskCount: number;
  createdProfileCount: number;
  createdSignalEventCount: number;
  createdSignalEvidenceCount: number;
  createdSopReminderCount: number;
  createdTagCount: number;
  deletedDirtySignalEventCount: number;
  finishedAt: string;
  outreachTargetLeadCount: number;
  pendingOutreachTaskCount: number;
  pendingSopReminderCount: number;
  profileCompanyCount: number;
  recalculatedLeadCount: number;
  sourceLeadCount: number;
  targetLeadCount: number;
  totalLeadCount: number;
  updatedProfileCount: number;
  updatedSignalEventCount: number;
  updatedSignalEvidenceCount: number;
  updatedTagCount: number;
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

export interface RadarLeadScoreBatchRecalculateResponse {
  items: RadarLeadScoreRecalculateResponse[];
  recalculatedCount: number;
  totalLeadCount: number;
}

export interface OutreachTemplate {
  approvalStatus: string;
  channel: string;
  content: string;
  createTime?: null | string;
  enabled: boolean;
  placeholderJson?: string[];
  priorityLevel: string;
  taskType: string;
  templateCode: string;
  templateId: number;
  templateName: string;
  updateTime?: null | string;
  versionNo: number;
}

export interface OutreachTemplateListResponse {
  items: OutreachTemplate[];
  page?: {
    currentPage: number;
    pageSize: number;
    total: number;
  };
  total: number;
}

export interface OutreachTemplatePayload {
  channel: string;
  content: string;
  placeholderJson?: string[];
  priorityLevel: string;
  taskType: string;
  templateCode: string;
  templateName: string;
}

export interface OutreachTemplatePreviewResponse {
  content: string;
  missingPlaceholders: string[];
  placeholders: string[];
  usedPlaceholders: string[];
}

export interface OutreachTemplateStatsRow {
  failedTasks: number;
  negativeReplies: number;
  positiveReplies: number;
  sentTasks: number;
  templateCode: string;
  templateId: number;
  templateName: string;
  totalTasks: number;
}

export interface OutreachTemplateVersion extends OutreachTemplate {
  changeType: string;
  versionId: number;
}

export interface OutreachTemplateEnabledResponse {
  enabled: boolean;
  templateId: number | string;
}

export interface OutreachSuggestionItem {
  channel: string;
  priorityLevel: string;
  suggestedContent: string;
  taskType: string;
  templateCode: string;
  templateId: number;
  templateName: string;
}

export interface OutreachSuggestion {
  canContact: boolean;
  city: string;
  companyName: string;
  contactName: string;
  contactRestrictionReason: string;
  industryName: string;
  intentArea: string;
  latestContactTime?: string;
  leadId: number;
  parkName: string;
  phoneNumber: string;
  priorityLevel: string;
  stage: string;
  suggestions: OutreachSuggestionItem[];
  totalScore: number;
}

export interface CreateOutreachTaskPayload {
  channel: string;
  content?: string;
  leadId: number;
  phoneNumber: string;
  taskType: string;
  templateCode?: string;
}

export interface OutreachTask {
  channel: string;
  content?: string;
  createTime?: string;
  leadId: number;
  phoneNumber: string;
  status: string;
  taskId: number;
  taskType: string;
  templateCode?: string;
}

export interface SendOutreachTaskResponse {
  providerTaskId?: null | string;
  resultCode?: 'CONTACT_RESTRICTED' | 'SUCCESS' | string;
  resultMessage?: string;
  sentAt?: null | string;
  sentBy?: null | number;
  status: string;
  taskId: number;
}

export type OutreachReplyStatus =
  | 'BLACKLIST'
  | 'NEGATIVE'
  | 'POSITIVE'
  | 'REPLIED'
  | 'UNSUBSCRIBED';

export interface ReplyOutreachTaskPayload {
  replyContent?: string;
  replyStatus: OutreachReplyStatus;
}

export interface ReplyOutreachTaskResponse {
  replyContent?: string;
  replyStatus: string;
  replyTime?: string;
  taskId: number;
}

export interface CancelOutreachTaskResponse {
  resultCode: string;
  resultMessage: string;
  status: string;
  taskId: number;
}

export interface RadarSopReminderListItem {
  contactName?: null | string;
  createTime?: null | string;
  description?: null | string;
  dueTime?: null | string;
  enterpriseName: string;
  handledTime?: null | string;
  latestContactTime?: null | string;
  leadId: number;
  ownerName?: null | string;
  parkName?: null | string;
  phoneNumber?: null | string;
  priorityLevel: string;
  reminderId: number;
  reminderStatus: string;
  reminderType: string;
  stage: string;
  title: string;
  totalScore: number;
  updateTime?: null | string;
}

export interface RadarSopReminderListParams {
  currentPage?: number;
  keyword?: string;
  pageSize?: number;
  priorityLevel?: string;
  reminderStatus?: string;
  reminderType?: string;
  stage?: string;
}

export interface RadarSopReminderSummary {
  needVisitReminders: number;
  newLeadReminders: number;
  overdueReminders: number;
  pendingReminders: number;
  totalReminders: number;
  visitFeedbackReminders: number;
  weeklyFollowUpReminders: number;
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
  return requestClient.get<PublicOpportunityListResponse>(
    '/investment/radar/public-opportunity/effective-list',
    {
      params,
      silentError: true,
    },
  );
}

export async function getEffectivePublicOpportunityStats(
  params: PublicOpportunityListParams,
) {
  return requestClient.get<PublicOpportunityEffectiveStats>(
    '/investment/radar/public-opportunity/effective-stats',
    {
      params,
      silentError: true,
    },
  );
}

export async function getEffectivePublicOpportunityOptions(
  params: PublicOpportunityListParams,
) {
  return requestClient.get<PublicOpportunityEffectiveOptions>(
    '/investment/radar/public-opportunity/effective-options',
    {
      params,
      silentError: true,
    },
  );
}

export async function getEffectivePublicOpportunityProgress(
  params: Pick<PublicOpportunityListParams, 'opportunityType'> = {},
) {
  return requestClient.get<PublicOpportunityCrawlerProgress>(
    '/investment/radar/public-opportunity/effective-progress',
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

export async function parseDemandPublicPage(
  data: PublicDemandPageParsePayload,
) {
  return requestClient.post<PublicDemandPageParseResponse>(
    '/investment/radar/public-opportunity/parse-demand-page',
    data,
  );
}

export async function importPublicOpportunityUrls(
  data: PublicOpportunityUrlImportPayload,
) {
  return requestClient.post<PublicOpportunityUrlImportResponse>(
    '/investment/radar/public-opportunity/import-urls',
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

export async function runInternalContractExpiryTask() {
  return requestClient.post<CrawlerTask>(
    '/investment/radar/crawler-task/run-internal-contract-expiry',
    {},
  );
}

export async function syncInternalContractExpiryToRadar() {
  return requestClient.post<{
    convertedCount: number;
    radarLeadIds: number[];
    reusedCount: number;
    signalSummary: {
      createdEventCount: number;
      createdEvidenceCount: number;
      deletedDirtyEventCount: number;
      updatedEventCount: number;
      updatedEvidenceCount: number;
    };
    task: CrawlerTask;
  }>('/investment/radar/crawler-task/sync-internal-contract-expiry', {});
}

export async function runPublicOpportunityCrawlerTask(
  data: PublicOpportunityCrawlerRunPayload = {},
) {
  return requestClient.post<CrawlerTask>(
    '/investment/radar/crawler-task/run-public-opportunity',
    data,
  );
}

export async function runEiaCrawlerTask() {
  return requestClient.post<CrawlerTask>(
    '/investment/radar/crawler-task/run-eia',
    {},
  );
}

export async function runRecruitmentCrawlerTask() {
  return requestClient.post<CrawlerTask>(
    '/investment/radar/crawler-task/run-recruitment',
    {},
  );
}

export async function runTenderCrawlerTask() {
  return requestClient.post<CrawlerTask>(
    '/investment/radar/crawler-task/run-tender',
    {},
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

export async function refreshSignalEvents() {
  return requestClient.post<SignalEventRebuildResponse>(
    '/investment/radar/signal-event/refresh',
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

export async function refreshEnterpriseProfiles() {
  return requestClient.post<EnterpriseProfileRebuildResponse>(
    '/investment/radar/enterprise-profile/refresh',
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

export async function recalculateRadarLeadScores() {
  return requestClient.post<RadarLeadScoreBatchRecalculateResponse>(
    '/investment/radar/lead/recalculate-scores',
    {},
  );
}

export async function getOutreachTemplateList(params?: {
  approvalStatus?: string;
  channel?: string;
  currentPage?: number;
  enabled?: string;
  keyword?: string;
  pageSize?: number;
  taskType?: string;
}) {
  return requestClient.get<OutreachTemplateListResponse>(
    '/investment/radar/outreach-template/list',
    {
      params,
      silentError: true,
    },
  );
}

export async function createOutreachTemplate(data: OutreachTemplatePayload) {
  return requestClient.post<OutreachTemplate>(
    '/investment/radar/outreach-template',
    data,
  );
}

export async function updateOutreachTemplate(
  templateId: number | string,
  data: OutreachTemplatePayload,
) {
  return requestClient.put<OutreachTemplate>(
    `/investment/radar/outreach-template/${templateId}`,
    data,
  );
}

export async function enableOutreachTemplate(templateId: number | string) {
  return requestClient.post<OutreachTemplateEnabledResponse>(
    `/investment/radar/outreach-template/${templateId}/enable`,
    {},
  );
}

export async function disableOutreachTemplate(templateId: number | string) {
  return requestClient.post<OutreachTemplateEnabledResponse>(
    `/investment/radar/outreach-template/${templateId}/disable`,
    {},
  );
}

export async function previewOutreachTemplate(data: OutreachTemplatePayload) {
  return requestClient.post<OutreachTemplatePreviewResponse>(
    '/investment/radar/outreach-template/preview',
    data,
  );
}

export async function getOutreachTemplateStats() {
  return requestClient.get<{
    items: OutreachTemplateStatsRow[];
    total: number;
  }>('/investment/radar/outreach-template/stats', {
    silentError: true,
  });
}

export async function getOutreachTemplateVersions(templateId: number | string) {
  return requestClient.get<{
    items: OutreachTemplateVersion[];
    total: number;
  }>(`/investment/radar/outreach-template/${templateId}/versions`, {
    silentError: true,
  });
}

export async function submitOutreachTemplateApproval(
  templateId: number | string,
) {
  return requestClient.post<OutreachTemplate>(
    `/investment/radar/outreach-template/${templateId}/submit-approval`,
    {},
  );
}

export async function approveOutreachTemplate(templateId: number | string) {
  return requestClient.post<OutreachTemplate>(
    `/investment/radar/outreach-template/${templateId}/approve`,
    {},
  );
}

export async function rejectOutreachTemplate(templateId: number | string) {
  return requestClient.post<OutreachTemplate>(
    `/investment/radar/outreach-template/${templateId}/reject`,
    {},
  );
}

export async function getOutreachSuggestion(leadId: number | string) {
  return requestClient.get<OutreachSuggestion>(
    `/investment/radar/lead/${leadId}/outreach-suggestion`,
    {
      silentError: true,
    },
  );
}

export async function getRadarLeadSop(leadId: number | string) {
  return requestClient.get<RadarLeadSop>(
    `/investment/radar/lead/${leadId}/sop`,
    {
      silentError: true,
    },
  );
}

export async function getRadarAnalysisSummary() {
  return requestClient.get<RadarAnalysisSummary>(
    '/investment/radar/analysis/summary',
    {
      silentError: true,
    },
  );
}

export async function getRadarAcquisitionAnalytics() {
  return requestClient.get<RadarAcquisitionAnalytics>(
    '/investment/radar/analytics/acquisition',
    {
      silentError: true,
    },
  );
}

export async function getRadarChannelAnalytics() {
  return requestClient.get<RadarChannelAnalyticsItem[]>(
    '/investment/radar/analytics/channel',
    {
      silentError: true,
    },
  );
}

export async function getRadarSalesAnalytics() {
  return requestClient.get<RadarAnalysisOwnerStat[]>(
    '/investment/radar/analytics/sales',
    {
      silentError: true,
    },
  );
}

export async function getRadarTemplateAnalytics() {
  return requestClient.get<RadarTemplateAnalyticsItem[]>(
    '/investment/radar/analytics/template',
    {
      silentError: true,
    },
  );
}

export async function rebuildRadarAcquisitionPipeline() {
  return requestClient.post<RadarPipelineRebuildResult>(
    '/investment/radar/pipeline/rebuild',
    {},
  );
}

export async function createRadarFollowRecord(
  leadId: number | string,
  data: CreateRadarFollowPayload,
) {
  return requestClient.post<{ recordId: number }>(
    `/investment/radar/lead/${leadId}/follow`,
    data,
  );
}

export async function createRadarVisitRecord(
  leadId: number | string,
  data: CreateRadarVisitPayload,
) {
  return requestClient.post<{ visitId: number }>(
    `/investment/radar/lead/${leadId}/visit`,
    data,
  );
}

export async function assignRadarLeadOwner(
  leadId: number | string,
  data: RadarLeadOwnerAssignPayload,
) {
  return requestClient.post<RadarLeadOwnerAssignResponse>(
    `/investment/radar/lead/${leadId}/assign-owner`,
    data,
  );
}

export async function closeRadarLead(
  leadId: number | string,
  data: RadarLeadClosePayload,
) {
  return requestClient.post<RadarLeadCloseResponse>(
    `/investment/radar/lead/${leadId}/close`,
    data,
  );
}

export async function getRadarSalesUserList(
  params: RadarSalesUserListParams = {},
) {
  return requestClient.get<RadarListResponse<RadarSalesUser>>(
    '/investment/radar/sales-user/list',
    {
      params,
      silentError: true,
    },
  );
}

export async function completeRadarSopReminder(reminderId: number | string) {
  return requestClient.post<{ reminderId: number; status: string }>(
    `/investment/radar/sop-reminder/${reminderId}/complete`,
    {},
  );
}

export async function completeRadarVisitRecord(
  visitId: number | string,
  data: CompleteRadarVisitPayload,
) {
  return requestClient.post<{
    actualTime: string;
    feedback: string;
    visitId: number;
    visitStatus: string;
  }>(`/investment/radar/visit-record/${visitId}/complete`, data);
}

export async function getRadarSopReminderList(
  params: RadarSopReminderListParams,
) {
  return requestClient.get<
    RadarListResponse<RadarSopReminderListItem> & {
      summary: RadarSopReminderSummary;
    }
  >('/investment/radar/sop-reminder/list', {
    params,
    silentError: true,
  });
}

export async function createOutreachTask(data: CreateOutreachTaskPayload) {
  return requestClient.post<OutreachTask>(
    '/investment/radar/outreach-task',
    data,
  );
}

export async function sendOutreachTask(taskId: number | string) {
  return requestClient.post<SendOutreachTaskResponse>(
    `/investment/radar/outreach-task/${taskId}/send`,
    {},
  );
}

export async function cancelOutreachTask(taskId: number | string) {
  return requestClient.post<CancelOutreachTaskResponse>(
    `/investment/radar/outreach-task/${taskId}/cancel`,
    {},
  );
}

export async function replyOutreachTask(
  taskId: number | string,
  data: ReplyOutreachTaskPayload,
) {
  return requestClient.post<ReplyOutreachTaskResponse>(
    `/investment/radar/outreach-task/${taskId}/reply`,
    data,
  );
}

export async function getContactRestrictionList(
  params: ContactRestrictionListParams,
) {
  return requestClient.get<
    RadarListResponse<ContactRestrictionListItem> & {
      summary: ContactRestrictionSummary;
    }
  >('/investment/radar/contact-restriction/list', {
    params,
    silentError: true,
  });
}

export async function releaseContactRestriction(
  restrictionId: number | string,
) {
  return requestClient.post<ReleaseContactRestrictionResponse>(
    `/investment/radar/contact-restriction/${restrictionId}/release`,
    {},
  );
}

// ==================== 房源匹配相关 ====================

export interface PropertyMatchItem {
  address?: null | string;
  availableArea: number;
  factoryId: number;
  factoryName: string;
  floorCount?: number;
  matchReasons: string[];
  matchScore: number;
  mismatchReminders: string[];
  parkId?: null | number;
  parkName?: null | string;
  rentPrice?: number;
  rentPriceText?: string;
  salesPitch: string;
  tag?: string;
  title?: string;
  totalArea: number;
  usedArea?: number;
}

export interface RebuildPropertyMatchResponse {
  matches: PropertyMatchItem[];
  rebuiltAt: string;
  totalCount: number;
}

export interface RebuildPropertyMatchBatchResponse {
  items: Array<{
    leadId: number;
    matchCount: number;
    topMatchScore: number;
  }>;
  rebuiltAt: string;
  rebuiltLeadCount: number;
}

export interface UpdatePropertyTagsResponse {
  factoryId: number;
  factoryName: string;
  tags: string[];
  updateTime: string;
}

/**
 * 获取房源匹配结果
 */
export async function getPropertyMatchList(leadId: number | string) {
  return requestClient.get<PropertyMatchItem[]>(
    `/investment/radar/lead/${leadId}/property-match`,
    {
      silentError: true,
    },
  );
}

/**
 * 重新计算房源匹配
 */
export async function rebuildPropertyMatch(leadId: number | string) {
  return requestClient.post<RebuildPropertyMatchResponse>(
    `/investment/radar/lead/${leadId}/rebuild-property-match`,
    {},
  );
}

export async function rebuildPropertyMatchBatch(limit = 200) {
  return requestClient.post<RebuildPropertyMatchBatchResponse>(
    '/investment/radar/lead/rebuild-property-match-batch',
    { limit },
  );
}

export async function updatePropertyTags(
  propertyId: number | string,
  tags: string[],
) {
  return requestClient.put<UpdatePropertyTagsResponse>(
    `/investment/radar/property/${propertyId}/tags`,
    { tags },
  );
}
