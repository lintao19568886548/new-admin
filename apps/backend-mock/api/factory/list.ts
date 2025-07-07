import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

const IMG_BASE_URL = '';

/**
 * 获取厂房列表接口
 * 支持分页查询和条件筛选
 */
export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const authorizedParkIds = userinfo.parks.map((park) => park.parkId);

  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 9; // 默认每页9条记录
    const skip = (currentPage - 1) * pageSize;

    // 构建查询条件
    const where: any = {
      isDeleted: false,
    };

    // 根据 isOwn 参数决定查询条件
    if (query.isOwn === undefined) {
      // 如果没有指定 isOwn，则查询所有有权限的厂房（自有 + 入驻）
      where.OR = [
        {
          // 自有厂房：在用户有权限的园区内
          isOwn: true,
          parkId: {
            in: authorizedParkIds,
          },
        },
        {
          // 入驻厂房：parkId 为 null
          isOwn: false,
          parkId: null,
        },
      ];
    } else {
      const isOwn = query.isOwn === 'true' || query.isOwn === true;
      where.isOwn = isOwn;

      // 根据厂房类型设置园区查询条件：自有厂房查询用户有权限的园区，入驻厂房查询 parkId 为 null
      where.parkId = isOwn ? { in: authorizedParkIds } : null;
    }

    // 厂房名称查询
    if (query.factoryName) {
      where.factoryName = { contains: query.factoryName };
    }

    // 地址查询
    if (query.address) {
      where.address = { contains: query.address };
    }

    // 园区ID查询（仅对自有厂房有效）
    if (query.parkId && query.isOwn !== 'false') {
      // 如果指定了园区ID，且不是明确查询入驻厂房，则添加园区ID条件
      if (where.OR) {
        // 如果使用了OR条件，需要修改自有厂房的查询条件
        where.OR[0].parkId = Number(query.parkId);
      } else if (where.isOwn === true) {
        // 如果明确查询自有厂房，直接设置parkId
        where.parkId = Number(query.parkId);
      }
    }

    // 获取总数
    const total = await prismaClient.factory.count({ where });

    // 获取分页数据
    const factories = await prismaClient.factory.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
      include: {
        // 包含园区信息（入驻厂房可能没有园区）
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

    // 处理返回数据
    const items = factories.map((factory) => {
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
        group: factory.park?.parkName || '入驻厂房',
        parkId: factory.parkId,
        parkName: factory.park?.parkName || '入驻厂房',
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
    console.error('获取厂房列表失败:', error);
    return serverErrorResponse(`获取厂房列表失败`, event);
  }
});
