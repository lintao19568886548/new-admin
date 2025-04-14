import { requestClient } from '#/api/request';

export async function getFirefightingList(params: any) {
  return requestClient.get('/maintenance/firefighting/list', { params });
}

export async function getFirefightingDetail(id: number) {
  return requestClient.get(`/maintenance/firefighting/${id}`);
}

export async function createFirefighting(data: any) {
  return requestClient.post('/maintenance/firefighting', data);
}

export async function updateFirefighting(id: number, data: any) {
  return requestClient.put(`/maintenance/firefighting/${id}`, data);
}

export async function deleteFirefighting(id: number) {
  return requestClient.delete(`/maintenance/firefighting/${id}`);
}
