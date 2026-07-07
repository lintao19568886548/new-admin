import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

const IMG_BASE_URL = '';

function getFloorAreaSummary(
  floors: Array<{ totalArea?: unknown; usedArea?: unknown }>,
) {
  const totalArea = floors.reduce(
    (sum, floor) => sum + Number(floor.totalArea || 0),
    0,
  );
  const usedArea = floors.reduce(
    (sum, floor) => sum + Number(floor.usedArea || 0),
    0,
  );

  return {
    availableArea: totalArea - usedArea,
    totalArea,
    usedArea,
  };
}

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

    const factoryCandidates = await prismaClient.factory.findMany({
      where,
      orderBy: {
        createTime: 'desc',
      },
      include: {
        park: {
          select: {
            parkId: true,
            parkName: true,
          },
        },
        floors: {
          where: {
            isDeleted: false,
          },
          select: {
            totalArea: true,
            usedArea: true,
          },
        },
      },
    });

    const availableFactorySummaries = factoryCandidates
      .map((factory) => {
        const areaSummary = getFloorAreaSummary(factory.floors);
        return {
          ...factory,
          ...areaSummary,
        };
      })
      .filter((factory) => factory.availableArea > 0)
      .sort((first, second) => {
        const areaDiff = second.availableArea - first.availableArea;
        if (areaDiff !== 0) {
          return areaDiff;
        }
        return (
          new Date(second.createTime || 0).getTime() -
          new Date(first.createTime || 0).getTime()
        );
      });

    const total = availableFactorySummaries.length;
    const paginatedSummaries = availableFactorySummaries.slice(
      skip,
      skip + pageSize,
    );
    const paginatedFactoryIds = paginatedSummaries.map(
      (factory) => factory.factoryId,
    );

    const factoryDetails =
      paginatedFactoryIds.length === 0
        ? []
        : await prismaClient.factory.findMany({
            where: {
              factoryId: {
                in: paginatedFactoryIds,
              },
            },
            include: {
              park: {
                select: {
                  parkId: true,
                  parkName: true,
                },
              },
              floors: {
                where: {
                  isDeleted: false,
                },
                include: {
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
    const factoryDetailMap = new Map(
      factoryDetails.map((factory) => [factory.factoryId, factory]),
    );
    const paginatedFactories = paginatedSummaries
      .map((summary) => factoryDetailMap.get(summary.factoryId))
      .filter(Boolean);

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
