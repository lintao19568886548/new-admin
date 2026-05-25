import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

class BackfillMenuTemplateKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackfillMenuTemplateKeyError';
  }
}

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

function shouldPrintHelp(argv) {
  return argv.length === 0 || argv.includes('--help') || argv.includes('-h');
}

function printHelp() {
  console.log(`单库回填 menu/code 模板稳定键

用法:
  pnpm -F @vben/backend-mock run menu-template:backfill-keys -- --customer-id=public
  pnpm -F @vben/backend-mock run menu-template:backfill-keys -- --customer-id=public --execute
  pnpm -F @vben/backend-mock run menu-template:backfill-keys -- --database-url=mysql://user:pass@host:3306/db

参数:
  --customer-id=<id>       目标单库，默认 public
  --database-url=<url>     直接指定目标数据库 URL；优先级高于 --customer-id
  --template-version=<n>   写入 template_version，默认 1
  --execute                执行写入；不传时只预览
  --include-existing       已有 template_key 的记录也重新计算并覆盖
  --help, -h               输出帮助

说明:
  - 路由菜单 template_key 优先来自 path。
  - 无 path 的权限型菜单使用父菜单 template_key + auth_code/name 定界。
  - 权限码 template_key 优先跟随关联菜单 template_key，其次来自 code/name。
  - 不能生成稳定 key 的记录会列为 unresolved 并中止写入。
  - 脚本会先报告重复 key 并中止，不会自动猜测冲突记录。
  - 只回填模板身份，不写 template_managed / template_internal_only。
  - 模板管理和仅内部使用开关由菜单管理维护，不能由回填脚本猜测。
  - 这是单库数据身份回填工具，不是菜单 OTA，也不会跨租户批量同步。`);
}

function parseArgs(argv) {
  const options = {
    customerId: 'public',
    databaseUrl: '',
    execute: false,
    includeExisting: false,
    templateVersion: 1,
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    if (arg === '--include-existing') {
      options.includeExisting = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new BackfillMenuTemplateKeyError(`未知参数: ${arg}`);
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
    if (key === 'template-version') {
      options.templateVersion = normalizePositiveInteger(value);
      continue;
    }
    throw new BackfillMenuTemplateKeyError(`未知参数: ${arg}`);
  }

  return options;
}

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }
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
    throw new BackfillMenuTemplateKeyError(`${name} 未配置`);
  }
  return value;
}

function parseDbUrl(rawUrl) {
  try {
    return new URL(stripWrappingQuotes(rawUrl));
  } catch (error) {
    throw new BackfillMenuTemplateKeyError(
      `数据库 URL 不合法: ${maskDatabaseUrl(rawUrl)}`,
      { cause: error },
    );
  }
}

function normalizeCustomerId(value) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId)) {
    throw new BackfillMenuTemplateKeyError(
      `customerId 不合法: ${customerId || '(empty)'}`,
    );
  }
  return customerId;
}

function normalizePositiveInteger(value) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new BackfillMenuTemplateKeyError(
      `template-version 必须为正整数: ${value}`,
    );
  }
  return numberValue;
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
      throw new BackfillMenuTemplateKeyError(
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
      throw new BackfillMenuTemplateKeyError(
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

function maskDatabaseUrl(rawUrl) {
  return String(rawUrl || '').replaceAll(
    /:\/\/([^:/?#]+):([^@/?#]+)@/g,
    '://$1:***@',
  );
}

function normalizeKeyPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 150);
}

function getTemplateKeyBody(templateKey, prefix) {
  const text = String(templateKey || '').trim();
  const prefixText = `${prefix}:`;
  return text.startsWith(prefixText) ? text.slice(prefixText.length) : text;
}

function buildTemplateKey(prefix, parts) {
  const body = parts.filter(Boolean).join(':').slice(0, 185);
  return body ? `${prefix}:${body}` : '';
}

function firstTextValue(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function buildMenuTemplateKey(menu, parentTemplateKey) {
  const normalizedPath = normalizeKeyPart(menu.path);
  if (normalizedPath) {
    return buildTemplateKey('menu', [normalizedPath]);
  }

  const normalizedIdentity = normalizeKeyPart(
    firstTextValue(menu.authCode, menu.name),
  );
  if (!normalizedIdentity) {
    return '';
  }

  const parentKeyBody = getTemplateKeyBody(parentTemplateKey, 'menu');
  if (parentKeyBody) {
    return buildTemplateKey('menu', [parentKeyBody, normalizedIdentity]);
  }
  return buildTemplateKey('menu', [normalizedIdentity]);
}

function buildCodeTemplateKey(code, menuById) {
  const menu = code.menuId ? menuById.get(Number(code.menuId)) : null;
  const menuKeyBody = menu ? getTemplateKeyBody(menu.templateKey, 'menu') : '';
  if (menuKeyBody) {
    return buildTemplateKey('code', [menuKeyBody]);
  }

  const normalizedCode = normalizeKeyPart(
    firstTextValue(code.code, code.name, code.content),
  );
  if (normalizedCode) {
    return buildTemplateKey('code', [normalizedCode]);
  }

  return '';
}

function groupBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function findDuplicatePlans(plans, keyName, idName) {
  return [...groupBy(plans, (item) => item[keyName]).entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      ids: items.map((item) => item[idName]),
      key,
    }));
}

async function readMenus(connection) {
  return connection.query(`
    SELECT
      menu_id AS menuId,
      name,
      path,
      pid,
      auth_code AS authCode,
      template_key AS templateKey,
      template_parent_key AS templateParentKey
    FROM menu
    ORDER BY menu_id ASC
  `);
}

async function readCodes(connection) {
  return connection.query(`
    SELECT
      code_id AS codeId,
      code,
      name,
      content,
      menu_id AS menuId,
      template_key AS templateKey
    FROM code
    ORDER BY code_id ASC
  `);
}

async function getExistingTemplateKeys(connection) {
  const [menuRows, codeRows] = await Promise.all([
    connection.query(`
      SELECT template_key AS templateKey, COUNT(*) AS total
      FROM menu
      WHERE template_key IS NOT NULL AND template_key <> ''
      GROUP BY template_key
      HAVING COUNT(*) > 1
    `),
    connection.query(`
      SELECT template_key AS templateKey, COUNT(*) AS total
      FROM code
      WHERE template_key IS NOT NULL AND template_key <> ''
      GROUP BY template_key
      HAVING COUNT(*) > 1
    `),
  ]);

  return {
    code: codeRows.map((row) => ({
      key: row.templateKey,
      total: Number(row.total),
    })),
    menu: menuRows.map((row) => ({
      key: row.templateKey,
      total: Number(row.total),
    })),
  };
}

function collectCycleMenuIds(menuById) {
  const cycleMenuIds = new Set();
  const visited = new Set();
  const visiting = new Set();
  const stack = [];

  function visit(menuId) {
    if (visited.has(menuId)) {
      return;
    }
    if (visiting.has(menuId)) {
      const cycleStartIndex = stack.indexOf(menuId);
      const cycleStack =
        cycleStartIndex === -1 ? stack : stack.slice(cycleStartIndex);
      for (const cycleMenuId of cycleStack) {
        cycleMenuIds.add(cycleMenuId);
      }
      cycleMenuIds.add(menuId);
      return;
    }

    const menu = menuById.get(menuId);
    if (!menu) {
      return;
    }

    visiting.add(menuId);
    stack.push(menuId);

    const parentMenuId = menu.pid ? Number(menu.pid) : null;
    if (parentMenuId && menuById.has(parentMenuId)) {
      visit(parentMenuId);
    }

    stack.pop();
    visiting.delete(menuId);
    visited.add(menuId);
  }

  for (const menuId of menuById.keys()) {
    visit(menuId);
  }

  return cycleMenuIds;
}

function buildMenuPlan(menus, options) {
  const rawMenuById = new Map(menus.map((menu) => [Number(menu.menuId), menu]));
  const resolvedTemplateKeyByMenuId = new Map();
  const cycleMenuIds = collectCycleMenuIds(rawMenuById);

  function resolveMenuTemplateKey(menuId, resolving = new Set()) {
    if (resolvedTemplateKeyByMenuId.has(menuId)) {
      return resolvedTemplateKeyByMenuId.get(menuId);
    }

    const menu = rawMenuById.get(menuId);
    if (!menu) {
      return '';
    }
    if (resolving.has(menuId)) {
      return '';
    }

    const currentTemplateKey = menu.templateKey
      ? String(menu.templateKey)
      : null;
    if (!options.includeExisting && currentTemplateKey) {
      resolvedTemplateKeyByMenuId.set(menuId, currentTemplateKey);
      return currentTemplateKey;
    }

    resolving.add(menuId);
    const parentMenuId = menu.pid ? Number(menu.pid) : null;
    const parentTemplateKey = parentMenuId
      ? resolveMenuTemplateKey(parentMenuId, resolving)
      : '';
    resolving.delete(menuId);

    const nextTemplateKey = buildMenuTemplateKey(menu, parentTemplateKey);
    resolvedTemplateKeyByMenuId.set(menuId, nextTemplateKey);
    return nextTemplateKey;
  }

  const plans = menus.map((menu) => {
    const menuId = Number(menu.menuId);
    const parentMenuId = menu.pid ? Number(menu.pid) : null;
    const parent = parentMenuId ? rawMenuById.get(parentMenuId) : null;
    const currentTemplateKey = menu.templateKey
      ? String(menu.templateKey)
      : null;
    const currentTemplateParentKey = menu.templateParentKey
      ? String(menu.templateParentKey)
      : null;
    const nextTemplateKey =
      !options.includeExisting && currentTemplateKey
        ? currentTemplateKey
        : resolveMenuTemplateKey(menuId);
    const nextTemplateParentKey = parent
      ? resolveMenuTemplateKey(parentMenuId)
      : null;
    const shouldUpdate =
      options.includeExisting ||
      currentTemplateKey !== nextTemplateKey ||
      currentTemplateParentKey !== nextTemplateParentKey;
    return {
      action: shouldUpdate ? 'update' : 'skip',
      currentTemplateParentKey,
      currentTemplateKey,
      menuId,
      name: menu.name ? String(menu.name) : null,
      nextTemplateKey,
      nextTemplateParentKey,
      parentMenuId,
      parentCycle: cycleMenuIds.has(menuId),
      parentMissing: Boolean(parentMenuId && !parent),
      path: menu.path ? String(menu.path) : null,
    };
  });

  return {
    menuById: new Map(
      plans.map((item) => [
        item.menuId,
        {
          ...rawMenuById.get(item.menuId),
          templateKey: item.nextTemplateKey,
        },
      ]),
    ),
    plans,
  };
}

function buildCodePlan(codes, menuById, options) {
  return codes.map((code) => {
    const codeId = Number(code.codeId);
    const menuId = code.menuId ? Number(code.menuId) : null;
    const menu = menuId ? menuById.get(menuId) : null;
    const currentTemplateKey = code.templateKey
      ? String(code.templateKey)
      : null;
    const nextTemplateKey =
      !options.includeExisting && currentTemplateKey
        ? currentTemplateKey
        : buildCodeTemplateKey(code, menuById);
    const shouldUpdate =
      options.includeExisting || currentTemplateKey !== nextTemplateKey;
    return {
      action: shouldUpdate ? 'update' : 'skip',
      codeId,
      code: code.code ? String(code.code) : null,
      currentTemplateKey,
      menuId,
      menuMissing: Boolean(menuId && !menu),
      name: code.name ? String(code.name) : null,
      nextTemplateKey,
    };
  });
}

function findUnresolvedPlans(menuPlans, codePlans) {
  function getMenuUnresolvedReason(item) {
    if (item.parentCycle) {
      return '菜单父子关系存在循环，不能安全生成 template_parent_key';
    }
    if (item.parentMissing) {
      return '父菜单不存在，不能安全生成 template_parent_key';
    }
    if (item.parentMenuId && !item.nextTemplateParentKey) {
      return '父菜单缺少稳定 template_key，不能安全生成 template_parent_key';
    }
    return '缺少可生成稳定 template_key 的 path/auth_code/name';
  }

  return {
    code: codePlans
      .filter((item) => !item.nextTemplateKey || item.menuMissing)
      .map((item) => ({
        code: item.code,
        codeId: item.codeId,
        menuId: item.menuId,
        name: item.name,
        reason: item.menuMissing
          ? '关联菜单不存在，不能安全生成权限码模板键'
          : '缺少可生成稳定 template_key 的关联菜单、code 或 name',
      })),
    menu: menuPlans
      .filter(
        (item) =>
          !item.nextTemplateKey ||
          item.parentCycle ||
          item.parentMissing ||
          Boolean(item.parentMenuId && !item.nextTemplateParentKey),
      )
      .map((item) => ({
        menuId: item.menuId,
        name: item.name,
        parentMenuId: item.parentMenuId,
        parentCycle: item.parentCycle,
        path: item.path,
        reason: getMenuUnresolvedReason(item),
      })),
  };
}

function assertNoUnresolvedPlans(unresolved) {
  if (unresolved.menu.length === 0 && unresolved.code.length === 0) {
    return;
  }
  throw new BackfillMenuTemplateKeyError(
    `存在无法生成稳定 template_key 的记录: ${JSON.stringify(unresolved)}`,
  );
}

function assertNoPlanConflicts(menuPlans, codePlans) {
  const duplicateMenus = findDuplicatePlans(
    menuPlans,
    'nextTemplateKey',
    'menuId',
  );
  const duplicateCodes = findDuplicatePlans(
    codePlans,
    'nextTemplateKey',
    'codeId',
  );
  const messages = [];
  if (duplicateMenus.length > 0) {
    messages.push(
      `menu 生成重复 template_key: ${JSON.stringify(duplicateMenus)}`,
    );
  }
  if (duplicateCodes.length > 0) {
    messages.push(
      `code 生成重复 template_key: ${JSON.stringify(duplicateCodes)}`,
    );
  }
  if (messages.length > 0) {
    throw new BackfillMenuTemplateKeyError(messages.join('\n'));
  }
}

function summarizePlan(plans) {
  const summary = { skip: 0, total: 0, update: 0 };
  for (const item of plans) {
    summary[item.action] += 1;
    summary.total += 1;
  }
  return summary;
}

async function reserveChangingTemplateKeys(params) {
  const allowedTargets = new Set([
    'code:code_id:template_key',
    'menu:menu_id:template_key',
  ]);
  const targetKey = `${params.tableName}:${params.idColumn}:${params.keyColumn}`;
  if (!allowedTargets.has(targetKey)) {
    throw new BackfillMenuTemplateKeyError(
      `不允许的模板键临时更新目标: ${targetKey}`,
    );
  }

  for (const item of params.plans) {
    if (item.currentTemplateKey === item.nextTemplateKey) {
      continue;
    }
    await params.connection.query(
      `
        UPDATE ${params.tableName}
        SET ${params.keyColumn} = ?
        WHERE ${params.idColumn} = ?
      `,
      [
        `__template_backfill_tmp:${params.tableName}:${item[params.idName]}`,
        item[params.idName],
      ],
    );
  }
}

async function applyMenuPlan(connection, plans, options) {
  const updatePlans = plans.filter((plan) => plan.action === 'update');
  await reserveChangingTemplateKeys({
    connection,
    idColumn: 'menu_id',
    idName: 'menuId',
    keyColumn: 'template_key',
    plans: updatePlans,
    tableName: 'menu',
  });

  for (const item of updatePlans) {
    await connection.query(
      `
        UPDATE menu
        SET
          template_key = ?,
          template_parent_key = ?,
          template_version = ?
        WHERE menu_id = ?
      `,
      [
        item.nextTemplateKey,
        item.nextTemplateParentKey,
        options.templateVersion,
        item.menuId,
      ],
    );
  }
}

async function applyCodePlan(connection, plans, options) {
  const updatePlans = plans.filter((plan) => plan.action === 'update');
  await reserveChangingTemplateKeys({
    connection,
    idColumn: 'code_id',
    idName: 'codeId',
    keyColumn: 'template_key',
    plans: updatePlans,
    tableName: 'code',
  });

  for (const item of updatePlans) {
    await connection.query(
      `
        UPDATE code
        SET
          template_key = ?,
          template_version = ?,
          update_time = update_time
        WHERE code_id = ?
      `,
      [item.nextTemplateKey, options.templateVersion, item.codeId],
    );
  }
}

async function main() {
  const argv = normalizeArgv(process.argv.slice(2));
  if (shouldPrintHelp(argv)) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  const databaseUrl =
    options.databaseUrl || resolveCustomerDbUrl(options.customerId);
  const connection = await openConnection(databaseUrl);

  try {
    const existingDuplicateKeys = await getExistingTemplateKeys(connection);
    if (
      existingDuplicateKeys.menu.length > 0 ||
      existingDuplicateKeys.code.length > 0
    ) {
      throw new BackfillMenuTemplateKeyError(
        `数据库已存在重复 template_key: ${JSON.stringify(existingDuplicateKeys)}`,
      );
    }

    const menus = await readMenus(connection);
    const codes = await readCodes(connection);
    const { menuById, plans: menuPlans } = buildMenuPlan(menus, options);
    const codePlans = buildCodePlan(codes, menuById, options);
    const unresolved = findUnresolvedPlans(menuPlans, codePlans);

    console.log(
      JSON.stringify(
        {
          customerId: options.customerId,
          databaseUrl: maskDatabaseUrl(databaseUrl),
          execute: options.execute,
          includeExisting: options.includeExisting,
          menu: {
            sample: menuPlans.slice(0, 20),
            summary: summarizePlan(menuPlans),
          },
          code: {
            sample: codePlans.slice(0, 20),
            summary: summarizePlan(codePlans),
          },
          preview: !options.execute,
          templateVersion: options.templateVersion,
          unresolved,
        },
        null,
        2,
      ),
    );

    assertNoUnresolvedPlans(unresolved);
    assertNoPlanConflicts(menuPlans, codePlans);

    if (!options.execute) {
      console.log('预览模式，未写入。确认无误后追加 --execute 执行。');
      return;
    }

    await connection.beginTransaction();
    try {
      await applyMenuPlan(connection, menuPlans, options);
      await applyCodePlan(connection, codePlans, options);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    console.log(
      JSON.stringify(
        {
          applied: {
            code: codePlans.filter((item) => item.action === 'update').length,
            menu: menuPlans.filter((item) => item.action === 'update').length,
          },
          execute: true,
          message: 'menu/code 模板稳定键回填完成。',
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    '[menu-template:backfill-keys] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
