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

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = Number(event.context.params?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return badRequestResponse('账号ID不合法', event);
  }

  const currentOperatorCenterUserId = Number(userinfo.centerUserId || 0);
  if (currentOperatorCenterUserId > 0 && id === currentOperatorCenterUserId) {
    return badRequestResponse('不能删除当前登录账号', event);
  }

  const customerId = String(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );

  const centerUser = await systemDbClient.user.findFirst({
    where: {
      customerType: customerId,
      id,
    },
    select: {
      id: true,
      username: true,
    },
  });

  if (!centerUser) {
    setResponseStatus(event, 404);
    return useResponseError('账号不存在', '账号不存在', 404);
  }

  const markAsDisabled = async () => {
    await systemDbClient.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: 0,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.updateMany({
        where: { revokedAt: null, userId: id },
        data: { revokedAt: new Date() },
      });
    });

    await prismaScopeStorage.run({ customerId }, async () => {
      const customerUser = await prismaClient.user.findUnique({
        where: { username: centerUser.username },
        select: { id: true },
      });
      if (!customerUser) {
        return;
      }
      await prismaClient.user.update({
        where: { id: Number(customerUser.id) },
        data: { status: 0 },
      });
      await prismaClient.userRole.deleteMany({
        where: { userId: Number(customerUser.id) },
      });
    });
  };

  try {
    await prismaScopeStorage.run({ customerId }, async () => {
      const customerUser = await prismaClient.user.findUnique({
        where: { username: centerUser.username },
        select: { id: true },
      });

      if (customerUser) {
        await prismaClient.userRole.deleteMany({
          where: { userId: Number(customerUser.id) },
        });
        await prismaClient.userCode.deleteMany({
          where: { userId: Number(customerUser.id) },
        });
        await prismaClient.user.delete({
          where: { id: Number(customerUser.id) },
        });
      }
    });

    await systemDbClient.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({
        where: { userId: id },
      });
      await tx.userCustomerMapping.deleteMany({
        where: {
          centerUserId: id,
          customerId,
        },
      });
      await tx.user.delete({
        where: { id },
      });
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);

    return useResponseSuccess({
      id,
      mode: 'hard',
    });
  } catch (error) {
    console.warn('删除账号失败，降级为禁用账号:', error);
    try {
      await markAsDisabled();
      await bumpPermissionCacheVersion(customerId).catch(() => undefined);
      return useResponseSuccess(
        {
          id,
          mode: 'soft',
        },
        '账号存在关联数据，已自动改为禁用',
      );
    } catch (fallbackError) {
      console.error('删除账号失败(含禁用降级):', fallbackError);
      return serverErrorResponse('删除账号失败', event);
    }
  }
});
