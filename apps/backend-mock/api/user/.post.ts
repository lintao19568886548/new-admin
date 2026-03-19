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
    return [];
  }
  return [
    ...new Set(input.map(Number).filter((id) => Number.isFinite(id) && id > 0)),
  ];
}

function normalizeStatus(input: unknown, fallback = 1) {
  if (input === undefined || input === null || input === '') {
    return fallback;
  }
  return Number(input) === 0 ? 0 : 1;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const customerId = String(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const body = (await readBody(event)) as Record<string, unknown>;

  const username = String(body.username || '').trim();
  const realName = String(body.realName || '').trim();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '').trim();
  const status = normalizeStatus(body.status, 1);
  const roleIds = normalizeRoleIds(body.roleIds);

  if (!username) {
    return badRequestResponse('账号不能为空', event);
  }
  if (!realName) {
    return badRequestResponse('姓名不能为空', event);
  }
  if (!password) {
    return badRequestResponse('密码不能为空', event);
  }

  const existedCenterUser = await systemDbClient.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existedCenterUser) {
    setResponseStatus(event, 409);
    return useResponseError('账号已存在', '账号已存在', 409);
  }

  const centerCustomer = await systemDbClient.customer.findUnique({
    where: { customerId },
    select: { dbName: true, status: true },
  });
  if (!centerCustomer || centerCustomer.status === 0) {
    return badRequestResponse('当前租户不可用，无法创建账号', event);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  let createdCenterUserId: null | number = null;

  try {
    const createdCenterUser = await systemDbClient.user.create({
      data: {
        customerType: customerId,
        password: hashedPassword,
        phone: phone || null,
        realName,
        status,
        tokenVersion: 1,
        username,
      },
      select: {
        id: true,
      },
    });
    createdCenterUserId = Number(createdCenterUser.id);

    const customerUser = await prismaScopeStorage.run(
      { customerId },
      async () => {
        const upserted = await prismaClient.user.upsert({
          where: { username },
          create: {
            customerType: customerId,
            password: hashedPassword,
            phone: phone || null,
            realName,
            status,
            tokenVersion: 1,
            username,
          },
          update: {
            customerType: customerId,
            password: hashedPassword,
            phone: phone || null,
            realName,
            status,
          },
          select: { id: true },
        });

        await prismaClient.userRole.deleteMany({
          where: { userId: Number(upserted.id) },
        });

        if (roleIds.length > 0) {
          const existingRoles = await prismaClient.role.findMany({
            where: {
              roleId: {
                in: roleIds,
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

        return upserted;
      },
    );

    await systemDbClient.userCustomerMapping.upsert({
      where: {
        centerUserId_customerId: {
          centerUserId: Number(createdCenterUser.id),
          customerId,
        },
      },
      create: {
        centerUserId: Number(createdCenterUser.id),
        customerId,
        customerUserId: Number(customerUser.id),
        dbName: centerCustomer.dbName ? String(centerCustomer.dbName) : null,
      },
      update: {
        customerUserId: Number(customerUser.id),
        dbName: centerCustomer.dbName ? String(centerCustomer.dbName) : null,
      },
    });

    await bumpPermissionCacheVersion(customerId).catch(() => undefined);

    return useResponseSuccess({
      id: Number(createdCenterUser.id),
    });
  } catch (error) {
    if (createdCenterUserId) {
      await systemDbClient.userCustomerMapping
        .deleteMany({
          where: { centerUserId: createdCenterUserId, customerId },
        })
        .catch(() => undefined);
      await systemDbClient.user
        .delete({
          where: { id: createdCenterUserId },
        })
        .catch(() => undefined);
    }
    console.error('创建账号失败:', error);
    return serverErrorResponse('创建账号失败', event);
  }
});
