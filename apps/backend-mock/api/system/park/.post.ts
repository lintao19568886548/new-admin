import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const { park, factories, dormitories } = body;
  try {
    // 使用事务处理创建操作
    const res = await prismaClient.$transaction(async (prisma) => {
      // 处理工厂数据，为每个工厂准备楼层数据
      const processedFactories = factories.map((factory) => {
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
          factories: {
            create: processedFactories,
          },
          dormitories: {
            create: dormitories,
          },
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
