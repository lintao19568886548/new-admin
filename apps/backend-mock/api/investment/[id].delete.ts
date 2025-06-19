import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const investmentId = Number.parseInt(event.context.params.id);
  if (!investmentId) {
    return useResponseError('investmentId错误');
  }

  try {
    const result = await prismaClient.investment.delete({
      where: {
        investmentId,
      },
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除账单失败:', error);
    return serverErrorResponse(`删除账单失败`, event);
  }
});
