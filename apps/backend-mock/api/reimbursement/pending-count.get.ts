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
    const parkIds = userinfo.parks?.map((park) => park.parkId);
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
    console.log('查询结果:', count);

    return useResponseSuccess({
      count,
    });
  } catch (error) {
    console.error('查询待处理报销数量失败:', error);
    return useResponseError('查询待处理报销数量失败', 500);
  }
});
