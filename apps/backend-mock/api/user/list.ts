import { Prisma } from '@prisma/.prisma/client/index.js';
import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { dedupeParks } from '~/utils/user-park-scope';

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

function addParkToMap(
  map: Map<number, Array<{ parkId: number; parkName: string }>>,
  userId: number,
  park: { parkId: number; parkName: string },
) {
  const list = map.get(userId) ?? [];
  list.push(park);
  map.set(userId, list);
}

function mapParkRowsByUserId(
  rows: Array<{
    parkId: bigint | number | string;
    parkName: null | string;
    userId: bigint | number | string;
  }>,
) {
  const result = new Map<number, Array<{ parkId: number; parkName: string }>>();
  rows.forEach((row) => {
    addParkToMap(result, Number(row.userId), {
      parkId: Number(row.parkId),
      parkName: String(row.parkName || ''),
    });
  });
  return result;
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
            park: {
              select: {
                parkId: true,
                parkName: true,
              },
            },
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
  const [mappings, directParkRows, roleParkRows] = await Promise.all([
    systemDbClient.userCustomerMapping.findMany({
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
    }),
    prismaScopeStorage.run({ customerId }, async () =>
      prismaClient.$queryRaw<
        Array<{
          parkId: bigint | number | string;
          parkName: null | string;
          userId: bigint | number | string;
        }>
      >(Prisma.sql`
        SELECT
          up.user_id AS userId,
          p.park_id AS parkId,
          p.park_name AS parkName
        FROM user_park up
        INNER JOIN park p ON p.park_id = up.park_id
        WHERE up.user_id IN (${Prisma.join(tenantUserIds)})
          AND up.is_deleted = false
          AND p.is_deleted = false
        ORDER BY up.user_id ASC, p.park_id ASC
      `),
    ),
    prismaScopeStorage.run({ customerId }, async () =>
      prismaClient.$queryRaw<
        Array<{
          parkId: bigint | number | string;
          parkName: null | string;
          userId: bigint | number | string;
        }>
      >(Prisma.sql`
        SELECT
          ur.user_id AS userId,
          p.park_id AS parkId,
          p.park_name AS parkName
        FROM user_role ur
        INNER JOIN role_park rp ON rp.role_id = ur.role_id
        INNER JOIN park p ON p.park_id = rp.park_id
        WHERE ur.user_id IN (${Prisma.join(tenantUserIds)})
          AND rp.is_deleted = false
          AND p.is_deleted = false
        ORDER BY ur.user_id ASC, p.park_id ASC
      `),
    ),
  ]);

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

  const directParksByUserId = mapParkRowsByUserId(directParkRows);
  const roleParksByUserId = mapParkRowsByUserId(roleParkRows);

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
    const directParks = directParksByUserId.get(Number(item.id)) || [];
    const roleParks = roleParksByUserId.get(Number(item.id)) || [];
    const legacyPark =
      item.parkId && item.park
        ? [
            {
              parkId: Number(item.park.parkId),
              parkName: String(item.park.parkName || ''),
            },
          ]
        : [];
    const parks = dedupeParks([...directParks, ...roleParks, ...legacyPark]);

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
