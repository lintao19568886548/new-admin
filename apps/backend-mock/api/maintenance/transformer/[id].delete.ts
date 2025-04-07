import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
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

    console.log('删除账单成功:', result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除账单失败:', error);
    return useResponseError('删除账单失败', 500);
  }
});
