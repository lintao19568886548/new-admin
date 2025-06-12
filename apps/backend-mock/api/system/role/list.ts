import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const { page, pageSize, name, remark, startTime, endTime, status } =
    getQuery(event);

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

  // 构建递归包含查询
  const includeRecursive = {
    roleMenus: {
      where: { isDeleted: false },
      include: {
        menu: true,
      },
    },
    roleParks: {
      where: { isDeleted: false },
      include: {
        park: true,
      },
    },
    children: {
      include: {
        // 这里可以根据需要继续嵌套，定义需要递归查询的层级
        roleMenus: { where: { isDeleted: false }, include: { menu: true } },
        roleParks: { where: { isDeleted: false }, include: { park: true } },
        children: {
          include: {
            // 再嵌套一层示例
            roleMenus: { where: { isDeleted: false }, include: { menu: true } },
            roleParks: { where: { isDeleted: false }, include: { park: true } },
            // 如果需要更多层级，可以在这里继续添加 children
          },
          orderBy: {
            createTime: 'asc' as const, // 使用 'as const' 来满足 SortOrder 类型
          },
        },
      },
      orderBy: {
        createTime: 'asc' as const, // 使用 'as const' 来满足 SortOrder 类型
      },
    },
  };

  // 1. 如果有查询条件，则进行分页查询（不支持层级）
  if (Object.keys(where).length > 0 || (page && pageSize)) {
    const total = await prismaClient.role.count({ where });
    const roles = await prismaClient.role.findMany({
      where,
      include: {
        roleMenus: { where: { isDeleted: false }, include: { menu: true } },
        roleParks: { where: { isDeleted: false }, include: { park: true } },
        // 分页查询时不递归加载 children，避免数据量过大和逻辑复杂
        // 如果需要在过滤结果中展示父级，可以在前端处理或单独查询
        parent: true, // 可以包含父级信息供参考
      },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: {
        createTime: 'desc',
      },
    });

    // 格式化分页查询的数据
    const listData = roles.map((role) => ({
      roleId: role.roleId,
      name: role.name,
      remark: role.remark,
      status: role.status ? 1 : 0,
      createTime: role.createTime ? role.createTime.toISOString() : null,
      updateTime: role.updateTime ? role.updateTime.toISOString() : null,
      permissions: role.roleMenus.map((rm) => rm.menu.menuId),
      parkIds: role.roleParks.map((rp) => rp.park.parkId),
      level: role.privilegeLevel,
      parentid: role.parentid,
      // 分页时不返回 children 数组
    }));

    return useResponseSuccess({ items: listData, total });
  } else {
    // 2. 如果没有查询条件，则查询顶层角色并递归加载子角色
    const roles = await prismaClient.role.findMany({
      where: {
        parentid: null, // 只查询顶级角色
        ...where, // 应用基础过滤条件（虽然这里是else分支，理论上where是空的）
      },
      include: includeRecursive, // 使用递归包含查询
      orderBy: {
        createTime: 'asc', // 顶级角色排序
      },
    });

    // 递归格式化返回数据
    const formatRole = (role) => ({
      roleId: role.roleId,
      name: role.name,
      remark: role.remark,
      status: role.status ? 1 : 0,
      createTime: role.createTime ? role.createTime.toISOString() : null,
      updateTime: role.updateTime ? role.updateTime.toISOString() : null,
      permissions: role.roleMenus.map((rm) => rm.menu.menuId),
      parkIds: role.roleParks.map((rp) => rp.park.parkId),
      level: role.privilegeLevel,
      parentid: role.parentid,
      children: role.children
        ? role.children.map((child) => formatRole(child))
        : [], // 显式调用 formatRole
    });

    const listData = roles.map((role) => formatRole(role)); // 为单参数添加括号

    // 无分页查询时，total 通常可以认为是顶层角色的数量，或者不返回 total
    return useResponseSuccess({ items: listData, total: listData.length }); // 返回处理后的层级数据
  }
});
