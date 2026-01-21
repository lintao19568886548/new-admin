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
    transformerName,
    address,
    checker,
    status,
    specifications,
    startTime,
    endTime,
    currentPark,
    currentPage,
    pageSize,
  } = query;

  // 构建查询条件
  const where: any = {};

  // 标题查询
  if (transformerName) {
    where.transformerName = {
      contains: transformerName,
    };
  }

  // 区域查询
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

  // 地址查询
  if (address) {
    where.address = {
      contains: address,
    };
  }

  // 检查人查询
  if (checker) {
    where.checker = {
      contains: checker,
    };
  }

  // 状态查询
  if (status) {
    where.status = {
      equals: status,
    };
  }

  // 规格查询
  if (specifications) {
    where.specifications = {
      contains: specifications,
    };
  }

  // 时间范围查询 - 使用startTime和endTime
  if (startTime && endTime) {
    where.checkTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  // 查询总记录数
  const total = await prismaClient.transformer.count({
    where,
  });

  // 查询分页数据
  const result = await prismaClient.transformer.findMany({
    where,
    orderBy: {
      checkTime: 'desc',
    },
    include: {
      factory: {
        select: {
          factoryName: true,
        },
      },
      park: {
        select: {
          parkName: true,
        },
      },
    },
    skip: (page - 1) * size,
    take: size,
    // 只选择需要的字段，减少数据传输量
  });

  const items = result.map((item) => {
    return {
      ...item,
      factoryName: item.factory?.factoryName || '',
      park: item.park?.parkName || '',
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});
