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

  const centerUser = await systemDbClient.user.findFirst({
    where: {
      customerType: customerId,
      id,
    },
    select: {
      id: true,
      password: true,
      phone: true,
      realName: true,
      status: true,
      username: true,
    },
  });

  if (!centerUser) {
    setResponseStatus(event, 404);
    return useResponseError('账号不存在', '账号不存在', 404);
  }

  if (nextUsername && nextUsername !== centerUser.username) {
    return badRequestResponse('暂不支持修改账号名', event);
  }
  if (!nextRealName) {
    return badRequestResponse('姓名不能为空', event);
  }

  const currentOperatorCenterUserId = Number(userinfo.centerUserId || 0);
  if (
    currentOperatorCenterUserId > 0 &&
    id === currentOperatorCenterUserId &&
    nextStatus === 0
  ) {
    return badRequestResponse('不能禁用当前登录账号', event);
  }

  const centerCustomer = await systemDbClient.customer.findUnique({
    where: { customerId },
    select: { dbName: true },
  });

  const hashedPassword = nextPassword
    ? await bcrypt.hash(nextPassword, 10)
    : null;
  const statusToWrite =
    nextStatus === null ? Number(centerUser.status ?? 1) : nextStatus;
  const shouldBumpTokenVersion = Boolean(hashedPassword) || statusToWrite === 0;

  const centerUpdateData: any = {
    phone: nextPhone || null,
    realName: nextRealName,
    status: statusToWrite,
  };

  if (hashedPassword) {
    centerUpdateData.password = hashedPassword;
  }
  if (shouldBumpTokenVersion) {
    centerUpdateData.tokenVersion = { increment: 1 };
  }

  try {
    await systemDbClient.user.update({
      where: { id },
      data: centerUpdateData,
    });

    if (shouldBumpTokenVersion) {
      await systemDbClient.refreshToken.updateMany({
        where: { revokedAt: null, userId: id },
        data: { revokedAt: new Date() },
      });
    }

    const customerUser = await prismaScopeStorage.run(
      { customerId },
      async () => {
        const upserted = await prismaClient.user.upsert({
          where: { username: centerUser.username },
          create: {
            customerType: customerId,
            password: hashedPassword || centerUser.password,
            phone: nextPhone || null,
            realName: nextRealName,
            status: statusToWrite,
            tokenVersion: 1,
            username: centerUser.username,
          },
          update: {
            customerType: customerId,
            ...(hashedPassword ? { password: hashedPassword } : null),
            phone: nextPhone || null,
            realName: nextRealName,
            status: statusToWrite,
          },
          select: {
            id: true,
          },
        });

        if (nextRoleIds) {
          await prismaClient.userRole.deleteMany({
            where: { userId: Number(upserted.id) },
          });

          if (nextRoleIds.length > 0) {
            const existingRoles = await prismaClient.role.findMany({
              where: {
                roleId: {
                  in: nextRoleIds,
                },
              },
              select: {
                roleId: true,
              },
            });
            const existingRoleIds = existingRoles.map((item) => item.roleId);
            if (existingRoleIds.length > 0) {
              await prismaClient.userRole.createMany({
                data: existingRoleIds.map((roleId) => ({
                  roleId,
                  userId: Number(upserted.id),
                })),
              });
            }
          }
        }

        return upserted;
      },
    );

    await systemDbClient.userCustomerMapping.upsert({
      where: {
        centerUserId_customerId: {
          centerUserId: id,
          customerId,
        },
      },
      create: {
        centerUserId: id,
        customerId,
        customerUserId: Number(customerUser.id),
        dbName: centerCustomer?.dbName ? String(centerCustomer.dbName) : null,
      },
      update: {
        customerUserId: Number(customerUser.id),
        dbName: centerCustomer?.dbName ? String(centerCustomer.dbName) : null,
      },
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);

    return useResponseSuccess({
      id,
    });
  } catch (error) {
    console.error('更新账号失败:', error);
    return serverErrorResponse('更新账号失败', event);
  }
});
