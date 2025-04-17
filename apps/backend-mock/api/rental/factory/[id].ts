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
        images: {
          include: {
            image: true,
          },
        },
      },
    });

    if (!factory) {
      return useResponseError('厂房不存在', 404);
    }

    // 处理图片数据
    const defaultImgUrl = '/assets/微信图片_20250320150833.jpg';
    const images = factory.images.map((item) => item.image.imgUrl);

    // 返回处理后的数据
    return useResponseSuccess({
      ...factory,
      imgUrl: images.length > 0 ? images[0] : defaultImgUrl, // 主图
      imageUrls: images.length > 0 ? images : [defaultImgUrl], // 所有图片
    });
  } catch (error) {
    console.error('获取厂房详情失败:', error);
    return useResponseError('获取厂房详情失败', 500);
  }
});
