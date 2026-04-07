import { prismaClient } from '~/utils/db';
import {
  CONTRACT_PARTY_ROLE,
  createRentalTenantInclude,
  mapRentalTenantOutput,
} from '~/utils/rental-contract';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (currentPage - 1) * pageSize;

    // 构建查询条件
    const where: any = {
      isDeleted: false,
    };
    const andConditions: any[] = [];

    // 区域查询
    if (query.currentPark) {
      if (Number(query.currentPark) === -1) {
        // 选择全部区域时,直接查询全部有权限的园区
        const parks = await prismaClient.park.findMany({
          where: {
            parkId: {
              in: userinfo.parks.map((park) => park.parkId),
            },
          },
          select: { parkId: true },
        });

        if (parks.length > 0) {
          where.parkId = {
            in: parks.map((park) => park.parkId),
          };
        }
      } else if (
        userinfo.parks
          .map((park) => park.parkId)
          .includes(Number(query.currentPark))
      ) {
        // 当用户有权限查看特定园区时
        const park = await prismaClient.park.findFirst({
          where: { parkId: Number(query.currentPark) },
          select: { parkId: true },
        });

        if (park) {
          where.parkId = park.parkId;
        }
      } else {
        return useResponseError('没有查看权限');
      }
    }

    // 区域查询
    // if (query.currentPark && Number(query.currentPark) !== -1) {
    //   where.parkId = Number(query.currentPark);
    // }

    if (query.tenantName) {
      const keyword = String(query.tenantName);
      andConditions.push({
        OR: [
          { tenantName: { contains: keyword } },
          {
            rentalTenantParties: {
              some: {
                role: CONTRACT_PARTY_ROLE.PARTY_B,
                partyNameSnapshot: { contains: keyword },
              },
            },
          },
        ],
      });
    }
    const partyBContactPhoneKeyword =
      query.partyBContactPhone ?? query.phoneNumber;
    if (partyBContactPhoneKeyword) {
      const keyword = String(partyBContactPhoneKeyword);
      andConditions.push({
        OR: [
          { phoneNumber: { contains: keyword } },
          {
            rentalTenantParties: {
              some: {
                role: CONTRACT_PARTY_ROLE.PARTY_B,
                contactPhoneSnapshot: { contains: keyword },
              },
            },
          },
        ],
      });
    }
    if (query.partyAName) {
      andConditions.push({
        rentalTenantParties: {
          some: {
            role: CONTRACT_PARTY_ROLE.PARTY_A,
            partyNameSnapshot: { contains: String(query.partyAName) },
          },
        },
      });
    }
    if (query.partyBName) {
      andConditions.push({
        rentalTenantParties: {
          some: {
            role: CONTRACT_PARTY_ROLE.PARTY_B,
            partyNameSnapshot: { contains: String(query.partyBName) },
          },
        },
      });
    }
    if (query.status) {
      const now = new Date();
      if (query.status === 'active') {
        // "生效中": contractEnd is in the future OR is null
        andConditions.push({
          OR: [{ contractEnd: { gte: now } }, { contractEnd: null }],
        });
      } else if (query.status === 'expired') {
        // "过期": contractEnd is in the past AND not null
        andConditions.push({
          contractEnd: {
            lt: now,
          },
        });
      }
    }
    if (query.contractDate) {
      const [start, end] = (query.contractDate as string).split(',');
      andConditions.push({
        contractStart: {
          gte: new Date(`${start} 00:00:00`),
        },
        contractEnd: {
          lte: new Date(`${end} 23:59:59`),
        },
      });
    }
    if (query.increaseDate) {
      const [start, end] = (query.increaseDate as string).split(',');
      andConditions.push({
        increaseDate: {
          gte: new Date(`${start} 00:00:00`),
          lte: new Date(`${end} 23:59:59`),
        },
      });
    }
    if (query.address) {
      andConditions.push({
        address: { contains: query.address },
      });
    }
    if (query.increaseRate) {
      andConditions.push({
        increaseRate: Number(query.increaseRate),
      });
    }
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
    // 获取总数
    const total = await prismaClient.rentalTenant.count({ where });

    // 获取分页数据
    const tenants = await prismaClient.rentalTenant.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
      include: createRentalTenantInclude(),
    });

    const items = tenants.map((tenant) => mapRentalTenantOutput(tenant));

    return useResponseSuccess({
      items,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取租户列表失败:', error);
    return serverErrorResponse(`获取租户列表失败`, event);
  }
});
