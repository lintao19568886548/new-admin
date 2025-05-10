import { requestClient } from '#/api/request';

export async function getFactoryList(params?: any) {
  return requestClient.get('/factory/list', { params });
}

export async function getFactoryDetail(id: number) {
  return requestClient.get(`/factory/${id}`);
}

export async function createFactory(data: any) {
  return requestClient.post('/factory', data);
}

export async function updateFactory(id: number, data: any) {
  return requestClient.put(`/factory/${id}`, data);
}

export async function deleteFactory(id: number) {
  return requestClient.delete(`/factory/${id}`);
}

// 添加获取厂房列表的API函数
export async function getFactoryListByParkId() {
  return requestClient.get(`/factory/list-by-park`);
}
