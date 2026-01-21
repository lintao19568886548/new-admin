import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

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
  if (currentPark !== undefined) {
    const authorizedParkIds = (userinfo.parks || []).map((park) =>
      Number(park.parkId),
    );
    if (authorizedParkIds.length === 0) {
      return useResponseSuccess({ items: [], total: 0 });
    }

    const parkIdToFilter = Number(currentPark);
    if (parkIdToFilter === -1) {
      where.parkId = { in: authorizedParkIds };
    } else if (authorizedParkIds.includes(parkIdToFilter)) {
      where.parkId = parkIdToFilter;
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
        },
      },
      park: {
        select: {
          parkId: true,
          parkName: true,
        },
      },
    },
  });

  const items = result.map((item) => {
    const { factory: factoryObject, park: parkObject, ...restOfItem } = item;
    return {
      ...restOfItem,
      factory: factoryObject?.factoryName || '',
      park: parkObject?.parkName || '',
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});
