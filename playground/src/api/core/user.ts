import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/user/info');
}

/**
 * 注销当前登录账号
 */
export async function cancelCurrentUserApi() {
  return requestClient.post('/user/cancel');
}
