import { requestClient } from '#/api/request';

export interface TenantInvitation {
  code: string;
  createdByCenterUserId: number;
  createTime: null | string;
  customerId: string;
  expiresAt: null | string;
  id: number;
  maxUses: null | number;
  remark: null | string;
  roleIds: number[];
  status: string;
  updateTime: null | string;
  usedCount: number;
}

export interface CreateTenantInvitationPayload {
  expiresAt?: string;
  maxUses?: null | number;
  remark?: string;
  roleIds: number[];
}

export interface JoinTenantInvitationResponse {
  alreadyJoined: boolean;
  customerId: string;
  customerName: string;
  joined: boolean;
  requiresRelogin: boolean;
}

export async function createTenantInvitationApi(
  payload: CreateTenantInvitationPayload,
) {
  return requestClient.post<{
    invitation: TenantInvitation;
    tenant: { customerId: string; dbName: null | string; name: string };
  }>('/tenant/invitation/create', payload);
}

export async function listTenantInvitationsApi() {
  return requestClient.get<{ items: TenantInvitation[]; total: number }>(
    '/tenant/invitation/list',
  );
}

export async function revokeTenantInvitationApi(id: number) {
  return requestClient.post<{ revoked: boolean }>('/tenant/invitation/revoke', {
    id,
  });
}

export async function joinTenantByInvitationCodeApi(code: string) {
  return requestClient.post<JoinTenantInvitationResponse>(
    '/tenant/invitation/join',
    { code },
  );
}
