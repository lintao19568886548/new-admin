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
    const finance = await prismaClient.finance.update({
      where: {
        financeId,
      },
      data: {
        ...body,
      },
    });
    return useResponseSuccess(finance);
  } catch (error) {
    console.error('更新财务数据失败:', error);
    return useResponseError('更新财务数据失败', 500);
  }
});
