import { requestClient } from '#/api/request';

export interface SalaryListParams {
  currentPage?: number;
  currentPark?: number | string;
  issued?: boolean | number | string;
  issueDate?: string;
  pageSize?: number;
  phoneNumber?: string;
  salaryAmount?: number | string;
  tenantName?: string;
}

export async function getSalaryList(params?: SalaryListParams) {
  return requestClient
    .get('/rental/salary/list', {
      params,
      paramsSerializer: (query) => {
        return Object.entries(query || {})
          .filter(
            ([, value]) =>
              value !== undefined && value !== null && value !== '',
          )
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value as any)}`,
          )
          .join('&');
      },
    })
    .then((response) => {
      if (response && !response.items) {
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

export async function getSalaryDetail(id: number) {
  return requestClient.get(`/rental/salary/${id}`);
}

export async function createSalary(data: any) {
  return requestClient.post('/rental/salary', data);
}

export async function updateSalary(id: number, data: any) {
  return requestClient.put(`/rental/salary/${id}`, data);
}

export async function deleteSalary(id: number) {
  return requestClient.delete(`/rental/salary/${id}`);
}

export async function getSalaryTenantOptions(params?: { keyword?: string }) {
  return requestClient.get('/rental/salary/tenant-options', { params });
}

export async function syncSalaryTenants(data?: {
  currentPark?: number | string;
}) {
  return requestClient.post('/rental/salary/sync', data);
}
