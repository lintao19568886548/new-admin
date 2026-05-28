import type { UserInfoForToken } from './user-service';

import { prismaClient } from '~/utils/db';
import { resolveSingleActiveOwnedSourceOrganizationForCenterUser } from '~/utils/organization';
import { forbiddenResponse } from '~/utils/response';

export type RoleScopeContext =
  | {
      kind: 'organization';
      organizationId: number;
    }
  | {
      kind: 'system';
    };

function isPublicCustomer(userinfo: UserInfoForToken) {
  return String(userinfo.customerId || '') === 'public';
}

function isPlatformSuper(userinfo: UserInfoForToken) {
  return isPublicCustomer(userinfo) && userinfo.roles.includes('Super');
}

export async function resolveRoleScopeContext(userinfo: UserInfoForToken) {
  if (!isPublicCustomer(userinfo) || isPlatformSuper(userinfo)) {
    return { kind: 'system' } satisfies RoleScopeContext;
  }

  const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
  const membership =
    await resolveSingleActiveOwnedSourceOrganizationForCenterUser({
      centerUserId,
      sourceCustomerId: 'public',
    });
  if (!membership) {
    return null;
  }

  return {
    kind: 'organization',
    organizationId: membership.organization.id,
  } satisfies RoleScopeContext;
}

export function getRoleScopeWhere(context: RoleScopeContext) {
  if (context.kind === 'organization') {
    return {
      organizationId: context.organizationId,
      scope: 'organization',
    };
  }

  return {};
}

export function applyRoleScopeCreateData<T extends Record<string, unknown>>(
  data: T,
  context: RoleScopeContext,
) {
  if (context.kind === 'organization') {
    return {
      ...data,
      organizationId: context.organizationId,
      scope: 'organization',
    };
  }

  return data;
}

export async function assertRoleInScope(params: {
  context: RoleScopeContext;
  roleId: number;
  roleModel?: {
    findFirst: (args: {
      select: { roleId: true };
      where: Record<string, unknown>;
    }) => Promise<null | { roleId: number }>;
  };
}) {
  const where = {
    roleId: params.roleId,
    ...getRoleScopeWhere(params.context),
  };
  const role = await (params.roleModel ?? prismaClient.role).findFirst({
    select: { roleId: true },
    where,
  });
  if (!role) {
    throw new Error('角色不存在或无权操作');
  }
}

export function noRoleScopeResponse(
  event: Parameters<typeof forbiddenResponse>[0],
) {
  return forbiddenResponse(
    event,
    '当前账号未绑定唯一 active 组织，无法操作组织角色',
  );
}
