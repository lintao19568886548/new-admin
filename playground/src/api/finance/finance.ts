import { requestClient } from '#/api/request';

export async function getFinanceList(params?: any) {
  console.warn('API调用参数:', params);
  return requestClient
    .get('/finance/list', {
      params,
      // 确保参数正确序列化
      paramsSerializer: (params) => {
        return Object.entries(params)
          .filter(
            ([_, value]) =>
              value !== null && value !== undefined && value !== '',
          )
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join('&');
      },
    })
    .then((response) => {
      // 确保返回的数据格式一致，包含分页信息
      if (response && !response.items) {
        // 如果返回的是数组，转换为标准格式
        return {
          currentPage: params?.currentPage || 1,
          pageSize: params?.pageSize || 20,
          total: Array.isArray(response) ? response.length : 0,
          items: Array.isArray(response) ? response : [],
        };
      }
      return response;
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
