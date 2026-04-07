import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  createRentalTenantInclude,
  mapRentalTenantOutput,
} from '~/utils/rental-contract';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  // 验证用户信息，确保用户已登录且具有有效ID
  if (!userinfo || !userinfo.id) {
    return unAuthorizedResponse(event);
  }

  try {
    // 确保 userinfo.roles 是一个数组，然后检查是否包含 'Super' 角色
    const roleNames = userinfo.roles || [];
    const hasSuperRole = roleNames.includes('Super');

    let parkIds: { parkId: number }[] = [];

    if (hasSuperRole) {
      // 如果是超级管理员，获取所有未删除的园区ID
      const allParks = await prismaClient.park.findMany({
        where: {
          isDeleted: false, // 只查询未被逻辑删除的园区
        },
        select: {
          parkId: true, // 只选择园区ID字段
        },
        orderBy: {
          parkId: 'asc', // 按园区ID升序排列
        },
      });
      parkIds = allParks;
    } else {
      // 对于普通用户，直接从数据库查询其当前有权限的园区ID
      // 确保 userinfo.id 存在且有效
      if (userinfo && userinfo.id) {
        const userWithRolesAndParks = await prismaClient.user.findUnique({
          where: { id: userinfo.id },
          include: {
            roles: {
              // UserRole entries linking user to roles
              include: {
                role: {
                  // Role entry
                  include: {
                    roleParks: {
                      // RolePark entries linking role to parks
                      where: {
                        isDeleted: false, // Only consider active role-park assignments
                        park: {
                          isDeleted: false, // Ensure the park itself is not deleted
                        },
                      },
                      select: {
                        parkId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (userWithRolesAndParks && userWithRolesAndParks.roles) {
          const authorizedParkIdsFromDB = userWithRolesAndParks.roles.flatMap(
            (userRole) =>
              userRole.role?.roleParks?.map((rp) => rp.parkId) || [],
          );

          // 过滤掉 undefined 或 null 的 parkId (如果 role 或 roleParks 可能为空)
          const validParkIds = authorizedParkIdsFromDB.filter(
            (id) => id !== null,
          ) as number[];

          const uniqueParkIdValues = [...new Set(validParkIds)];
          parkIds = uniqueParkIdValues
            .map((id) => ({ parkId: id }))
            .sort((a, b) => a.parkId - b.parkId);
        } else {
          // 用户不存在或没有关联角色
          parkIds = [];
        }
      } else {
        // userinfo.id 无效或不存在，理论上不应发生在此处，因为前面有校验
        parkIds = [];
      }
    }

    const parks = await prismaClient.park.findMany({
      where: {
        parkId: {
          in: parkIds.map((id) => id.parkId),
        },
      },
      orderBy: {
        createTime: 'desc',
      },
      include: {
        rentalTenants: {
          include: createRentalTenantInclude({ includeImages: false }),
        },
      },
    });

    // const result = parks
    //   .filter((park) => park.rentalTenants.length > 0)
    //   .map((park) => ({
    //     label: park.parkName,
    //     value: park.parkId,
    //     children: park.rentalTenants.map((tenant) => ({
    //       isLeaf: true,
    //       value: tenant.rentalTenantId,
    //       label: tenant.tenantName,
    //     })),
    //   }));

    const result = parks
      .filter((park) => park.rentalTenants.length > 0)
      .flatMap((park) =>
        park.rentalTenants.map((tenant) => {
          const mappedTenant = mapRentalTenantOutput(tenant);
          return {
            tenantId: tenant.rentalTenantId,
            partyBName: mappedTenant.partyBName,
            phoneNumber: mappedTenant.phoneNumber,
            tenantName: `${mappedTenant.tenantName}`,
          };
        }),
      );

    console.log(result);

    return useResponseSuccess(result);
  } catch (error) {
    console.error('获取园区ID列表失败:', error);
    return useResponseError('获取园区列表失败', 500);
  }
});
