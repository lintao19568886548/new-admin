import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('id不能为空');
  }
  const body = await readBody(event);
  try {
    // 使用事务处理创建操作
    const result = await prismaClient.park.update({
      where: {
        parkId: Number(id),
      },
      data: {
        ...body,
      },
    });
    return useResponseSuccess(result);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
