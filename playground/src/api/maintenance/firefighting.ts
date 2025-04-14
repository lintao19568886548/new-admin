import { requestClient } from '#/api/request';

export async function getFirefightingList(params: any) {
  return requestClient.get('/firefighting/list', { params });
}

export async function getFirefightingDetail(id: number) {
  return requestClient.get(`/firefighting/${id}`);
}

export async function createFirefighting(data: any) {
  return requestClient.post('/firefighting', data);
}

export async function updateFirefighting(data: any) {
  return requestClient.put('/firefighting', data);
}

export async function deleteFirefighting(id: number) {
  return requestClient.delete(`/firefighting/${id}`);
}
