import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 获取查询参数
  const query = getQuery(event);
  const { startTime, endTime, currentPage, pageSize } = query;

  // 构建查询条件
  const where: any = {
    username: {
      not: 'vben', // 排除用户名为 vben 的记录
    },
  };

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
