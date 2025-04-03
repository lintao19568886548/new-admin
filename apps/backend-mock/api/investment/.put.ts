import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log('请求体参数:', body);

  try {
    // 使用事务处理创建操作
    const result = await prismaClient.investment.update({
      where: {
        investmentId: Number(body.investmentId),
      },
      data: {
        ...body,
      },
    });
    console.log('插入数据成功:', result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
