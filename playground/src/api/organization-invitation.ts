import { requestClient } from '#/api/request';

export interface OrganizationInvitation {
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

export interface CreateOrganizationInvitationPayload {
  expiresAt?: string;
  maxUses?: null | number;
  remark?: string;
  roleIds: number[];
}

export interface JoinOrganizationInvitationResponse {
  alreadyJoined: boolean;
  customerId: string;
  customerName: string;
  joined: boolean;
  organizationSpaceId?: string;
  organizationSpaceName?: string;
  requiresRelogin: boolean;
}

export async function createOrganizationInvitationApi(
  payload: CreateOrganizationInvitationPayload,
) {
  return requestClient.post<{
    invitation: OrganizationInvitation;
    organizationSpace: {
      customerId: string;
      dbName: null | string;
      name: string;
    };
  }>('/organization/invitation/create', payload);
}

export async function listOrganizationInvitationsApi() {
  return requestClient.get<{ items: OrganizationInvitation[]; total: number }>(
    '/organization/invitation/list',
  );
}

export async function revokeOrganizationInvitationApi(id: number) {
  return requestClient.post<{ revoked: boolean }>(
    '/organization/invitation/revoke',
    {
      id,
    },
  );
}

export async function joinOrganizationByInvitationCodeApi(code: string) {
  return requestClient.post<JoinOrganizationInvitationResponse>(
    '/organization/invitation/join',
    { code },
  );
}
