import { requestClient } from '#/api/request';

export interface TransformerItem {
  address: string;
  checker: string;
  checkTime: string;
  createTime?: string;
  parkId?: number;
  remark?: string;
  specifications: string;
  status: string;
  title: string;
  transformerId: number;
  updateTime?: string;
}

export async function getTransformerList(params: any) {
  return requestClient.get('/maintenance/transformer/list', { params });
}

export async function getTransformerDetail(id: number) {
  return requestClient.get(`/maintenance/transformer/${id}`);
}

export async function createTransformer(data: any) {
  return requestClient.post('/maintenance/transformer', data);
}

export async function updateTransformer(id: number, data: any) {
  return requestClient.put(`/maintenance/transformer/${id}`, data);
}

export async function deleteTransformer(id: number) {
  return requestClient.delete(`/maintenance/transformer/${id}`);
}
