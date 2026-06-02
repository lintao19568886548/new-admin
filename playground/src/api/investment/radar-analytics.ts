import { requestClient } from '#/api/request';

export interface RadarSalesFunnel {
  assignedLeads: number;
  contactedLeads: number;
  contactRate: number;
  dealLeads: number;
  dealRate: number;
  newLeads: number;
  repliedLeads: number;
  replyRate: number;
  visitLeads: number;
  visitRate: number;
}

export interface RadarRoiItem {
  channel: string;
  dealLeads: number;
  estimatedCost: number;
  estimatedRevenue: number;
  roi: number;
  sentTasks: number;
}

export interface RadarTemplateConversionItem {
  dealLeads: number;
  dealRate: number;
  positiveRate: number;
  positiveReplies: number;
  repliedTasks: number;
  replyRate: number;
  sentTasks: number;
  templateCode: string;
  templateId?: null | number;
  templateName: string;
  totalTasks: number;
  visitLeads: number;
  visitRate: number;
}

export async function getRadarSalesFunnel() {
  return requestClient.get<RadarSalesFunnel>(
    '/investment/radar/analytics/sales-funnel',
    { silentError: true },
  );
}

export async function getRadarRoiStats() {
  return requestClient.get<RadarRoiItem[]>('/investment/radar/analytics/roi', {
    silentError: true,
  });
}

export async function getRadarTemplateConversionStats() {
  return requestClient.get<RadarTemplateConversionItem[]>(
    '/investment/radar/analytics/template-conversion',
    { silentError: true },
  );
}
