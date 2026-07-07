import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { getVipMembershipAccessState } from '~/utils/vip-membership';

type OnboardingStepKey = 'accounts' | 'factoryInfo' | 'permissions';

interface OnboardingStep {
  completed: boolean;
  description: string;
  key: OnboardingStepKey;
  path: string;
  title: string;
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function isSetupManager(userinfo: { codes?: string[]; roles?: string[] }) {
  const roles = Array.isArray(userinfo.roles) ? userinfo.roles : [];
  const codes = Array.isArray(userinfo.codes) ? userinfo.codes : [];
  return (
    roles.some((role) => /admin|super|管理员|园区/i.test(role)) ||
    codes.some((code) =>
      ['system:park', 'system:role', 'system:user'].some((prefix) =>
        code.startsWith(prefix),
      ),
    )
  );
}

function buildSteps(completed: Record<OnboardingStepKey, boolean>) {
  return [
    {
      completed: completed.factoryInfo,
      description: '建立园区基础资料，并至少录入一个厂房。',
      key: 'factoryInfo',
      path: '/system/park?onboarding=1',
      title: '完善厂房信息',
    },
    {
      completed: completed.accounts,
      description: '为团队成员建立账号，便于后续按岗位授权。',
      key: 'accounts',
      path: '/system/user?tab=accounts&onboarding=1',
      title: '建立账号',
    },
    {
      completed: completed.permissions,
      description: '给账号绑定角色权限，限定可访问的菜单和园区范围。',
      key: 'permissions',
      path: '/system/role?onboarding=1',
      title: '权限分配',
    },
  ] satisfies OnboardingStep[];
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const customerId = normalizeText(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const defaultCustomerId = normalizeText(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const isTenantCustomer =
    customerId && customerId !== defaultCustomerId && customerId !== 'public';
  const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
  const setupManager = isSetupManager(userinfo);

  const [
    membershipState,
    parkCount,
    factoryCount,
    additionalUserCount,
    assignedPermissionUserCount,
  ] = await Promise.all([
    isTenantCustomer
      ? getVipMembershipAccessState({
          centerUserId,
          customerId,
        }).catch(() => null)
      : Promise.resolve(null),
    prismaClient.park.count({
      where: { isDeleted: false },
    }),
    prismaClient.factory.count({
      where: { isDeleted: false, isOwn: true },
    }),
    prismaClient.user.count({
      where: {
        id: { not: Number(userinfo.id) },
        status: 1,
      },
    }),
    prismaClient.userRole.count({
      where: {
        user: {
          status: 1,
        },
        userId: { not: Number(userinfo.id) },
        role: {
          status: true,
          OR: [
            {
              roleMenus: {
                some: { isDeleted: false },
              },
            },
            {
              roleCodes: {
                some: {},
              },
            },
          ],
        },
      },
    }),
  ]);

  const completed = {
    accounts: additionalUserCount > 0,
    factoryInfo: parkCount > 0 && factoryCount > 0,
    permissions: assignedPermissionUserCount > 0,
  } satisfies Record<OnboardingStepKey, boolean>;
  const steps = buildSteps(completed);
  const nextStep = steps.find((step) => !step.completed) || null;
  const status = nextStep ? 'in_progress' : 'completed';
  const setupIncomplete = status !== 'completed';
  const paidCustomer =
    membershipState?.membershipStatus === 'active' ||
    membershipState?.vipStatus === 'active' ||
    membershipState?.accessScopeStatus === 'member_active';
  const shouldGuide = isTenantCustomer && setupManager && setupIncomplete;

  const reason = paidCustomer ? 'paid_customer' : null;
  const setupReason = reason || (setupIncomplete ? 'first_setup' : null);

  return useResponseSuccess({
    customerId,
    forceRequired: shouldGuide,
    isPaidCustomer: Boolean(paidCustomer),
    isSetupManager: setupManager,
    nextStep,
    progress: {
      completed: steps.filter((step) => step.completed).length,
      total: steps.length,
    },
    reason: setupReason,
    shouldGuide,
    statistics: {
      additionalUserCount,
      assignedPermissionUserCount,
      factoryCount,
      parkCount,
    },
    status,
    steps,
  });
});
