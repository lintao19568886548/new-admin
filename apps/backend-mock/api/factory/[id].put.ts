import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const id = Number(event.context.params?.id);

  if (Number.isNaN(id)) {
    return useResponseError('无效的厂房ID', 400);
  }

  // 从 body 中分离出 floors 数据和 factory 的基本数据
  const { floors, ...factoryData } = body;
  try {
    // 使用事务处理更新操作
    const factory = await prismaClient.$transaction(async (prisma) => {
      // 1. 更新厂房基本信息 (不包括关联数据)
      await prisma.factory.update({
        where: { factoryId: id },
        data: {
          ...factoryData,
        },
      });

      // 2. 查找当前厂房的所有楼层 ID
      const existingFloors = await prisma.factoryFloor.findMany({
        where: { factoryId: id },
        select: { floorId: true },
      });
      const existingFloorIds = existingFloors.map((f) => f.floorId);

      // 3. 如果存在旧楼层，先删除关联的图片，再删除楼层
      if (existingFloorIds.length > 0) {
        // 先删除所有关联的 FactoryFloorImage 记录
        await prisma.factoryFloorImage.deleteMany({
          where: { floorId: { in: existingFloorIds } },
        });

        // 然后删除所有 FactoryFloor 记录
        await prisma.factoryFloor.deleteMany({
          where: { factoryId: id },
        });
      }

      // 4. 创建新的楼层及其关联图片
      for (const floor of floors) {
        const { images, ...floorData } = floor;
        // 移除 floorId，因为是新建
        delete floorData.floorId;

        const newFloor = await prisma.factoryFloor.create({
          data: {
            ...floorData,
            factoryId: id,
          },
        });

        // 如果有图片数据，创建图片关联
        if (images && Array.isArray(images) && images.length > 0) {
          // 使用 Promise.all 并行创建所有图片关联
          await Promise.all(
            images.map((image) =>
              prisma.factoryFloorImage
                .create({
                  data: {
                    imgId: image.imgId,
                    floorId: newFloor.floorId,
                  },
                })
                .catch((error) => {
                  // 处理可能的唯一约束冲突
                  if (error.code === 'P2002') {
                    console.warn(
                      `楼层图片关联已存在 (FloorId: ${newFloor.floorId}, ImgId: ${image.imgId})`,
                    );
                  } else {
                    console.error(`创建楼层图片关联失败:`, error);
                    throw error; // 重新抛出其他错误
                  }
                }),
            ),
          );
        }
      }

      // 5. 查询并返回更新后的完整厂房数据
      return await prisma.factory.findUnique({
        where: { factoryId: id },
        include: {
          floors: {
            include: {
              images: {
                include: {
                  image: true,
                },
              },
            },
          },
        },
      });
    });

    const result = {
      ...factory,
      floors: factory.floors.map((floor) => ({
        ...floor,
        images: floor.images.map((imgRelation) => ({
          imgId: imgRelation.imgId,
          name: imgRelation.image?.imgUrl.split('/').at(-1) || '',
          url: imgRelation.image?.imgUrl || '',
        })),
      })),
    };

    return useResponseSuccess(result);
  } catch (error) {
    console.error('更新厂房信息时发生错误:', error);
    return serverErrorResponse(
      `更新厂房失败: ${error.message || '未知错误'}`,
      event,
    );
  }
});
