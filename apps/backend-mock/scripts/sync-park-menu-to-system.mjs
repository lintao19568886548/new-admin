import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

class ParkMenuSyncError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParkMenuSyncError';
  }
}

function printHelp() {
  console.log(`同步园区管理菜单到系统管理

用法:
  pnpm -F @vben/backend-mock run menu:sync-park-to-system -- --customer-id=public
  pnpm -F @vben/backend-mock run menu:sync-park-to-system -- --customer-id=public --execute
  pnpm -F @vben/backend-mock run menu:sync-park-to-system -- --database-url=mysql://user:pass@host:3306/db --execute

参数:
  --customer-id=<id>    目标租户库，默认 public
  --database-url=<url>  直接指定目标数据库 URL，优先级高于 --customer-id
  --execute             执行写入；不传时只预览
  --help, -h            输出帮助

说明:
  - 把旧的 /rental/manage 菜单物理迁移为 /system/park，父级改到 /system。
  - 如果库里已经有 SystemPark，会更新它；旧 RentalManage 会隐藏，旧移动端入口会停用。
  - 会把已有 role_menu 旧菜单权限补到新菜单，避免原来能管理园区的角色丢入口。`);
}

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function normalizeCustomerId(value) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId)) {
    throw new ParkMenuSyncError(
      `customerId 不合法: ${customerId || '(empty)'}`,
    );
  }
  return customerId;
}

function parseArgs(argv) {
  const options = {
    customerId: 'public',
    databaseUrl: '',
    execute: false,
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new ParkMenuSyncError(`未知参数: ${arg}`);
    }
    const [, key, value] = match;
    if (key === 'customer-id') {
      options.customerId = normalizeCustomerId(value);
      continue;
    }
    if (key === 'database-url') {
      options.databaseUrl = stripWrappingQuotes(value);
      continue;
    }
    throw new ParkMenuSyncError(`未知参数: ${arg}`);
  }

  return options;
}

function requireEnv(name) {
  const value = stripWrappingQuotes(process.env[name]);
  if (!value) {
    throw new ParkMenuSyncError(`${name} 未配置`);
  }
  return value;
}

function parseDbUrl(rawUrl) {
  try {
    return new URL(stripWrappingQuotes(rawUrl));
  } catch {
    throw new ParkMenuSyncError(
      `数据库 URL 不合法: ${maskDatabaseUrl(rawUrl)}`,
    );
  }
}

function maskDatabaseUrl(rawUrl) {
  return String(rawUrl || '').replaceAll(
    /:\/\/([^:/?#]+):([^@/?#]+)@/g,
    '://$1:***@',
  );
}

function getDefaultCustomerId() {
  return normalizeCustomerId(process.env.DEFAULT_CUSTOMER_ID || 'default');
}

function resolveCustomerDbUrl(customerId) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  const defaultCustomerId = getDefaultCustomerId();
  const databaseUrl = requireEnv('DATABASE_URL');
  const publicDatabaseUrl = stripWrappingQuotes(
    process.env.PUBLIC_DATABASE_URL,
  );
  const template = stripWrappingQuotes(
    process.env.CUSTOMER_DATABASE_URL_TEMPLATE,
  );

  if (normalizedCustomerId === 'public') {
    if (!publicDatabaseUrl) {
      throw new ParkMenuSyncError(
        'PUBLIC_DATABASE_URL 未配置，无法解析 public',
      );
    }
    return publicDatabaseUrl;
  }

  if (normalizedCustomerId === defaultCustomerId) {
    return databaseUrl;
  }

  if (template) {
    if (!template.includes('{customerId}')) {
      throw new ParkMenuSyncError(
        'CUSTOMER_DATABASE_URL_TEMPLATE 必须包含 {customerId} 占位符',
      );
    }
    return template.replaceAll('{customerId}', normalizedCustomerId);
  }

  const url = parseDbUrl(databaseUrl);
  const prefix = process.env.CUSTOMER_DB_PREFIX || 'customer_';
  url.pathname = `/${prefix}${normalizedCustomerId}`;
  return url.toString();
}

function createConnectionConfig(rawUrl) {
  const url = parseDbUrl(rawUrl);
  return {
    acquireTimeout: 5000,
    connectTimeout: 5000,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
  };
}

async function openConnection(rawUrl) {
  return mariadb.createConnection(createConnectionConfig(rawUrl));
}

function toPlainRow(row) {
  if (!row) return null;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'bigint' ? Number(value) : value,
    ]),
  );
}

async function findOne(connection, sql, params = []) {
  const rows = await connection.query(sql, params);
  return toPlainRow(rows[0]);
}

async function findMenu(connection, whereSql, params = []) {
  return findOne(
    connection,
    `
      SELECT
        menu_id AS menuId,
        name,
        path,
        component,
        pid,
        auth_code AS authCode,
        type,
        status
      FROM menu
      WHERE ${whereSql}
      ORDER BY menu_id ASC
      LIMIT 1
    `,
    params,
  );
}

async function findSystemMenu(connection) {
  return findMenu(connection, "name = 'System' OR path = '/system'");
}

async function findSystemParkMenu(connection) {
  return findMenu(
    connection,
    "name = 'SystemPark' OR TRIM(TRAILING '/' FROM path) = '/system/park'",
  );
}

async function findLegacyParkMenu(connection) {
  return findMenu(
    connection,
    `
      name = 'RentalManage'
      OR TRIM(TRAILING '/' FROM path) = '/rental/manage'
      OR TRIM(TRAILING '/' FROM component) = '/rental/manage/list'
    `,
  );
}

async function findLegacyParkMobileMenu(connection) {
  return findMenu(
    connection,
    `
      COALESCE(status, 1) <> 0
      AND (
        name = 'RentalManageMobile'
        OR TRIM(TRAILING '/' FROM path) = '/rental/manage/mobile'
        OR TRIM(TRAILING '/' FROM component) = '/rental/manage/mobile'
      )
    `,
  );
}

async function ensureMenuMeta(connection, menuId, meta) {
  const existing = await findOne(
    connection,
    'SELECT meta_id AS metaId FROM menu_meta WHERE menu_id = ? LIMIT 1',
    [menuId],
  );

  if (existing) {
    await connection.query(
      `
        UPDATE menu_meta
        SET title = ?, icon = ?, \`order\` = ?, hide_in_menu = ?
        WHERE menu_id = ?
      `,
      [meta.title, meta.icon, meta.order, meta.hideInMenu, menuId],
    );
    return;
  }

  await connection.query(
    `
      INSERT INTO menu_meta (title, icon, \`order\`, hide_in_menu, menu_id)
      VALUES (?, ?, ?, ?, ?)
    `,
    [meta.title, meta.icon, meta.order, meta.hideInMenu, menuId],
  );
}

async function ensureSystemMenu(connection) {
  const existing = await findSystemMenu(connection);
  if (existing) return existing;

  const result = await connection.query(
    `
      INSERT INTO menu (name, type, status, path, component, pid, auth_code)
      VALUES ('System', 'catalog', 1, '/system', NULL, NULL, NULL)
    `,
  );
  const menuId = Number(result.insertId);
  await ensureMenuMeta(connection, menuId, {
    hideInMenu: false,
    icon: 'ion:settings-outline',
    order: 9997,
    title: '系统管理',
  });
  return { menuId, name: 'System', path: '/system' };
}

async function insertSystemParkMenu(connection, systemMenuId) {
  const result = await connection.query(
    `
      INSERT INTO menu (name, type, status, path, component, pid, auth_code)
      VALUES ('SystemPark', 'menu', 1, '/system/park', '/system/park/list', ?, 'system:park')
    `,
    [systemMenuId],
  );
  const menuId = Number(result.insertId);
  await ensureMenuMeta(connection, menuId, {
    hideInMenu: false,
    icon: 'mdi:office-building-cog-outline',
    order: 25,
    title: '园区管理',
  });
  return menuId;
}

async function updateSystemParkMenu(connection, menuId, systemMenuId) {
  await connection.query(
    `
      UPDATE menu
      SET
        name = 'SystemPark',
        type = 'menu',
        status = 1,
        path = '/system/park',
        component = '/system/park/list',
        pid = ?,
        auth_code = 'system:park',
        template_key = 'menu:system-park',
        template_parent_key = 'menu:system'
      WHERE menu_id = ?
    `,
    [systemMenuId, menuId],
  );
  await ensureMenuMeta(connection, menuId, {
    hideInMenu: false,
    icon: 'mdi:office-building-cog-outline',
    order: 25,
    title: '园区管理',
  });
}

async function hideLegacyMenu(connection, menu) {
  if (!menu) return;

  await connection.query(
    `
      UPDATE menu
      SET
        name = ?,
        path = ?,
        component = ?,
        auth_code = ?,
        status = 1
      WHERE menu_id = ?
    `,
    [
      menu.name || 'RentalManage',
      menu.path || '/rental/manage',
      menu.component || '/rental/manage/list',
      menu.authCode || 'rental:manage',
      menu.menuId,
    ],
  );
  await ensureMenuMeta(connection, menu.menuId, {
    hideInMenu: true,
    icon: 'mdi:clipboard-list',
    order: 999,
    title: '园区管理',
  });
}

async function ensureHiddenMobileCompatibilityMenu(connection) {
  const menu = await findLegacyParkMobileMenu(connection);
  if (!menu) return null;

  await connection.query(
    `
      UPDATE menu
      SET
        status = 0,
        auth_code = COALESCE(auth_code, 'rental:manage-mobile')
      WHERE menu_id = ?
    `,
    [menu.menuId],
  );
  await ensureMenuMeta(connection, menu.menuId, {
    hideInMenu: true,
    icon: 'mdi:cellphone-cog',
    order: 999,
    title: '园区管理',
  });
  return menu.menuId;
}

async function ensureRoleMenuBinding(connection, roleId, menuId) {
  const existing = await findOne(
    connection,
    `
      SELECT id, is_deleted AS isDeleted
      FROM role_menu
      WHERE role_id = ? AND menu_id = ?
      LIMIT 1
    `,
    [roleId, menuId],
  );

  if (existing) {
    if (Number(existing.isDeleted) !== 0) {
      await connection.query(
        'UPDATE role_menu SET is_deleted = 0 WHERE id = ?',
        [existing.id],
      );
      return 1;
    }
    return 0;
  }

  await connection.query(
    'INSERT INTO role_menu (role_id, menu_id, is_deleted) VALUES (?, ?, 0)',
    [roleId, menuId],
  );
  return 1;
}

async function syncRoleMenuBindings(connection, fromMenuId, toMenuId) {
  if (!fromMenuId || !toMenuId || fromMenuId === toMenuId) {
    return { created: 0, sourceRoles: 0 };
  }

  const sourceRows = await connection.query(
    `
      SELECT DISTINCT role_id AS roleId
      FROM role_menu
      WHERE menu_id = ? AND is_deleted = 0
    `,
    [fromMenuId],
  );
  const roleIds = sourceRows.map((row) => Number(row.roleId)).filter(Boolean);
  if (roleIds.length === 0) {
    return { created: 0, sourceRoles: 0 };
  }

  let changed = 0;
  for (const roleId of roleIds) {
    changed += await ensureRoleMenuBinding(connection, roleId, toMenuId);
  }

  return { changed, sourceRoles: roleIds.length };
}

async function syncParentMenuBindings(connection, childMenuId, parentMenuId) {
  if (!childMenuId || !parentMenuId || childMenuId === parentMenuId) {
    return { changed: 0, sourceRoles: 0 };
  }

  const sourceRows = await connection.query(
    `
      SELECT DISTINCT role_id AS roleId
      FROM role_menu
      WHERE menu_id = ? AND is_deleted = 0
    `,
    [childMenuId],
  );
  const roleIds = sourceRows.map((row) => Number(row.roleId)).filter(Boolean);
  let changed = 0;

  for (const roleId of roleIds) {
    changed += await ensureRoleMenuBinding(connection, roleId, parentMenuId);
  }

  return { changed, sourceRoles: roleIds.length };
}

async function buildPlan(connection) {
  const systemMenu = await findSystemMenu(connection);
  const systemParkMenu = await findSystemParkMenu(connection);
  const legacyParkMenu = await findLegacyParkMenu(connection);
  const legacyParkMobileMenu = await findLegacyParkMobileMenu(connection);
  let parkMenuAction = 'create_system_park_menu';

  if (systemParkMenu) {
    parkMenuAction = 'update_existing_system_park_menu';
  } else if (legacyParkMenu) {
    parkMenuAction = 'migrate_legacy_park_menu_to_system';
  }

  return {
    actions: [
      systemMenu ? 'use_existing_system_menu' : 'create_system_menu',
      parkMenuAction,
      legacyParkMenu &&
      (!systemParkMenu || legacyParkMenu.menuId !== systemParkMenu.menuId)
        ? 'hide_legacy_park_menu'
        : null,
      legacyParkMobileMenu ? 'hide_legacy_mobile_menu' : null,
      legacyParkMenu && systemParkMenu
        ? 'copy_role_permissions_to_system_park'
        : null,
      'ensure_system_parent_permission_for_park_roles',
    ].filter(Boolean),
    legacyParkMenu,
    legacyParkMobileMenu,
    systemMenu,
    systemParkMenu,
  };
}

async function applyPlan(connection) {
  await connection.beginTransaction();
  try {
    const systemMenu = await ensureSystemMenu(connection);
    const legacyParkMenu = await findLegacyParkMenu(connection);
    const systemParkMenu = await findSystemParkMenu(connection);
    let systemParkMenuId;

    if (systemParkMenu) {
      systemParkMenuId = systemParkMenu.menuId;
      await updateSystemParkMenu(
        connection,
        systemParkMenuId,
        systemMenu.menuId,
      );
    } else if (legacyParkMenu) {
      systemParkMenuId = legacyParkMenu.menuId;
      await updateSystemParkMenu(
        connection,
        systemParkMenuId,
        systemMenu.menuId,
      );
    } else {
      systemParkMenuId = await insertSystemParkMenu(
        connection,
        systemMenu.menuId,
      );
    }

    const refreshedLegacyMenu = await findLegacyParkMenu(connection);
    if (
      refreshedLegacyMenu &&
      refreshedLegacyMenu.menuId !== systemParkMenuId
    ) {
      await hideLegacyMenu(connection, refreshedLegacyMenu);
    }

    const roleMenuSync = await syncRoleMenuBindings(
      connection,
      refreshedLegacyMenu?.menuId,
      systemParkMenuId,
    );
    const parentMenuSync = await syncParentMenuBindings(
      connection,
      systemParkMenuId,
      systemMenu.menuId,
    );
    const hiddenMobileMenuId =
      await ensureHiddenMobileCompatibilityMenu(connection);

    await connection.commit();
    return {
      hiddenMobileMenuId,
      parentMenuSync,
      roleMenuSync,
      systemMenuId: systemMenu.menuId,
      systemParkMenuId,
    };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  }
}

async function main() {
  const argv = normalizeArgv(process.argv.slice(2));
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  const databaseUrl =
    options.databaseUrl || resolveCustomerDbUrl(options.customerId);
  const connection = await openConnection(databaseUrl);

  try {
    const plan = await buildPlan(connection);
    console.log(
      JSON.stringify(
        {
          customerId: options.customerId,
          databaseUrl: maskDatabaseUrl(databaseUrl),
          execute: options.execute,
          plan,
          preview: !options.execute,
        },
        null,
        2,
      ),
    );

    if (!options.execute) {
      console.log('预览模式，未写入。确认无误后追加 --execute 执行。');
      return;
    }

    const result = await applyPlan(connection);
    console.log(
      JSON.stringify(
        {
          execute: true,
          message: '园区管理菜单已同步到系统管理',
          result,
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(
    '[menu:sync-park-to-system] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
