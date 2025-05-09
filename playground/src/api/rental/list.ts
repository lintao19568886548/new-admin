import { requestClient } from '#/api/request';

// 获取园区列表
export async function getParkList(params?: any) {
  return requestClient.get('/rental/park/list', { params });
}

// 获取园区详情
export async function getParkDetail(id: number) {
  return requestClient.get(`/rental/park/${id}`);
}
