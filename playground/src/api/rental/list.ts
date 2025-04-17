import { requestClient } from '#/api/request';

// 获取园区列表
export async function getParkList(params?: any) {
  return requestClient.get('/rental/park/list', { params });
}

// 获取园区详情
export async function getParkDetail(id: number) {
  return requestClient.get(`/rental/park/${id}`);
}

// 保留原有的厂房相关API，以便兼容旧代码
export async function getListList(params?: any) {
  return requestClient.get('/rental/factory/list', { params });
}

export async function getListDetail(id: number) {
  return requestClient.get(`/rental/factory/${id}`);
}
