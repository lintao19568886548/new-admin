import bcrypt from 'bcryptjs';
import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { bumpPermissionCacheVersion } from '~/utils/permission-cache';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

function normalizeRoleIds(input: unknown) {
  if (!Array.isArray(input)) {
    return null;
  }
  return [
    ...new Set(input.map(Number).filter((id) => Number.isFinite(id) && id > 0)),
  ];
}

function normalizeStatus(input: unknown) {
  if (input === undefined || input === null || input === '') {
    return null;
  }
  return Number(input) === 0 ? 0 : 1;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = Number(event.context.params?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return badRequestResponse('账号ID不合法', event);
  }

  const customerId = String(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const body = (await readBody(event)) as Record<string, unknown>;

  const nextUsername = String(body.username || '').trim();
  const nextRealName = String(body.realName || '').trim();
  const nextPhone = String(body.phone || '').trim();
  const nextPassword = String(body.password || '').trim();
  const nextStatus = normalizeStatus(body.status);
  const nextRoleIds = normalizeRoleIds(body.roleIds);

  const tenantUser = await prismaScopeStorage.run({ customerId }, async () =>
    prismaClient.user.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
        phone: true,
        realName: true,
        status: true,
        username: true,
      },
    }),
  );

  if (!tenantUser) {
    setResponseStatus(event, 404);
    return useResponseError('账号不存在', '账号不存在', 404);
  }
  if (nextUsername && nextUsername !== tenantUser.username) {
    return badRequestResponse('暂不支持修改账号名', event);
  }
  if (!nextRealName) {
    return badRequestResponse('姓名不能为空', event);
  }

  const currentTenantUserId = Number(userinfo.id || 0);
  if (
    currentTenantUserId > 0 &&
    currentTenantUserId === id &&
    nextStatus === 0
  ) {
    return badRequestResponse('不能禁用当前登录账号', event);
  }

  const centerCustomer = await systemDbClient.customer.findUnique({
    where: { customerId },
    select: { dbName: true },
  });

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
        select: { id: true, customerType: true },
      })
    : null;
  const centerUserByUsername = centerUserByMapping
    ? null
    : await systemDbClient.user.findUnique({
        where: { username: tenantUser.username },
        select: { id: true, customerType: true },
      });
  const centerUser = centerUserByMapping || centerUserByUsername;

  if (centerUser?.customerType) {
    const centerCustomerType = String(centerUser.customerType);
    if (centerCustomerType !== customerId) {
      setResponseStatus(event, 409);
      return useResponseError(
        `中心库账号归属租户为 ${centerCustomerType}，无法修改`,
        `中心库账号归属租户为 ${centerCustomerType}，无法修改`,
        409,
      );
    }
  }

  const hashedPassword = nextPassword
    ? await bcrypt.hash(nextPassword, 10)
    : null;
  const statusToWrite =
    nextStatus === null ? Number(tenantUser.status ?? 1) : nextStatus;

  try {
    await prismaScopeStorage.run({ customerId }, async () =>
      prismaClient.$transaction(async (prisma) => {
        await prisma.user.update({
          where: { id },
          data: {
            ...(hashedPassword ? { password: hashedPassword } : null),
            phone: nextPhone || null,
            realName: nextRealName,
            status: statusToWrite,
          },
        });

        if (nextRoleIds) {
          await prisma.userRole.deleteMany({
            where: { userId: id },
          });

          if (nextRoleIds.length > 0) {
            const existingRoles = await prisma.role.findMany({
              where: {
                roleId: {
                  in: nextRoleIds,
                },
              },
              select: { roleId: true },
            });
            const existingRoleIds = existingRoles.map((item) => item.roleId);
            if (existingRoleIds.length > 0) {
              await prisma.userRole.createMany({
                data: existingRoleIds.map((roleId) => ({
                  roleId,
                  userId: id,
                })),
              });
            }
          }
        }
      }),
    );

    let centerUserId = centerUser?.id ? Number(centerUser.id) : null;
    const shouldBumpTokenVersion =
      Boolean(hashedPassword) || statusToWrite === 0;

    if (centerUserId) {
      await systemDbClient.user.update({
        where: { id: centerUserId },
        data: {
          customerType: customerId,
          ...(hashedPassword ? { password: hashedPassword } : null),
          phone: nextPhone || null,
          realName: nextRealName,
          status: statusToWrite,
          ...(shouldBumpTokenVersion
            ? { tokenVersion: { increment: 1 } }
            : null),
        },
      });
    } else {
      const createdCenterUser = await systemDbClient.user.create({
        data: {
          customerType: customerId,
          password: hashedPassword || tenantUser.password,
          phone: nextPhone || null,
          realName: nextRealName,
          status: statusToWrite,
          tokenVersion: 1,
          username: tenantUser.username,
        },
        select: { id: true },
      });
      centerUserId = Number(createdCenterUser.id);
    }

    if (shouldBumpTokenVersion && centerUserId) {
      await systemDbClient.refreshToken.updateMany({
        where: {
          revokedAt: null,
          userId: centerUserId,
        },
        data: { revokedAt: new Date() },
      });
    }

    if (centerUserId) {
      await systemDbClient.userCustomerMapping.upsert({
        where: {
          centerUserId_customerId: {
            centerUserId,
            customerId,
          },
        },
        create: {
          centerUserId,
          customerId,
          customerUserId: id,
          dbName: centerCustomer?.dbName ? String(centerCustomer.dbName) : null,
        },
        update: {
          customerUserId: id,
          dbName: centerCustomer?.dbName ? String(centerCustomer.dbName) : null,
        },
      });
    }

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);

    return useResponseSuccess({
      centerUserId,
      id,
      tenantUserId: id,
    });
  } catch (error) {
    console.error('更新账号失败:', error);
    return serverErrorResponse('更新账号失败', event);
  }
});
