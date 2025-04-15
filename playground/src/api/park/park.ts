import { requestClient } from '#/api/request';

export async function getVisitorParkList(params: any) {
  return requestClient.get('/park/visitor-list', { params });
}

export async function getParkList(params: any) {
  return requestClient.get('/park/list', { params });
}

export async function getParkDetail(id: number) {
  return requestClient.get(`/park/${id}`);
}

export async function createPark(data: any) {
  return requestClient.post('/park', data);
}

export async function updatePark(id: number, data: any) {
  return requestClient.put(`/park/${id}`, data);
}

export async function deletePark(id: number) {
  return requestClient.delete(`/park/${id}`);
}
