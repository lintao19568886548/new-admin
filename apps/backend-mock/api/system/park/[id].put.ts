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
                if (floor.floorId) {
                  // 提取图片数据
                  const { images, ...floorData } = floor;

                  // 更新楼层基本信息
                  await prisma.factoryFloor.update({
                    where: { floorId: floor.floorId },
                    data: {
                      ...floorData,
                      factoryId: factory.factoryId,
                    },
                  });

                  // 处理图片数据
                  if (images && Array.isArray(images)) {
                    // 获取现有图片ID列表
                    const existingFloor = existingFactory.floors.find(
                      (f) => f.floorId === floor.floorId,
                    );
                    const existingImageIds = existingFloor.images.map(
                      (img) => img.imgId,
                    );

                    // 如果传入的图片数组为空，删除所有关联图片
                    if (images.length === 0 && existingImageIds.length > 0) {
                      await prisma.factoryFloorImage.deleteMany({
                        where: {
                          floorId: floor.floorId,
                        },
                      });
                    } else {
                      // 获取请求中图片的ID列表
                      const incomingImageIds = new Set(
                        images
                          .filter((img) => img.imgId)
                          .map((img) => img.imgId),
                      );

                      // 找出需要删除的图片ID
                      const imageIdsToDelete = existingImageIds.filter(
                        (id) => !incomingImageIds.has(id),
                      );

                      // 删除不再需要的图片关联
                      imageIdsToDelete.length > 0
                        ? await prisma.factoryFloorImage.deleteMany({
                            where: {
                              imgId: {
                                in: imageIdsToDelete,
                              },
                              floorId: floor.floorId,
                            },
                          })
                        : null;

                      // 处理更新和创建图片
                      for (const image of images) {
                        // 首先确保Image记录存在
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
                            const existingRelation =
                              await prisma.factoryFloorImage.findFirst({
                                where: {
                                  imgId,
                                  floorId: floor.floorId,
                                },
                              });

                            if (!existingRelation) {
                              // 如果关联不存在，创建新关联
                              await prisma.factoryFloorImage.create({
                                data: {
                                  imgId,
                                  floorId: floor.floorId,
                                },
                              });
                            }
                          } catch (error) {
                            console.error('处理楼层图片关系时出错:', error);
                            // 可能是因为unique约束冲突，尝试更新现有关系
                            // 这里可以根据实际情况处理错误
                          }
                        }
                      }
                    }
                  }
                } else {
                  // 提取图片数据
                  const { images, ...floorData } = floor;

                  // 创建新楼层
                  const newFloor = await prisma.factoryFloor.create({
                    data: {
                      ...floorData,
                      factoryId: factory.factoryId,
                    },
                  });

                  // 处理图片数据
                  if (
                    images &&
                    Array.isArray(images) && // 即使是空数组也会进入这个条件，但不会执行下面的循环
                    images.length > 0
                  ) {
                    for (const image of images) {
                      // 首先确保Image记录存在
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
                              floorId: newFloor.floorId,
                            },
                          });
                        } catch (error) {
                          console.error('创建楼层图片关系时出错:', error);
                          // 处理可能的错误
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            // 创建新工厂
            const { floors, ...factoryData } = factory;

            // 使用三元表达式创建工厂（有楼层或无楼层）
            if (floors && Array.isArray(floors) && floors.length > 0) {
              // 创建带有楼层的工厂
              const newFactory = await prisma.factory.create({
                data: {
                  ...factoryData,
                  parkId: id,
                },
              });

              // 为每个楼层创建记录和关联图片
              for (const floor of floors) {
                const { images, ...floorData } = floor;

                const newFloor = await prisma.factoryFloor.create({
                  data: {
                    ...floorData,
                    factoryId: newFactory.factoryId,
                  },
                });

                // 处理图片数据
                if (images && Array.isArray(images) && images.length > 0) {
                  for (const image of images) {
                    await prisma.factoryFloorImage.create({
                      data: {
                        imgId: image.imgId,
                        floorId: newFloor.floorId,
                      },
                    });
                  }
                }
              }
            } else {
              // 创建没有楼层的工厂
              await prisma.factory.create({
                data: {
                  ...factoryData,
                  parkId: id,
                },
              });
            }
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
