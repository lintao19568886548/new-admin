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

    const existed = await prismaClient.repairOrder.findUnique({
      where: {
        repairOrderId,
      },
    });
    if (!existed) {
      return useResponseError('报修工单不存在');
    }
    if (!getAuthorizedParkIds(userinfo).includes(existed.parkId)) {
      return useResponseError('没有操作权限');
    }

    const result = await prismaClient.repairOrder.delete({
      where: {
        repairOrderId,
      },
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除报修工单失败:', error);
    return serverErrorResponse('删除报修工单失败', event);
  }
});
