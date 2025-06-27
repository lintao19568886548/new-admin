import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const username = userinfo.username;
  const roleNames = userinfo.roles;
  const isAdvancedPermission = ['Super', '董事长', '总经理'].some((role) =>
    roleNames.includes(role),
  );

  // 获取查询参数
  const query = getQuery(event);
  const { startTime, endTime, currentPage, pageSize } = query;

  // 构建查询条件
  const where: any = {};

  if (isAdvancedPermission) {
    // 高级权限用户可以查看所有记录（排除vben用户）
    where.username = {
      notIn: ['vben', ''],
    };
  } else {
    // 普通用户查看自己所属角色及其嵌套子角色的记录

    // 获取当前用户的角色ID列表
    const userRoles = await prismaClient.userRole.findMany({
      where: {
        user: {
          username,
        },
      },
      select: {
        roleId: true,
      },
    });

    const userRoleIds = userRoles.map((ur) => ur.roleId);

    // 递归获取所有子角色ID的函数
    const getAllChildRoleIds = async (roleIds: number[]): Promise<number[]> => {
      if (roleIds.length === 0) return [];

      const childRoles = await prismaClient.role.findMany({
        where: {
          parentId: {
            in: roleIds,
          },
        },
        select: {
          roleId: true,
        },
      });

      const childRoleIds = childRoles.map((r) => r.roleId);

      if (childRoleIds.length === 0) {
        return roleIds;
      }

      // 递归获取子角色的子角色
      const grandChildRoleIds = await getAllChildRoleIds(childRoleIds);
      return [...roleIds, ...grandChildRoleIds];
    };

    // 获取用户角色及其所有子角色的ID
    const allRoleIds = await getAllChildRoleIds(userRoleIds);

    // 查询这些角色对应的用户名
    const usersInRoles = await prismaClient.user.findMany({
      where: {
        roles: {
          some: {
            roleId: {
              in: allRoleIds,
            },
          },
        },
      },
      select: {
        username: true,
      },
    });

    const allowedUsernames = usersInRoles.map((u) => u.username);

    // 设置查询条件：只能查看这些用户的记录
    where.username = {
      in: allowedUsernames,
    };
  }

  // 请求时间范围查询
  if (startTime && endTime) {
    where.requestTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  // 计算分页参数
  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  // 查询总记录数
  const total = await prismaClient.apiLog.count({
    where,
  });

  // 查询分页数据
  const items = await prismaClient.apiLog.findMany({
    where,
    orderBy: {
      requestTime: 'desc',
    },
    skip: (page - 1) * size,
    take: size,
  });

  // 获取所有菜单项，用于后续匹配
  const menus = await prismaClient.menu.findMany({
    select: {
      menuId: true,
      name: true,
      path: true,
      meta: {
        select: {
          title: true,
        },
      },
    },
  });

  // 为每个项添加moduleName和moduleNameCN字段
  const enhancedItems = items.map((item) => {
    // 查找匹配的菜单项
    const matchedMenu = menus.find((menu) => {
      // 检查refererPath是否等于menu的path值
      return item.refererPath && item.refererPath === menu.path;
    });

    // 返回带有moduleName和moduleNameCN的项
    return {
      ...item,
      moduleName: matchedMenu ? matchedMenu.name : '未知模块',
      moduleNameCN:
        matchedMenu && matchedMenu.meta ? matchedMenu.meta.title : '未知模块',
    };
  });

  console.log('enhancedItems', enhancedItems);

  return useResponseSuccess({
    items: enhancedItems,
    total,
  });
});
