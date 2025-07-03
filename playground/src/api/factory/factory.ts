import { requestClient } from '#/api/request';

export async function getFactoryList(params?: any) {
  return requestClient.get('/factory/list', { params });
}

export async function getAvailableFactoryList(params?: any) {
  return requestClient.get('/factory/available-list', { params });
}

export async function getFactoryDetail(id: number) {
  return requestClient.get(`/factory/${id}`);
}

/**
 * 创建自有厂房
 * @param data 厂房数据
 */
export async function createOwnFactory(data: any) {
  return requestClient.post('/factory/own', data);
}

/**
 * 创建非自有厂房（入驻厂房）
 * @param data 厂房数据
 */
export async function createSettledFactory(data: any) {
  return requestClient.post('/factory/settled', data);
}

/**
 * 创建厂房（通用接口，保持向后兼容）
 * @param data 厂房数据
 * @deprecated 建议使用 createOwnFactory 或 createRentalFactory
 */
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
