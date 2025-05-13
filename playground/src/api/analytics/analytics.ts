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
