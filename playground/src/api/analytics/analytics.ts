import { requestClient } from '#/api/request';

export async function getAnalyticsData(params: any) {
  return requestClient.get(`/analytics/data`, { params });
}

export async function getAnalyticsTrend() {
  return requestClient.get(`/analytics/trend`);
}
export async function getAnalyticsMonth() {
  return requestClient.get(`/analytics/month-sum`);
}

export async function getAnalyticsTotal() {
  return requestClient.get(`/analytics/total`);
}

export async function getAnalyticsParkElectricity() {
  return requestClient.get(`/analytics/park-electricity`);
}

export async function getAnalyticsContractOverview(params?: {
  parkId?: number;
}) {
  return requestClient.get(`/analytics/contract-overview`, { params });
}

export async function getAnalyticsRevenueOverview(params?: {
  parkId?: number;
}) {
  return requestClient.get(`/analytics/revenue-overview`, { params });
}

export async function getAnalyticsParkDashboardStats(params?: {
  parkId?: number;
}) {
  return requestClient.get(`/analytics/park-dashboard-stats`, { params });
}
