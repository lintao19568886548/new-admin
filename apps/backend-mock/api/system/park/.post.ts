import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

function sanitizeParkPayload(input: Record<string, any>) {
  const area = Number(input.area);
  return {
    address: String(input.address || '').trim(),
    area: Number.isFinite(area) ? area : 0,
    description: input.description ? String(input.description) : null,
    parkName: String(input.parkName || '').trim(),
    status: input.status ? String(input.status) : null,
  };
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const rawPark =
    body?.park && typeof body.park === 'object' ? body.park : body;
  const park = sanitizeParkPayload(rawPark || {});
  const factories = Array.isArray(body?.factories) ? body.factories : [];
  const dormitories = Array.isArray(body?.dormitories) ? body.dormitories : [];

  if (!park.parkName || !park.address || !park.area) {
    return useResponseError('parkName, address and area are required');
  }
  try {
    // 使用事务处理创建操作
    const res = await prismaClient.$transaction(async (prisma) => {
      // 处理工厂数据，为每个工厂准备楼层数据
      const processedFactories = factories.map((factory: any) => {
        const { floors, ...factoryData } = factory;

        // 如果有楼层数据，则设置嵌套创建
        if (floors && Array.isArray(floors) && floors.length > 0) {
          return {
            ...factoryData,
            floors: {
              create: floors,
            },
          };
        }

        // 如果没有楼层数据，则只返回工厂数据
        return factoryData;
      });

      return await prisma.park.create({
        data: {
          ...park,
          factories:
            processedFactories.length > 0
              ? {
                  create: processedFactories,
                }
              : undefined,
          dormitories:
            dormitories.length > 0
              ? {
                  create: dormitories,
                }
              : undefined,
        },
        include: {
          factories: {
            include: {
              floors: true,
            },
          },
          dormitories: true,
        },
      });
    });
    return useResponseSuccess(res);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
