import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  export interface SystemUser {
    centerUserId?: number;
    createTime?: null | string;
    customerType?: null | string;
    customerUserId?: null | number;
    id: number;
    phone?: string;
    realName: string;
    roleIds?: number[];
    roles?: string[];
    status: number;
    tenantStatus?: number;
    tokenVersion?: number;
    updateTime?: null | string;
    username: string;
  }
}

export async function getSystemUserList(params: Record<string, any>) {
  return requestClient.get<{
    items: SystemUserApi.SystemUser[];
    total: number;
  }>('/user/list', { params });
}

export async function createSystemUser(data: Record<string, unknown>) {
  return requestClient.post('/user', data);
}

export async function updateSystemUser(
  id: number,
  data: Record<string, unknown>,
) {
  return requestClient.put(`/user/${id}`, data);
}

export async function deleteSystemUser(id: number) {
  return requestClient.delete(`/user/${id}`);
}
