import { requestClient } from '#/api/request';

export async function getListList(params?: any) {
  return requestClient.get('/rental/list/list', { params });
}

export async function getListDetail(id: number) {
  return requestClient.get(`/rental/list/${id}`);
}
