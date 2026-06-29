import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

class AgentWorkbenchMenuError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AgentWorkbenchMenuError';
  }
}

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

function printHelp() {
  console.log(`配置 Agent 工作台菜单

用法:
  pnpm -F @vben/backend-mock run menu:agent-workbench -- --customer-id=public
  pnpm -F @vben/backend-mock run menu:agent-workbench -- --customer-id=public --scope=local --execute
  pnpm -F @vben/backend-mock run menu:agent-workbench -- --customer-id=public --scope=online --execute
  pnpm -F @vben/backend-mock run menu:agent-workbench -- --database-url=mysql://user:pass@host:3306/db --scope=local --execute

参数:
  --customer-id=<id>     目标租户库，默认 public
  --database-url=<url>   直接指定目标数据库 URL，优先级高于 customer-id
  --scope=<local|online> local 显示本地菜单；online 保留数据但隐藏，默认 local
  --execute              执行写入；不传时只预览
  --help, -h             输出帮助

效果:
  - 确保总台 /dashboard 存在。
  - local 模式确保 AI工具集 /tools 作为总台下的目录，排序第二并可见。
  - online 模式确保 AI工具集数据存在但 hide_in_menu=1，线上左侧菜单保持隐藏。
  - 将 /tools/agent-workbench 配成 Agent工作台，挂在 AI工具集下面。
  - 将原 /tools 页面迁移为 /tools/webtools，作为 AI工具导航子菜单。
  - 补齐任务中心、任务详情、Skill中心、模型配置菜单。
  - 已有 role_menu 权限会尽量保留并补齐父级目录权限。`);
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

function requireEnv(name) {
  const value = stripWrappingQuotes(process.env[name]);
  if (!value) {
    throw new AgentWorkbenchMenuError(`${name} 未配置`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    customerId: 'public',
    databaseUrl: '',
    execute: false,
    scope: 'local',
  };

  for (const arg of normalizeArgv(argv)) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new AgentWorkbenchMenuError(`未知参数: ${arg}`);
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
    if (key === 'scope') {
      options.scope = normalizeScope(value);
      continue;
    }
    throw new AgentWorkbenchMenuError(`未知参数: ${arg}`);
  }

  return options;
}

function normalizeScope(value) {
  const scope = String(value || '')
    .trim()
    .toLowerCase();
  if (scope === 'local' || scope === 'online') {
    return scope;
  }
  throw new AgentWorkbenchMenuError(
    `scope 不合法: ${scope || '(empty)'}，只能是 local 或 online`,
  );
}

function parseDbUrl(rawUrl) {
  try {
    return new URL(stripWrappingQuotes(rawUrl));
  } catch {
    throw new AgentWorkbenchMenuError(
      `数据库 URL 不合法: ${maskDatabaseUrl(rawUrl)}`,
    );
  }
}

function normalizeCustomerId(value) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId)) {
    throw new AgentWorkbenchMenuError(
      `customerId 不合法: ${customerId || '(empty)'}`,
    );
  }
  return customerId;
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
      throw new AgentWorkbenchMenuError(
        'PUBLIC_DATABASE_URL 未配置，无法解析 public 租户库',
      );
    }
    return publicDatabaseUrl;
  }

  if (normalizedCustomerId === defaultCustomerId) {
    return databaseUrl;
  }

  if (template) {
    if (!template.includes('{customerId}')) {
      throw new AgentWorkbenchMenuError(
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

function maskDatabaseUrl(rawUrl) {
  return String(rawUrl || '').replaceAll(
    /:\/\/([^:/?#]+):([^@/?#]+)@/g,
    '://$1:***@',
  );
}

async function openConnection(rawUrl) {
  return mariadb.createConnection(createConnectionConfig(rawUrl));
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function findMenu(connection, whereSql, params) {
  const rows = await connection.query(
    `
      SELECT
        m.menu_id AS menuId,
        m.name,
        m.type,
        m.status,
        m.path,
        m.component,
        m.pid,
        m.auth_code AS authCode,
        mm.title,
        mm.icon,
        mm.\`order\` AS sortOrder,
        mm.hide_in_menu AS hideInMenu
      FROM menu m
      LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
      WHERE ${whereSql}
      ORDER BY m.menu_id ASC
      LIMIT 1
    `,
    params,
  );
  return rows[0] || null;
}

async function findMenuByPath(connection, pathValue) {
  return findMenu(connection, 'm.path = ?', [pathValue]);
}

async function ensureMenu(connection, route) {
  const existing =
    (route.path ? await findMenuByPath(connection, route.path) : null) ||
    (route.name
      ? await findMenu(connection, 'm.name = ?', [route.name])
      : null);

  if (existing) {
    await connection.query(
      `
        UPDATE menu
        SET
          name = ?,
          type = ?,
          status = 1,
          path = ?,
          active_path = ?,
          redirect = ?,
          component = ?,
          pid = ?,
          auth_code = ?
        WHERE menu_id = ?
      `,
      [
        route.name,
        route.type,
        route.path,
        route.activePath || null,
        route.redirect || null,
        route.component || null,
        route.pid || null,
        route.authCode || null,
        existing.menuId,
      ],
    );
    await upsertMenuMeta(connection, existing.menuId, route.meta);
    return { action: 'update', menuId: existing.menuId };
  }

  const result = await connection.query(
    `
      INSERT INTO menu
        (name, type, status, path, active_path, redirect, component, pid, auth_code)
      VALUES
        (?, ?, 1, ?, ?, ?, ?, ?, ?)
    `,
    [
      route.name,
      route.type,
      route.path,
      route.activePath || null,
      route.redirect || null,
      route.component || null,
      route.pid || null,
      route.authCode || null,
    ],
  );
  const menuId = toNumber(result.insertId);
  await upsertMenuMeta(connection, menuId, route.meta);
  return { action: 'insert', menuId };
}

async function upsertMenuMeta(connection, menuId, meta) {
  const [existing] = await connection.query(
    'SELECT meta_id AS metaId FROM menu_meta WHERE menu_id = ? LIMIT 1',
    [menuId],
  );

  if (existing) {
    await connection.query(
      `
        UPDATE menu_meta
        SET
          title = ?,
          icon = ?,
          \`order\` = ?,
          active_path = ?,
          hide_in_menu = ?,
          is_app = ?
        WHERE menu_id = ?
      `,
      [
        meta.title,
        meta.icon || null,
        meta.order,
        meta.activePath || null,
        meta.hideInMenu ?? null,
        meta.isApp ?? null,
        menuId,
      ],
    );
    return;
  }

  await connection.query(
    `
      INSERT INTO menu_meta
        (title, icon, \`order\`, active_path, hide_in_menu, is_app, menu_id)
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      meta.title,
      meta.icon || null,
      meta.order,
      meta.activePath || null,
      meta.hideInMenu ?? null,
      meta.isApp ?? null,
      menuId,
    ],
  );
}

async function readRoleIdsWithMenu(connection, menuId) {
  const rows = await connection.query(
    `
      SELECT DISTINCT role_id AS roleId
      FROM role_menu
      WHERE menu_id = ? AND is_deleted = 0
    `,
    [menuId],
  );
  return rows.map((item) => toNumber(item.roleId)).filter(Boolean);
}

async function grantMenuToRoles(connection, menuId, roleIds) {
  for (const roleId of roleIds) {
    const [existing] = await connection.query(
      'SELECT id, is_deleted AS isDeleted FROM role_menu WHERE role_id = ? AND menu_id = ? LIMIT 1',
      [roleId, menuId],
    );
    if (existing) {
      if (existing.isDeleted) {
        await connection.query(
          'UPDATE role_menu SET is_deleted = 0, update_time = NOW(3) WHERE id = ?',
          [existing.id],
        );
      }
      continue;
    }
    await connection.query(
      'INSERT INTO role_menu (role_id, menu_id, is_deleted, create_time, update_time) VALUES (?, ?, 0, NOW(3), NOW(3))',
      [roleId, menuId],
    );
  }
}

async function readMenuSnapshot(connection) {
  return connection.query(`
    SELECT
      parent.menu_id AS parentId,
      parent.name AS parentName,
      parent.path AS parentPath,
      parentMeta.title AS parentTitle,
      m.menu_id AS menuId,
      m.name,
      m.path,
      m.component,
      m.pid,
      mm.title,
      mm.icon,
      mm.\`order\` AS sortOrder,
      mm.hide_in_menu AS hideInMenu
    FROM menu m
    LEFT JOIN menu parent ON parent.menu_id = m.pid
    LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
    LEFT JOIN menu_meta parentMeta ON parentMeta.menu_id = parent.menu_id
    WHERE m.path IN (
      '/dashboard',
      '/analytics',
      '/tools',
      '/tools/agent-workbench',
      '/tools/webtools',
      '/tools/agent-tasks',
      '/tools/agent-tasks/detail',
      '/tools/agent-skills',
      '/tools/agent-models',
      '/workspace',
      '/workbench'
    )
       OR m.name IN (
      'Dashboard',
      'Analytics',
      'Tools',
      'AgentWorkbench',
      'AiToolsWebtools',
      'AgentTaskCenter',
      'AgentTaskDetail',
      'AgentSkillCenter',
      'AgentModelConfig',
      'Workspace',
      'Workbench'
    )
    ORDER BY COALESCE(parent.menu_id, m.menu_id), COALESCE(mm.\`order\`, 9999), m.menu_id
  `);
}

async function applyMenuChanges(connection, options) {
  const exposeMenus = options.scope === 'local';
  const menuHideInMenu = !exposeMenus;
  const hiddenMenu = true;

  const dashboardResult = await ensureMenu(connection, {
    authCode: null,
    component: '',
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -9999,
      title: 'page.dashboard.title',
    },
    name: 'Dashboard',
    path: '/dashboard',
    pid: null,
    redirect: null,
    type: 'catalog',
  });
  const dashboardId = dashboardResult.menuId;

  const analyticsResult = await ensureMenu(connection, {
    authCode: null,
    component: '/dashboard/analytics/index',
    meta: {
      icon: 'lucide:area-chart',
      order: 1,
      title: 'page.dashboard.analytics',
    },
    name: 'Analytics',
    path: '/analytics',
    pid: dashboardId,
    redirect: null,
    type: 'menu',
  });

  const toolsResult = await ensureMenu(connection, {
    authCode: null,
    component: '',
    meta: {
      hideInMenu: menuHideInMenu,
      icon: 'lucide:bot',
      order: 2,
      title: 'page.tools.title',
    },
    name: 'Tools',
    path: '/tools',
    pid: dashboardId,
    redirect: '/tools/agent-workbench',
    type: 'catalog',
  });
  const toolsId = toolsResult.menuId;

  const agentResult = await ensureMenu(connection, {
    authCode: 'agent:workbench',
    component: '/dashboard/agent-workbench/index',
    meta: {
      hideInMenu: menuHideInMenu,
      icon: 'lucide:messages-square',
      order: 1,
      title: 'Agent工作台',
    },
    name: 'AgentWorkbench',
    path: '/tools/agent-workbench',
    pid: toolsId,
    redirect: null,
    type: 'menu',
  });

  const webtoolsResult = await ensureMenu(connection, {
    authCode: 'tools:webtools',
    component: '/tools/webtools',
    meta: {
      hideInMenu: menuHideInMenu,
      icon: 'lucide:panel-top',
      order: 2,
      title: 'AI工具导航',
    },
    name: 'AiToolsWebtools',
    path: '/tools/webtools',
    pid: toolsId,
    redirect: null,
    type: 'menu',
  });

  const taskCenterResult = await ensureMenu(connection, {
    authCode: 'agent:tasks',
    component: '/agent/task-list',
    meta: {
      hideInMenu: menuHideInMenu,
      icon: 'lucide:list-checks',
      order: 3,
      title: '任务中心',
    },
    name: 'AgentTaskCenter',
    path: '/tools/agent-tasks',
    pid: toolsId,
    redirect: null,
    type: 'menu',
  });

  const taskDetailResult = await ensureMenu(connection, {
    activePath: '/tools/agent-tasks',
    authCode: 'agent:tasks',
    component: '/agent/task-detail',
    meta: {
      activePath: '/tools/agent-tasks',
      hideInMenu: true,
      icon: 'lucide:file-search',
      order: 3.1,
      title: '任务详情',
    },
    name: 'AgentTaskDetail',
    path: '/tools/agent-tasks/detail',
    pid: toolsId,
    redirect: null,
    type: 'menu',
  });

  const skillCenterResult = await ensureMenu(connection, {
    authCode: 'agent:skills',
    component: '/agent/skill-center',
    meta: {
      hideInMenu: menuHideInMenu,
      icon: 'lucide:blocks',
      order: 4,
      title: 'Skill中心',
    },
    name: 'AgentSkillCenter',
    path: '/tools/agent-skills',
    pid: toolsId,
    redirect: null,
    type: 'menu',
  });

  const modelConfigResult = await ensureMenu(connection, {
    authCode: 'agent:models',
    component: '/agent/model-config',
    meta: {
      hideInMenu: menuHideInMenu,
      icon: 'lucide:sliders-horizontal',
      order: 5,
      title: '模型配置',
    },
    name: 'AgentModelConfig',
    path: '/tools/agent-models',
    pid: toolsId,
    redirect: null,
    type: 'menu',
  });

  const hiddenWorkspaceResult = await ensureMenu(connection, {
    activePath: '/tools/agent-workbench',
    authCode: 'dashboard:workspace',
    component: '/dashboard/workspace/index',
    meta: {
      activePath: '/tools/agent-workbench',
      hideInMenu: hiddenMenu,
      icon: 'carbon:workspace',
      order: 98,
      title: '旧工作台',
    },
    name: 'Workspace',
    path: '/workspace',
    pid: toolsId,
    redirect: null,
    type: 'menu',
  });

  const hiddenWorkbenchResult = await ensureMenu(connection, {
    activePath: '/tools/agent-workbench',
    authCode: 'dashboard:workbench',
    component: '/dashboard/workbench/index',
    meta: {
      activePath: '/tools/agent-workbench',
      hideInMenu: hiddenMenu,
      icon: 'lucide:messages-square',
      order: 99,
      title: '旧工作台导航',
    },
    name: 'Workbench',
    path: '/workbench',
    pid: toolsId,
    redirect: null,
    type: 'menu',
  });

  const roleIds = [
    ...new Set([
      ...(await readRoleIdsWithMenu(connection, agentResult.menuId)),
      ...(await readRoleIdsWithMenu(connection, analyticsResult.menuId)),
      ...(await readRoleIdsWithMenu(connection, dashboardId)),
      ...(await readRoleIdsWithMenu(connection, hiddenWorkbenchResult.menuId)),
      ...(await readRoleIdsWithMenu(connection, hiddenWorkspaceResult.menuId)),
      ...(await readRoleIdsWithMenu(connection, modelConfigResult.menuId)),
      ...(await readRoleIdsWithMenu(connection, skillCenterResult.menuId)),
      ...(await readRoleIdsWithMenu(connection, taskCenterResult.menuId)),
      ...(await readRoleIdsWithMenu(connection, taskDetailResult.menuId)),
      ...(await readRoleIdsWithMenu(connection, toolsId)),
      ...(await readRoleIdsWithMenu(connection, webtoolsResult.menuId)),
    ]),
  ];

  await grantMenuToRoles(connection, dashboardId, roleIds);
  await grantMenuToRoles(connection, toolsId, roleIds);
  await grantMenuToRoles(connection, agentResult.menuId, roleIds);
  await grantMenuToRoles(connection, hiddenWorkspaceResult.menuId, roleIds);
  await grantMenuToRoles(connection, hiddenWorkbenchResult.menuId, roleIds);
  await grantMenuToRoles(connection, modelConfigResult.menuId, roleIds);
  await grantMenuToRoles(connection, skillCenterResult.menuId, roleIds);
  await grantMenuToRoles(connection, taskCenterResult.menuId, roleIds);
  await grantMenuToRoles(connection, taskDetailResult.menuId, roleIds);
  await grantMenuToRoles(connection, webtoolsResult.menuId, roleIds);

  return {
    agentWorkbenchMenuId: agentResult.menuId,
    dashboardMenuId: dashboardId,
    hiddenWorkspaceMenuId: hiddenWorkspaceResult.menuId,
    hideInMenu: menuHideInMenu,
    modelConfigMenuId: modelConfigResult.menuId,
    roleIds,
    scope: options.scope,
    skillCenterMenuId: skillCenterResult.menuId,
    taskCenterMenuId: taskCenterResult.menuId,
    taskDetailMenuId: taskDetailResult.menuId,
    toolsMenuId: toolsId,
    webtoolsMenuId: webtoolsResult.menuId,
  };
}

function replacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const databaseUrl =
    options.databaseUrl || resolveCustomerDbUrl(options.customerId);
  const connection = await openConnection(databaseUrl);

  try {
    const before = await readMenuSnapshot(connection);
    console.log(
      JSON.stringify(
        {
          before,
          customerId: options.customerId,
          databaseUrl: maskDatabaseUrl(databaseUrl),
          execute: options.execute,
          scope: options.scope,
        },
        replacer,
        2,
      ),
    );

    if (!options.execute) {
      console.log('预览模式，未写入。确认无误后追加 --execute 执行。');
      return;
    }

    await connection.beginTransaction();
    let result;
    try {
      result = await applyMenuChanges(connection, options);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const after = await readMenuSnapshot(connection);
    console.log(
      JSON.stringify(
        {
          after,
          applied: result,
          execute: true,
          message: 'Agent 工作台菜单配置完成。',
        },
        replacer,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    '[menu:agent-workbench] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
