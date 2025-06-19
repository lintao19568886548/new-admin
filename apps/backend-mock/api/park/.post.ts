import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  try {
    // 使用事务处理创建操作
    const res = await prismaClient.park.create({
      data: {
        ...body,
      },
    });
    return useResponseSuccess(res);
  } catch (error) {
    console.error('插入数据失败:', error);
    return serverErrorResponse(`插入数据失败`, event);
  }
});
