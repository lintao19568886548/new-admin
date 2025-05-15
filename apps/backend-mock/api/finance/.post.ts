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

  try {
    // 创建财务记录
    const finance = await prismaClient.finance.create({
      data: {
        ...body,
      },
    });

    console.log('插入财务数据成功:', finance);
    return useResponseSuccess(finance);
  } catch (error) {
    console.error('插入财务数据失败:', error);
    return serverErrorResponse(`插入财务数据失败\n${error}`, event);
  }
});
