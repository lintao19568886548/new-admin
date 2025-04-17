import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

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
          include: {
            // 包含厂房图片
            images: {
              include: {
                image: true,
              },
            },
            // 包含消防设施
            firefighting: true,
            // 包含变压器
            transformers: true,
          },
        },
        // 包含宿舍信息
        dormitories: true,
      },
    });

    if (!park) {
      return useResponseError('园区不存在', 404);
    }

    // 处理厂房数据，添加图片URL
    const factories = park.factories.map((factory) => {
      const defaultImgUrl = '/assets/微信图片_20250320150833.jpg';
      const images = factory.images.map((item) => item.image.imgUrl);

      // 移除嵌套的images对象，避免数据冗余
      const { images: _images, ...factoryData } = factory;

      // 确保日期字段格式正确
      const safeFactory = {
        ...factoryData,
        buildTime: factory.buildTime ? factory.buildTime.toISOString() : null,
        createTime: factory.createTime
          ? factory.createTime.toISOString()
          : null,
        updateTime: factory.updateTime
          ? factory.updateTime.toISOString()
          : null,
      };

      return {
        ...safeFactory,
        imgUrl: images.length > 0 ? images[0] : defaultImgUrl,
        imageUrls: images.length > 0 ? images : [defaultImgUrl],
        // 处理消防设施数据
        firefighting: factory.firefighting.map((item) => ({
          ...item,
          checkTime: item.checkTime ? item.checkTime.toISOString() : null,
          imgUrl: defaultImgUrl, // 为消防设施添加默认图片
        })),
        // 处理变压器数据
        transformers: factory.transformers.map((item) => ({
          ...item,
          checkTime: item.checkTime ? item.checkTime.toISOString() : null,
          imgUrl: defaultImgUrl, // 为变压器添加默认图片
        })),
      };
    });

    // 返回处理后的数据
    return useResponseSuccess({
      ...park,
      createTime: park.createTime ? park.createTime.toISOString() : null,
      updateTime: park.updateTime ? park.updateTime.toISOString() : null,
      imgUrl: '/assets/微信图片_20250320150833.jpg', // 园区默认图片
      imageUrls: ['/assets/微信图片_20250320150833.jpg'], // 园区图片列表
      factories, // 处理后的厂房数据
    });
  } catch (error) {
    console.error('获取园区详情失败:', error);
    return useResponseError('获取园区详情失败', 500);
  }
});
