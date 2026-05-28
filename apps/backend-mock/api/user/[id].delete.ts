import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  assertCenterUserCanLeaveCustomerOrganizations,
  deactivateCenterUserCustomerOrganizationMemberships,
  OrganizationLifecycleError,
} from '~/utils/organization-role-policy';
import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = Number(event.context.params?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return badRequestResponse('账号ID不合法', event);
  }

  const currentTenantUserId = Number(userinfo.id || 0);
  if (currentTenantUserId > 0 && id === currentTenantUserId) {
    return badRequestResponse('不能删除当前登录账号', event);
  }

  const customerId = String(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );

  const tenantUser = await prismaScopeStorage.run({ customerId }, async () =>
    prismaClient.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
      },
    }),
  );
  if (!tenantUser) {
    setResponseStatus(event, 404);
    return useResponseError('账号不存在', '账号不存在', 404);
  }

  const mapping = await systemDbClient.userCustomerMapping.findFirst({
    where: {
      customerId,
      customerUserId: id,
    },
    select: {
      centerUserId: true,
    },
  });
  const centerUserByMapping = mapping
    ? await systemDbClient.user.findUnique({
        where: { id: Number(mapping.centerUserId) },
        select: { id: true, customerType: true, username: true },
      })
    : null;
  const centerUserByUsername = centerUserByMapping
    ? null
    : await systemDbClient.user.findUnique({
        where: { username: tenantUser.username },
        select: { id: true, customerType: true, username: true },
      });
  const centerUserRaw = centerUserByMapping || centerUserByUsername;
  const centerUserBelongsCurrentCustomer =
    !centerUserRaw?.customerType ||
    String(centerUserRaw.customerType) === customerId;
  const centerUser = centerUserBelongsCurrentCustomer ? centerUserRaw : null;

  try {
    if (centerUserRaw?.id) {
      await assertCenterUserCanLeaveCustomerOrganizations({
        centerUserId: Number(centerUserRaw.id),
        customerId,
      });
    }
  } catch (error) {
    if (error instanceof OrganizationLifecycleError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('校验组织 owner 删除保护失败:', error);
    return serverErrorResponse('删除账号失败', event);
  }

  await prismaScopeStorage.run({ customerId }, async () =>
    prismaClient.$transaction(async (prisma) => {
      await (prisma.employee as any).updateMany({
        where: { userId: id },
        data: { userId: null },
      });
      await prisma.user.update({
        where: { id },
        data: { status: 2 },
      });
      await prisma.userRole.deleteMany({
        where: { userId: id },
      });
      await prisma.userCode.deleteMany({
        where: { userId: id },
      });
    }),
  );

  if (mapping?.centerUserId) {
    const centerUserId = Number(mapping.centerUserId);
    await systemDbClient.userCustomerMapping.deleteMany({
      where: {
        centerUserId,
        customerId,
        customerUserId: id,
      },
    });

    if (centerUserBelongsCurrentCustomer) {
      const mappingCount = await systemDbClient.userCustomerMapping.count({
        where: {
          centerUserId,
        },
      });
      if (mappingCount === 0) {
        await systemDbClient.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: centerUserId },
            data: {
              status: 2,
              tokenVersion: { increment: 1 },
            },
          });
          await tx.refreshToken.deleteMany({
            where: {
              userId: centerUserId,
            },
          });
        });
      }
    }
  } else if (centerUser?.id) {
    const centerUserId = Number(centerUser.id);
    await systemDbClient.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: centerUserId },
        data: {
          status: 2,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.deleteMany({
        where: {
          userId: centerUserId,
        },
      });
    });
  }

  await bumpPermissionCacheVersion(customerId).catch(() => undefined);
  if (centerUser?.id) {
    await deactivateCenterUserCustomerOrganizationMemberships({
      centerUserId: Number(centerUser.id),
      customerId,
    });
  }

  return useResponseSuccess({
    id,
    mode: 'soft',
    tenantUserId: id,
  });
});
