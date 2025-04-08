import { requestClient } from '#/api/request';

export async function getAnalyticsData(params: any) {
  return requestClient.get(`/analytics/data`, params);
}

export async function getAnalyticsTrend(params: any) {
  return requestClient.get(`/analytics/trend`, params);
}
export async function getAnalyticsMonth(params: any) {
  return requestClient.get(`/analytics/month-sum`, params);
}

export async function getAnalyticsTotal(params: any) {
  return requestClient.get(`/analytics/total`, params);
}
