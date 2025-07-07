import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const financeId = Number.parseInt(event.context.params?.id ?? '');
  if (!financeId) {
    return useResponseError('financeId错误');
  }

  try {
    const finance = await prismaClient.finance.update({
      where: {
        financeId,
      },
      data: {
        isDeleted: true,
      },
    });
    return useResponseSuccess(finance);
  } catch (error) {
    console.error('删除财务数据失败:', error);
    return serverErrorResponse('删除财务数据失败', event);
  }
});
