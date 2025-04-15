import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const { currentPage, pageSize } = getQuery(event);

  // 构建查询条件
  const where: any = {};

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
