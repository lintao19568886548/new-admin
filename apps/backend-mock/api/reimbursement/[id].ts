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
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  try {
    const id = Number(event.context.params?.id);
    if (Number.isNaN(id)) {
      return useResponseError('无效的报销ID', 400);
    }

    // 查询报销记录
    const reimbursement = await prismaClient.reimbursement.findUnique({
      where: { id },
    });

    if (!reimbursement) {
      return useResponseError('未找到报销记录', 404);
    }

    return useResponseSuccess(reimbursement);
  } catch (error) {
    console.error('查询报销详情失败:', error);
    return useResponseError('查询报销详情失败', 500);
  }
});
