import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  const hygieneCheckId = Number.parseInt(event.context.params.id); // 修改点
  if (!hygieneCheckId) {
    // 修改点
    return useResponseError('hygieneCheckId错误'); // 修改点
  }

  try {
    const result = await prismaClient.hygieneCheck.delete({
      // 修改点
      where: {
        hygieneCheckId, // 修改点
      },
    });

    console.log('删除账单成功:', result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除账单失败:', error);
    return serverErrorResponse(`删除账单失败\n${error}`, event);
  }
});
