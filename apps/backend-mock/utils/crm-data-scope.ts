import type { UserInfoForToken } from '~/utils/user-service';

import { CrmScmError } from '~/utils/crm-scrm';
import { systemDbClient } from '~/utils/db';

export interface CrmDataScope {
  currentUserId: number;
  isSuper: boolean;
  salesUserId?: number;
}

export function resolveCrmDataScope(
  userinfo: null | undefined | UserInfoForToken,
): CrmDataScope {
  const roles = Array.isArray(userinfo?.roles) ? userinfo.roles : [];
  const isSuper = roles.includes('Super');
  const currentUserId = Number(userinfo?.centerUserId || userinfo?.id || 0);
  const normalizedCurrentUserId =
    Number.isInteger(currentUserId) && currentUserId > 0 ? currentUserId : 0;
  const scopedSalesUserId = isSuper
    ? undefined
    : normalizedCurrentUserId || 2_147_483_647;

  return {
    currentUserId: normalizedCurrentUserId,
    isSuper,
    salesUserId: scopedSalesUserId,
  };
}

export function applyCrmSalesDataScope<T extends Record<string, unknown>>(
  input: T,
  userinfo: null | undefined | UserInfoForToken,
): T {
  const scope = resolveCrmDataScope(userinfo);
  if (scope.isSuper) {
    return input;
  }
  return {
    ...input,
    salesUserId: scope.salesUserId,
  };
}

export function forceCrmSalesUserIdForWrite(
  inputSalesUserId: unknown,
  userinfo: null | undefined | UserInfoForToken,
) {
  const scope = resolveCrmDataScope(userinfo);
  if (!scope.isSuper) {
    return scope.salesUserId;
  }
  return inputSalesUserId || scope.currentUserId;
}

function normalizeScopedId(value: unknown, fieldName: string) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new CrmScmError(`${fieldName}必须是有效的正整数`);
  }
  return num;
}

export async function assertCrmSalesChannelDataAccess(
  channelId: unknown,
  userinfo: null | undefined | UserInfoForToken,
) {
  const scope = resolveCrmDataScope(userinfo);
  if (scope.isSuper) {
    return;
  }

  const id = normalizeScopedId(channelId, 'id');
  const channel = await systemDbClient.crmSalesChannel.findFirst({
    select: { id: true },
    where: {
      id,
      salesUserId: scope.salesUserId,
    },
  });
  if (!channel) {
    throw new CrmScmError('无权操作该获客渠道', 403);
  }
}

export async function assertCrmOwnerBindingDataAccess(
  bindingId: unknown,
  userinfo: null | undefined | UserInfoForToken,
) {
  const scope = resolveCrmDataScope(userinfo);
  if (scope.isSuper) {
    return;
  }

  const id = normalizeScopedId(bindingId, 'id');
  const binding = await systemDbClient.crmCustomerOwnerBinding.findFirst({
    select: { id: true },
    where: {
      id,
      ownerSalesUserId: scope.salesUserId,
    },
  });
  if (!binding) {
    throw new CrmScmError('无权操作该客户归属', 403);
  }
}
