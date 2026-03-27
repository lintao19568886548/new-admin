import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

const IMG_BASE_URL = '';

/**
 * 获取有空闲面积的厂房列表接口
 * 支持分页查询和条件筛选，只返回空闲面积大于0的厂房
 */
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

    // 厂房名称查询
    if (query.factoryName) {
      where.factoryName = { contains: query.factoryName };
    }

    // 地址查询
    if (query.address) {
      where.address = { contains: query.address };
    }

    // 园区ID查询
    if (query.parkId) {
      where.parkId = Number(query.parkId);
    }

    // 是否自有厂房查询
    if (query.isOwn !== undefined) {
      where.isOwn = query.isOwn === 'true' || query.isOwn === true;
    }

    // 获取所有符合条件的厂房数据（不分页，用于过滤空闲面积）
    const allFactories = await prismaClient.factory.findMany({
      where,
      orderBy: {
        createTime: 'desc',
      },
      include: {
        // 包含园区信息
        park: {
          select: {
            parkId: true,
            parkName: true,
          },
        },
        // 包含楼层信息用于统计
        floors: {
          where: {
            isDeleted: false,
          },
          include: {
            // 包含楼层图片
            images: {
              include: {
                image: {
                  select: {
                    imgUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 过滤出有空闲面积的厂房
    const availableFactories = allFactories.filter((factory) => {
      // 计算厂房总的空闲面积
      const totalArea = factory.floors.reduce(
        (sum, floor) => sum + Number(floor.totalArea),
        0,
      );
      const usedArea = factory.floors.reduce(
        (sum, floor) => sum + Number(floor.usedArea),
        0,
      );
      const availableArea = totalArea - usedArea;

      // 只返回空闲面积大于0的厂房
      return availableArea > 0;
    });

    // 计算过滤后的总数
    const total = availableFactories.length;

    // 对过滤后的结果进行分页
    const paginatedFactories = availableFactories.slice(skip, skip + pageSize);

    // 处理返回数据
    const items = paginatedFactories.map((factory) => {
      // 处理楼层数据并获取图片
      const floors = factory.floors.map((floor) => {
        const floorImages = floor.images
          .map((item) =>
            item.image?.imgUrl ? `${IMG_BASE_URL}${item.image?.imgUrl}` : '',
          )
          .filter(Boolean);

        return {
          ...floor,
          imgUrl: floorImages.length > 0 ? floorImages[0] : '',
          imageUrls: floorImages,
          totalArea: Number(floor.totalArea),
          usedArea: Number(floor.usedArea),
        };
      });

      // 计算厂房统计信息
      const totalArea = floors.reduce((sum, floor) => sum + floor.totalArea, 0);
      const usedArea = floors.reduce((sum, floor) => sum + floor.usedArea, 0);
      const availableArea = totalArea - usedArea;
      const floorCount = floors.length;

      // 获取第一个楼层的图片作为厂房主图
      const firstFloorImages = floors.length > 0 ? floors[0].imageUrls : [];
      const firstFloorMainImage = floors.length > 0 ? floors[0].imgUrl : '';

      return {
        id: factory.factoryId,
        factoryId: factory.factoryId,
        title: factory.factoryName,
        factoryName: factory.factoryName,
        address: factory.address,
        contact: factory.contact,
        description: factory.description || '',
        buildTime: factory.buildTime ? factory.buildTime.toISOString() : null,
        area: totalArea,
        availableArea,
        floorCount,
        rentPrice: floors.length > 0 ? Number(floors[0].rentPrice) : 0,
        tag: factory.isOwn ? '自有' : '入驻',
        group: factory.park?.parkName || null,
        parkId: factory.parkId ?? null,
        parkName: factory.park?.parkName || null,
        imgUrl: firstFloorMainImage,
        imageUrls: firstFloorImages,
        content: factory.description || '',
        date: factory.createTime ? factory.createTime.toISOString() : null,
        createTime: factory.createTime
          ? factory.createTime.toISOString()
          : null,
        updateTime: factory.updateTime
          ? factory.updateTime.toISOString()
          : null,
      };
    });

    return useResponseSuccess({
      items,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('查询空闲厂房数据失败:', error);
    return useResponseError('查询空闲厂房数据失败', 500);
  }
});
