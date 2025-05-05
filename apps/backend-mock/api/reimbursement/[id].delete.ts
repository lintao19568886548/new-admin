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

    // 删除报销记录
    const deletedReimbursement = await prismaClient.reimbursement.delete({
      where: { id },
    });

    console.log('删除报销记录成功:', deletedReimbursement);
    return useResponseSuccess(deletedReimbursement);
  } catch (error) {
    console.error('删除报销记录失败:', error);
    return useResponseError('删除报销记录失败', 500);
  }
});
