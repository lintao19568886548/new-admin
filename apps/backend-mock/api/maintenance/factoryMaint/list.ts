import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  // 获取查询参数
  const query = getQuery(event);
  console.log('query', query);
  const {
    maintenanceItem, // 新增：维护项目查询
    maintenanceStatus, // 新增：维护状态查询
    personInCharge, // 新增：负责人查询
    // startTime and endTime from query are used for date range filtering
    startTime: queryStartTime, // Renamed to avoid conflict with model field name if used directly
    endTime: queryEndTime, // Renamed to avoid conflict
    currentPark,
    factoryId,
    currentPage,
    pageSize,
  } = query;

  // 构建查询条件
  const where: any = {};

  // 区域查询 (currentPark)
  // 注意: factoryMaintenance 模型当前没有直接的 parkId 字段。
  // 下面的逻辑检查用户是否有权访问某个园区，但不会直接在 factoryMaintenance 上按 parkId 筛选。
  // 如果需要按园区筛选厂房维护记录，您可能需要：
  // 1. 在 factoryMaintenance 模型中添加 parkId。
  // 2. 或者，查询指定园区下的所有厂房，然后根据这些厂房ID筛选维护记录。
  if (currentPark) {
    const parkIdToFilter = Number(currentPark);
    if (parkIdToFilter === -1) {
      // 查看所有有权限的园区
      const userHasAccessToAnyPark =
        userinfo.parks && userinfo.parks.length > 0;
      if (!userHasAccessToAnyPark) {
        // 如果用户没有任何园区权限，但尝试查看“全部”，则可能返回空或错误
        // Depending on desired behavior, could return empty or an error
        // For now, this won't add a DB filter, but implies broad access if parks exist
      }
      // No direct where.parkId filter here as factoryMaintenance lacks parkId
    } else if (
      userinfo.parks.map((park) => park.parkId).includes(parkIdToFilter)
    ) {
      // 用户有权限查看特定园区
      // No direct where.parkId filter here
    } else {
      return useResponseError('没有查看权限');
    }
  }

  // 厂房ID查询
  if (factoryId) {
    where.factoryId = Number(factoryId);
  }

  // 维护项目查询 (模糊查询)
  if (maintenanceItem) {
    where.maintenanceItem = {
      contains: maintenanceItem as string,
    };
  }

  // 维护状态查询 (精确匹配)
  if (maintenanceStatus) {
    where.maintenanceStatus = {
      equals: maintenanceStatus as string,
    };
  }

  // 负责人查询 (模糊查询)
  if (personInCharge) {
    where.personInCharge = {
      contains: personInCharge as string,
    };
  }

  // 时间范围查询 - 使用 queryStartTime 和 queryEndTime 作用于模型的 startTime 字段
  if (queryStartTime && queryEndTime) {
    where.startTime = {
      // Filters on the startTime field of the factoryMaintenance model
      gte: new Date(queryStartTime as string),
      lte: new Date(queryEndTime as string),
    };
  } else if (queryStartTime) {
    where.startTime = {
      gte: new Date(queryStartTime as string),
    };
  } else if (queryEndTime) {
    where.startTime = {
      // Or perhaps endTime field if filtering by task completion
      lte: new Date(queryEndTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  console.log('where', where);
  // 查询总记录数
  const total = await prismaClient.factoryMaintenance.count({
    // Changed to factoryMaintenance
    where,
  });

  // 查询分页数据
  const result = await prismaClient.factoryMaintenance.findMany({
    // Changed to factoryMaintenance
    where,
    orderBy: {
      startTime: 'desc', // Changed from checkTime to startTime, or consider createTime
    },
    skip: (page - 1) * size,
    take: size,
    include: {
      factory: {
        // factoryMaintenance has factoryId
        select: {
          factoryName: true,
          park: {
            // 新增：包含关联的园区信息
            select: {
              parkId: true, // 选择园区ID
              parkName: true, // 选择园区名称
            },
          },
        },
      },
    },
  });
  // console.log('result', result);

  const items = result.map((item) => {
    // 提取原始的 factory 对象，避免在展开 item 时意外地保留它
    const { factory: factoryObject, ...restOfItem } = item;
    return {
      ...restOfItem, // 展开 factoryMaintenance 模型的其余字段
      parkId: factoryObject?.park?.parkId || '', // 将园区ID赋值给 parkId 字段
      factory: factoryObject?.factoryName || '', // 将厂房名称赋值给 factory 字段
      park: factoryObject?.park?.parkName || '', // 将园区名称赋值给 park 字段
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});
