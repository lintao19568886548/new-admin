import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    // 检查用户权限
    const userWithRoles = await prismaClient.user.findUnique({
      where: { id: userinfo.id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const privilegeLevels =
      userWithRoles?.roles.map((r) => r.role.privilegeLevel || 0) || [];
    const maxPrivilegeLevel =
      privilegeLevels.length > 0 ? Math.max(...privilegeLevels) : 0;

    if (maxPrivilegeLevel <= 2) {
      return useResponseSuccess({
        count: 0,
      });
    }

    const where: any = {
      isDeleted: false,
      status: 0,
    };

    if (
      userinfo.username !== 'vben' &&
      userinfo.username !== '董事长' &&
      userinfo.username !== '总监'
    ) {
      const parkIds = userinfo.parks?.map((park) => park.parkId);
      if (parkIds?.length) {
        where.parkId = { in: parkIds };
      } else {
        where.username = userinfo.username;
      }
    }

    const count = await prismaClient.reimbursement.count({
      where,
    });

    return useResponseSuccess({
      count,
    });
  } catch (error) {
    console.error('查询待处理报销数量失败:', error);
    return useResponseError('查询待处理报销数量失败', 500);
  }
});
