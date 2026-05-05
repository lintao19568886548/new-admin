import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    // 查询所有园区，包含厂房和楼层信息
    const parks = await prismaClient.park.findMany({
      where: { isDeleted: false },
      include: {
        factories: {
          where: { isDeleted: false },
          include: {
            floors: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    // 统计数据
    let totalArea = 0;
    let rentedArea = 0;
    let vacantArea = 0;
    let rentedCount = 0;
    let vacantCount = 0;

    // 遍历所有园区
    for (const park of parks) {
      // 遍历所有厂房
      for (const factory of park.factories) {
        // 遍历所有楼层
        for (const floor of factory.floors) {
          const floorTotalArea = Number(floor.totalArea) || 0;
          const floorUsedArea = Number(floor.usedArea) || 0;

          // 累加总面积
          totalArea += floorTotalArea;

          if (floorUsedArea > 0) {
            rentedArea += Math.min(floorUsedArea, floorTotalArea);
            rentedCount++;
          }

          if (floorTotalArea > floorUsedArea) {
            vacantArea += floorTotalArea - floorUsedArea;
            vacantCount++;
          }
        }
      }
    }

    // 计算出租率
    const rentalRate = totalArea > 0 ? (rentedArea / totalArea) * 100 : 0;

    const result = {
      totalArea: totalArea.toFixed(2),
      rentedArea: rentedArea.toFixed(2),
      vacantArea: vacantArea.toFixed(2),
      rentalRate: rentalRate.toFixed(2),
      rentedCount,
      vacantCount,
    };

    console.log('园区租赁统计数据:', result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('获取园区租赁统计数据失败:', error);
    return useResponseSuccess({
      totalArea: '0.00',
      rentedArea: '0.00',
      vacantArea: '0.00',
      rentalRate: '0.00',
      rentedCount: 0,
      vacantCount: 0,
    });
  }
});
