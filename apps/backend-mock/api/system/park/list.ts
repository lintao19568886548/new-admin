import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const { area, address, parkName, currentPage, pageSize } = getQuery(event);

  // 构建查询条件
  const where: any = {
    isDeleted: false,
  };

  // 修改查询条件，匹配前端表单字段
  if (parkName) {
    where.parkName = { contains: parkName };
  }

  if (address) {
    where.address = { contains: address };
  }

  // 处理总面积查询 - 支持等于和区间查询
  if (area) {
    const areaQuery = String(area).split(',');
    if (areaQuery[0] === 'equal' && areaQuery[1]) {
      const value = Number.parseFloat(areaQuery[1]);
      if (!Number.isNaN(value)) {
        where.area = { equals: value };
      }
    } else if (areaQuery[0] === 'between') {
      where.area = {};

      // 处理最小值
      if (areaQuery[1] && areaQuery[1] !== '') {
        const min = Number.parseFloat(areaQuery[1]);
        if (!Number.isNaN(min)) {
          where.area.gte = min; // 大于等于最小值
        }
      }

      // 处理最大值
      if (areaQuery[2] && areaQuery[2] !== '') {
        const max = Number.parseFloat(areaQuery[2]);
        if (!Number.isNaN(max)) {
          where.area.lte = max; // 小于等于最大值
        }
      }

      // 如果没有有效的查询条件，删除空的查询对象
      if (Object.keys(where.area).length === 0) {
        delete where.area;
      }
    }
  }

  // 查询总数
  const total = await prismaClient.park.count({ where });

  // 查询数据
  const result = await prismaClient.park.findMany({
    where,
    skip: (Number(currentPage) - 1) * Number(pageSize),
    take: Number(pageSize),
  });

  return useResponseSuccess({
    items: result,
    total,
  });
});
