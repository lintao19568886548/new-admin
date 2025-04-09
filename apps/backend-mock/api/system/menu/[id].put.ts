import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const menuId = event.context.params?.id;
  if (!menuId) {
    return useResponseError('id is required', 400);
  }
  const body = await readBody(event);
  const { meta, ...menuData } = body;
  delete meta.metaId;
  delete meta.menuId;
  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      return await prisma.menu.update({
        where: {
          menuId: Number(menuId),
        },
        data: {
          ...menuData,
          meta: {
            update: {
              ...meta,
            },
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
