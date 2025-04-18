import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { useResponseSuccess } from '~/utils/response';

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
    title,
    address,
    extinguisher,
    hydrant,
    fireExit,
    checker,
    startTime,
    endTime,
    currentPark,
    currentPage,
    pageSize,
  } = query;

  // 构建查询条件
  const where: any = {};

  // 区域查询
  if (currentPark) {
    if (Number(currentPark) === -1) {
      // 选择全部区域时,直接查询全部有权限的园区
      const parks = await prismaClient.park.findMany({
        where: {
          parkName: {
            in: userinfo.parks.map((park) => park.parkName),
          },
        },
        select: { parkId: true },
      });

      if (parks.length > 0) {
        where.parkId = {
          in: parks.map((park) => park.parkId),
        };
      }
    } else if (
      userinfo.parks.map((park) => park.parkId).includes(Number(currentPark))
    ) {
      // 当用户有权限查看特定园区时
      const park = await prismaClient.park.findFirst({
        where: { parkId: Number(currentPark) },
        select: { parkId: true },
      });

      if (park) {
        where.parkId = park.parkId;
      }
    } else {
      return useResponseError('没有查看权限');
    }
  }

  // 标题查询
  if (title) {
    where.title = {
      contains: title,
    };
  }

  // 地址查询
  if (address) {
    where.address = {
      contains: address,
    };
  }

  // 灭火器状态查询
  if (extinguisher) {
    where.extinguisher = {
      equals: extinguisher,
    };
  }

  // 消防栓状态查询
  if (hydrant) {
    where.hydrant = {
      equals: hydrant,
    };
  }

  // 安全出口状态查询
  if (fireExit) {
    where.fireExit = {
      equals: fireExit,
    };
  }

  // 检查人员查询
  if (checker) {
    where.checker = {
      contains: checker,
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

  console.log('where', where);
  // 查询总记录数
  const total = await prismaClient.firefighting.count({
    where,
  });

  // 查询分页数据
  const result = await prismaClient.firefighting.findMany({
    where,
    orderBy: {
      checkTime: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
  });
  console.log('result', result);

  return useResponseSuccess({
    items: result,
    total,
  });
});
