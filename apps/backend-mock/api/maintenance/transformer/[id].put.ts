import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const transformerId = Number.parseInt(event.context.params.id);
  if (!transformerId) {
    return useResponseError('transformerId错误');
  }

  try {
    const transformer = await prismaClient.transformer.update({
      where: {
        transformerId,
      },
      data: {
        ...body,
      },
    });
    return useResponseSuccess(transformer);
  } catch (error) {
    console.error('更新变压器数据失败:', error);
    return useResponseError('更新变压器数据失败', 500);
  }
});
