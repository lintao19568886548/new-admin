import { useResponseError, useResponseSuccess } from '~/utils/response';

function hasOwn(object: object, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    return ['1', 'true'].includes(value.trim().toLowerCase());
  }
  return false;
}

function pickTemplateData(menuData: Record<string, unknown>) {
  const data: {
    templateInternalOnly?: boolean;
    templateManaged?: boolean;
  } = {};
  if (hasOwn(menuData, 'templateManaged')) {
    data.templateManaged = normalizeBoolean(menuData.templateManaged);
  }
  if (hasOwn(menuData, 'templateInternalOnly')) {
    data.templateInternalOnly = normalizeBoolean(menuData.templateInternalOnly);
  }
  return data;
}

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
  const templateData = pickTemplateData(menuData);
  delete meta.metaId;
  delete meta.menuId;
  try {
    const res = await prismaClient.$transaction(async (prisma) => {
      const menu = await prisma.menu.update({
        where: {
          menuId: Number(menuId),
        },
        data: {
          ...menuData,
          ...templateData,
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

      if (Object.keys(templateData).length > 0) {
        await prisma.code.updateMany({
          data: templateData,
          where: {
            menuId: Number(menuId),
          },
        });
      }

      return menu;
    });
    return useResponseSuccess(res);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
