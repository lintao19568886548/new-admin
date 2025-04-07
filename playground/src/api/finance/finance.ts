import { requestClient } from '#/api/request';

export async function getFinanceList(params?: any) {
  console.warn('API调用参数:', params);
  return requestClient.get('/finance/list', {
    params,
    // 确保参数正确序列化
    paramsSerializer: (params) => {
      return Object.entries(params)
        .filter(
          ([_, value]) => value !== null && value !== undefined && value !== '',
        )
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join('&');
    },
  });
}

export async function getFinanceDetail(id: number) {
  return requestClient.get(`/finance/${id}`);
}

export async function createFinance(data: any) {
  return requestClient.post('/finance', data);
}

export async function updateFinance(id: number, data: any) {
  return requestClient.put(`/finance/${id}`, data);
}

export async function deleteFinance(id: number) {
  return requestClient.delete(`/finance/${id}`);
}

export async function getFinanceAnalyticsData(params: any) {
  return requestClient.get(`/finance/data`, params);
}
