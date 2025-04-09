export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const menus = await prismaClient.menu.findMany({
    where: {
      pid: null, // 只查询顶级菜单（pid 为 null 的菜单）
    },
    orderBy: {
      meta: {
        order: 'asc', // 根据排序字段进行升序排序
      },
    },
    include: {
      meta: true, // 包含菜单元数据
      children: {
        include: {
          meta: true, // 包含子菜单的元数据
          children: {
            include: {
              meta: true, // 如果需要更深层次的子菜单，可以继续嵌套
            },
          },
        },
      },
    },
  });

  // 一次性处理所有数据转换
  const processedMenus = processMenuData(menus, {
    removeEmptyFields: true,
    fieldsToRemove: [],
    removeEmptyChildren: true,
  });

  return useResponseSuccess(processedMenus);
});
