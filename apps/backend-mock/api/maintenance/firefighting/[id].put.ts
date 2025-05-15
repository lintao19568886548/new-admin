import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log('请求体参数:', body);
  const id = Number.parseInt(event.context.params.id);

  try {
    // 使用事务处理创建操作
    const result = await prismaClient.firefighting.update({
      where: {
        firefightingId: id,
      },
      data: {
        ...body,
      },
    });
    console.log('插入数据成功:', result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('插入数据失败:', error);
    return serverErrorResponse(`插入数据失败\n${error}`, event);
  }
});
