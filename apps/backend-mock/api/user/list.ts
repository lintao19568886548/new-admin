import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { getLegacyUserPark, getUserDirectParks } from '~/utils/user-park-scope';

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
    status: { not: 2 },
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

  const [total, tenantUsers] = await prismaScopeStorage.run(
    { customerId },
    async () =>
      Promise.all([
        prismaClient.user.count({ where }),
        prismaClient.user.findMany({
          where,
          orderBy: { createTime: 'desc' },
          skip: (currentPage - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            username: true,
            realName: true,
            phone: true,
            parkId: true,
            status: true,
            tokenVersion: true,
            customerType: true,
            createTime: true,
            updateTime: true,
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
      ]),
  );

  if (tenantUsers.length === 0) {
    return useResponseSuccess({
      items: [],
      total,
    });
  }

  const tenantUserIds = tenantUsers.map((item) => item.id);
  const mappings = await systemDbClient.userCustomerMapping.findMany({
    where: {
      customerId,
      customerUserId: {
        in: tenantUserIds,
      },
    },
    select: {
      centerUserId: true,
      customerUserId: true,
    },
  });

  const centerUserIds = [...new Set(mappings.map((item) => item.centerUserId))];
  const centerUsers =
    centerUserIds.length > 0
      ? await systemDbClient.user.findMany({
          where: {
            id: {
              in: centerUserIds,
            },
          },
          select: {
            id: true,
            status: true,
            tokenVersion: true,
            createTime: true,
            updateTime: true,
          },
        })
      : [];

  const mappingByTenantUserId = new Map(
    mappings.map((item) => [item.customerUserId, item.centerUserId]),
  );
  const centerUserById = new Map(centerUsers.map((item) => [item.id, item]));

  const userParkEntries = await prismaScopeStorage.run(
    { customerId },
    async () =>
      Promise.all(
        tenantUsers.map(async (item) => {
          const directParks = await getUserDirectParks(
            Number(item.id),
            prismaClient,
          ).catch(() => []);
          const parks =
            directParks.length > 0
              ? directParks
              : await getLegacyUserPark(Number(item.id), prismaClient);
          return [Number(item.id), parks] as const;
        }),
      ),
  );
  const parksByUserId = new Map(userParkEntries);

  const items = tenantUsers.map((item) => {
    const roleIds = [...new Set(item.roles.map((row) => Number(row.roleId)))];
    const roles = [
      ...new Set(
        item.roles
          .map((row) => String(row.role?.name || '').trim())
          .filter((name) => name.length > 0),
      ),
    ];
    const centerUserId = mappingByTenantUserId.get(item.id);
    const centerUser = centerUserId ? centerUserById.get(centerUserId) : null;
    const parks = parksByUserId.get(Number(item.id)) || [];

    return {
      id: Number(item.id),
      tenantUserId: Number(item.id),
      centerUserId: centerUserId ? Number(centerUserId) : null,
      createTime: item.createTime ? item.createTime.toISOString() : null,
      customerType: item.customerType ? String(item.customerType) : null,
      customerUserId: Number(item.id),
      phone: item.phone ? String(item.phone) : '',
      parkIds: parks.map((park) => park.parkId),
      parks,
      realName: String(item.realName || ''),
      roleIds,
      roles,
      status: Number(item.status ?? 1),
      tokenVersion: Number(centerUser?.tokenVersion ?? item.tokenVersion ?? 1),
      updateTime: item.updateTime ? item.updateTime.toISOString() : null,
      username: String(item.username || ''),
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});
