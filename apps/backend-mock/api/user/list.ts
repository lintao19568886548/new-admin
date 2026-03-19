import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

function toSafeInt(value: unknown, fallback: number, min = 1, max = 200) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  const rounded = Math.floor(num);
  if (rounded < min) {
    return min;
  }
  if (rounded > max) {
    return max;
  }
  return rounded;
}

function normalizeStatus(value: unknown): null | number {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const raw = String(value).trim().toLowerCase();
  if (raw === '1' || raw === 'true') {
    return 1;
  }
  if (raw === '0' || raw === 'false') {
    return 0;
  }
  return null;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const customerId = String(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  const query = getQuery(event);

  const currentPage = toSafeInt(
    query.currentPage ?? query.page ?? query.pageNo,
    1,
    1,
    9999,
  );
  const pageSize = toSafeInt(query.pageSize, 20, 1, 200);
  const username = String(query.username || '').trim();
  const realName = String(query.realName || '').trim();
  const phone = String(query.phone || '').trim();
  const status = normalizeStatus(query.status);

  const where: any = {
    customerType: customerId,
  };

  if (username) {
    where.username = { contains: username };
  }
  if (realName) {
    where.realName = { contains: realName };
  }
  if (phone) {
    where.phone = { contains: phone };
  }
  if (status !== null) {
    where.status = status;
  }

  const total = await systemDbClient.user.count({ where });
  const centerUsers = await systemDbClient.user.findMany({
    where,
    orderBy: { createTime: 'desc' },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      username: true,
      realName: true,
      phone: true,
      status: true,
      tokenVersion: true,
      customerType: true,
      createTime: true,
      updateTime: true,
    },
  });

  if (centerUsers.length === 0) {
    return useResponseSuccess({
      items: [],
      total,
    });
  }

  const usernames = centerUsers.map((item) => item.username);
  const centerUserIds = centerUsers.map((item) => item.id);

  const [customerUsers, mappings] = await Promise.all([
    prismaScopeStorage.run({ customerId }, async () =>
      prismaClient.user.findMany({
        where: {
          username: {
            in: usernames,
          },
        },
        select: {
          id: true,
          username: true,
          status: true,
          roles: {
            include: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ),
    systemDbClient.userCustomerMapping.findMany({
      where: {
        customerId,
        centerUserId: {
          in: centerUserIds,
        },
      },
      select: {
        centerUserId: true,
        customerUserId: true,
      },
    }),
  ]);

  const customerUserMap = new Map(
    customerUsers.map((item) => [item.username, item]),
  );
  const mappingByCenterUserId = new Map(
    mappings.map((item) => [item.centerUserId, item.customerUserId]),
  );

  const items = centerUsers.map((item) => {
    const customerUser = customerUserMap.get(item.username);
    const roleIds = customerUser
      ? [...new Set(customerUser.roles.map((row) => Number(row.roleId)))]
      : [];
    const roles = customerUser
      ? [
          ...new Set(
            customerUser.roles
              .map((row) => String(row.role?.name || '').trim())
              .filter((name) => name.length > 0),
          ),
        ]
      : [];

    return {
      id: Number(item.id),
      centerUserId: Number(item.id),
      createTime: item.createTime ? item.createTime.toISOString() : null,
      customerType: item.customerType ? String(item.customerType) : null,
      customerUserId: customerUser?.id
        ? Number(customerUser.id)
        : (mappingByCenterUserId.get(item.id) ?? null),
      phone: item.phone ? String(item.phone) : '',
      realName: String(item.realName || ''),
      roleIds,
      roles,
      status: Number(item.status ?? 1),
      tenantStatus: Number(customerUser?.status ?? 1),
      tokenVersion: Number(item.tokenVersion ?? 1),
      updateTime: item.updateTime ? item.updateTime.toISOString() : null,
      username: String(item.username || ''),
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});
