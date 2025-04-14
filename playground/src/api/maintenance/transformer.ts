import { requestClient } from '#/api/request';

export async function getTransformerList(params: any) {
  return requestClient.get('/transformer/list', { params });
}

export async function getTransformerDetail(id: number) {
  return requestClient.get(`/transformer/${id}`);
}

export async function createTransformer(data: any) {
  return requestClient.post('/transformer', data);
}

export async function updateTransformer(data: any) {
  return requestClient.put('/transformer', data);
}

export async function deleteTransformer(id: number) {
  return requestClient.delete(`/transformer/${id}`);
}
