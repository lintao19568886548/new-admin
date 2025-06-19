import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const { username, currentPage = 1, pageSize = 10 } = getQuery(event);

  const where: any = {};
  if (username) {
    where.username = {
      contains: username as string,
    };
  }

  const page = Number(currentPage);
  const limit = Number(pageSize);

  const total = await prismaClient.localization.count({ where });
  const list = await prismaClient.localization.findMany({
    where,
    orderBy: {
      punchTime: 'desc',
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  return useResponseSuccess(
    {
      items: list,
      total,
    },
    '获取打卡记录列表成功',
  );
});
