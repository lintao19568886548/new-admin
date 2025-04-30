import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 9; // 默认每页9条记录
    const skip = (currentPage - 1) * pageSize;

    // 构建查询条件
    const where: any = {
      isDeleted: false,
    };

    // 园区名称查询
    if (query.parkName) {
      where.parkName = { contains: query.parkName };
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
    const parks = await prismaClient.park.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
      include: {
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
      const defaultImgUrl = '/assets/微信图片_20250320150833.jpg';

      return {
        ...park,
        imgUrl: defaultImgUrl, // 使用默认图片
        factoryCount: park.factories.length, // 厂房数量
        dormitoryCount: park.dormitories.length, // 宿舍数量
      };
    });

    console.log('返回的园区数据:', items[0]); // 添加日志，查看处理后的数据结构

    return useResponseSuccess({
      items,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取园区列表失败:', error);
    return useResponseError('获取园区列表失败', 500);
  }
});
