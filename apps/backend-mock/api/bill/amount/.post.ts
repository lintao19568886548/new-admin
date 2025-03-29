import { PrismaClient } from '@prisma/client';

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
    const user = await prisma.user.create({
      data: {
        id: 2,
        username: 'user',
        password: '123456',
        roles: 'admin',
        homePath: '/dashboard',
        realName: 'Default User', // 添加必需的 realName 字段
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
