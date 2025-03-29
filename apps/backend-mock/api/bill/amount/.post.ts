import { PrismaClient } from '@prisma/client';
import { useResponseError, useResponseSuccess } from '~/utils/response';

const prisma = new PrismaClient();

export default eventHandler(async (event) => {
  // const userinfo = await verifyAccessToken(event);
  // if (!userinfo) {
  //   console.log('userinfo', userinfo);
  //   return unAuthorizedResponse(event);
  // }
  const body = await readBody(event);
  console.log('请求体参数:', body);

  try {
    const user = await prisma.amountBill.create({
      data: {
        ...body,
      },
    });
    console.log(user);
    await prisma.$disconnect();
    console.log('插入数据成功:', user);
    return useResponseSuccess(user);
  } catch (error) {
    await prisma.$disconnect();
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
