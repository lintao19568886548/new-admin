import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

const IMG_BASE_URL =
  process.env.NODE_ENV === 'production' ? 'https://yizuw.cn' : '';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 9; // 默认每页9条记录
    const skip = (currentPage - 1) * pageSize;

    // 构建查询条件
    const where: any = {
      isDeleted: false,
      parkName: {
        notIn: ['宜租网络', '总部', '东莞光泰园区'],
      },
    };

    // 园区名称查询
    if (query.parkName) {
      where.parkName.contains = query.parkName;
    }

    // 地址查询
    if (query.address) {
      where.address = { contains: query.address };
    }

    // 状态查询
    if (query.status) {
      where.status = { equals: query.status };
    }

    // 获取总数
    const total = await prismaClient.park.count({ where });

    // 获取分页数据
    // (Prisma query from Step 1)
    const parks = await prismaClient.park.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
      include: {
        images: {
          orderBy: {
            createTime: 'asc',
          },
          include: {
            image: {
              select: {
                imgUrl: true,
              },
            },
          },
        },
        // 假设您可能还有其他的 include，比如统计厂房和宿舍数量
        factories: {
          select: {
            factoryId: true,
          },
        },
        dormitories: {
          select: {
            dormitoryId: true,
          },
        },
      },
    });

    // 处理返回数据
    const items = parks.map((park) => {
      // 从 park.images 中提取所有图片的 URL
      // park.images 现在是一个数组，每个元素包含 { image: { imgUrl: '...' } }
      const parkImageUrls = park.images
        ? park.images
            .map((parkImageRelation) =>
              parkImageRelation.image?.imgUrl
                ? `${IMG_BASE_URL}${parkImageRelation.image?.imgUrl}`
                : '',
            ) // 提取 imgUrl
            .filter((url): url is string => !!url) // 过滤掉无效的 URL (null 或 undefined)
        : [];

      return {
        ...park,
        // 根据您的需求，这里可以添加其他处理过的字段，比如厂房和宿舍数量
        // factoryCount: park.factories.length,
        // dormitoryCount: park.dormitories.length,

        // 设置主图片 URL (例如，列表中的第一张，如果存在)
        imgUrl: parkImageUrls.length > 0 ? parkImageUrls[0] : '', // 如果没有图片，则为空字符串
        // 设置图片 URL 列表
        imageUrls: parkImageUrls,
        // 确保移除 park.images 属性，因为它已经被处理并包含在 imgUrl 和 imageUrls 中
        // 或者根据需要保留，但通常会移除以避免冗余数据
        // images: undefined, // 可选：显式移除原始 images 数组
      };
    });

    return useResponseSuccess({
      items,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取园区列表失败:', error);
    return serverErrorResponse(`获取园区列表失败\n${error}`, event);
  }
});
