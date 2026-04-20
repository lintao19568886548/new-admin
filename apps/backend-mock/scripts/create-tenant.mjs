import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mariadb from 'mariadb';

/**
 * 使用方式：
 * 1. 修改下方 CONFIG 顶部变量
 * 2. 先保持 previewOnly=true 运行一次，确认输出
 * 3. 再将 previewOnly 改为 false 执行真正创建
 *
 * 运行命令：
 * node ./scripts/create-tenant.mjs
 * pnpm -F @vben/backend-mock tenant:create
 */
const CONFIG = {
  previewOnly: false,

  tenant: {
    customerId: 'customer_dg_hpt',
    customerName: '东莞市宏鹏腾产业运营服务有限公司',
    customerCode: '',
  },

  bootstrap: {
    seedBaseData: true,
    templateDatabaseUrl: '',
    includeAppVersions: true,
    includeSystemKeys: false,
  },

  admin: {
    create: true,
    username: '13926821992',
    password: '821992',
    realName: '13926821992',
    phone: '',
    roleName: 'Super',
    resetPasswordIfExists: false,
  },
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');
const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve('prisma/build/index.js', {
  paths: [backendMockDir],
});

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

const BASE_TABLES = [
  'menu',
  'menu_meta',
  'role',
  'code',
  'role_menu',
  'role_code',
];

if (CONFIG.bootstrap.includeAppVersions) {
  BASE_TABLES.push('app_versions');
}

if (CONFIG.bootstrap.includeSystemKeys) {
  BASE_TABLES.push('key');
}

class TenantCreateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenantCreateError';
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
    throw new TenantCreateError(`${name} 未配置`);
  }
  return value;
}

function parseDbUrl(rawUrl) {
  return new URL(stripWrappingQuotes(rawUrl));
}

function normalizeCustomerId(customerId) {
  const normalized = String(customerId || '').trim();
  if (!normalized) {
    throw new TenantCreateError('tenant.customerId 不能为空');
  }
  if (!/^\w+$/.test(normalized)) {
    throw new TenantCreateError(
      `customerId 不合法: ${normalized}，仅支持字母、数字、下划线`,
    );
  }
  return normalized;
}

function validateAdminConfig(adminConfig) {
  if (!adminConfig.create) {
    return;
  }

  if (!String(adminConfig.username || '').trim()) {
    throw new TenantCreateError('admin.username 不能为空');
  }
  if (!String(adminConfig.password || '')) {
    throw new TenantCreateError('admin.password 不能为空');
  }
  if (!String(adminConfig.realName || '').trim()) {
    throw new TenantCreateError('admin.realName 不能为空');
  }
  if (!String(adminConfig.roleName || '').trim()) {
    throw new TenantCreateError('admin.roleName 不能为空');
  }
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
      throw new TenantCreateError(
        '当前环境未配置 PUBLIC_DATABASE_URL，不能创建 public 租户',
      );
    }
    return publicDatabaseUrl;
  }

  if (template) {
    if (!template.includes('{customerId}')) {
      throw new TenantCreateError(
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

function createConnectionConfig(rawUrl, options = {}) {
  const url = parseDbUrl(rawUrl);
  const database = options.withoutDatabase
    ? undefined
    : url.pathname.replace(/^\//, '');

  return {
    acquireTimeout: 5000,
    connectTimeout: 5000,
    connectionLimit: 1,
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    ...(database ? { database } : null),
  };
}

async function openConnection(rawUrl, options = {}) {
  const connection = await mariadb.createConnection(
    createConnectionConfig(rawUrl, options),
  );
  await connection.query(
    "SET SESSION sql_mode = REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', '')",
  );
  return connection;
}

function normalizeSqlValue(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
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

async function getTableColumns(connection, tableName) {
  const rows = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((item) => item.Field);
}

async function getTableCount(connection, tableName) {
  const rows = await connection.query(
    `SELECT COUNT(*) AS total FROM \`${tableName}\``,
  );
  return Number(rows[0]?.total || 0);
}

async function copyTableData({
  sourceConnection,
  targetConnection,
  tableName,
}) {
  const targetCount = await getTableCount(targetConnection, tableName);
  if (targetCount > 0) {
    console.log(
      `[tenant:create] 跳过基础表 ${tableName}，目标库已有 ${targetCount} 条记录`,
    );
    return;
  }

  const columns = await getTableColumns(sourceConnection, tableName);
  if (columns.length === 0) {
    console.log(`[tenant:create] 跳过基础表 ${tableName}，未找到列定义`);
    return;
  }

  const rows = await sourceConnection.query(`SELECT * FROM \`${tableName}\``);
  if (rows.length === 0) {
    console.log(`[tenant:create] 跳过基础表 ${tableName}，模板库为空`);
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
    await targetConnection.query(sql, parameters);
  }

  console.log(
    `[tenant:create] 已初始化基础表 ${tableName}，共 ${rows.length} 条记录`,
  );
}

function runPrismaDbPush(targetDatabaseUrl) {
  const result = spawnSync(process.execPath, [prismaCliPath, 'db', 'push'], {
    cwd: backendMockDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: targetDatabaseUrl,
    },
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw new TenantCreateError(
      `执行 prisma db push 失败: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new TenantCreateError(
      `prisma db push 失败，退出码 ${result.status ?? 1}`,
    );
  }
}

async function ensureCustomerRecord(centerConnection, params) {
  const existingRows = await centerConnection.query(
    'SELECT customer_id, name, code, status, db_name FROM customer WHERE customer_id = ? LIMIT 1',
    [params.customerId],
  );
  const existing = existingRows[0];

  if (!existing) {
    await centerConnection.query(
      'INSERT INTO customer (customer_id, name, code, status, db_name, create_time, update_time) VALUES (?, ?, ?, 1, ?, NOW(), NOW())',
      [
        params.customerId,
        params.customerName,
        params.customerCode || null,
        params.dbName,
      ],
    );
    console.log(
      `[tenant:create] 已写入中心库 customer 记录: ${params.customerId}`,
    );
    return;
  }

  const currentDbName = String(existing.db_name || '').trim();
  if (currentDbName && currentDbName !== params.dbName) {
    throw new TenantCreateError(
      `中心库 customer 已存在，但 db_name 不一致: ${currentDbName} != ${params.dbName}`,
    );
  }

  await centerConnection.query(
    'UPDATE customer SET name = ?, code = ?, status = 1, db_name = ?, update_time = NOW() WHERE customer_id = ?',
    [
      params.customerName,
      params.customerCode || null,
      params.dbName,
      params.customerId,
    ],
  );
  console.log(
    `[tenant:create] 已更新中心库 customer 记录: ${params.customerId}`,
  );
}

async function ensureAdminUser({
  adminConfig,
  centerConnection,
  customerId,
  dbName,
  tenantConnection,
}) {
  const roleRows = await tenantConnection.query(
    'SELECT role_id, name FROM role WHERE name = ? LIMIT 1',
    [adminConfig.roleName],
  );
  const role = roleRows[0];
  if (!role) {
    throw new TenantCreateError(
      `目标租户库中未找到角色 ${adminConfig.roleName}，请先开启基础数据初始化或检查模板库`,
    );
  }

  const tenantRows = await tenantConnection.query(
    'SELECT id, username, customer_type FROM user WHERE username = ? LIMIT 1',
    [adminConfig.username],
  );
  const centerRows = await centerConnection.query(
    'SELECT id, username, customer_type FROM user WHERE username = ? LIMIT 1',
    [adminConfig.username],
  );

  const tenantUser = tenantRows[0] || null;
  const centerUser = centerRows[0] || null;

  const tenantCustomerType = String(tenantUser?.customer_type || '').trim();
  if (tenantUser && tenantCustomerType && tenantCustomerType !== customerId) {
    throw new TenantCreateError(
      `租户库账号 ${adminConfig.username} 的 customer_type 为 ${tenantCustomerType}，与目标租户 ${customerId} 不一致`,
    );
  }

  const centerCustomerType = String(centerUser?.customer_type || '').trim();
  if (centerUser && centerCustomerType && centerCustomerType !== customerId) {
    throw new TenantCreateError(
      `中心库账号 ${adminConfig.username} 已归属于租户 ${centerCustomerType}`,
    );
  }

  const hasPartialAdmin = Boolean(tenantUser) !== Boolean(centerUser);

  if (hasPartialAdmin && !adminConfig.resetPasswordIfExists) {
    throw new TenantCreateError(
      `管理员账号 ${adminConfig.username} 存在半创建状态，请将 admin.resetPasswordIfExists 改为 true 后重试`,
    );
  }

  const passwordHash = await bcrypt.hash(adminConfig.password, 10);
  const shouldSyncPassword =
    !tenantUser || !centerUser || Boolean(adminConfig.resetPasswordIfExists);

  let tenantUserId = tenantUser ? Number(tenantUser.id) : null;
  if (!tenantUser) {
    const result = await tenantConnection.query(
      'INSERT INTO user (username, real_name, password, customer_type, status, token_version, phone, home_path, park_id, create_time, update_time) VALUES (?, ?, ?, ?, 1, 1, ?, NULL, NULL, NOW(), NOW())',
      [
        adminConfig.username,
        adminConfig.realName,
        passwordHash,
        customerId,
        adminConfig.phone || null,
      ],
    );
    tenantUserId = Number(result.insertId);
    console.log(
      `[tenant:create] 已创建租户库管理员账号: ${adminConfig.username}`,
    );
  } else if (shouldSyncPassword) {
    await tenantConnection.query(
      'UPDATE user SET real_name = ?, password = ?, customer_type = ?, status = 1, phone = ?, update_time = NOW() WHERE id = ?',
      [
        adminConfig.realName,
        passwordHash,
        customerId,
        adminConfig.phone || null,
        Number(tenantUser.id),
      ],
    );
    tenantUserId = Number(tenantUser.id);
    console.log(
      `[tenant:create] 已同步租户库管理员账号信息: ${adminConfig.username}`,
    );
  } else {
    tenantUserId = Number(tenantUser.id);
    console.log(
      `[tenant:create] 复用已有租户库管理员账号: ${adminConfig.username}`,
    );
  }

  let centerUserId = centerUser ? Number(centerUser.id) : null;
  if (!centerUser) {
    const result = await centerConnection.query(
      'INSERT INTO user (username, real_name, password, customer_type, status, token_version, phone, home_path, create_time, update_time) VALUES (?, ?, ?, ?, 1, 1, ?, NULL, NOW(), NOW())',
      [
        adminConfig.username,
        adminConfig.realName,
        passwordHash,
        customerId,
        adminConfig.phone || null,
      ],
    );
    centerUserId = Number(result.insertId);
    console.log(
      `[tenant:create] 已创建中心库管理员账号: ${adminConfig.username}`,
    );
  } else if (shouldSyncPassword) {
    await centerConnection.query(
      'UPDATE user SET real_name = ?, password = ?, customer_type = ?, status = 1, token_version = token_version + 1, phone = ?, update_time = NOW() WHERE id = ?',
      [
        adminConfig.realName,
        passwordHash,
        customerId,
        adminConfig.phone || null,
        Number(centerUser.id),
      ],
    );
    await centerConnection.query(
      'DELETE FROM refresh_token WHERE user_id = ?',
      [Number(centerUser.id)],
    );
    centerUserId = Number(centerUser.id);
    console.log(
      `[tenant:create] 已同步中心库管理员账号信息: ${adminConfig.username}`,
    );
  } else {
    centerUserId = Number(centerUser.id);
    if (!centerCustomerType) {
      await centerConnection.query(
        'UPDATE user SET customer_type = ?, update_time = NOW() WHERE id = ?',
        [customerId, centerUserId],
      );
    }
    console.log(
      `[tenant:create] 复用已有中心库管理员账号: ${adminConfig.username}`,
    );
  }

  await centerConnection.query(
    'INSERT INTO user_tenant_mapping (center_user_id, customer_id, customer_user_id, db_name, create_time, update_time) VALUES (?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE customer_user_id = VALUES(customer_user_id), db_name = VALUES(db_name), update_time = NOW()',
    [centerUserId, customerId, tenantUserId, dbName],
  );
  console.log(
    `[tenant:create] 已写入管理员映射关系: center=${centerUserId}, tenant=${tenantUserId}`,
  );

  const roleMappingRows = await tenantConnection.query(
    'SELECT id FROM user_role WHERE user_id = ? AND role_id = ? LIMIT 1',
    [tenantUserId, Number(role.role_id)],
  );
  if (roleMappingRows.length === 0) {
    await tenantConnection.query(
      'INSERT INTO user_role (user_id, role_id, create_time, update_time) VALUES (?, ?, NOW(), NOW())',
      [tenantUserId, Number(role.role_id)],
    );
    console.log(
      `[tenant:create] 已授予管理员角色 ${adminConfig.roleName} 给账号 ${adminConfig.username}`,
    );
  } else {
    console.log(
      `[tenant:create] 管理员账号已拥有角色 ${adminConfig.roleName}，跳过授予`,
    );
  }
}

async function main() {
  const customerId = normalizeCustomerId(CONFIG.tenant.customerId);
  const defaultCustomerId = resolveDefaultCustomerId();

  if (customerId === defaultCustomerId) {
    throw new TenantCreateError(
      `customerId 不能等于默认租户 ${defaultCustomerId}`,
    );
  }

  if (!String(CONFIG.tenant.customerName || '').trim()) {
    throw new TenantCreateError('tenant.customerName 不能为空');
  }

  validateAdminConfig(CONFIG.admin);

  const centerDatabaseUrl = requireEnv('CENTER_DATABASE_URL');
  const targetDatabaseUrl = resolveCustomerDbUrl(customerId);
  const targetDbName = getDatabaseNameFromUrl(targetDatabaseUrl);
  const templateDatabaseUrl =
    stripWrappingQuotes(CONFIG.bootstrap.templateDatabaseUrl) ||
    requireEnv('DATABASE_URL');
  const templateDbName = getDatabaseNameFromUrl(templateDatabaseUrl);

  console.log('[tenant:create] 当前配置');
  console.log(
    JSON.stringify(
      {
        admin: CONFIG.admin.create
          ? {
              roleName: CONFIG.admin.roleName,
              username: CONFIG.admin.username,
            }
          : null,
        bootstrapTables: CONFIG.bootstrap.seedBaseData ? BASE_TABLES : [],
        customerId,
        customerName: CONFIG.tenant.customerName,
        dbName: targetDbName,
        previewOnly: CONFIG.previewOnly,
        templateDbName,
      },
      null,
      2,
    ),
  );

  if (CONFIG.previewOnly) {
    console.log(
      '[tenant:create] 当前为预览模式，确认无误后请将 CONFIG.previewOnly 改为 false 再执行',
    );
    return;
  }

  const targetAdminConnection = await openConnection(targetDatabaseUrl, {
    withoutDatabase: true,
  });
  const centerConnection = await openConnection(centerDatabaseUrl);

  try {
    await targetAdminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${targetDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`[tenant:create] 已确保数据库存在: ${targetDbName}`);

    runPrismaDbPush(targetDatabaseUrl);

    const tenantConnection = await openConnection(targetDatabaseUrl);
    try {
      await ensureCustomerRecord(centerConnection, {
        customerCode: String(CONFIG.tenant.customerCode || '').trim(),
        customerId,
        customerName: String(CONFIG.tenant.customerName).trim(),
        dbName: targetDbName,
      });

      if (CONFIG.bootstrap.seedBaseData) {
        const templateConnection = await openConnection(templateDatabaseUrl);
        try {
          for (const tableName of BASE_TABLES) {
            await copyTableData({
              sourceConnection: templateConnection,
              tableName,
              targetConnection: tenantConnection,
            });
          }
        } finally {
          await templateConnection.end().catch(() => undefined);
        }
      }

      if (CONFIG.admin.create) {
        await ensureAdminUser({
          adminConfig: {
            phone: String(CONFIG.admin.phone || '').trim(),
            password: String(CONFIG.admin.password || ''),
            realName: String(CONFIG.admin.realName || '').trim(),
            resetPasswordIfExists: Boolean(CONFIG.admin.resetPasswordIfExists),
            roleName: String(CONFIG.admin.roleName || '').trim(),
            username: String(CONFIG.admin.username || '').trim(),
          },
          centerConnection,
          customerId,
          dbName: targetDbName,
          tenantConnection,
        });
      }
    } finally {
      await tenantConnection.end().catch(() => undefined);
    }
  } finally {
    await centerConnection.end().catch(() => undefined);
    await targetAdminConnection.end().catch(() => undefined);
  }

  console.log(`[tenant:create] 租户 ${customerId} 创建完成`);
}

main().catch((error) => {
  console.error(
    '[tenant:create] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
