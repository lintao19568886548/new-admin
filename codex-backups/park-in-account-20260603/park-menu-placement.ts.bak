type MenuRecord = Record<string, any>;

const LEGACY_PARK_MENU_PATH = '/rental/manage';
const LEGACY_PARK_MOBILE_PATH = '/rental/manage/mobile';
const SYSTEM_MENU_PATH = '/system';
const SYSTEM_PARK_MENU_PATH = '/system/park';
const SYSTEM_PARK_MOBILE_PATH = '/system/park/mobile';

const SYSTEM_MENU_FALLBACK = {
  component: undefined,
  meta: {
    icon: 'ion:settings-outline',
    order: 9997,
    title: '系统管理',
  },
  name: 'System',
  path: SYSTEM_MENU_PATH,
  type: 'catalog',
};

const SYSTEM_PARK_MENU_FALLBACK = {
  authCode: 'system:park',
  component: '/system/park/list',
  meta: {
    icon: 'mdi:office-building-cog-outline',
    order: 25,
    title: '园区管理',
  },
  name: 'SystemPark',
  path: SYSTEM_PARK_MENU_PATH,
  type: 'menu',
};

const SYSTEM_PARK_MOBILE_MENU_FALLBACK = {
  authCode: 'system:park-mobile',
  component: '/rental/manage/mobile',
  meta: {
    hideInMenu: true,
    icon: 'mdi:cellphone-cog',
    title: '园区管理',
  },
  name: 'SystemParkMobile',
  path: SYSTEM_PARK_MOBILE_PATH,
  type: 'menu',
};

const LEGACY_PARK_MENU_FALLBACK = {
  authCode: 'rental:manage',
  component: '/rental/manage/list',
  meta: {
    hideInMenu: true,
    icon: 'mdi:clipboard-list',
    title: '园区管理',
  },
  name: 'RentalManage',
  path: LEGACY_PARK_MENU_PATH,
  type: 'menu',
};

const LEGACY_PARK_MOBILE_MENU_FALLBACK = {
  authCode: 'rental:manage-mobile',
  component: '/rental/manage/mobile',
  meta: {
    hideInMenu: true,
    icon: 'mdi:cellphone-cog',
    title: '园区管理',
  },
  name: 'RentalManageMobile',
  path: LEGACY_PARK_MOBILE_PATH,
  type: 'menu',
};

type NormalizeParkMenuOptions = {
  ensureParkWhenMissing?: boolean;
  includeCompatibilityRoutes?: boolean;
  includeMobileRoute?: boolean;
  preferLegacyMenu?: boolean;
};

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    ) as T;
  }
  return value;
}

function normalizeRoutePath(value: unknown) {
  const path = String(value || '').trim();
  if (!path || path === '/') {
    return path || '';
  }
  return path.replace(/\/+$/, '') || '/';
}

function isSamePath(menu: MenuRecord, path: string) {
  return normalizeRoutePath(menu.path) === path;
}

function isSystemMenu(menu: MenuRecord) {
  return menu.name === 'System' || isSamePath(menu, SYSTEM_MENU_PATH);
}

function isSystemParkMenu(menu: MenuRecord) {
  return menu.name === 'SystemPark' || isSamePath(menu, SYSTEM_PARK_MENU_PATH);
}

function isLegacyParkMenu(menu: MenuRecord) {
  return (
    menu.name === 'RentalManage' ||
    isSamePath(menu, LEGACY_PARK_MENU_PATH) ||
    normalizeRoutePath(menu.component) === '/rental/manage/list'
  );
}

function isLegacyParkMobileMenu(menu: MenuRecord) {
  return (
    menu.name === 'RentalManageMobile' ||
    isSamePath(menu, LEGACY_PARK_MOBILE_PATH) ||
    normalizeRoutePath(menu.component) === '/rental/manage/mobile'
  );
}

function shouldRemoveParkMenu(menu: MenuRecord) {
  return (
    isSystemParkMenu(menu) ||
    isLegacyParkMenu(menu) ||
    isLegacyParkMobileMenu(menu)
  );
}

function findFirstMenu(
  menus: MenuRecord[],
  predicate: (menu: MenuRecord) => boolean,
): MenuRecord | undefined {
  const queue = [...menus];
  while (queue.length > 0) {
    const menu = queue.shift();
    if (!menu) continue;
    if (predicate(menu)) return menu;
    if (Array.isArray(menu.children)) {
      queue.push(...menu.children);
    }
  }
  return undefined;
}

function removeMenus(
  menus: MenuRecord[],
  predicate: (menu: MenuRecord) => boolean,
) {
  return menus
    .filter((menu) => !predicate(menu))
    .map((menu) => {
      if (!Array.isArray(menu.children)) {
        return menu;
      }
      const children = removeMenus(menu.children, predicate);
      return {
        ...menu,
        ...(children.length > 0 ? { children } : {}),
      };
    });
}

function ensureChildren(menu: MenuRecord) {
  if (!Array.isArray(menu.children)) {
    menu.children = [];
  }
  return menu.children as MenuRecord[];
}

function sortChildren(menu: MenuRecord) {
  if (!Array.isArray(menu.children)) return;
  menu.children.sort(
    (left, right) => (left.meta?.order ?? 999) - (right.meta?.order ?? 999),
  );
  menu.children.forEach((child) => sortChildren(child));
}

function upsertChild(parent: MenuRecord, child: MenuRecord) {
  const children = ensureChildren(parent);
  const nextPath = normalizeRoutePath(child.path);
  const nextName = child.name;
  const filteredChildren = children.filter(
    (item) =>
      normalizeRoutePath(item.path) !== nextPath &&
      (!nextName || item.name !== nextName),
  );
  filteredChildren.push(child);
  parent.children = filteredChildren;
  sortChildren(parent);
}

function toSystemParkMenu(source?: MenuRecord) {
  const base = cloneValue((source || SYSTEM_PARK_MENU_FALLBACK) as MenuRecord);
  delete base.children;
  return {
    ...base,
    authCode: base.authCode || SYSTEM_PARK_MENU_FALLBACK.authCode,
    component: SYSTEM_PARK_MENU_FALLBACK.component,
    meta: {
      ...base.meta,
      hideInMenu: false,
      icon: base.meta?.icon || SYSTEM_PARK_MENU_FALLBACK.meta.icon,
      order: base.meta?.order ?? SYSTEM_PARK_MENU_FALLBACK.meta.order,
      title: SYSTEM_PARK_MENU_FALLBACK.meta.title,
    },
    name: SYSTEM_PARK_MENU_FALLBACK.name,
    path: SYSTEM_PARK_MENU_FALLBACK.path,
    type: 'menu',
  };
}

function toSystemParkMobileMenu(source?: MenuRecord) {
  const base = cloneValue(
    (source || SYSTEM_PARK_MOBILE_MENU_FALLBACK) as MenuRecord,
  );
  delete base.children;
  return {
    ...base,
    authCode: base.authCode || SYSTEM_PARK_MOBILE_MENU_FALLBACK.authCode,
    component: SYSTEM_PARK_MOBILE_MENU_FALLBACK.component,
    meta: {
      ...base.meta,
      hideInMenu: true,
      icon: base.meta?.icon || SYSTEM_PARK_MOBILE_MENU_FALLBACK.meta.icon,
      title: SYSTEM_PARK_MOBILE_MENU_FALLBACK.meta.title,
    },
    name: SYSTEM_PARK_MOBILE_MENU_FALLBACK.name,
    path: SYSTEM_PARK_MOBILE_MENU_FALLBACK.path,
    type: 'menu',
  };
}

function toHiddenLegacyParkMenu(source?: MenuRecord) {
  const base = cloneValue((source || LEGACY_PARK_MENU_FALLBACK) as MenuRecord);
  delete base.children;
  return {
    ...base,
    authCode: base.authCode || LEGACY_PARK_MENU_FALLBACK.authCode,
    component: LEGACY_PARK_MENU_FALLBACK.component,
    meta: {
      ...base.meta,
      hideInMenu: true,
      icon: base.meta?.icon || LEGACY_PARK_MENU_FALLBACK.meta.icon,
      title: LEGACY_PARK_MENU_FALLBACK.meta.title,
    },
    name: LEGACY_PARK_MENU_FALLBACK.name,
    path: LEGACY_PARK_MENU_FALLBACK.path,
    type: 'menu',
  };
}

function toHiddenLegacyParkMobileMenu(source?: MenuRecord) {
  const base = cloneValue(
    (source || LEGACY_PARK_MOBILE_MENU_FALLBACK) as MenuRecord,
  );
  delete base.children;
  return {
    ...base,
    authCode: base.authCode || LEGACY_PARK_MOBILE_MENU_FALLBACK.authCode,
    component: LEGACY_PARK_MOBILE_MENU_FALLBACK.component,
    meta: {
      ...base.meta,
      hideInMenu: true,
      icon: base.meta?.icon || LEGACY_PARK_MOBILE_MENU_FALLBACK.meta.icon,
      title: LEGACY_PARK_MOBILE_MENU_FALLBACK.meta.title,
    },
    name: LEGACY_PARK_MOBILE_MENU_FALLBACK.name,
    path: LEGACY_PARK_MOBILE_MENU_FALLBACK.path,
    type: 'menu',
  };
}

function appendTopLevelRoute(menus: MenuRecord[], route: MenuRecord) {
  const nextPath = normalizeRoutePath(route.path);
  const exists = Boolean(
    findFirstMenu(
      menus,
      (menu) =>
        normalizeRoutePath(menu.path) === nextPath || menu.name === route.name,
    ),
  );
  if (!exists) {
    menus.push(route);
  }
}

export function normalizeParkManagementMenuPlacement(
  menus: MenuRecord[],
  options: NormalizeParkMenuOptions = {},
) {
  const clonedMenus = cloneValue(menus);
  const legacyParkMenu = findFirstMenu(clonedMenus, isLegacyParkMenu);
  const systemParkMenu = findFirstMenu(clonedMenus, isSystemParkMenu);
  const sourceMenu =
    options.preferLegacyMenu && legacyParkMenu
      ? legacyParkMenu
      : systemParkMenu || legacyParkMenu;

  if (!sourceMenu && !options.ensureParkWhenMissing) {
    return clonedMenus;
  }

  const normalizedMenus = removeMenus(clonedMenus, shouldRemoveParkMenu);
  const systemMenu =
    findFirstMenu(normalizedMenus, isSystemMenu) ||
    cloneValue(SYSTEM_MENU_FALLBACK);
  const hasSystemMenu = Boolean(findFirstMenu(normalizedMenus, isSystemMenu));
  const parkMenu = toSystemParkMenu(sourceMenu);

  if (!hasSystemMenu) {
    normalizedMenus.push(systemMenu);
  }
  upsertChild(systemMenu, parkMenu);

  if (options.includeMobileRoute) {
    upsertChild(systemMenu, toSystemParkMobileMenu());
  }

  if (options.includeCompatibilityRoutes) {
    appendTopLevelRoute(
      normalizedMenus,
      toHiddenLegacyParkMenu(legacyParkMenu),
    );
    appendTopLevelRoute(normalizedMenus, toHiddenLegacyParkMobileMenu());
  }

  normalizedMenus.sort(
    (left, right) => (left.meta?.order ?? 999) - (right.meta?.order ?? 999),
  );
  normalizedMenus.forEach((menu) => sortChildren(menu));

  return normalizedMenus;
}

export const PARK_MENU_PATHS = {
  legacyParkMenuPath: LEGACY_PARK_MENU_PATH,
  legacyParkMobilePath: LEGACY_PARK_MOBILE_PATH,
  systemParkMenuPath: SYSTEM_PARK_MENU_PATH,
  systemParkMobilePath: SYSTEM_PARK_MOBILE_PATH,
};
