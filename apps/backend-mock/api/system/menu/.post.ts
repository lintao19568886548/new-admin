import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const { meta, ...menuData } = body;
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
    return useResponseSuccess(res);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
