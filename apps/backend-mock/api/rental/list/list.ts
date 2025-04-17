import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 9; // 默认每页9条记录
    const skip = (currentPage - 1) * pageSize;

    // 构建查询条件
    const where: any = {};

    // 厂房名称查询
    if (query.factoryName) {
      where.factoryName = { contains: query.factoryName };
    }

    // 联系人查询
    if (query.contact) {
      where.contact = { contains: query.contact };
    }

    // 状态查询
    if (query.status) {
      where.status = { equals: query.status };
    }

    // 获取总数
    const total = await prismaClient.factory.count({ where });

    // 获取分页数据，包含图片关联
    const factories = await prismaClient.factory.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
      include: {
        images: {
          include: {
            image: true,
          },
          take: 1, // 只取第一张图片用于列表展示
        },
      },
    });

    // 处理返回数据，添加图片URL
    const items = factories.map((factory) => {
      const defaultImgUrl = '/assets/微信图片_20250320150833.jpg';
      // 如果有图片，使用第一张图片的URL，否则使用默认图片
      const imgUrl =
        factory.images && factory.images.length > 0 && factory.images[0].image
          ? factory.images[0].image.imgUrl
          : defaultImgUrl;

      // 移除嵌套的images对象，避免数据冗余
      const { images: _images, ...factoryData } = factory;

      return {
        ...factoryData,
        imgUrl,
      };
    });

    console.log('返回的数据:', items[0]); // 添加日志，查看处理后的数据结构

    return useResponseSuccess({
      items,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取厂房列表失败:', error);
    return useResponseError('获取厂房列表失败', 500);
  }
});
