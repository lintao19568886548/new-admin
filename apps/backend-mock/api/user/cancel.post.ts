import { clearRefreshTokenCookie } from '~/utils/cookie-utils';
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
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const tenantUserId = Number(userinfo.id || 0);
  if (!Number.isFinite(tenantUserId) || tenantUserId <= 0) {
    return badRequestResponse('当前账号信息无效', event);
  }

  const customerId = String(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const centerUserId = Number(userinfo.centerUserId || 0);

  try {
    const tenantUser = await prismaScopeStorage.run({ customerId }, async () =>
      prismaClient.user.findUnique({
        where: { id: tenantUserId },
        select: {
          id: true,
          username: true,
        },
      }),
    );
    if (!tenantUser) {
      return badRequestResponse('当前账号不存在', event, 404);
    }

    const mapping =
      centerUserId > 0
        ? await systemDbClient.userCustomerMapping.findFirst({
            where: {
              centerUserId,
              customerId,
              customerUserId: tenantUserId,
            },
            select: {
              centerUserId: true,
            },
          })
        : null;

    const centerUserByMapping = mapping
      ? await systemDbClient.user.findUnique({
          where: { id: Number(mapping.centerUserId) },
          select: { id: true, customerType: true, username: true },
        })
      : null;
    const centerUserById =
      centerUserByMapping || centerUserId <= 0
        ? null
        : await systemDbClient.user.findUnique({
            where: { id: centerUserId },
            select: { id: true, customerType: true, username: true },
          });
    const centerUserByUsername =
      centerUserByMapping || centerUserById
        ? null
        : await systemDbClient.user.findUnique({
            where: { username: tenantUser.username },
            select: { id: true, customerType: true, username: true },
          });

    const centerUserRaw =
      centerUserByMapping || centerUserById || centerUserByUsername;
    const centerUserBelongsCurrentCustomer =
      !centerUserRaw?.customerType ||
      String(centerUserRaw.customerType) === customerId;
    const centerUser = centerUserBelongsCurrentCustomer ? centerUserRaw : null;

    if (centerUserRaw?.id) {
      await assertCenterUserCanLeaveCustomerOrganizations({
        centerUserId: Number(centerUserRaw.id),
        customerId,
      });
    }

    await prismaScopeStorage.run({ customerId }, async () =>
      prismaClient.$transaction(async (prisma) => {
        await prisma.user.update({
          where: { id: tenantUserId },
          data: { status: 2 },
        });
        await prisma.userRole.deleteMany({
          where: { userId: tenantUserId },
        });
        await prisma.userCode.deleteMany({
          where: { userId: tenantUserId },
        });
      }),
    );

    if (mapping?.centerUserId) {
      const mappedCenterUserId = Number(mapping.centerUserId);
      await systemDbClient.userCustomerMapping.deleteMany({
        where: {
          centerUserId: mappedCenterUserId,
          customerId,
          customerUserId: tenantUserId,
        },
      });

      if (centerUserBelongsCurrentCustomer) {
        const mappingCount = await systemDbClient.userCustomerMapping.count({
          where: {
            centerUserId: mappedCenterUserId,
          },
        });
        if (mappingCount === 0) {
          await systemDbClient.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: mappedCenterUserId },
              data: {
                status: 2,
                tokenVersion: { increment: 1 },
              },
            });
            await tx.refreshToken.deleteMany({
              where: {
                userId: mappedCenterUserId,
              },
            });
          });
        }
      }
    } else if (centerUser?.id) {
      const resolvedCenterUserId = Number(centerUser.id);
      await systemDbClient.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: resolvedCenterUserId },
          data: {
            status: 2,
            tokenVersion: { increment: 1 },
          },
        });
        await tx.refreshToken.deleteMany({
          where: {
            userId: resolvedCenterUserId,
          },
        });
      });
    }

    clearRefreshTokenCookie(event);
    await bumpPermissionCacheVersion(customerId).catch(() => undefined);
    if (centerUser?.id) {
      await deactivateCenterUserCustomerOrganizationMemberships({
        centerUserId: Number(centerUser.id),
        customerId,
      });
    }

    return useResponseSuccess({
      centerUserId: centerUser?.id ? Number(centerUser.id) : null,
      mode: 'soft',
      tenantUserId,
    });
  } catch (error) {
    if (error instanceof OrganizationLifecycleError) {
      return badRequestResponse(error.message, event, error.statusCode);
    }
    console.error('注销当前账号失败:', error);
    return serverErrorResponse('注销当前账号失败', event);
  }
});
