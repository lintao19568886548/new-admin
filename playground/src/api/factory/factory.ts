import { requestClient } from '#/api/request';
import { notifyWorkbenchTodoChangedAfter } from '#/utils/workbench-todo-sync';

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
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post('/factory/own', data),
    { reason: 'factory-saved', source: 'factory-api' },
  );
}

/**
 * 创建非自有厂房（入驻厂房）
 * @param data 厂房数据
 */
export async function createSettledFactory(data: any) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post('/factory/settled', data),
    { reason: 'factory-saved', source: 'factory-api' },
  );
}

/**
 * 创建厂房（通用接口，保持向后兼容）
 * @param data 厂房数据
 * @deprecated 建议使用 createOwnFactory 或 createRentalFactory
 */
export async function createFactory(data: any) {
  return notifyWorkbenchTodoChangedAfter(requestClient.post('/factory', data), {
    reason: 'factory-saved',
    source: 'factory-api',
  });
}

export async function updateFactory(id: number, data: any) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.put(`/factory/${id}`, data),
    { reason: 'factory-saved', source: 'factory-api' },
  );
}

export async function deleteFactory(id: number) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.delete(`/factory/${id}`),
    { reason: 'factory-deleted', source: 'factory-api' },
  );
}

// 添加获取厂房列表的API函数
export async function getFactoryListByParkId() {
  return requestClient.get(`/factory/list-by-park`);
}
