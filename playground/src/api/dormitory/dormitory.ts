import { requestClient } from '#/api/request';

export async function getDormitoryList(params?: any) {
  return requestClient.get('/dormitory/list', { params });
}

export async function getDormitoryDetail(id: number) {
  return requestClient.get(`/dormitory/${id}`);
}

export async function createDormitory(data: any) {
  return requestClient.post('/dormitory', data);
}

export async function updateDormitory(id: number, data: any) {
  return requestClient.put(`/dormitory/${id}`, data);
}

export async function deleteDormitory(id: number) {
  return requestClient.delete(`/dormitory/${id}`);
}
