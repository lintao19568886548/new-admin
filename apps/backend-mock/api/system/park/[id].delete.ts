import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('id不能为空');
  }

  try {
    // 使用事务处理删除操作
    const result = await prismaClient.$transaction(async (prisma) => {
      // 首先获取园区信息，确认园区存在
      const existingPark = await prisma.park.findUnique({
        where: { parkId: id },
        include: {
          factories: {
            include: {
              floors: true,
            },
          },
          dormitories: true,
        },
      });

      if (!existingPark) {
        throw new Error(`未找到ID为${id}的园区`);
      }

      // 删除工厂相关的楼层数据
      for (const factory of existingPark.factories) {
        if (factory.floors && factory.floors.length > 0) {
          await prisma.factoryFloor.deleteMany({
            where: {
              factoryId: factory.factoryId,
            },
          });
        }
      }

      // 删除工厂数据
      await prisma.factory.deleteMany({
        where: {
          parkId: id,
        },
      });

      // 删除宿舍数据
      await prisma.dormitory.deleteMany({
        where: {
          parkId: id,
        },
      });

      // 最后删除园区
      return await prisma.park.delete({
        where: {
          parkId: id,
        },
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除失败:', error);
    return useResponseError('删除失败', 500);
  }
});
