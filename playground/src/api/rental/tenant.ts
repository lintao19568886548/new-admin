import { requestClient } from '#/api/request';

export async function getTenantList(params?: any) {
  console.warn('API调用参数:', params);

  // 处理查询参数，移除空值
  const cleanParams: Record<string, any> = { ...params };
  Object.keys(cleanParams).forEach((key) => {
    if (
      cleanParams[key] === undefined ||
      cleanParams[key] === null ||
      cleanParams[key] === ''
    ) {
      // 使用 undefined 赋值替代 delete
      cleanParams[key] = undefined;
    }
  });

  // 过滤掉 undefined 的值
  const filteredParams = Object.fromEntries(
    Object.entries(cleanParams).filter(([_, value]) => value !== undefined),
  );

  return requestClient
    .get('/rental/tenant/list', {
      params: filteredParams,
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

export async function getTenantDetail(id: number) {
  return requestClient.get(`/rental/tenant/${id}`);
}

export async function getTenantSelectList() {
  return requestClient.get(`/rental/tenant/select`);
}

export async function createTenant(data: any) {
  return requestClient.post('/rental/tenant', data);
}

export async function updateTenant(id: number, data: any) {
  return requestClient.put(`/rental/tenant/${id}`, data);
}

export async function deleteTenant(id: number) {
  return requestClient.delete(`/rental/tenant/${id}`);
}

// 获取租户短信信息
export async function getTenantSmsInfo(id: number) {
  return requestClient.get(`/rental/tenant/${id}/sms-info`);
}

// 发送短信
export async function sendSms(data: {
  contractEndDate: string;
  increaseDate: string;
  phoneNumber: string;
  rentalTenantId: number;
  tenantName: string;
}) {
  return requestClient.post('/sms/send', data);
}
