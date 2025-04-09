import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const {
    page = 1,
    pageSize = 20,
    name,
    remark,
    startTime,
    endTime,
    status,
  } = getQuery(event);

  // 构建查询条件
  const where: any = {};

  if (name) {
    where.name = {
      contains: String(name),
    };
  }

  if (remark) {
    where.remark = {
      contains: String(remark),
    };
  }

  if (startTime) {
    where.createTime = {
      ...where.createTime,
      gte: new Date(String(startTime)),
    };
  }

  if (endTime) {
    where.createTime = {
      ...where.createTime,
      lte: new Date(String(endTime)),
    };
  }

  if (['0', '1', 'false', 'true'].includes(status as string)) {
    where.status = ['1', 'true'].includes(status as string);
  }

  // 查询总数
  const total = await prismaClient.role.count({ where });

  // 查询角色列表及其关联的菜单
  const roles = await prismaClient.role.findMany({
    where,
    include: {
      roleMenus: {
        include: {
          menu: true,
        },
      },
    },
    skip: (Number(page) - 1) * Number(pageSize),
    take: Number(pageSize),
    orderBy: {
      createTime: 'desc',
    },
  });

  // 格式化返回数据
  const listData = roles.map((role) => {
    return {
      roleId: role.roleId,
      name: role.name,
      remark: role.remark,
      status: role.status ? 1 : 0,
      createTime: role.createTime ? role.createTime.toISOString() : null,
      updateTime: role.updateTime ? role.updateTime.toISOString() : null,
      // 提取关联的菜单ID
      permissions: role.roleMenus.map((rm) => rm.menu.menuId),
    };
  });

  return useResponseSuccess({
    items: listData,
    total,
  });
});
