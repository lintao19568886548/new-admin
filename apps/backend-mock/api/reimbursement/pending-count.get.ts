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
    console.error('用户未登录或token无效');
    return unAuthorizedResponse(event);
  }

  try {
    const hasAuditPermission = (userinfo.reimbursementAuth || 0) > 0;
    if (!hasAuditPermission) {
      return useResponseSuccess({
        count: 0,
      });
    }

    console.log('开始获取待处理报销数量，用户信息:', {
      username: userinfo.username,
      parks: userinfo.parks,
    });

    const parkIds = (userinfo.parks || [])
      .map((park) => Number(park.parkId))
      .filter((parkId) => !Number.isNaN(parkId));
    console.log('用户园区信息:', userinfo.parks);
    console.log('提取的园区ID:', parkIds);

    // 如果用户没有关联任何园区，直接返回 count: 0
    if (!parkIds?.length) {
      console.log('用户没有关联任何园区，返回 count: 0');
      return useResponseSuccess({
        count: 0,
      });
    }

    const where: any = {
      isDeleted: false,
      status: 0,
      parkId: { in: parkIds },
    };
    console.log('查询条件:', where);

    const count = await prismaClient.reimbursement.count({
      where,
    });
    console.log('查询结果 - 待处理报销数量:', count);

    return useResponseSuccess({
      count,
    });
  } catch (error) {
    console.error('查询待处理报销数量失败:', error);
    return useResponseError('查询待处理报销数量失败', 500);
  }
});
