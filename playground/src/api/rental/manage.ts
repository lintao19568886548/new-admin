import { requestClient } from '#/api/request';

export async function getManageList(params?: any) {
  return requestClient.get('/rental/manage/list', { params });
}

export async function getManageDetail(id: number) {
  return requestClient.get(`/rental/manage/${id}`);
}

export async function createManage(data: any) {
  return requestClient.post('/rental/manage', data);
}

export async function updateManage(id: number, data: any) {
  return requestClient.put(`/rental/manage/${id}`, data);
}

export async function deleteManage(id: number) {
  return requestClient.delete(`/rental/manage/${id}`);
}
