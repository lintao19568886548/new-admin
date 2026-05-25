import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

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

const CODE_COMPARE_FIELDS = ['code', 'name', 'content', 'templateVersion'];

class MenuTemplateDryRunError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MenuTemplateDryRunError';
  }
}

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

function shouldPrintHelp(argv) {
  return argv.length === 0 || argv.includes('--help') || argv.includes('-h');
}

function printHelp() {
  console.log(`菜单模板同步 dry-run

用法:
  pnpm -F @vben/backend-mock run menu-template:sync-dry-run -- --target-customer-id=public
  pnpm -F @vben/backend-mock run menu-template:sync-dry-run -- --target-customer-id=<tenantId>
  pnpm -F @vben/backend-mock run menu-template:sync-dry-run -- --all-tenants

参数:
  --source-customer-id=<id>   模板源逻辑库，默认 default
  --source-database-url=<url> 直接指定模板源数据库 URL
  --target-customer-id=<id>   目标逻辑库；public 也是目标之一
  --target-db-name=<name>     目标库真实数据库名，通常来自 center.customer.db_name
  --target-database-url=<url> 直接指定目标数据库 URL；优先级高于 target-customer-id
  --all-tenants               从中心库 customer 表枚举全部启用租户，不包含 public/default
  --no-log                    只输出结果，不写 menu_template_sync_job/log
  --help, -h                  输出帮助

说明:
  - 只读 source/target 菜单、menu_meta、code，不写目标库。
  - source 发布候选集为 template_managed=1 AND template_internal_only=0 AND template_deleted_at IS NULL。
  - target 下线候选只统计 template_managed=1 且不在 source 发布候选集内的记录。
  - 有 duplicate、缺失 template_key、未受模板管理的同 key 目标记录时，目标状态为 blocked。`);
}

function parseArgs(argv) {
  const options = {
    allTenants: false,
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
  return {
    codes,
    codesByMenuId: new Map(
      codes.filter((item) => item.menuId).map((item) => [item.menuId, item]),
    ),
    metas,
    metasByMenuId: new Map(metas.map((item) => [item.menuId, item])),
    menus,
    menusById: new Map(menus.map((item) => [item.menuId, item])),
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
      'dry_run',
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

function summarizeTargets(results) {
  return {
    blocked: results.filter((item) => item.status === 'blocked').length,
    ready: results.filter((item) => item.status === 'ready').length,
    targets: results.length,
  };
}

async function main() {
  const argv = normalizeArgv(process.argv.slice(2));
  if (shouldPrintHelp(argv)) {
    printHelp();
    return;
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
    const targets = options.allTenants
      ? await listTenantTargets(centerConnection)
      : [buildSingleTarget(options)];
    const targetScope = options.allTenants
      ? 'all_tenants'
      : targets[0]?.customerId || 'direct';

    if (options.log && centerConnection) {
      jobId = await createJob(centerConnection, {
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

    const results = [];
    for (const target of targets) {
      try {
        const result = await runTarget(sourceSnapshot, target);
        results.push(result);
        if (options.log && centerConnection) {
          await createLog(centerConnection, jobId, {
            details: result.details,
            status: result.status,
            summary: result.summary,
            targetCustomerId: result.targetCustomerId,
            targetDbName: result.targetDbName,
          });
        }
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
        results.push(failed);
        if (options.log && centerConnection) {
          await createLog(centerConnection, jobId, {
            details: failed.details,
            errorMessage: failed.errorMessage,
            status: failed.status,
            summary: failed.summary,
            targetCustomerId: failed.targetCustomerId,
            targetDbName: failed.targetDbName,
          });
        }
      }
    }

    const summary = summarizeTargets(results);
    const status = summary.blocked > 0 ? 'blocked' : 'ready';
    if (options.log && centerConnection) {
      await updateJob(centerConnection, jobId, {
        status,
        summary,
      });
    }

    console.log(
      JSON.stringify(
        {
          dryRun: true,
          jobId: jobId || null,
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
          targets: results,
        },
        null,
        2,
      ),
    );
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
  }
}

main().catch((error) => {
  console.error(
    '[menu-template:sync-dry-run] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
