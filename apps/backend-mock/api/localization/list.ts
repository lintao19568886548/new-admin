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
    return unAuthorizedResponse(event);
  }

  const { username, currentPage = 1, pageSize = 10 } = getQuery(event);

  const where: any = {};
  const roleNames = userinfo.roles ?? [];
  const isSuper = roleNames.includes('Super');

  if (username && typeof username === 'string' && username.trim().length > 0) {
    if (!isSuper && username.trim() !== userinfo.username) {
      return useResponseError('没有权限查看其他用户打卡记录');
    }
    where.username = isSuper
      ? { contains: username.trim() }
      : userinfo.username;
  } else {
    where.username = isSuper ? undefined : userinfo.username;
  }

  const page = Number(currentPage);
  const limit = Number(pageSize);

  if (where.username === undefined) {
    delete where.username;
  }

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
