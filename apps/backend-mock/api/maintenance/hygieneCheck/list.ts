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
    // 适配 HygieneAssessment 模型字段
    checkItems,
    checker,
    checkResult,
    // checkDate
    startTime: queryStartTime,
    endTime: queryEndTime,
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

  // 检查项目查询 (模糊查询)
  if (checkItems) {
    where.checkItems = {
      // 修改点
      contains: checkItems as string,
    };
  }

  // 检查结果查询 (精确匹配)
  if (checkResult) {
    where.checkResult = {
      // 修改点
      equals: checkResult as string,
    };
  }

  // 检查人查询 (模糊查询)
  if (checker) {
    where.checker = {
      // 修改点
      contains: checker as string,
    };
  }

  // 检查日期范围查询 - 作用于 checkDate 字段
  if (queryStartTime && queryEndTime) {
    where.checkDate = {
      // 修改点
      gte: new Date(queryStartTime as string),
      lte: new Date(queryEndTime as string),
    };
  } else if (queryStartTime) {
    where.checkDate = {
      // 修改点
      gte: new Date(queryStartTime as string),
    };
  } else if (queryEndTime) {
    where.checkDate = {
      // 修改点
      lte: new Date(queryEndTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  console.log('where', where);
  // 查询总记录数
  const total = await prismaClient.hygieneCheck.count({
    // 修改点
    where,
  });

  // 查询分页数据
  const result = await prismaClient.hygieneCheck.findMany({
    // 修改点
    where,
    orderBy: {
      hygieneCheckId: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
    include: {
      factory: {
        select: {
          factoryName: true,
          park: {
            select: {
              parkId: true,
              parkName: true,
            },
          },
        },
      },
    },
  });

  const items = result.map((item) => {
    const { factory: factoryObject, ...restOfItem } = item;
    return {
      ...restOfItem,
      parkId: factoryObject?.park?.parkId || null, // 确保 parkId 存在
      factory: factoryObject?.factoryName || '',
      park: factoryObject?.park?.parkName || '',
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});
