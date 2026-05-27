import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';
import { createClient } from 'redis';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

const MENU_COMPARE_FIELDS = [
  'name',
  'type',
  'status',
  'path',
  'activePath',
  'redirect',
  'component',
  'authCode',
  'templateParentKey',
  'templateVersion',
];

const MENU_META_COMPARE_FIELDS = [
  'title',
  'icon',
  'order',
  'color',
  'activeIcon',
  'activePath',
  'affixTab',
  'affixTabOrder',
  'badge',
  'badgeType',
  'badgeVariants',
  'hideChildrenInMenu',
  'hideInBreadcrumb',
  'hideInMenu',
  'hideInTab',
  'iframeSrc',
  'keepAlive',
  'link',
  'isApp',
  'maxNumOfOpenTab',
  'noBasicLayout',
  'openInNewWindow',
];

const CODE_COMPARE_FIELDS = [
  'code',
  'name',
  'content',
  'menuTemplateKey',
  'templateVersion',
];

class MenuTemplateDryRunError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MenuTemplateDryRunError';
  }
}

class TargetExecutionError extends Error {
  constructor(message, result) {
    super(message);
    this.name = 'TargetExecutionError';
    this.result = result;
  }
}

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

function shouldPrintHelp(argv) {
  return argv.length === 0 || argv.includes('--help') || argv.includes('-h');
}

function printHelp() {
  console.log(`菜单模板同步

用法:
  pnpm -F @vben/backend-mock run menu-template:sync-dry-run -- --target-customer-id=public
  pnpm -F @vben/backend-mock run menu-template:sync-dry-run -- --target-customer-id=<tenantId>
  pnpm -F @vben/backend-mock run menu-template:sync-dry-run -- --all-tenants
  pnpm -F @vben/backend-mock run menu-template:sync-execute -- --target-customer-id=public

参数:
  --source-customer-id=<id>   模板源逻辑库，默认 default
  --source-database-url=<url> 直接指定模板源数据库 URL
  --target-customer-id=<id>   目标逻辑库；public 也是目标之一
  --target-db-name=<name>     目标库真实数据库名，通常来自 center.customer.db_name
  --target-database-url=<url> 直接指定目标数据库 URL；优先级高于 target-customer-id
  --all-tenants               从中心库 customer 表枚举全部启用租户，不包含 public/default
  --execute                   执行真实 OTA 写入；不传时只做 dry-run
  --no-log                    只输出结果，不写 menu_template_sync_job/log
  --help, -h                  输出帮助

说明:
  - 默认只读 source/target 菜单、menu_meta、code，不写目标库。
  - --execute 会先对全部目标做 preflight；任一目标 blocked 时整批不执行。
  - --execute 下每个目标库单独事务，写 menu/menu_meta/code，不写角色和授权表。
  - --execute 要求 REDIS_URL 已配置且 Redis 可连接，用于刷新跨进程权限缓存版本。
  - source 发布候选集为 template_managed=1 AND template_internal_only=0 AND template_deleted_at IS NULL。
  - target 下线候选只统计 template_managed=1 且不在 source 发布候选集内的记录。
  - 有 duplicate、缺失 template_key、父级未发布、code 关联冲突时，目标状态为 blocked。`);
}

function parseArgs(argv) {
  const options = {
    allTenants: false,
    execute: false,
    log: true,
    sourceCustomerId: getDefaultCustomerId(),
    sourceDatabaseUrl: '',
    targetCustomerId: '',
    targetDatabaseUrl: '',
    targetDbName: '',
  };

  for (const arg of argv) {
    if (arg === '--all-tenants') {
      options.allTenants = true;
      continue;
    }
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    if (arg === '--no-log') {
      options.log = false;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new MenuTemplateDryRunError(`未知参数: ${arg}`);
    }
    const [, key, value] = match;
    if (key === 'source-customer-id') {
      options.sourceCustomerId = normalizeCustomerId(value);
      continue;
    }
    if (key === 'source-database-url') {
      options.sourceDatabaseUrl = stripWrappingQuotes(value);
      continue;
    }
    if (key === 'target-customer-id') {
      options.targetCustomerId = normalizeCustomerId(value);
      continue;
    }
    if (key === 'target-db-name') {
      options.targetDbName = normalizeDatabaseName(value);
      continue;
    }
    if (key === 'target-database-url') {
      options.targetDatabaseUrl = stripWrappingQuotes(value);
      continue;
    }
    throw new MenuTemplateDryRunError(`未知参数: ${arg}`);
  }

  const hasSingleTarget = Boolean(
    options.targetCustomerId || options.targetDatabaseUrl,
  );
  if (options.allTenants && hasSingleTarget) {
    throw new MenuTemplateDryRunError('--all-tenants 不能和单目标参数同时使用');
  }
  if (!options.allTenants && !hasSingleTarget) {
    throw new MenuTemplateDryRunError(
      '请指定 --target-customer-id、--target-database-url 或 --all-tenants',
    );
  }
  if (options.execute && !options.log) {
    throw new MenuTemplateDryRunError('--execute 不能和 --no-log 同时使用');
  }
  if (options.execute && !getRedisUrl()) {
    throw new MenuTemplateDryRunError('--execute 需要配置 REDIS_URL');
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
    throw new MenuTemplateDryRunError(`${name} 未配置`);
  }
  return value;
}

function getDefaultCustomerId() {
  return normalizeCustomerId(process.env.DEFAULT_CUSTOMER_ID || 'default');
}

function normalizeCustomerId(value) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId)) {
    throw new MenuTemplateDryRunError(
      `customerId 不合法: ${customerId || '(empty)'}`,
    );
  }
  return customerId;
}

function normalizeDatabaseName(value) {
  const dbName = String(value || '').trim();
  if (dbName && !/^\w+$/.test(dbName)) {
    throw new MenuTemplateDryRunError(`数据库名不合法: ${dbName}`);
  }
  return dbName;
}

function parseDbUrl(rawUrl) {
  try {
    return new URL(stripWrappingQuotes(rawUrl));
  } catch (error) {
    throw new MenuTemplateDryRunError(
      `数据库 URL 不合法: ${maskDatabaseUrl(rawUrl)}`,
      { cause: error },
    );
  }
}

function applyDatabaseName(rawUrl, dbName) {
  const normalizedDbName = normalizeDatabaseName(dbName);
  if (!normalizedDbName) {
    return rawUrl;
  }
  const url = parseDbUrl(rawUrl);
  url.pathname = `/${normalizedDbName}`;
  return url.toString();
}

function resolveCenterDatabaseUrl() {
  return (
    stripWrappingQuotes(process.env.CENTER_DATABASE_URL) ||
    requireEnv('DATABASE_URL')
  );
}

function resolveCustomerDbUrl(customerId, options = {}) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  const targetDbName = normalizeDatabaseName(options.dbName);
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
      throw new MenuTemplateDryRunError(
        'PUBLIC_DATABASE_URL 未配置，无法解析 public 库',
      );
    }
    return applyDatabaseName(publicDatabaseUrl, targetDbName);
  }

  if (normalizedCustomerId === defaultCustomerId) {
    return applyDatabaseName(databaseUrl, targetDbName);
  }

  if (template) {
    if (!template.includes('{customerId}')) {
      throw new MenuTemplateDryRunError(
        'CUSTOMER_DATABASE_URL_TEMPLATE 必须包含 {customerId} 占位符',
      );
    }
    return applyDatabaseName(
      template.replaceAll('{customerId}', normalizedCustomerId),
      targetDbName,
    );
  }

  const url = parseDbUrl(databaseUrl);
  const prefix = process.env.CUSTOMER_DB_PREFIX || 'customer_';
  url.pathname = `/${prefix}${normalizedCustomerId}`;
  return applyDatabaseName(url.toString(), targetDbName);
}

function getDatabaseNameFromUrl(rawUrl) {
  return decodeURIComponent(parseDbUrl(rawUrl).pathname.replace(/^\//, ''));
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

function getRedisUrl() {
  return stripWrappingQuotes(process.env.REDIS_URL);
}

function maskRedisUrl(rawUrl) {
  const redisUrl = stripWrappingQuotes(rawUrl);
  if (!redisUrl) {
    return '';
  }
  try {
    const url = new URL(redisUrl);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return redisUrl.replaceAll(/:\/\/([^:/?#]+):([^@/?#]+)@/g, '://$1:***@');
  }
}

function buildRedisOutput(options) {
  const redisUrl = getRedisUrl();
  return {
    required: Boolean(options.execute),
    url: redisUrl ? maskRedisUrl(redisUrl) : null,
  };
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function toIsoString(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function normalizeComparableValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === undefined) {
    return null;
  }
  return value;
}

function toJsonValue(value) {
  return JSON.stringify(value ?? null);
}

async function readMenus(connection) {
  const rows = await connection.query(`
    SELECT
      menu_id AS menuId,
      name,
      type,
      status,
      path,
      active_path AS activePath,
      redirect,
      component,
      pid,
      auth_code AS authCode,
      template_key AS templateKey,
      template_parent_key AS templateParentKey,
      template_version AS templateVersion,
      template_managed AS templateManaged,
      template_internal_only AS templateInternalOnly,
      template_deleted_at AS templateDeletedAt
    FROM menu
    ORDER BY menu_id ASC
  `);

  return rows.map((row) => ({
    ...row,
    menuId: Number(row.menuId),
    pid: row.pid === null || row.pid === undefined ? null : Number(row.pid),
    status: Number(row.status),
    templateDeletedAt: toIsoString(row.templateDeletedAt),
    templateInternalOnly: toBoolean(row.templateInternalOnly),
    templateManaged: toBoolean(row.templateManaged),
    templateVersion: Number(row.templateVersion || 1),
  }));
}

async function readMenuMetas(connection) {
  const rows = await connection.query(`
    SELECT
      meta_id AS metaId,
      title,
      icon,
      \`order\`,
      color,
      active_icon AS activeIcon,
      active_path AS activePath,
      affix_tab AS affixTab,
      affix_tab_order AS affixTabOrder,
      badge_content AS badge,
      badge_type AS badgeType,
      badge_variants AS badgeVariants,
      hide_children_in_menu AS hideChildrenInMenu,
      hide_in_breadcrumb AS hideInBreadcrumb,
      hide_in_menu AS hideInMenu,
      hide_in_tab AS hideInTab,
      iframe_src AS iframeSrc,
      keep_alive AS keepAlive,
      link,
      is_app AS isApp,
      max_num_of_open_tab AS maxNumOfOpenTab,
      no_basic_layout AS noBasicLayout,
      open_in_new_window AS openInNewWindow,
      menu_id AS menuId
    FROM menu_meta
    ORDER BY menu_id ASC
  `);

  return rows.map((row) => ({
    ...row,
    affixTab: row.affixTab === null ? null : toBoolean(row.affixTab),
    hideChildrenInMenu:
      row.hideChildrenInMenu === null
        ? null
        : toBoolean(row.hideChildrenInMenu),
    hideInBreadcrumb:
      row.hideInBreadcrumb === null ? null : toBoolean(row.hideInBreadcrumb),
    hideInMenu: row.hideInMenu === null ? null : toBoolean(row.hideInMenu),
    hideInTab: row.hideInTab === null ? null : toBoolean(row.hideInTab),
    isApp: row.isApp === null ? null : toBoolean(row.isApp),
    keepAlive: row.keepAlive === null ? null : toBoolean(row.keepAlive),
    menuId: Number(row.menuId),
    metaId: Number(row.metaId),
    noBasicLayout:
      row.noBasicLayout === null ? null : toBoolean(row.noBasicLayout),
    openInNewWindow:
      row.openInNewWindow === null ? null : toBoolean(row.openInNewWindow),
  }));
}

async function readCodes(connection) {
  const rows = await connection.query(`
    SELECT
      code_id AS codeId,
      code,
      name,
      content,
      menu_id AS menuId,
      template_key AS templateKey,
      template_version AS templateVersion,
      template_managed AS templateManaged,
      template_internal_only AS templateInternalOnly,
      template_deleted_at AS templateDeletedAt
    FROM code
    ORDER BY code_id ASC
  `);

  return rows.map((row) => ({
    ...row,
    codeId: Number(row.codeId),
    menuId:
      row.menuId === null || row.menuId === undefined
        ? null
        : Number(row.menuId),
    templateDeletedAt: toIsoString(row.templateDeletedAt),
    templateInternalOnly: toBoolean(row.templateInternalOnly),
    templateManaged: toBoolean(row.templateManaged),
    templateVersion: Number(row.templateVersion || 1),
  }));
}

async function readSnapshot(connection) {
  const [menus, metas, codes] = await Promise.all([
    readMenus(connection),
    readMenuMetas(connection),
    readCodes(connection),
  ]);
  const menusById = new Map(menus.map((item) => [item.menuId, item]));
  const normalizedCodes = codes.map((code) => ({
    ...code,
    menuTemplateKey: code.menuId
      ? menusById.get(code.menuId)?.templateKey || null
      : null,
  }));
  return {
    codes: normalizedCodes,
    codesByMenuId: new Map(
      normalizedCodes
        .filter((item) => item.menuId)
        .map((item) => [item.menuId, item]),
    ),
    metas,
    metasByMenuId: new Map(metas.map((item) => [item.menuId, item])),
    menus,
    menusById,
  };
}

function isPublishableTemplate(row) {
  return (
    row.templateManaged && !row.templateInternalOnly && !row.templateDeletedAt
  );
}

function buildPublishSnapshot(snapshot) {
  const menus = snapshot.menus.filter((item) => isPublishableTemplate(item));
  const publishMenuIdSet = new Set(menus.map((item) => item.menuId));
  const excludedCodes = snapshot.codes.filter(
    (item) =>
      isPublishableTemplate(item) &&
      item.menuId &&
      !publishMenuIdSet.has(item.menuId),
  );
  const codes = snapshot.codes.filter(
    (item) =>
      isPublishableTemplate(item) &&
      (!item.menuId || publishMenuIdSet.has(item.menuId)),
  );
  return {
    ...snapshot,
    allCodesByMenuId: snapshot.codesByMenuId,
    codes,
    codesByMenuId: new Map(
      codes.filter((item) => item.menuId).map((item) => [item.menuId, item]),
    ),
    excludedCodes,
    menus,
    metas: menus
      .map((menu) => snapshot.metasByMenuId.get(menu.menuId))
      .filter(Boolean),
    metasByMenuId: new Map(
      menus
        .map((menu) => snapshot.metasByMenuId.get(menu.menuId))
        .filter(Boolean)
        .map((meta) => [meta.menuId, meta]),
    ),
    publishMenuIdSet,
  };
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

function findDuplicateTemplateKeys(items, idName) {
  return [...groupBy(items, (item) => item.templateKey || '').entries()]
    .filter(([key, values]) => key && values.length > 1)
    .map(([key, values]) => ({
      ids: values.map((item) => item[idName]),
      key,
    }));
}

function indexByTemplateKey(items) {
  const map = new Map();
  for (const item of items) {
    if (item.templateKey) {
      map.set(item.templateKey, item);
    }
  }
  return map;
}

function diffFields(source, target, fields) {
  const changes = [];
  for (const field of fields) {
    const sourceValue = normalizeComparableValue(source?.[field] ?? null);
    const targetValue = normalizeComparableValue(target?.[field] ?? null);
    if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
      changes.push({
        field,
        source: sourceValue,
        target: targetValue,
      });
    }
  }
  return changes;
}

function summarizeDetails(details) {
  return {
    code: {
      adopt: details.code.adopt.length,
      conflict: details.code.conflict.length,
      create: details.code.create.length,
      disable: details.code.disable.length,
      update: details.code.update.length,
    },
    menu: {
      adopt: details.menu.adopt.length,
      conflict: details.menu.conflict.length,
      create: details.menu.create.length,
      disable: details.menu.disable.length,
      parentChanged: details.menu.parentChanged.length,
      update: details.menu.update.length,
    },
  };
}

function pushConflict(details, scope, reason, item) {
  details[scope].conflict.push({
    ...item,
    reason,
  });
}

function findMenuTemplateParentCycles(menus) {
  const parentByKey = new Map(
    menus
      .filter((item) => item.templateKey)
      .map((item) => [item.templateKey, item.templateParentKey || '']),
  );
  const reported = new Set();
  const cycles = [];

  for (const menu of menus) {
    if (!menu.templateKey) {
      continue;
    }
    const pathKeys = [];
    const seen = new Set();
    let currentKey = menu.templateKey;

    while (currentKey && parentByKey.has(currentKey)) {
      if (seen.has(currentKey)) {
        const startIndex = pathKeys.indexOf(currentKey);
        const cycleKeys = [...pathKeys.slice(startIndex), currentKey];
        const reportKey = [...new Set(cycleKeys)].sort().join('|');
        if (!reported.has(reportKey)) {
          reported.add(reportKey);
          cycles.push(cycleKeys);
        }
        break;
      }
      seen.add(currentKey);
      pathKeys.push(currentKey);
      currentKey = parentByKey.get(currentKey);
    }
  }

  return cycles;
}

function validateSourceSnapshot(source, details) {
  const menuDuplicateKeys = findDuplicateTemplateKeys(source.menus, 'menuId');
  for (const item of menuDuplicateKeys) {
    pushConflict(details, 'menu', 'source_duplicate_template_key', item);
  }

  const codeDuplicateKeys = findDuplicateTemplateKeys(source.codes, 'codeId');
  for (const item of codeDuplicateKeys) {
    pushConflict(details, 'code', 'source_duplicate_template_key', item);
  }

  const menuKeys = new Set(source.menus.map((item) => item.templateKey));
  for (const cycleKeys of findMenuTemplateParentCycles(source.menus)) {
    pushConflict(details, 'menu', 'source_parent_cycle', {
      cycleKeys,
    });
  }

  for (const menu of source.menus) {
    if (!menu.templateKey) {
      pushConflict(details, 'menu', 'source_missing_template_key', {
        menuId: menu.menuId,
        name: menu.name,
      });
    }
    if (menu.templateParentKey && !menuKeys.has(menu.templateParentKey)) {
      pushConflict(details, 'menu', 'source_parent_not_publishable', {
        menuId: menu.menuId,
        name: menu.name,
        templateKey: menu.templateKey,
        templateParentKey: menu.templateParentKey,
      });
    }
    if (!source.metasByMenuId.has(menu.menuId)) {
      pushConflict(details, 'menu', 'source_missing_menu_meta', {
        menuId: menu.menuId,
        name: menu.name,
        templateKey: menu.templateKey,
      });
    }
    if (menu.type === 'button') {
      const linkedCode = source.allCodesByMenuId?.get(menu.menuId);
      if (!linkedCode) {
        pushConflict(details, 'code', 'source_button_menu_missing_code', {
          menuId: menu.menuId,
          name: menu.name,
          templateKey: menu.templateKey,
        });
      } else if (!source.codesByMenuId.has(menu.menuId)) {
        pushConflict(details, 'code', 'source_button_code_not_publishable', {
          code: linkedCode.code,
          codeId: linkedCode.codeId,
          codeTemplateKey: linkedCode.templateKey,
          menuId: menu.menuId,
          menuTemplateKey: menu.templateKey,
        });
      }
    }
  }

  for (const code of source.codes) {
    if (!code.templateKey) {
      pushConflict(details, 'code', 'source_missing_template_key', {
        code: code.code,
        codeId: code.codeId,
        menuId: code.menuId,
      });
    }
  }

  for (const code of source.excludedCodes || []) {
    pushConflict(details, 'code', 'source_code_menu_not_publishable', {
      code: code.code,
      codeId: code.codeId,
      menuId: code.menuId,
      templateKey: code.templateKey,
    });
  }
}

function validateTargetSnapshot(target, details) {
  const menuDuplicateKeys = findDuplicateTemplateKeys(target.menus, 'menuId');
  for (const item of menuDuplicateKeys) {
    pushConflict(details, 'menu', 'target_duplicate_template_key', item);
  }

  const codeDuplicateKeys = findDuplicateTemplateKeys(target.codes, 'codeId');
  for (const item of codeDuplicateKeys) {
    pushConflict(details, 'code', 'target_duplicate_template_key', item);
  }

  for (const menu of target.menus) {
    if (menu.templateManaged && !menu.templateKey) {
      pushConflict(details, 'menu', 'target_managed_missing_template_key', {
        menuId: menu.menuId,
        name: menu.name,
      });
    }
  }

  for (const code of target.codes) {
    if (code.templateManaged && !code.templateKey) {
      pushConflict(details, 'code', 'target_managed_missing_template_key', {
        code: code.code,
        codeId: code.codeId,
      });
    }
  }
}

function validateTargetCodeMenuSlots(
  source,
  target,
  details,
  targetMenuByKey,
  targetCodeByKey,
) {
  for (const sourceCode of source.codes) {
    if (!sourceCode.templateKey || !sourceCode.menuId) {
      continue;
    }

    const sourceMenu = source.menusById.get(sourceCode.menuId);
    if (!sourceMenu?.templateKey) {
      continue;
    }

    const expectedTargetMenu = targetMenuByKey.get(sourceMenu.templateKey);
    if (!expectedTargetMenu) {
      continue;
    }

    const targetCode = targetCodeByKey.get(sourceCode.templateKey);
    const targetSlotCode = target.codesByMenuId.get(expectedTargetMenu.menuId);
    if (!targetSlotCode) {
      continue;
    }
    if (!targetCode || targetCode.codeId !== targetSlotCode.codeId) {
      pushConflict(details, 'code', 'target_code_menu_slot_conflict', {
        expectedMenuId: expectedTargetMenu.menuId,
        expectedMenuTemplateKey: sourceMenu.templateKey,
        sourceCodeId: sourceCode.codeId,
        sourceCodeTemplateKey: sourceCode.templateKey,
        targetCodeId: targetSlotCode.codeId,
        targetCodeTemplateKey: targetSlotCode.templateKey,
      });
    }
  }
}

function buildEmptyDetails() {
  return {
    code: {
      adopt: [],
      conflict: [],
      create: [],
      disable: [],
      update: [],
    },
    menu: {
      adopt: [],
      conflict: [],
      create: [],
      disable: [],
      parentChanged: [],
      update: [],
    },
  };
}

function buildDiff(source, target) {
  const details = buildEmptyDetails();
  validateSourceSnapshot(source, details);
  validateTargetSnapshot(target, details);

  const sourceMenuByKey = indexByTemplateKey(source.menus);
  const targetMenuByKey = indexByTemplateKey(target.menus);
  const sourceCodeByKey = indexByTemplateKey(source.codes);
  const targetCodeByKey = indexByTemplateKey(target.codes);
  validateTargetCodeMenuSlots(
    source,
    target,
    details,
    targetMenuByKey,
    targetCodeByKey,
  );

  for (const sourceMenu of source.menus) {
    if (!sourceMenu.templateKey) {
      continue;
    }
    const targetMenu = targetMenuByKey.get(sourceMenu.templateKey);
    if (!targetMenu) {
      details.menu.create.push({
        menuId: sourceMenu.menuId,
        name: sourceMenu.name,
        templateKey: sourceMenu.templateKey,
        templateParentKey: sourceMenu.templateParentKey,
      });
      continue;
    }

    const fieldChanges = diffFields(
      sourceMenu,
      targetMenu,
      MENU_COMPARE_FIELDS,
    );
    const metaChanges = diffFields(
      source.metasByMenuId.get(sourceMenu.menuId),
      target.metasByMenuId.get(targetMenu.menuId),
      MENU_META_COMPARE_FIELDS,
    );
    const parentChanged =
      sourceMenu.templateParentKey !== targetMenu.templateParentKey;
    if (!targetMenu.templateManaged) {
      details.menu.adopt.push({
        changes: fieldChanges,
        metaChanges,
        parentChanged,
        sourceMenuId: sourceMenu.menuId,
        targetMenuId: targetMenu.menuId,
        templateKey: sourceMenu.templateKey,
        sourceTemplateParentKey: sourceMenu.templateParentKey,
        targetTemplateParentKey: targetMenu.templateParentKey,
      });
      continue;
    }
    if (parentChanged) {
      details.menu.parentChanged.push({
        sourceMenuId: sourceMenu.menuId,
        targetMenuId: targetMenu.menuId,
        templateKey: sourceMenu.templateKey,
        sourceTemplateParentKey: sourceMenu.templateParentKey,
        targetTemplateParentKey: targetMenu.templateParentKey,
      });
    }
    if (fieldChanges.length > 0 || metaChanges.length > 0) {
      details.menu.update.push({
        changes: fieldChanges,
        metaChanges,
        sourceMenuId: sourceMenu.menuId,
        targetMenuId: targetMenu.menuId,
        templateKey: sourceMenu.templateKey,
      });
    }
  }

  for (const targetMenu of target.menus) {
    if (
      targetMenu.templateManaged &&
      targetMenu.templateKey &&
      !targetMenu.templateDeletedAt &&
      !sourceMenuByKey.has(targetMenu.templateKey)
    ) {
      details.menu.disable.push({
        menuId: targetMenu.menuId,
        name: targetMenu.name,
        templateKey: targetMenu.templateKey,
      });
    }
  }

  for (const sourceCode of source.codes) {
    if (!sourceCode.templateKey) {
      continue;
    }
    const targetCode = targetCodeByKey.get(sourceCode.templateKey);
    if (!targetCode) {
      details.code.create.push({
        code: sourceCode.code,
        codeId: sourceCode.codeId,
        templateKey: sourceCode.templateKey,
      });
      continue;
    }
    const changes = diffFields(sourceCode, targetCode, CODE_COMPARE_FIELDS);
    if (!targetCode.templateManaged) {
      details.code.adopt.push({
        changes,
        sourceCodeId: sourceCode.codeId,
        targetCodeId: targetCode.codeId,
        templateKey: sourceCode.templateKey,
      });
      continue;
    }

    if (changes.length > 0) {
      details.code.update.push({
        changes,
        sourceCodeId: sourceCode.codeId,
        targetCodeId: targetCode.codeId,
        templateKey: sourceCode.templateKey,
      });
    }
  }

  for (const targetCode of target.codes) {
    if (
      targetCode.templateManaged &&
      targetCode.templateKey &&
      !targetCode.templateDeletedAt &&
      !sourceCodeByKey.has(targetCode.templateKey)
    ) {
      details.code.disable.push({
        code: targetCode.code,
        codeId: targetCode.codeId,
        templateKey: targetCode.templateKey,
      });
    }
  }

  const summary = summarizeDetails(details);
  const blocked = summary.menu.conflict > 0 || summary.code.conflict > 0;

  return {
    blocked,
    details,
    summary,
  };
}

async function createJob(centerConnection, params) {
  const result = await centerConnection.query(
    `
      INSERT INTO menu_template_sync_job
        (mode, source_customer_id, target_scope, target_customer_id, status, started_at)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `,
    [
      params.mode,
      params.sourceCustomerId,
      params.targetScope,
      params.targetCustomerId || null,
      'running',
      new Date(),
    ],
  );
  return Number(result.insertId);
}

async function updateJob(centerConnection, jobId, params) {
  if (!jobId) {
    return;
  }
  await centerConnection.query(
    `
      UPDATE menu_template_sync_job
      SET
        status = ?,
        summary = ?,
        error_message = ?,
        completed_at = ?,
        update_time = ?
      WHERE id = ?
    `,
    [
      params.status,
      toJsonValue(params.summary),
      params.errorMessage || null,
      new Date(),
      new Date(),
      jobId,
    ],
  );
}

async function createLog(centerConnection, jobId, params) {
  if (!jobId) {
    return;
  }
  await centerConnection.query(
    `
      INSERT INTO menu_template_sync_log
        (job_id, target_customer_id, target_db_name, status, summary, details, error_message)
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      jobId,
      params.targetCustomerId,
      params.targetDbName || null,
      params.status,
      toJsonValue(params.summary),
      toJsonValue(params.details),
      params.errorMessage || null,
    ],
  );
}

async function listTenantTargets(centerConnection) {
  const defaultCustomerId = getDefaultCustomerId();
  const rows = await centerConnection.query(
    `
      SELECT
        customer_id AS customerId,
        db_name AS dbName,
        name
      FROM customer
      WHERE status = 1
        AND customer_id NOT IN (?, ?)
      ORDER BY customer_id ASC
    `,
    ['public', defaultCustomerId],
  );

  return rows.map((row) => ({
    customerId: normalizeCustomerId(row.customerId),
    dbName: row.dbName ? normalizeDatabaseName(row.dbName) : '',
    name: row.name ? String(row.name) : '',
  }));
}

function buildSingleTarget(options) {
  return {
    customerId:
      options.targetCustomerId ||
      `direct_${getDatabaseNameFromUrl(options.targetDatabaseUrl)}`,
    databaseUrl: options.targetDatabaseUrl,
    dbName: options.targetDbName,
  };
}

function resolveTargetDatabaseUrl(target) {
  return (
    target.databaseUrl ||
    resolveCustomerDbUrl(target.customerId, {
      dbName: target.dbName,
    })
  );
}

function maskTargetDatabaseUrl(target) {
  if (target.databaseUrl) {
    return maskDatabaseUrl(target.databaseUrl);
  }
  try {
    return maskDatabaseUrl(resolveTargetDatabaseUrl(target));
  } catch {
    return '';
  }
}

async function runTarget(sourcePublishSnapshot, target) {
  const targetDatabaseUrl = resolveTargetDatabaseUrl(target);
  const targetConnection = await openConnection(targetDatabaseUrl);
  try {
    const targetSnapshot = await readSnapshot(targetConnection);
    const diff = buildDiff(sourcePublishSnapshot, targetSnapshot);
    return {
      databaseUrl: maskDatabaseUrl(targetDatabaseUrl),
      details: diff.details,
      status: diff.blocked ? 'blocked' : 'ready',
      summary: diff.summary,
      targetCustomerId: target.customerId,
      targetDbName:
        target.dbName || getDatabaseNameFromUrl(targetDatabaseUrl) || null,
    };
  } finally {
    await targetConnection.end().catch(() => undefined);
  }
}

function toDbNullable(value) {
  return value === undefined ? null : value;
}

function toDbBoolean(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return toBoolean(value) ? 1 : 0;
}

function getMenuWriteParams(sourceMenu) {
  return [
    sourceMenu.name || '',
    sourceMenu.type || 'menu',
    Number(sourceMenu.status ?? 1),
    sourceMenu.path || '',
    toDbNullable(sourceMenu.activePath),
    toDbNullable(sourceMenu.redirect),
    toDbNullable(sourceMenu.component),
    toDbNullable(sourceMenu.authCode),
    sourceMenu.templateKey,
    toDbNullable(sourceMenu.templateParentKey),
    Number(sourceMenu.templateVersion || 1),
  ];
}

async function upsertMenuFromSource(connection, sourceMenu, targetMenu) {
  const params = getMenuWriteParams(sourceMenu);
  if (targetMenu) {
    await connection.query(
      `
        UPDATE menu
        SET
          name = ?,
          type = ?,
          status = ?,
          path = ?,
          active_path = ?,
          redirect = ?,
          component = ?,
          auth_code = ?,
          template_key = ?,
          template_parent_key = ?,
          template_version = ?,
          template_managed = 1,
          template_internal_only = 0,
          template_deleted_at = NULL
        WHERE menu_id = ?
      `,
      [...params, targetMenu.menuId],
    );
    return targetMenu.menuId;
  }

  const result = await connection.query(
    `
      INSERT INTO menu
        (
          name,
          type,
          status,
          path,
          active_path,
          redirect,
          component,
          auth_code,
          template_key,
          template_parent_key,
          template_version,
          template_managed,
          template_internal_only,
          template_deleted_at,
          pid
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, NULL)
    `,
    params,
  );
  return Number(result.insertId);
}

function getMenuMetaWriteParams(sourceMeta, targetMenuId) {
  return [
    sourceMeta.title || '',
    toDbNullable(sourceMeta.icon),
    toDbNullable(sourceMeta.order),
    toDbNullable(sourceMeta.color),
    toDbNullable(sourceMeta.activeIcon),
    toDbNullable(sourceMeta.activePath),
    toDbBoolean(sourceMeta.affixTab),
    toDbNullable(sourceMeta.affixTabOrder),
    toDbNullable(sourceMeta.badge),
    toDbNullable(sourceMeta.badgeType),
    toDbNullable(sourceMeta.badgeVariants),
    toDbBoolean(sourceMeta.hideChildrenInMenu),
    toDbBoolean(sourceMeta.hideInBreadcrumb),
    toDbBoolean(sourceMeta.hideInMenu),
    toDbBoolean(sourceMeta.hideInTab),
    toDbNullable(sourceMeta.iframeSrc),
    toDbBoolean(sourceMeta.keepAlive),
    toDbNullable(sourceMeta.link),
    toDbBoolean(sourceMeta.isApp),
    toDbNullable(sourceMeta.maxNumOfOpenTab),
    toDbBoolean(sourceMeta.noBasicLayout),
    toDbBoolean(sourceMeta.openInNewWindow),
    targetMenuId,
  ];
}

async function upsertMenuMetaFromSource(
  connection,
  sourceMeta,
  targetMenuId,
  targetMeta,
) {
  const params = getMenuMetaWriteParams(sourceMeta, targetMenuId);
  if (targetMeta) {
    await connection.query(
      `
        UPDATE menu_meta
        SET
          title = ?,
          icon = ?,
          \`order\` = ?,
          color = ?,
          active_icon = ?,
          active_path = ?,
          affix_tab = ?,
          affix_tab_order = ?,
          badge_content = ?,
          badge_type = ?,
          badge_variants = ?,
          hide_children_in_menu = ?,
          hide_in_breadcrumb = ?,
          hide_in_menu = ?,
          hide_in_tab = ?,
          iframe_src = ?,
          keep_alive = ?,
          link = ?,
          is_app = ?,
          max_num_of_open_tab = ?,
          no_basic_layout = ?,
          open_in_new_window = ?
        WHERE menu_id = ?
      `,
      params,
    );
    return;
  }

  await connection.query(
    `
      INSERT INTO menu_meta
        (
          title,
          icon,
          \`order\`,
          color,
          active_icon,
          active_path,
          affix_tab,
          affix_tab_order,
          badge_content,
          badge_type,
          badge_variants,
          hide_children_in_menu,
          hide_in_breadcrumb,
          hide_in_menu,
          hide_in_tab,
          iframe_src,
          keep_alive,
          link,
          is_app,
          max_num_of_open_tab,
          no_basic_layout,
          open_in_new_window,
          menu_id
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params,
  );
}

function getTargetMenuIdForSourceCode(
  source,
  targetMenuIdByTemplateKey,
  sourceCode,
) {
  if (!sourceCode.menuId) {
    return null;
  }
  const sourceMenu = source.menusById.get(sourceCode.menuId);
  if (!sourceMenu?.templateKey) {
    return null;
  }
  return targetMenuIdByTemplateKey.get(sourceMenu.templateKey) || null;
}

function getCodeWriteParams(sourceCode, targetMenuId) {
  return [
    sourceCode.code || '',
    sourceCode.name || '',
    toDbNullable(sourceCode.content),
    targetMenuId,
    sourceCode.templateKey,
    Number(sourceCode.templateVersion || 1),
  ];
}

async function upsertCodeFromSource(
  connection,
  sourceCode,
  targetMenuId,
  targetCode,
) {
  const params = getCodeWriteParams(sourceCode, targetMenuId);
  if (targetCode) {
    await connection.query(
      `
        UPDATE code
        SET
          code = ?,
          name = ?,
          content = ?,
          menu_id = ?,
          template_key = ?,
          template_version = ?,
          template_managed = 1,
          template_internal_only = 0,
          template_deleted_at = NULL
        WHERE code_id = ?
      `,
      [...params, targetCode.codeId],
    );
    return targetCode.codeId;
  }

  const result = await connection.query(
    `
      INSERT INTO code
        (
          code,
          name,
          content,
          menu_id,
          template_key,
          template_version,
          template_managed,
          template_internal_only,
          template_deleted_at
        )
      VALUES
        (?, ?, ?, ?, ?, ?, 1, 0, NULL)
    `,
    params,
  );
  return Number(result.insertId);
}

async function disableTargetMenu(connection, targetMenu, now) {
  await connection.query(
    `
      UPDATE menu
      SET
        status = 0,
        template_deleted_at = COALESCE(template_deleted_at, ?)
      WHERE menu_id = ?
    `,
    [now, targetMenu.menuId],
  );
}

async function disableTargetCode(connection, targetCode, now) {
  await connection.query(
    `
      UPDATE code
      SET
        template_deleted_at = COALESCE(template_deleted_at, ?)
      WHERE code_id = ?
    `,
    [now, targetCode.codeId],
  );
}

async function applyMenuTemplateSync(connection, source, target) {
  const sourceMenuByKey = indexByTemplateKey(source.menus);
  const sourceCodeByKey = indexByTemplateKey(source.codes);
  const targetMenuByKey = indexByTemplateKey(target.menus);
  const targetCodeByKey = indexByTemplateKey(target.codes);
  const targetMetaByMenuId = new Map(target.metasByMenuId);
  const targetMenuIdByTemplateKey = new Map();
  const execution = {
    code: {
      disabled: 0,
      upserted: 0,
    },
    menu: {
      disabled: 0,
      metaUpserted: 0,
      parentFixed: 0,
      upserted: 0,
    },
  };

  for (const sourceMenu of source.menus) {
    if (!sourceMenu.templateKey) {
      continue;
    }
    const targetMenu = targetMenuByKey.get(sourceMenu.templateKey);
    const targetMenuId = await upsertMenuFromSource(
      connection,
      sourceMenu,
      targetMenu,
    );
    targetMenuIdByTemplateKey.set(sourceMenu.templateKey, targetMenuId);
    execution.menu.upserted += 1;

    const sourceMeta = source.metasByMenuId.get(sourceMenu.menuId);
    if (!sourceMeta) {
      throw new MenuTemplateDryRunError(
        `source menu ${sourceMenu.templateKey} 缺少 menu_meta`,
      );
    }
    await upsertMenuMetaFromSource(
      connection,
      sourceMeta,
      targetMenuId,
      targetMetaByMenuId.get(targetMenuId),
    );
    targetMetaByMenuId.set(targetMenuId, { menuId: targetMenuId });
    execution.menu.metaUpserted += 1;
  }

  for (const sourceMenu of source.menus) {
    if (!sourceMenu.templateKey) {
      continue;
    }
    const targetMenuId = targetMenuIdByTemplateKey.get(sourceMenu.templateKey);
    const parentMenuId = sourceMenu.templateParentKey
      ? targetMenuIdByTemplateKey.get(sourceMenu.templateParentKey) || null
      : null;
    await connection.query('UPDATE menu SET pid = ? WHERE menu_id = ?', [
      parentMenuId,
      targetMenuId,
    ]);
    execution.menu.parentFixed += 1;
  }

  for (const sourceCode of source.codes) {
    if (!sourceCode.templateKey) {
      continue;
    }
    const targetMenuId = getTargetMenuIdForSourceCode(
      source,
      targetMenuIdByTemplateKey,
      sourceCode,
    );
    const targetCode = targetCodeByKey.get(sourceCode.templateKey);
    await upsertCodeFromSource(
      connection,
      sourceCode,
      targetMenuId,
      targetCode,
    );
    execution.code.upserted += 1;
  }

  const now = new Date();
  for (const targetMenu of target.menus) {
    if (
      targetMenu.templateManaged &&
      targetMenu.templateKey &&
      !targetMenu.templateDeletedAt &&
      !sourceMenuByKey.has(targetMenu.templateKey)
    ) {
      await disableTargetMenu(connection, targetMenu, now);
      execution.menu.disabled += 1;
    }
  }

  for (const targetCode of target.codes) {
    if (
      targetCode.templateManaged &&
      targetCode.templateKey &&
      !targetCode.templateDeletedAt &&
      !sourceCodeByKey.has(targetCode.templateKey)
    ) {
      await disableTargetCode(connection, targetCode, now);
      execution.code.disabled += 1;
    }
  }

  return execution;
}

let redisClientPromise = null;

async function getScriptRedisClient() {
  const url = getRedisUrl();
  if (!url) {
    return null;
  }
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({ url });
      client.on('error', (error) => {
        console.error('[menu-template:sync] Redis client error:', error);
      });
      await client.connect();
      return client;
    })();
  }
  return await redisClientPromise;
}

async function closeScriptRedisClient() {
  if (!redisClientPromise) {
    return;
  }
  const client = await redisClientPromise.catch(() => null);
  redisClientPromise = null;
  await client?.quit().catch(() => undefined);
}

async function assertPermissionCacheReadyForExecute() {
  const redis = await getScriptRedisClient();
  if (!redis) {
    throw new MenuTemplateDryRunError('--execute 需要配置 REDIS_URL');
  }
  await redis.ping();
}

async function bumpPermissionCacheVersion(customerId) {
  const redis = await getScriptRedisClient();
  if (!redis) {
    throw new MenuTemplateDryRunError('--execute 需要配置 REDIS_URL');
  }
  const value = await redis.incr(`permission:version:${customerId}`);
  return {
    status: 'bumped',
    version: Number(value),
  };
}

async function executeTarget(sourcePublishSnapshot, target) {
  const targetDatabaseUrl = resolveTargetDatabaseUrl(target);
  const targetConnection = await openConnection(targetDatabaseUrl);
  let committed = false;
  let execution;
  let targetSnapshot;
  let diff;
  const targetDbName =
    target.dbName || getDatabaseNameFromUrl(targetDatabaseUrl) || null;

  try {
    await targetConnection.beginTransaction();
    targetSnapshot = await readSnapshot(targetConnection);
    diff = buildDiff(sourcePublishSnapshot, targetSnapshot);

    if (diff.blocked) {
      const blockedResult = {
        databaseUrl: maskDatabaseUrl(targetDatabaseUrl),
        details: diff.details,
        errorMessage: `目标 ${target.customerId} execute 前 preflight blocked`,
        status: 'blocked',
        summary: diff.summary,
        targetCustomerId: target.customerId,
        targetDbName,
      };
      throw new TargetExecutionError(
        `目标 ${target.customerId} execute 前 preflight blocked`,
        blockedResult,
      );
    }

    execution = await applyMenuTemplateSync(
      targetConnection,
      sourcePublishSnapshot,
      targetSnapshot,
    );
    await targetConnection.commit();
    committed = true;
    let permissionCache;
    try {
      permissionCache = await bumpPermissionCacheVersion(target.customerId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TargetExecutionError(
        `目标 ${target.customerId} 数据已提交，但权限缓存刷新失败: ${errorMessage}`,
        {
          databaseUrl: maskDatabaseUrl(targetDatabaseUrl),
          details: diff.details,
          errorMessage,
          execution,
          permissionCache: {
            errorMessage,
            status: 'failed',
          },
          status: 'failed',
          summary: diff.summary,
          targetCustomerId: target.customerId,
          targetDbName,
        },
      );
    }

    return {
      databaseUrl: maskDatabaseUrl(targetDatabaseUrl),
      details: diff.details,
      execution,
      permissionCache,
      status: 'completed',
      summary: diff.summary,
      targetCustomerId: target.customerId,
      targetDbName,
    };
  } catch (error) {
    if (!committed) {
      await targetConnection.rollback().catch(() => undefined);
    }
    if (error instanceof TargetExecutionError) {
      throw error;
    }
    throw new TargetExecutionError(
      error instanceof Error ? error.message : String(error),
      {
        databaseUrl: maskDatabaseUrl(targetDatabaseUrl),
        details: diff?.details || buildEmptyDetails(),
        errorMessage: error instanceof Error ? error.message : String(error),
        status: 'failed',
        summary: diff?.summary || summarizeDetails(buildEmptyDetails()),
        targetCustomerId: target.customerId,
        targetDbName,
      },
    );
  } finally {
    await targetConnection.end().catch(() => undefined);
  }
}

function summarizeTargets(results) {
  return {
    blocked: results.filter((item) => item.status === 'blocked').length,
    ready: results.filter((item) => item.status === 'ready').length,
    targets: results.length,
  };
}

function summarizeExecutions(results) {
  return {
    blocked: results.filter((item) => item.status === 'blocked').length,
    completed: results.filter((item) => item.status === 'completed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    targets: results.length,
  };
}

export async function runMenuTemplateSync(rawArgv = process.argv.slice(2)) {
  const argv = normalizeArgv(rawArgv);
  if (shouldPrintHelp(argv)) {
    printHelp();
    return null;
  }

  const options = parseArgs(argv);
  const sourceDatabaseUrl =
    options.sourceDatabaseUrl || resolveCustomerDbUrl(options.sourceCustomerId);
  const needsCenterConnection = options.log || options.allTenants;
  const centerConnection = needsCenterConnection
    ? await openConnection(resolveCenterDatabaseUrl())
    : null;
  let jobId = 0;

  try {
    if (options.execute) {
      await assertPermissionCacheReadyForExecute();
    }

    const targets = options.allTenants
      ? await listTenantTargets(centerConnection)
      : [buildSingleTarget(options)];
    const targetScope = options.allTenants
      ? 'all_tenants'
      : targets[0]?.customerId || 'direct';
    const mode = options.execute ? 'execute' : 'dry_run';

    if (options.log && centerConnection) {
      jobId = await createJob(centerConnection, {
        mode,
        sourceCustomerId: options.sourceCustomerId,
        targetCustomerId: options.allTenants ? '' : targets[0]?.customerId,
        targetScope,
      });
    }

    const sourceConnection = await openConnection(sourceDatabaseUrl);
    let sourceSnapshot;
    try {
      sourceSnapshot = buildPublishSnapshot(
        await readSnapshot(sourceConnection),
      );
    } finally {
      await sourceConnection.end().catch(() => undefined);
    }

    const preflightResults = [];
    for (const target of targets) {
      try {
        const result = await runTarget(sourceSnapshot, target);
        preflightResults.push(result);
      } catch (error) {
        const failed = {
          databaseUrl: maskTargetDatabaseUrl(target),
          details: buildEmptyDetails(),
          errorMessage: error instanceof Error ? error.message : String(error),
          status: 'blocked',
          summary: summarizeDetails(buildEmptyDetails()),
          targetCustomerId: target.customerId,
          targetDbName: target.dbName || '',
        };
        preflightResults.push(failed);
      }
    }

    if (!options.execute) {
      for (const result of preflightResults) {
        if (options.log && centerConnection) {
          await createLog(centerConnection, jobId, {
            details: result.details,
            errorMessage: result.errorMessage,
            status: result.status,
            summary: result.summary,
            targetCustomerId: result.targetCustomerId,
            targetDbName: result.targetDbName,
          });
        }
      }

      const summary = summarizeTargets(preflightResults);
      const status = summary.blocked > 0 ? 'blocked' : 'ready';
      if (options.log && centerConnection) {
        await updateJob(centerConnection, jobId, {
          status,
          summary,
        });
      }

      return {
        dryRun: true,
        jobId: jobId || null,
        mode,
        redis: buildRedisOutput(options),
        source: {
          customerId: options.sourceCustomerId,
          databaseUrl: maskDatabaseUrl(sourceDatabaseUrl),
          publishSet: {
            code: sourceSnapshot.codes.length,
            menu: sourceSnapshot.menus.length,
          },
        },
        status,
        summary,
        targets: preflightResults,
      };
    }

    const preflightSummary = summarizeTargets(preflightResults);
    if (preflightSummary.blocked > 0) {
      for (const result of preflightResults) {
        if (options.log && centerConnection) {
          await createLog(centerConnection, jobId, {
            details: result.details,
            errorMessage: result.errorMessage,
            status: result.status,
            summary: result.summary,
            targetCustomerId: result.targetCustomerId,
            targetDbName: result.targetDbName,
          });
        }
      }
      if (options.log && centerConnection) {
        await updateJob(centerConnection, jobId, {
          status: 'blocked',
          summary: preflightSummary,
        });
      }
      return {
        dryRun: false,
        executed: false,
        jobId: jobId || null,
        mode,
        preflight: preflightSummary,
        redis: buildRedisOutput(options),
        source: {
          customerId: options.sourceCustomerId,
          databaseUrl: maskDatabaseUrl(sourceDatabaseUrl),
          publishSet: {
            code: sourceSnapshot.codes.length,
            menu: sourceSnapshot.menus.length,
          },
        },
        status: 'blocked',
        summary: preflightSummary,
        targets: preflightResults,
      };
    }

    const executionResults = [];
    for (const target of targets) {
      let result;
      try {
        result = await executeTarget(sourceSnapshot, target);
      } catch (error) {
        result =
          error instanceof TargetExecutionError
            ? error.result
            : {
                databaseUrl: maskTargetDatabaseUrl(target),
                details: buildEmptyDetails(),
                errorMessage:
                  error instanceof Error ? error.message : String(error),
                status: 'failed',
                summary: summarizeDetails(buildEmptyDetails()),
                targetCustomerId: target.customerId,
                targetDbName: target.dbName || '',
              };
      }
      executionResults.push(result);
      if (result.permissionCache?.status === 'failed') {
        break;
      }
    }

    for (const result of executionResults) {
      if (options.log && centerConnection) {
        await createLog(centerConnection, jobId, {
          details: {
            plan: result.details,
            execution: result.execution,
            permissionCache: result.permissionCache,
          },
          errorMessage: result.errorMessage,
          status: result.status,
          summary: result.summary,
          targetCustomerId: result.targetCustomerId,
          targetDbName: result.targetDbName,
        });
      }
    }

    const summary = summarizeExecutions(executionResults);
    const status =
      summary.failed > 0 || summary.blocked > 0 ? 'failed' : 'completed';
    if (options.log && centerConnection) {
      await updateJob(centerConnection, jobId, {
        status,
        summary: {
          execution: summary,
          preflight: preflightSummary,
        },
      });
    }

    return {
      dryRun: false,
      executed: status === 'completed',
      jobId: jobId || null,
      mode,
      preflight: preflightSummary,
      redis: buildRedisOutput(options),
      source: {
        customerId: options.sourceCustomerId,
        databaseUrl: maskDatabaseUrl(sourceDatabaseUrl),
        publishSet: {
          code: sourceSnapshot.codes.length,
          menu: sourceSnapshot.menus.length,
        },
      },
      status,
      summary,
      targets: executionResults,
    };
  } catch (error) {
    if (options.log && centerConnection && jobId) {
      await updateJob(centerConnection, jobId, {
        errorMessage: error instanceof Error ? error.message : String(error),
        status: 'failed',
        summary: null,
      }).catch(() => undefined);
    }
    throw error;
  } finally {
    await centerConnection?.end().catch(() => undefined);
    await closeScriptRedisClient();
  }
}

async function main() {
  const result = await runMenuTemplateSync(process.argv.slice(2));
  if (result) {
    console.log(JSON.stringify(result, null, 2));
  }
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      '[menu-template:sync] 执行失败:',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
