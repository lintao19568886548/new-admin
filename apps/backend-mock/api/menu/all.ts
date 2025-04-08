import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const menus = await prismaClient.menu.findMany({
    where: {
      pid: null, // 只查询顶级菜单（pid 为 null 的菜单）
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
    fieldsToRemove: ['menuId', 'metaId', 'type', 'status'],
    removeEmptyChildren: true,
  });

  return processedMenus;
});

// 处理菜单数据的通用函数 - 优化版本
const processMenuData = (
  obj,
  options?: {
    fieldsToRemove?: string[];
    removeEmptyChildren?: boolean;
    removeEmptyFields?: boolean;
  },
) => {
  // 使用函数内部的默认值设置，而不是参数默认值
  const defaultOptions = {
    removeEmptyFields: true,
    fieldsToRemove: [],
    removeEmptyChildren: true,
  };

  // 合并选项
  const mergedOptions = { ...defaultOptions, ...options };

  if (obj === null || typeof obj !== 'object') return obj;

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map((item) => processMenuData(item, mergedOptions));
  }

  // 复制对象以避免修改原对象
  const result = { ...obj };
  const { removeEmptyFields, fieldsToRemove, removeEmptyChildren } =
    mergedOptions;
  const fieldSet = new Set(fieldsToRemove);

  // 一次性处理所有属性
  const entries = Object.entries(result).filter(([key, value]) => {
    // 移除指定字段
    if (fieldSet.has(key)) return false;

    // 移除空值
    if (removeEmptyFields && (value === null || value === '')) return false;

    // 处理空children数组
    if (
      key === 'children' &&
      removeEmptyChildren &&
      Array.isArray(value) &&
      value.length === 0
    )
      return false;

    return true;
  });

  // 递归处理嵌套对象
  for (const [key, value] of entries) {
    if (typeof value === 'object' && value !== null) {
      result[key] = processMenuData(value, mergedOptions);
    }
  }

  // 重建对象

  return useResponseSuccess(
    Object.fromEntries(entries.map(([key]) => [key, result[key]])),
  );
};
