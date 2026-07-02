import { verifyAccessToken } from '~/utils/jwt-utils';
import { ensureSingleOwnerSourceOrganizationForCenterUser } from '~/utils/organization';
import { OrganizationLifecycleError } from '~/utils/organization-role-policy';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { resolveVipMembershipSourceCustomerId } from '~/utils/vip-membership';

function normalizeOrganizationIdentityInput(body: Record<string, unknown>) {
  let nested: Record<string, unknown> = {};
  if (
    body.organizationIdentity &&
    typeof body.organizationIdentity === 'object' &&
    !Array.isArray(body.organizationIdentity)
  ) {
    nested = body.organizationIdentity as Record<string, unknown>;
  }

  return {
    city: nested.city ?? body.organizationCity ?? body.city,
    companyShortName:
      nested.companyShortName ??
      nested.companyName ??
      body.organizationCompanyShortName ??
      body.organizationCompanyName ??
      body.companyShortName ??
      body.companyName,
  };
}

function normalizeLifecycleErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : '创建组织空间失败，请稍后重试';
  if (message === '只有组织所有者可以开通组织空间') {
    return '当前账号已加入组织，不能再创建新组织';
  }
  return message;
}

function isOrganizationIdentityInputError(message: string) {
  return (
    message.startsWith('请填写') ||
    message.startsWith('所在城市不能超过') ||
    message.startsWith('简称不能超过') ||
    message.startsWith('城市或组织简称无法转换')
  );
}

function resolveClientErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }
  if (isOrganizationIdentityInputError(error.message)) {
    return 400;
  }
  if (!(error instanceof OrganizationLifecycleError)) {
    return null;
  }

  const statusCode = Number((error as { statusCode?: unknown })?.statusCode);
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500
    ? statusCode
    : 400;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const currentCustomerId = String(userinfo.customerId || '').trim();
  const sourceCustomerId =
    resolveVipMembershipSourceCustomerId(currentCustomerId);
  if (sourceCustomerId !== 'public') {
    return badRequestResponse(
      '只有公共/默认入口账号可以创建组织空间',
      event,
      409,
    );
  }

  const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
  if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = (await readBody(event)) as Record<string, unknown>;
    const membership = await ensureSingleOwnerSourceOrganizationForCenterUser({
      centerUserId,
      organizationIdentity: normalizeOrganizationIdentityInput(body || {}),
      sourceCustomerId,
    });

    return useResponseSuccess({
      sourceOrganization: {
        city: membership.organization.city || undefined,
        companyShortName: membership.organization.companyShortName || undefined,
        id: membership.organization.id,
        memberRole: membership.memberRole,
        name: membership.organization.name,
        sourceCustomerId: membership.organization.sourceCustomerId,
      },
      sourceOrganizationCount: 1,
    });
  } catch (error) {
    const message = normalizeLifecycleErrorMessage(error);
    const statusCode = resolveClientErrorStatus(error);
    if (statusCode) {
      return badRequestResponse(message, event, statusCode);
    }

    console.error('创建组织空间失败:', error);
    return serverErrorResponse('创建组织空间失败，请稍后重试', event);
  }
});
