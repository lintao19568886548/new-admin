import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const { meta, ...menuData } = body;
  console.log('body', meta);
  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      return await prisma.menu.create({
        data: {
          ...menuData,
          meta: {
            create: meta,
          },
        },
        include: {
          meta: true,
        },
      });
    });
    console.log('插入数据成功:', res);
    return useResponseSuccess(res);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
