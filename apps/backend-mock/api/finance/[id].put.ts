import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const financeId = Number.parseInt(event.context.params.id);
  if (!financeId) {
    return useResponseError('financeId错误');
  }

  try {
    const updatedFinance = await prismaClient.finance.update({
      where: { financeId },
      data: {
        ...body,
        transactionTime: body.transactionTime
          ? new Date(body.transactionTime)
          : undefined,
      },
    });
    return useResponseSuccess(updatedFinance);
  } catch (error) {
    console.error('更新财务数据失败:', error);
    return serverErrorResponse(`更新财务数据失败`, event);
  }
});
