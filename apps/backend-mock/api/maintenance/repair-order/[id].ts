import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

import { getAuthorizedParkIds } from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const repairOrderId = Number(event.context.params?.id);
    if (!repairOrderId) {
      return useResponseError('repairOrderId 错误');
    }

    const result = await prismaClient.repairOrder.findUnique({
      where: {
        repairOrderId,
      },
    });

    if (!result) {
      return useResponseError('报修工单不存在');
    }

    if (!getAuthorizedParkIds(userinfo).includes(result.parkId)) {
      return useResponseError('没有查看权限');
    }

    return useResponseSuccess(result);
  } catch (error) {
    console.error('获取报修工单详情失败:', error);
    return serverErrorResponse('获取报修工单详情失败', event);
  }
});
