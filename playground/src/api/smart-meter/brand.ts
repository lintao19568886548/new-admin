import { requestClient } from '#/api/request';

export type MeterType = 'electric' | 'water';

export interface MeterBrandListParams {
  brandCode?: string;
  brandName?: string;
  currentPage?: number;
  enabled?: boolean | number | string;
  isDefault?: boolean | number | string;
  meterType?: MeterType;
  pageSize?: number;
  protocolType?: string;
}

export type MeterBrandOptionField = 'brandCode' | 'brandName' | 'protocolType';

export interface MeterBrandOptionParams {
  field?: MeterBrandOptionField;
  keyword?: string;
  meterType?: MeterType;
}

export interface MeterBrand {
  apiEndpoint?: string;
  appKey?: string;
  appSecretRef?: string;
  brandCode: string;
  brandName: string;
  enabled: boolean;
  isDefault: boolean;
  meterBrandId: number;
  meterType: MeterType;
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

export async function getMeterBrandList(params?: MeterBrandListParams) {
  return requestClient.get('/smart-meter/brand/list', {
    params: filterParams(params),
  });
}

export async function getMeterBrandSearchOptions(
  params?: MeterBrandOptionParams,
) {
  return requestClient.get('/smart-meter/brand/options', {
    params: filterParams(params),
  });
}

export async function getMeterBrandDetail(id: number) {
  return requestClient.get(`/smart-meter/brand/${id}`);
}

export async function createMeterBrand(data: Record<string, any>) {
  return requestClient.post('/smart-meter/brand', data);
}

export async function updateMeterBrand(id: number, data: Record<string, any>) {
  return requestClient.put(`/smart-meter/brand/${id}`, data);
}

export async function deleteMeterBrand(id: number) {
  return requestClient.delete(`/smart-meter/brand/${id}`);
}
