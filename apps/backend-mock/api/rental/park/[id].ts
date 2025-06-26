import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

const IMG_BASE_URL = '';

export default eventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id);

    if (Number.isNaN(id)) {
      return useResponseError('无效的园区ID', 400);
    }

    // 查询园区信息，并包含关联的厂房、宿舍信息
    const park = await prismaClient.park.findUnique({
      where: { parkId: id },
      include: {
        // 包含厂房信息
        factories: {
          where: {
            isDeleted: false,
          },
          include: {
            // 包含厂房楼层
            floors: {
              where: {
                isDeleted: false,
              },
              include: {
                // 包含楼层图片
                images: {
                  include: {
                    image: true,
                  },
                },
              },
            },
            // 包含消防设施
            firefighting: {
              orderBy: {
                checkTime: 'desc',
              },
              take: 1,
            },
            // 包含变压器
            transformers: {
              orderBy: {
                checkTime: 'desc',
              },
              take: 1,
            },
            // 新增：包含升降机
            elevator: {
              orderBy: {
                checkTime: 'desc',
              },
              take: 1,
            },
          },
        },
        // 包含宿舍信息
        dormitories: {
          where: {
            isDeleted: false,
          },
          include: {
            // 包含宿舍图片
            images: {
              include: {
                image: true,
              },
            },
          },
        },
        // 新增：包含园区图片信息
        images: {
          orderBy: {
            id: 'asc',
          },
          include: {
            image: true, // 确保 Image 模型被包含，其中应有 imgUrl
          },
        },
      },
    });

    if (!park) {
      return useResponseError('园区不存在', 404);
    }

    // 新增：处理园区图片数据
    const processedParkImages = park.images
      ? park.images
          .map((parkImageRelation) =>
            parkImageRelation.image?.imgUrl
              ? `${IMG_BASE_URL}${parkImageRelation.image?.imgUrl}`
              : '',
          ) // 从关联的 Image 对象获取 imgUrl
          .filter((url): url is string => !!url) // 过滤掉无效的 URL，并确保类型安全
      : [];

    const parkMainImgUrl =
      processedParkImages.length > 0 ? processedParkImages[0] : '';
    const parkImageUrlsList =
      processedParkImages.length > 0 ? processedParkImages : [];

    // 处理厂房数据，添加图片URL
    const factories = park.factories.map((factory) => {
      // 处理厂房楼层数据
      const floors = factory.floors.map((floor) => {
        // 添加空值检查
        const floorImages = floor.images
          .map((item) =>
            item.image?.imgUrl ? `${IMG_BASE_URL}${item.image?.imgUrl}` : '',
          )
          .filter(Boolean); // 过滤掉undefined和null

        return {
          ...floor,
          imgUrl: floorImages.length > 0 ? floorImages[0] : '',
          imageUrls: floorImages.length > 0 ? floorImages : [],
          createTime: floor.createTime ? floor.createTime.toISOString() : null,
          updateTime: floor.updateTime ? floor.updateTime.toISOString() : null,
        };
      });

      // 确保日期字段格式正确
      const safeFactory = {
        ...factory,
        buildTime: factory.buildTime ? factory.buildTime.toISOString() : null,
        createTime: factory.createTime
          ? factory.createTime.toISOString()
          : null,
        updateTime: factory.updateTime
          ? factory.updateTime.toISOString()
          : null,
      };

      // 获取第一个楼层的图片作为厂房主图
      const firstFloorImages =
        floors.length > 0 && floors[0].imageUrls ? floors[0].imageUrls : [];
      const firstFloorMainImage =
        floors.length > 0 && floors[0].imgUrl ? floors[0].imgUrl : '';

      return {
        ...safeFactory,
        floors,
        imgUrl: firstFloorMainImage,
        imageUrls: firstFloorImages,
        // 处理消防设施数据
        firefighting: factory.firefighting.map((item) => ({
          ...item,
          checkTime: item.checkTime ? item.checkTime.toISOString() : null,
        })),
        // 处理变压器数据
        transformers: factory.transformers.map((item) => ({
          ...item,
          checkTime: item.checkTime ? item.checkTime.toISOString() : null,
        })),
        // 新增：处理升降机数据
        elevators: factory.elevator.map((item) => ({
          ...item,
          checkTime: item.checkTime ? item.checkTime.toISOString() : null,
        })),
      };
    });

    // 处理宿舍数据
    const dormitories = park.dormitories.map((dorm) => {
      // 添加空值检查
      const dormImages = dorm.images
        .map((item) =>
          item.image?.imgUrl ? `${IMG_BASE_URL}${item.image?.imgUrl}` : '',
        )
        .filter(Boolean); // 过滤掉undefined和null

      return {
        ...dorm,
        imgUrl: dormImages.length > 0 ? dormImages[0] : '',
        imageUrls: dormImages.length > 0 ? dormImages : [],
        createTime: dorm.createTime ? dorm.createTime.toISOString() : null,
        updateTime: dorm.updateTime ? dorm.updateTime.toISOString() : null,
      };
    });

    // 返回处理后的数据
    return useResponseSuccess({
      ...park,
      createTime: park.createTime ? park.createTime.toISOString() : null,
      updateTime: park.updateTime ? park.updateTime.toISOString() : null,
      imgUrl: parkMainImgUrl, // 修改：使用处理后的园区主图片
      imageUrls: parkImageUrlsList, // 修改：使用处理后的园区图片列表
      factories, // 处理后的厂房数据
      dormitories, // 处理后的宿舍数据
    });
  } catch (error) {
    console.error('后端获取园区详情失败:', error);
    return serverErrorResponse(`获取园区详情失败`, event);
  }
});
