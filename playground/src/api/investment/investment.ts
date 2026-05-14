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
