import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

/**
 * 使用方式：
 * 1. 修改下方 CONFIG 顶部变量
 * 2. 先保持 previewOnly=true 运行一次确认输出
 * 3. 再将 previewOnly 改为 false 执行真正同步
 *
 * 运行命令：
 * node ./scripts/sync-menu-data.mjs
 * pnpm -F @vben/backend-mock menu:sync
 */
const CONFIG = {
  previewOnly: false,

  source: {
    databaseUrl:
      'mysql://root:123456@192.168.110.29:3306/magic?timezone=Asia/Shanghai',
  },

  target: {
    customerId: 'public',
    databaseUrl:
      'mysql://root:123456@192.168.110.29:3306/public_magic?timezone=Asia/Shanghai',
  },

  sync: {
    syncRoleBindings: false, // 默认不覆盖 role_menu / role_code，按需手动开启
  },
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

const MENU_TABLES = ['menu', 'menu_meta', 'code'];
const ROLE_BINDING_TABLES = ['role_menu', 'role_code'];

class MenuSyncError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MenuSyncError';
  }
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
    throw new MenuSyncError(`${name} 未配置`);
  }
  return value;
}

function parseDbUrl(rawUrl) {
  return new URL(stripWrappingQuotes(rawUrl));
}

function normalizeCustomerId(customerId) {
  const normalized = String(customerId || '').trim();
  if (!normalized) {
    throw new MenuSyncError('target.customerId 不能为空');
  }
  if (!/^\w+$/.test(normalized)) {
    throw new MenuSyncError(
      `customerId 不合法: ${normalized}，仅支持字母、数字、下划线`,
    );
  }
  return normalized;
}

function resolveDefaultCustomerId() {
  return String(process.env.DEFAULT_CUSTOMER_ID || 'default');
}

function resolveCustomerDbUrl(customerId) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  const defaultCustomerId = resolveDefaultCustomerId();
  const databaseUrl = requireEnv('DATABASE_URL');
  const publicDatabaseUrl = stripWrappingQuotes(
    process.env.PUBLIC_DATABASE_URL,
  );
  const template = stripWrappingQuotes(
    process.env.CUSTOMER_DATABASE_URL_TEMPLATE,
  );

  if (normalizedCustomerId === 'public') {
    if (!publicDatabaseUrl) {
      throw new MenuSyncError(
        '当前环境未配置 PUBLIC_DATABASE_URL，不能定位 public 租户库',
      );
    }
    return publicDatabaseUrl;
  }

  if (template) {
    if (!template.includes('{customerId}')) {
      throw new MenuSyncError(
        'CUSTOMER_DATABASE_URL_TEMPLATE 必须包含 {customerId} 占位符',
      );
    }
    return template.replaceAll('{customerId}', normalizedCustomerId);
  }

  if (normalizedCustomerId === defaultCustomerId) {
    return databaseUrl;
  }

  const url = parseDbUrl(databaseUrl);
  const prefix = process.env.CUSTOMER_DB_PREFIX || 'customer_';
  url.pathname = `/${prefix}${normalizedCustomerId}`;
  return url.toString();
}

function getDatabaseNameFromUrl(rawUrl) {
  const url = parseDbUrl(rawUrl);
  return url.pathname.replace(/^\//, '');
}

function createConnectionConfig(rawUrl) {
  const url = parseDbUrl(rawUrl);
  return {
    connectTimeout: 5000,
    database: url.pathname.replace(/^\//, ''),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
  };
}

async function openConnection(rawUrl) {
  return mariadb.createConnection(createConnectionConfig(rawUrl));
}

async function getTableColumns(connection, tableName) {
  const rows = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((item) => item.Field);
}

function normalizeSqlValue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

async function readTableData(connection, tableName) {
  const columns = await getTableColumns(connection, tableName);
  const rows = await connection.query(`SELECT * FROM \`${tableName}\``);
  return { columns, rows };
}

async function insertRows(connection, tableName, columns, rows) {
  if (rows.length === 0) {
    return;
  }

  const chunkSize = 100;
  const quotedColumns = columns.map((column) => `\`${column}\``).join(', ');
  const valuePlaceholders = `(${columns.map(() => '?').join(', ')})`;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const sql = `INSERT INTO \`${tableName}\` (${quotedColumns}) VALUES ${chunk
      .map(() => valuePlaceholders)
      .join(', ')}`;
    const parameters = chunk.flatMap((row) =>
      columns.map((column) => normalizeSqlValue(row[column])),
    );
    await connection.query(sql, parameters);
  }
}

async function validateRoleBindingCompatibility(
  sourceConnection,
  targetConnection,
) {
  const sourceRoleIds = await sourceConnection.query(
    'SELECT DISTINCT role_id FROM role_menu UNION SELECT DISTINCT role_id FROM role_code',
  );
  if (sourceRoleIds.length === 0) {
    return;
  }

  const sourceRoles = await sourceConnection.query(
    'SELECT role_id, name FROM role',
  );
  const targetRoles = await targetConnection.query(
    'SELECT role_id, name FROM role',
  );

  const sourceRoleById = new Map(
    sourceRoles.map((item) => [Number(item.role_id), String(item.name || '')]),
  );
  const targetRoleById = new Map(
    targetRoles.map((item) => [Number(item.role_id), String(item.name || '')]),
  );

  const mismatches = [];
  for (const row of sourceRoleIds) {
    const roleId = Number(row.role_id);
    const sourceName = sourceRoleById.get(roleId) || '';
    const targetName = targetRoleById.get(roleId) || '';
    if (!targetRoleById.has(roleId)) {
      mismatches.push(`role_id=${roleId} 在目标库不存在`);
      continue;
    }
    if (sourceName !== targetName) {
      mismatches.push(
        `role_id=${roleId} 名称不一致: source=${sourceName}, target=${targetName}`,
      );
    }
  }

  if (mismatches.length > 0) {
    throw new MenuSyncError(
      `目标库角色定义与源库不一致，不能安全同步 role_menu/role_code:\n${mismatches.join('\n')}`,
    );
  }
}

async function syncTables({ sourceConnection, targetConnection, tableNames }) {
  const tableDataMap = new Map();
  for (const tableName of tableNames) {
    tableDataMap.set(
      tableName,
      await readTableData(sourceConnection, tableName),
    );
  }

  const deleteOrder = [...tableNames].reverse();
  const insertOrder = [...tableNames];

  await targetConnection.beginTransaction();
  try {
    for (const tableName of deleteOrder) {
      await targetConnection.query(`DELETE FROM \`${tableName}\``);
    }

    for (const tableName of insertOrder) {
      const { columns, rows } = tableDataMap.get(tableName);
      await insertRows(targetConnection, tableName, columns, rows);
      console.log(
        `[menu:sync] 已同步表 ${tableName}，共 ${rows.length} 条记录`,
      );
    }

    await targetConnection.commit();
  } catch (error) {
    await targetConnection.rollback().catch(() => undefined);
    throw error;
  }
}

async function main() {
  const sourceDatabaseUrl =
    stripWrappingQuotes(CONFIG.source.databaseUrl) ||
    requireEnv('DATABASE_URL');
  const targetDatabaseUrl =
    stripWrappingQuotes(CONFIG.target.databaseUrl) ||
    resolveCustomerDbUrl(CONFIG.target.customerId);

  const sourceDbName = getDatabaseNameFromUrl(sourceDatabaseUrl);
  const targetDbName = getDatabaseNameFromUrl(targetDatabaseUrl);
  const syncRoleBindings = Boolean(CONFIG.sync.syncRoleBindings);
  const tableNames = syncRoleBindings
    ? [...MENU_TABLES, ...ROLE_BINDING_TABLES]
    : [...MENU_TABLES];

  const sourceUrl = parseDbUrl(sourceDatabaseUrl);
  const targetUrl = parseDbUrl(targetDatabaseUrl);
  if (
    sourceUrl.hostname === targetUrl.hostname &&
    Number(sourceUrl.port || 3306) === Number(targetUrl.port || 3306) &&
    decodeURIComponent(sourceUrl.username) ===
      decodeURIComponent(targetUrl.username) &&
    sourceDbName === targetDbName
  ) {
    throw new MenuSyncError('源库和目标库相同，已中止同步');
  }

  console.log('[menu:sync] 当前配置');
  console.log(
    JSON.stringify(
      {
        previewOnly: CONFIG.previewOnly,
        sourceDbName,
        syncRoleBindings,
        tables: tableNames,
        targetDbName,
      },
      null,
      2,
    ),
  );

  if (!syncRoleBindings) {
    console.log(
      '[menu:sync] 当前未同步 role_menu/role_code。若源库删除了菜单或权限码，目标库可能残留旧权限关联。',
    );
  }

  if (CONFIG.previewOnly) {
    console.log(
      '[menu:sync] 当前为预览模式，确认无误后请将 CONFIG.previewOnly 改为 false 再执行',
    );
    return;
  }

  const sourceConnection = await openConnection(sourceDatabaseUrl);
  const targetConnection = await openConnection(targetDatabaseUrl);

  try {
    if (syncRoleBindings) {
      await validateRoleBindingCompatibility(
        sourceConnection,
        targetConnection,
      );
    }

    await syncTables({
      sourceConnection,
      tableNames,
      targetConnection,
    });
  } finally {
    await sourceConnection.end().catch(() => undefined);
    await targetConnection.end().catch(() => undefined);
  }

  console.log('[menu:sync] 菜单管理数据同步完成');
}

main().catch((error) => {
  console.error(
    '[menu:sync] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
