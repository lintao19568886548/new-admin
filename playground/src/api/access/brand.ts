import { requestClient } from '#/api/request';

export interface AccessBrandListParams {
  brandCode?: string;
  brandName?: string;
  currentPage?: number;
  enabled?: boolean | number | string;
  isDefault?: boolean | number | string;
  pageSize?: number;
  protocolType?: string;
}

export type AccessBrandOptionField = 'brandCode' | 'brandName' | 'protocolType';

export interface AccessBrandOptionParams {
  field?: AccessBrandOptionField;
  keyword?: string;
}

export interface AccessBrand {
  accessBrandId: number;
  apiEndpoint?: string;
  appKey?: string;
  appSecretRef?: string;
  brandCode: string;
  brandName: string;
  enabled: boolean;
  isDefault: boolean;
  protocolType?: string;
  remark?: string;
  updateTime?: string;
}

function filterParams(params?: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

export async function getAccessBrandList(params?: AccessBrandListParams) {
  return requestClient.get('/access/brand/list', {
    params: filterParams(params),
  });
}

export async function getAccessBrandSearchOptions(
  params?: AccessBrandOptionParams,
) {
  return requestClient.get('/access/brand/options', {
    params: filterParams(params),
  });
}

export async function getAccessBrandDetail(id: number) {
  return requestClient.get(`/access/brand/${id}`);
}

export async function createAccessBrand(data: Record<string, any>) {
  return requestClient.post('/access/brand', data);
}

export async function updateAccessBrand(id: number, data: Record<string, any>) {
  return requestClient.put(`/access/brand/${id}`, data);
}

export async function deleteAccessBrand(id: number) {
  return requestClient.delete(`/access/brand/${id}`);
}
