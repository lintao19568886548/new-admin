import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id);

    if (Number.isNaN(id)) {
      return useResponseError('无效的厂房ID', 400);
    }

    const factory = await prismaClient.factory.findUnique({
      where: { factoryId: id },
      include: {
        // 更新为包含楼层和楼层图片
        floors: {
          include: {
            images: {
              include: {
                image: true,
              },
            },
          },
        },
        // 包含消防设施
        firefighting: true,
        // 包含变压器
        transformers: true,
      },
    });

    if (!factory) {
      return useResponseError('厂房不存在', 404);
    }

    // 从楼层中获取图片
    const allImages = [];
    factory.floors.forEach((floor) => {
      if (floor.images && floor.images.length > 0) {
        floor.images.forEach((img) => {
          allImages.push(img.image.imgUrl);
        });
      }
    });

    // 处理楼层数据
    const floors = factory.floors.map((floor) => {
      const floorImages = floor.images.map((item) => item.image.imgUrl);

      return {
        ...floor,
        imgUrl: floorImages.length > 0 ? floorImages[0] : '',
        imageUrls: floorImages.length > 0 ? floorImages : '',
      };
    });

    // 返回处理后的数据
    return useResponseSuccess({
      ...factory,
      floors,
      imgUrl: allImages.length > 0 ? allImages[0] : '', // 主图
      imageUrls: allImages.length > 0 ? allImages : '', // 所有图片
      // 处理消防设施数据
      firefighting: factory.firefighting.map((item) => ({
        ...item,
        imgUrl: item.imgUrl || '',
      })),
      // 处理变压器数据
      transformers: factory.transformers.map((item) => ({
        ...item,
        imgUrl: item.imgUrl || '',
      })),
    });
  } catch (error) {
    console.error('获取厂房详情失败:', error);
    return useResponseError('获取厂房详情失败', 500);
  }
});
