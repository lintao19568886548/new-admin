import type { Prisma } from '@prisma/.prisma/client/index.js';
import type { DefaultArgs } from '@prisma/.prisma/client/runtime/library';

import { PrismaClient } from '@prisma/.prisma/client/index.js';
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
              floors: {
                include: {
                  images: true,
                },
              },
            },
          },
          dormitories: true,
        },
      });

      if (!existingPark) {
        throw new Error(`未找到ID为${id}的园区`);
      }
      // 处理 factories 数据
      if (factories) {
        await updateParkFactories(prisma, existingPark, factories);
      }

      console.log('dormitories', dormitories);
      // 处理 dormitories 数据
      if (dormitories) {
        await updateParkDormitories(prisma, existingPark, dormitories);
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
              floors: {
                include: {
                  images: true,
                },
              },
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

/**
 * 更新园区宿舍数据
 */
async function updateParkDormitories(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$extends' | '$on' | '$transaction' | '$use'
  >,
  existingPark: any,
  dormitories: any[],
) {
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
  if (dormitoryIdsToDelete.length > 0) {
    await prisma.dormitory.deleteMany({
      where: {
        dormitoryId: {
          in: dormitoryIdsToDelete,
        },
      },
    });
  }

  // 处理更新和创建
  const dormitoryPromises = dormitories.map(async (dormitory) => {
    dormitory.dormitoryId
      ? // 更新现有宿舍
        prisma.dormitory.update({
          where: { dormitoryId: dormitory.dormitoryId },
          data: {
            ...dormitory,
            parkId: existingPark.parkId,
          },
        })
      : // 创建新宿舍
        prisma.dormitory.create({
          data: {
            ...dormitory,
            parkId: existingPark.parkId,
          },
        });
  });

  // 等待所有宿舍更新/创建完成
  await Promise.all(dormitoryPromises);
}

/**
 * 更新园区厂房数据
 */
async function updateParkFactories(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$extends' | '$on' | '$transaction' | '$use'
  >,
  existingPark: any,
  factories: any[],
) {
  if (!factories || !Array.isArray(factories)) {
    return;
  }

  // 获取现有工厂的ID列表
  const existingFactoryIds = existingPark.factories.map((f) => f.factoryId);

  // 获取请求中工厂的ID列表（过滤掉没有ID的新工厂）
  const incomingFactoryIds = new Set(
    factories.filter((f) => f.factoryId).map((f) => f.factoryId),
  );

  // 找出需要删除的工厂ID（存在于现有列表但不在请求列表中）
  const factoryIdsToDelete = existingFactoryIds.filter(
    (id) => !incomingFactoryIds.has(id),
  );

  // 删除不再需要的工厂及其关联数据
  if (factoryIdsToDelete.length > 0) {
    await deleteFactoriesWithRelations(prisma, factoryIdsToDelete);
  }

  // 处理更新和创建工厂
  const factoryPromises = factories.map(async (factory) => {
    factory.factoryId
      ? // 更新现有工厂
        await updateExistingFactory(
          prisma,
          existingPark,
          factory,
          existingPark.factories.find((f) => f.factoryId === factory.factoryId),
        )
      : // 创建新工厂
        await createNewFactory(prisma, existingPark, factory);
  });

  // 等待所有工厂更新/创建完成
  await Promise.all(factoryPromises);
}

/**
 * 删除工厂及其关联数据
 */
async function deleteFactoriesWithRelations(
  prisma: any,
  factoryIdsToDelete: number[],
) {
  // 获取要删除的工厂关联的所有楼层ID
  const relatedFloors = await prisma.factoryFloor.findMany({
    where: {
      factoryId: {
        in: factoryIdsToDelete,
      },
    },
    select: {
      floorId: true,
    },
  });

  const relatedFloorIds = relatedFloors.map((floor) => floor.floorId);

  // 先删除楼层关联的图片
  if (relatedFloorIds.length > 0) {
    await prisma.factoryFloorImage.deleteMany({
      where: {
        floorId: {
          in: relatedFloorIds,
        },
      },
    });
  }

  // 再删除楼层
  await prisma.factoryFloor.deleteMany({
    where: {
      factoryId: {
        in: factoryIdsToDelete,
      },
    },
  });

  // 最后删除工厂
  await prisma.factory.deleteMany({
    where: {
      factoryId: {
        in: factoryIdsToDelete,
      },
    },
  });
}

/**
 * 更新现有工厂
 */
async function updateExistingFactory(
  prisma: any,
  existingPark: any,
  factory: any,
  existingFactory: any,
) {
  // 提取楼层数据
  const { floors, ...factoryData } = factory;

  // 更新工厂基本信息
  await prisma.factory.update({
    where: { factoryId: factory.factoryId },
    data: {
      ...factoryData,
      parkId: existingPark.parkId,
    },
  });

  // 处理楼层数据
  if (floors && Array.isArray(floors)) {
    await updateFactoryFloors(
      prisma,
      factory.factoryId,
      floors,
      existingFactory,
    );
  }
}

/**
 * 更新工厂楼层
 */
async function updateFactoryFloors(
  prisma: any,
  factoryId: number,
  floors: any[],
  existingFactory: any,
) {
  // 获取现有楼层ID列表
  const existingFloorIds = existingFactory.floors.map((floor) => floor.floorId);

  // 获取请求中楼层的ID列表（过滤掉没有ID的新楼层）
  const incomingFloorIds = new Set(
    floors.filter((floor) => floor.floorId).map((floor) => floor.floorId),
  );

  // 找出需要删除的楼层ID
  const floorIdsToDelete = existingFloorIds.filter(
    (id) => !incomingFloorIds.has(id),
  );

  // 删除不再需要的楼层及其关联图片
  if (floorIdsToDelete.length > 0) {
    await deleteFloorsWithImages(prisma, floorIdsToDelete);
  }

  // 处理更新和创建楼层
  const floorPromises = floors.map(async (floor) => {
    floor.floorId
      ? // 更新现有楼层
        await updateExistingFloor(
          prisma,
          factoryId,
          floor,
          existingFactory.floors.find((f) => f.floorId === floor.floorId),
        )
      : // 创建新楼层
        await createNewFloor(prisma, factoryId, floor);
  });

  // 等待所有楼层更新/创建完成
  await Promise.all(floorPromises);
}

/**
 * 删除楼层及其关联图片
 */
async function deleteFloorsWithImages(prisma: any, floorIdsToDelete: number[]) {
  // 首先删除与这些楼层关联的所有图片关系
  await prisma.factoryFloorImage.deleteMany({
    where: {
      floorId: {
        in: floorIdsToDelete,
      },
    },
  });
  // 然后删除楼层
  await prisma.factoryFloor.deleteMany({
    where: {
      floorId: {
        in: floorIdsToDelete,
      },
    },
  });
}

/**
 * 更新现有楼层
 */
async function updateExistingFloor(
  prisma: any,
  factoryId: number,
  floor: any,
  existingFloor: any,
) {
  // 提取图片数据
  const { images, ...floorData } = floor;

  // 更新楼层基本信息
  await prisma.factoryFloor.update({
    where: { floorId: floor.floorId },
    data: {
      ...floorData,
      factoryId,
    },
  });

  // 处理图片数据
  if (images && Array.isArray(images)) {
    await updateFloorImages(prisma, floor.floorId, images, existingFloor);
  }
}

/**
 * 更新楼层图片
 */
async function updateFloorImages(
  prisma: any,
  floorId: number,
  images: any[],
  existingFloor: any,
) {
  // 获取现有图片ID列表
  const existingImageIds = existingFloor.images.map((img) => img.imgId);

  // 如果传入的图片数组为空，删除所有关联图片
  if (images.length === 0 && existingImageIds.length > 0) {
    await prisma.factoryFloorImage.deleteMany({
      where: {
        floorId,
      },
    });
    return;
  }

  // 获取请求中图片的ID列表
  const incomingImageIds = new Set(
    images.filter((img) => img.imgId).map((img) => img.imgId),
  );

  // 找出需要删除的图片ID
  const imageIdsToDelete = existingImageIds.filter(
    (id) => !incomingImageIds.has(id),
  );
  console.log('imageIdsToDelete', imageIdsToDelete);
  // 删除不再需要的图片关联
  if (imageIdsToDelete.length > 0) {
    await prisma.factoryFloorImage.deleteMany({
      where: {
        imgId: {
          in: imageIdsToDelete,
        },
        floorId,
      },
    });

    await prisma.image.deleteMany({
      where: {
        imgId: {
          in: imageIdsToDelete,
        },
      },
    });
  }

  // 处理更新和创建图片
  const imagePromises = images.map(async (image) => {
    // 确保Image记录存在
    let imgId = image.imgId;

    if (!imgId && image.imgUrl) {
      // 如果没有imgId但有imgUrl，创建新的Image记录
      const newImage = await prisma.image.create({
        data: {
          imgUrl: image.imgUrl,
        },
      });
      imgId = newImage.imgId;
    }

    if (imgId) {
      try {
        // 查找是否已存在关联
        const existingRelation = await prisma.factoryFloorImage.findFirst({
          where: {
            imgId,
            floorId,
          },
        });

        if (!existingRelation) {
          // 如果关联不存在，创建新关联
          await prisma.factoryFloorImage.create({
            data: {
              imgId,
              floorId,
            },
          });
        }
      } catch (error) {
        console.error('处理楼层图片关系时出错:', error);
        // 可能是因为unique约束冲突，这里可以根据实际情况处理错误
      }
    }
  });

  // 等待所有图片处理完成
  await Promise.all(imagePromises);
}

/**
 * 创建新楼层
 */
async function createNewFloor(prisma: any, factoryId: number, floor: any) {
  // 提取图片数据
  const { images, ...floorData } = floor;

  // 创建新楼层
  const newFloor = await prisma.factoryFloor.create({
    data: {
      ...floorData,
      factoryId,
    },
  });

  // 处理图片数据
  if (images && Array.isArray(images) && images.length > 0) {
    await createFloorImages(prisma, newFloor.floorId, images);
  }
}

/**
 * 创建楼层图片
 */
async function createFloorImages(prisma: any, floorId: number, images: any[]) {
  const imagePromises = images.map(async (image) => {
    // 确保Image记录存在
    let imgId = image.imgId;

    if (!imgId && image.imgUrl) {
      // 如果没有imgId但有imgUrl，创建新的Image记录
      const newImage = await prisma.image.create({
        data: {
          imgUrl: image.imgUrl,
        },
      });
      imgId = newImage.imgId;
    }

    if (imgId) {
      try {
        await prisma.factoryFloorImage.create({
          data: {
            imgId,
            floorId,
          },
        });
      } catch (error) {
        console.error('创建楼层图片关系时出错:', error);
        // 处理可能的错误
      }
    }
  });

  // 等待所有图片处理完成
  await Promise.all(imagePromises);
}

/**
 * 创建新工厂
 */
async function createNewFactory(prisma: any, existingPark: any, factory: any) {
  // 提取楼层数据
  const { floors, ...factoryData } = factory;

  // 创建新工厂
  const newFactory = await prisma.factory.create({
    data: {
      ...factoryData,
      parkId: existingPark.parkId,
    },
  });

  // 处理楼层数据
  if (floors && Array.isArray(floors) && floors.length > 0) {
    // 为每个楼层创建记录和关联图片
    const floorPromises = floors.map(async (floor) => {
      await createNewFloor(prisma, newFactory.factoryId, floor);
    });

    // 等待所有楼层创建完成
    await Promise.all(floorPromises);
  }
}
