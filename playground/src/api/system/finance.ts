import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemFinanceApi {
  export interface SystemFinance {
    [key: string]: any;
    amount: number;
    billCategory: string;
    billName: string;
    transactionTime: string;
    transactionType: string;
  }
}

/**
 * 获取角色列表数据
 */
async function getFinanceList(params: Recordable<any>) {
  return requestClient.get<Array<SystemFinanceApi.SystemFinance>>(
    '/system/role/list',
    { params },
  );
}

/**
 * 创建角色
 * @param data 角色数据
 */
async function createFinance(data: Omit<SystemFinanceApi.SystemFinance, 'id'>) {
  return requestClient.post('/system/role', data);
}

/**
 * 更新角色
 *
 * @param id 角色 ID
 * @param data 角色数据
 */
async function updateFinance(
  id: string,
  data: Omit<SystemFinanceApi.SystemFinance, 'id'>,
) {
  return requestClient.put(`/system/role/${id}`, data);
}

/**
 * 删除角色
 * @param id 角色 ID
 */
async function deleteFinance(id: string) {
  return requestClient.delete(`/system/role/${id}`);
}

export { createFinance, deleteFinance, getFinanceList, updateFinance };
