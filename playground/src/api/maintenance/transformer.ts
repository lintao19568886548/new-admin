import { requestClient } from '#/api/request';

export async function getTransformerList(params: any) {
  return requestClient.get('/maintenance/transformer/list', { params });
}

export async function getTransformerDetail(id: number) {
  return requestClient.get(`/maintenance/transformer/${id}`);
}

export async function createTransformer(data: any) {
  return requestClient.post('/maintenance/transformer', data);
}

export async function updateTransformer(data: any) {
  return requestClient.put('/maintenance/transformer', data);
}

export async function deleteTransformer(id: number) {
  return requestClient.delete(`/maintenance/transformer/${id}`);
}
