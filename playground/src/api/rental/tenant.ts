import { requestClient } from '#/api/request';
import { notifyWorkbenchTodoChangedAfter } from '#/utils/workbench-todo-sync';

export async function getTenantList(params?: any) {
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

export async function getTenantSelectList(params?: any) {
  return requestClient.get(`/rental/tenant/select`, { params });
}

export async function createTenant(data: any) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post('/rental/tenant', data),
    { reason: 'tenant-saved', source: 'tenant-api' },
  );
}

export async function updateTenant(id: number, data: any) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.put(`/rental/tenant/${id}`, data),
    { reason: 'tenant-saved', source: 'tenant-api' },
  );
}

export async function deleteTenant(id: number) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.delete(`/rental/tenant/${id}`),
    { reason: 'tenant-deleted', source: 'tenant-api' },
  );
}

export async function clearTenants(params?: any) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post('/rental/tenant/clear', params),
    { reason: 'tenant-cleared', source: 'tenant-api' },
  );
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

// 批量发送催缴短信
export async function sendBulkSms() {
  return requestClient.post('/sms/send-bulk');
}
