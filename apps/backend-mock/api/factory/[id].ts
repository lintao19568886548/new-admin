import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

const IMG_BASE_URL = '';

export default eventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id);

    if (Number.isNaN(id)) {
      return useResponseError('无效的厂房ID', 400);
    }

    // 查询厂房信息，包含楼层数据
    const factory = await prismaClient.factory.findUnique({
      where: {
        factoryId: id,
        isOwn: false, // 只查询入驻厂房
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
      },
    });

    if (!factory) {
      return useResponseError('厂房不存在', 404);
    }

    // 处理厂房楼层数据
    const floors = factory.floors.map((floor) => {
      // 处理楼层图片
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
        totalArea: Number(floor.totalArea),
        usedArea: Number(floor.usedArea),
        rentPrice: Number(floor.rentPrice),
      };
    });

    // 获取第一个楼层的图片作为厂房主图
    const firstFloorImages =
      floors.length > 0 && floors[0].imageUrls ? floors[0].imageUrls : [];
    const firstFloorMainImage =
      floors.length > 0 && floors[0].imgUrl ? floors[0].imgUrl : '';

    // 计算厂房统计信息
    const totalArea = floors.reduce((sum, floor) => sum + floor.totalArea, 0);
    const usedArea = floors.reduce((sum, floor) => sum + floor.usedArea, 0);
    const availableArea = totalArea - usedArea;
    const floorCount = floors.length;

    // 移除设施数据处理，专注于厂房和楼层信息

    // 返回处理后的厂房详情数据
    const result = {
      factoryId: factory.factoryId,
      factoryName: factory.factoryName,
      address: factory.address,
      contact: factory.contact,
      description: factory.description || '',
      buildTime: factory.buildTime ? factory.buildTime.toISOString() : null,
      createTime: factory.createTime ? factory.createTime.toISOString() : null,
      updateTime: factory.updateTime ? factory.updateTime.toISOString() : null,
      isOwn: factory.isOwn,
      parkId: null, // 入驻厂房没有园区ID
      parkName: '入驻厂房',

      // 厂房图片信息
      imgUrl: firstFloorMainImage,
      imageUrls: firstFloorImages,

      // 厂房统计信息
      totalArea,
      usedArea,
      availableArea,
      floorCount,

      // 楼层信息
      floors,
    };

    return useResponseSuccess(result);
  } catch (error) {
    console.error('后端获取厂房详情失败:', error);
    return serverErrorResponse(`获取厂房详情失败`, event);
  }
});
