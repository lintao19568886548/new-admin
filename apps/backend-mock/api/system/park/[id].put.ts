import { prismaClient } from '~/utils/db';
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

  const body = await readBody(event);
  const { park, factories, dormitories } = body;

  try {
    // 使用事务处理更新操作
    const result = await prismaClient.$transaction(async (prisma) => {
      // 首先获取现有的 factories 和 dormitories
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

      // 处理 factories 数据 - 精细化更新
      if (factories) {
        // 获取现有工厂的ID列表
        const existingFactoryIds = existingPark.factories.map(
          (f) => f.factoryId,
        );
        // 获取请求中工厂的ID列表（过滤掉没有ID的新工厂）
        const incomingFactoryIds = new Set(
          factories.filter((f) => f.factoryId).map((f) => f.factoryId),
        );

        // 找出需要删除的工厂ID（存在于现有列表但不在请求列表中）
        const factoryIdsToDelete = existingFactoryIds.filter(
          (id) => !incomingFactoryIds.has(id),
        );

        // 删除不再需要的工厂
        factoryIdsToDelete.length > 0
          ? await prisma.factory.deleteMany({
              where: {
                factoryId: {
                  in: factoryIdsToDelete,
                },
              },
            })
          : null;

        // 处理更新和创建
        for (const factory of factories) {
          if (factory.factoryId) {
            // 更新现有工厂
            const existingFactory = existingPark.factories.find(
              (f) => f.factoryId === factory.factoryId,
            );

            // 提取楼层数据
            const { floors, ...factoryData } = factory;

            // 更新工厂基本信息
            await prisma.factory.update({
              where: { factoryId: factory.factoryId },
              data: {
                ...factoryData,
                parkId: id,
              },
            });

            // 处理楼层数据
            if (floors && Array.isArray(floors)) {
              // 获取现有楼层ID列表
              const existingFloorIds = existingFactory.floors.map(
                (floor) => floor.floorId,
              );

              // 获取请求中楼层的ID列表（过滤掉没有ID的新楼层）
              const incomingFloorIds = new Set(
                floors
                  .filter((floor) => floor.floorId)
                  .map((floor) => floor.floorId),
              );

              // 找出需要删除的楼层ID
              const floorIdsToDelete = existingFloorIds.filter(
                (id) => !incomingFloorIds.has(id),
              );

              // 删除不再需要的楼层
              floorIdsToDelete.length > 0
                ? await prisma.factoryFloor.deleteMany({
                    where: {
                      floorId: {
                        in: floorIdsToDelete,
                      },
                    },
                  })
                : null;

              // 处理更新和创建楼层
              for (const floor of floors) {
                floor.floorId
                  ? await prisma.factoryFloor.update({
                      where: { floorId: floor.floorId },
                      data: {
                        ...floor,
                        factoryId: factory.factoryId,
                      },
                    })
                  : await prisma.factoryFloor.create({
                      data: {
                        ...floor,
                        factoryId: factory.factoryId,
                      },
                    });
              }
            }
          } else {
            // 创建新工厂
            const { floors, ...factoryData } = factory;

            // 使用三元表达式创建工厂（有楼层或无楼层）
            await prisma.factory.create({
              data: {
                ...factoryData,
                parkId: id,
                ...(floors && Array.isArray(floors) && floors.length > 0
                  ? { floors: { create: floors } }
                  : {}),
              },
            });
          }
        }
      }

      // 处理 dormitories 数据 - 精细化更新
      if (dormitories) {
        // 获取现有宿舍的ID列表
        const existingDormitoryIds = existingPark.dormitories.map(
          (d) => d.dormitoryId,
        );
        // 获取请求中宿舍的ID列表（过滤掉没有ID的新宿舍）
        const incomingDormitoryIds = new Set(
          dormitories.filter((d) => d.dormitoryId).map((d) => d.dormitoryId),
        );

        // 找出需要删除的宿舍ID（存在于现有列表但不在请求列表中）
        const dormitoryIdsToDelete = existingDormitoryIds.filter(
          (id) => !incomingDormitoryIds.has(id),
        );

        // 删除不再需要的宿舍
        dormitoryIdsToDelete.length > 0
          ? await prisma.dormitory.deleteMany({
              where: {
                dormitoryId: {
                  in: dormitoryIdsToDelete,
                },
              },
            })
          : null;

        // 处理更新和创建
        for (const dormitory of dormitories) {
          dormitory.dormitoryId
            ? await prisma.dormitory.update({
                where: { dormitoryId: dormitory.dormitoryId },
                data: {
                  ...dormitory,
                  parkId: id,
                },
              })
            : await prisma.dormitory.create({
                data: {
                  ...dormitory,
                  parkId: id,
                },
              });
        }
      }

      // 更新园区数据并返回更新后的完整数据
      return await prisma.park.update({
        where: {
          parkId: id,
        },
        data: {
          ...park,
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
    return useResponseSuccess(result);
  } catch (error) {
    console.error('更新数据失败:', error);
    return useResponseError('更新数据失败', 500);
  }
});
