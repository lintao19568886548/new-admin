import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const { id, path } = getQuery(event);
  // 检查路径是否已存在
  // 如果提供了id，则排除该id的记录（用于编辑时检查）
  if (path) {
    const whereCondition: any = {
      path: path as string,
    };

    // 如果提供了id，排除该id的记录
    if (id) {
      whereCondition.menuId = {
        not: Number(id),
      };
    }

    const data = await prismaClient.menu.findFirst({
      where: whereCondition,
    });

    // 如果找到记录，说明名称已存在
    return useResponseSuccess(!!data);
  }

  return useResponseSuccess(false);
});
