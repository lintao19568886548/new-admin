import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import mariadb from 'mariadb';
import { systemDbClient } from '~/utils/db';
import { resolveSingleActiveOwnedSourceOrganizationForCenterUser } from '~/utils/organization';

const BASE_DATA_TABLES = ['app_versions'];
const COPY_ROWS_CHUNK_SIZE = 100;
const COPY_ROWS_PAGE_SIZE = 500;
const DEFAULT_WORKER_INTERVAL_MS = 5000;
const DEFAULT_WORKER_STALE_AFTER_MS = 10 * 60 * 1000;
const DEFAULT_WORKER_MAX_RETRY = 5;
const TENANT_CREATOR_ROLE_NAME = 'Super';
const WORKER_ID = `${hostname()}:${process.pid}:${randomUUID()}`;

type DbConnection = Awaited<ReturnType<typeof mariadb.createConnection>>;

interface TenantProvisioningJobRecord {
  id: number;
  initiatorCenterUserId: number;
  lockOwner: string;
  retryCount: number;
  sourceOrgId: null | number;
  sourceCustomerId: string;
  status: string;
  targetCity: null | string;
  targetCompanyShortName: null | string;
  targetCustomerId: null | string;
  targetDbName: null | string;
}

interface CenterUserSnapshot {
  customerType: null | string;
  homePath: null | string;
  id: number;
  password: string;
  phone: null | string;
  realName: string;
  status: null | number;
  tokenVersion: number;
  username: string;
}

interface SourceTenantUserSnapshot {
  homePath: null | string;
  id: number;
  password: string;
  phone: null | string;
  realName: string;
  status: null | number;
  username: string;
}

interface OrganizationMemberSnapshot {
  centerUser: CenterUserSnapshot;
  centerUserId: number;
  memberRole: string;
  sourceUser: SourceTenantUserSnapshot;
  sourceUserId: number;
  targetUserId: number;
}

interface OrganizationMigrationContext {
  centerUser: CenterUserSnapshot;
  centerUserId: number;
  sourceCustomerId: string;
  sourceOrgId: number;
  targetCustomerId: string;
  targetUserId: number;
}

interface OrganizationRoleSnapshotItem {
  roleName: null | string;
  sourceRoleId: number;
  targetRoleId: number;
}

interface OrganizationRoleSnapshotPlan {
  roleMap: Map<number, number>;
  snapshots: OrganizationRoleSnapshotItem[];
}

interface CopyRowsOptions {
  heartbeat?: () => Promise<void>;
  params?: unknown[];
  tableName: string;
  targetTransforms?: Record<
    string,
    (value: unknown, row: Record<string, unknown>) => unknown
  >;
  whereSql?: string;
}

type CopyRowsPageCallback = (
  rows: Array<Record<string, unknown>>,
) => Promise<unknown> | unknown;

interface CopyRowsCursorOptions extends CopyRowsOptions {
  afterWritePage?: CopyRowsPageCallback;
  beforeWritePage?: CopyRowsPageCallback;
  cursorColumn: string;
  pageSize?: number;
}

interface PreparedCopyRowsPlan {
  columns: string[];
  insertVerb: 'INSERT' | 'INSERT IGNORE';
  onDuplicateSql: string;
  quotedColumns: string;
  tableName: string;
  valuePlaceholders: string;
}

interface UserMigrationContext {
  centerUser: CenterUserSnapshot;
  centerUserId: number;
  sourceOrgId?: number;
  sourceCustomerId: string;
  sourceUserId: number;
  targetCustomerId: string;
  targetUserId: number;
  username: string;
}

interface SuperPermissionClosure {
  codeIds: number[];
  roleCodeCount: number;
  roleId: number;
  roleMenuCount: number;
}

const globalForTenantProvisioning = globalThis as typeof globalThis & {
  __tenantProvisioningWorker?: {
    intervalId: ReturnType<typeof setInterval>;
    running: boolean;
  };
};

function stripWrappingQuotes(value: unknown) {
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

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getWorkerMaxRetry() {
  return getPositiveIntegerEnv(
    'TENANT_PROVISIONING_MAX_RETRY',
    DEFAULT_WORKER_MAX_RETRY,
  );
}

function getWorkerBatchSize() {
  return getPositiveIntegerEnv('TENANT_PROVISIONING_BATCH_SIZE', 1);
}

function isWorkerEnabled() {
  return (
    String(process.env.TENANT_PROVISIONING_WORKER_ENABLED ?? 'true')
      .trim()
      .toLowerCase() !== 'false'
  );
}

function normalizeCustomerId(customerId: unknown) {
  const normalized = String(customerId || '').trim();
  if (!normalized || !/^\w+$/.test(normalized)) {
    throw new Error(`租户 customerId 不合法: ${normalized || '(empty)'}`);
  }
  return normalized;
}

function normalizeDatabaseName(dbName: unknown) {
  const normalized = String(dbName || '').trim();
  if (!normalized || !/^\w+$/.test(normalized)) {
    throw new Error(`数据库名不合法: ${normalized || '(empty)'}`);
  }
  if (normalized.length > 100) {
    throw new Error(`数据库名超过 100 字符: ${normalized}`);
  }
  return normalized;
}

function getDefaultCustomerId() {
  return String(process.env.DEFAULT_CUSTOMER_ID || 'default');
}

function requireEnv(name: string) {
  const value = stripWrappingQuotes(process.env[name]);
  if (!value) {
    throw new Error(`${name} 未配置`);
  }
  return value;
}

function parseDbUrl(rawUrl: string) {
  return new URL(stripWrappingQuotes(rawUrl));
}

function applyDatabaseName(rawUrl: string, dbName: string) {
  const url = parseDbUrl(rawUrl);
  url.pathname = `/${normalizeDatabaseName(dbName)}`;
  return url.toString();
}

function resolveCustomerDbUrl(
  customerId: string,
  options: { dbName?: null | string } = {},
) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  const targetDbName = options.dbName
    ? normalizeDatabaseName(options.dbName)
    : '';
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
      throw new Error('PUBLIC_DATABASE_URL 未配置，无法读取 public 库');
    }
    return targetDbName
      ? applyDatabaseName(publicDatabaseUrl, targetDbName)
      : publicDatabaseUrl;
  }

  if (template) {
    if (!template.includes('{customerId}')) {
      throw new Error(
        'CUSTOMER_DATABASE_URL_TEMPLATE 必须包含 {customerId} 占位符',
      );
    }
    const resolved = template.replaceAll('{customerId}', normalizedCustomerId);
    return targetDbName ? applyDatabaseName(resolved, targetDbName) : resolved;
  }

  if (normalizedCustomerId === defaultCustomerId) {
    return targetDbName
      ? applyDatabaseName(databaseUrl, targetDbName)
      : databaseUrl;
  }

  const url = parseDbUrl(databaseUrl);
  const prefix = process.env.CUSTOMER_DB_PREFIX || 'customer_';
  url.pathname = `/${prefix}${normalizedCustomerId}`;
  return targetDbName
    ? applyDatabaseName(url.toString(), targetDbName)
    : url.toString();
}

function getDatabaseNameFromUrl(rawUrl: string) {
  return normalizeDatabaseName(
    decodeURIComponent(parseDbUrl(rawUrl).pathname.replace(/^\//, '')),
  );
}

function createConnectionConfig(
  rawUrl: string,
  options: { withoutDatabase?: boolean } = {},
) {
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

async function openConnection(
  rawUrl: string,
  options: { withoutDatabase?: boolean } = {},
) {
  const connection = await mariadb.createConnection(
    createConnectionConfig(rawUrl, options),
  );
  await connection.query(
    "SET SESSION sql_mode = REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', '')",
  );
  return connection;
}

function assertSafeTargetDatabase(params: {
  sourceDatabaseUrl: string;
  targetCustomerId: string;
  targetDbName: string;
  templateDatabaseUrl: string;
}) {
  const targetDbName = normalizeDatabaseName(params.targetDbName);
  if (params.targetCustomerId === 'public') {
    throw new Error('拒绝把 public 作为自动开通目标租户');
  }

  const protectedDbNames = new Set([
    getDatabaseNameFromUrl(params.sourceDatabaseUrl),
    getDatabaseNameFromUrl(params.templateDatabaseUrl),
    getDatabaseNameFromUrl(requireEnv('CENTER_DATABASE_URL')),
    getDatabaseNameFromUrl(requireEnv('DATABASE_URL')),
    'information_schema',
    'mysql',
    'performance_schema',
    'sys',
  ]);

  const publicDatabaseUrl = stripWrappingQuotes(
    process.env.PUBLIC_DATABASE_URL,
  );
  if (publicDatabaseUrl) {
    protectedDbNames.add(getDatabaseNameFromUrl(publicDatabaseUrl));
  }

  if (protectedDbNames.has(targetDbName)) {
    throw new Error(`拒绝重建受保护数据库: ${targetDbName}`);
  }
}

async function rebuildTargetDatabase(
  connection: DbConnection,
  targetDbName: string,
) {
  const quotedDbName = quoteIdentifier(normalizeDatabaseName(targetDbName));
  await connection.query(`DROP DATABASE IF EXISTS ${quotedDbName}`);
  await connection.query(
    `CREATE DATABASE ${quotedDbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
}

function quoteIdentifier(value: string) {
  return `\`${value.replaceAll('`', '``')}\``;
}

function normalizeSqlValue(value: unknown) {
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

async function getTableColumns(connection: DbConnection, tableName: string) {
  const rows = (await connection.query(
    `SHOW COLUMNS FROM ${quoteIdentifier(tableName)}`,
  )) as Array<{ Field: string }>;
  return rows.map((item) => item.Field);
}

async function getPrimaryColumns(connection: DbConnection, tableName: string) {
  const rows = (await connection.query(
    `SHOW KEYS FROM ${quoteIdentifier(tableName)} WHERE Key_name = 'PRIMARY'`,
  )) as Array<{ Column_name: string }>;
  return new Set(rows.map((item) => item.Column_name));
}

async function getTableCount(
  connection: DbConnection,
  tableName: string,
  whereSql = '',
  params: unknown[] = [],
) {
  const rows = (await connection.query(
    `SELECT COUNT(*) AS total FROM ${quoteIdentifier(tableName)} ${whereSql}`,
    params,
  )) as Array<{ total: bigint | number | string }>;
  return Number(rows[0]?.total || 0);
}

async function getQueryCount(
  connection: DbConnection,
  sql: string,
  params: unknown[] = [],
) {
  const rows = (await connection.query(sql, params)) as Array<{
    total: bigint | number | string;
  }>;
  return Number(rows[0]?.total || 0);
}

function getDynamicRowValue(row: Record<string, unknown>, keyPrefix: string) {
  const matched = Object.entries(row).find(([key]) =>
    key.toLowerCase().startsWith(keyPrefix.toLowerCase()),
  );
  return matched?.[1];
}

async function listBaseTables(connection: DbConnection) {
  const rows = (await connection.query(
    "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'",
  )) as Array<Record<string, unknown>>;

  return rows
    .map((row) => getDynamicRowValue(row, 'Tables_in_'))
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function getCreateTableSql(row: Record<string, unknown>, tableName: string) {
  const createSql = row['Create Table'] || getDynamicRowValue(row, 'Create ');
  const text = String(createSql || '');
  if (!text) {
    throw new Error(`无法读取表结构: ${tableName}`);
  }
  return text;
}

function buildTargetCreateTableSql(createSql: string, tableName: string) {
  const targetSql = createSql
    .replaceAll(
      /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`[^`]+`|\S+)/gi,
      `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)}`,
    )
    .replaceAll(/\sAUTO_INCREMENT=\d+\b/gi, '');

  if (targetSql === createSql) {
    throw new Error(`无法改写目标表结构 SQL: ${tableName}`);
  }
  return targetSql;
}

async function cloneSchemaFromTemplate(params: {
  heartbeat?: () => Promise<void>;
  targetConnection: DbConnection;
  templateConnection: DbConnection;
}) {
  const tableNames = await listBaseTables(params.templateConnection);
  if (tableNames.length === 0) {
    throw new Error('模板库没有可复制的基础表结构');
  }

  await params.targetConnection.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const tableName of tableNames) {
      const rows = (await params.templateConnection.query(
        `SHOW CREATE TABLE ${quoteIdentifier(tableName)}`,
      )) as Array<Record<string, unknown>>;
      const createSql = getCreateTableSql(rows[0] || {}, tableName);
      await params.targetConnection.query(
        buildTargetCreateTableSql(createSql, tableName),
      );
      await params.heartbeat?.();
    }
  } finally {
    await params.targetConnection
      .query('SET FOREIGN_KEY_CHECKS = 1')
      .catch(() => undefined);
  }
}

async function updateJobHeartbeat(job: TenantProvisioningJobRecord) {
  const result = await systemDbClient.tenantProvisioningJob.updateMany({
    data: {
      heartbeatAt: new Date(),
    },
    where: {
      id: job.id,
      lockOwner: job.lockOwner,
      status: 'provisioning',
    },
  });

  if (result.count === 0) {
    throw new Error(`租户开通任务租约已失效，停止继续执行 jobId=${job.id}`);
  }
}

async function updateJobStep(
  job: TenantProvisioningJobRecord,
  step: string,
  message?: string,
) {
  const result = await systemDbClient.tenantProvisioningJob.updateMany({
    data: {
      errorMessage: message || null,
      heartbeatAt: new Date(),
      step,
    },
    where: {
      id: job.id,
      lockOwner: job.lockOwner,
      status: 'provisioning',
    },
  });

  if (result.count === 0) {
    throw new Error(
      `租户开通任务租约已失效，无法进入步骤 ${step}, jobId=${job.id}`,
    );
  }
}

async function claimNextProvisioningJob() {
  const maxRetry = getWorkerMaxRetry();
  const staleAfterMs = getPositiveIntegerEnv(
    'TENANT_PROVISIONING_STALE_AFTER_MS',
    DEFAULT_WORKER_STALE_AFTER_MS,
  );
  const staleBefore = new Date(Date.now() - staleAfterMs);

  const job = await systemDbClient.tenantProvisioningJob.findFirst({
    orderBy: { createTime: 'asc' },
    where: {
      retryCount: { lt: maxRetry },
      OR: [
        { status: 'pending' },
        { status: 'failed_retryable' },
        {
          heartbeatAt: { lt: staleBefore },
          status: 'provisioning',
        },
      ],
    },
  });

  if (!job) {
    return null;
  }

  const now = new Date();
  const result = await systemDbClient.tenantProvisioningJob.updateMany({
    data: {
      errorMessage: null,
      heartbeatAt: now,
      lockedAt: now,
      lockOwner: WORKER_ID,
      startedAt: now,
      status: 'provisioning',
      step: 'claimed',
    },
    where: {
      heartbeatAt: job.heartbeatAt,
      id: job.id,
      lockedAt: job.lockedAt,
      lockOwner: job.lockOwner,
      startedAt: job.startedAt,
      status: job.status,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return systemDbClient.tenantProvisioningJob.findUnique({
    where: { id: job.id },
  });
}

async function copyRows(
  params: CopyRowsOptions & {
    sourceConnection: DbConnection;
    targetConnection: DbConnection;
  },
) {
  const plan = await prepareCopyRowsPlan(params);
  if (!plan) {
    return 0;
  }
  const rows = (await params.sourceConnection.query(
    `SELECT ${plan.columns
      .map((column) => quoteIdentifier(column))
      .join(', ')} FROM ${quoteIdentifier(params.tableName)} ${
      params.whereSql || ''
    }`,
    params.params || [],
  )) as Array<Record<string, unknown>>;
  return writeRowsInChunks({
    heartbeat: params.heartbeat,
    plan,
    rows,
    targetConnection: params.targetConnection,
    targetTransforms: params.targetTransforms,
  });
}

async function prepareCopyRowsPlan(params: {
  sourceConnection: DbConnection;
  tableName: string;
  targetConnection: DbConnection;
}) {
  const sourceColumns = await getTableColumns(
    params.sourceConnection,
    params.tableName,
  );
  const targetColumns = await getTableColumns(
    params.targetConnection,
    params.tableName,
  );
  const targetColumnSet = new Set(targetColumns);
  const columns = sourceColumns.filter((column) => targetColumnSet.has(column));
  if (columns.length === 0) {
    return null;
  }

  const primaryColumns = await getPrimaryColumns(
    params.targetConnection,
    params.tableName,
  );
  const updateColumns = columns.filter((column) => !primaryColumns.has(column));

  return {
    columns,
    insertVerb: updateColumns.length > 0 ? 'INSERT' : 'INSERT IGNORE',
    onDuplicateSql:
      updateColumns.length > 0
        ? ` ON DUPLICATE KEY UPDATE ${updateColumns
            .map(
              (column) =>
                `${quoteIdentifier(column)} = VALUES(${quoteIdentifier(column)})`,
            )
            .join(', ')}`
        : '',
    quotedColumns: columns.map((column) => quoteIdentifier(column)).join(', '),
    tableName: params.tableName,
    valuePlaceholders: `(${columns.map(() => '?').join(', ')})`,
  } satisfies PreparedCopyRowsPlan;
}

async function writeRowsInChunks(params: {
  heartbeat?: () => Promise<void>;
  plan: PreparedCopyRowsPlan;
  rows: Array<Record<string, unknown>>;
  targetConnection: DbConnection;
  targetTransforms?: CopyRowsOptions['targetTransforms'];
}) {
  if (params.rows.length === 0) {
    return 0;
  }

  for (
    let index = 0;
    index < params.rows.length;
    index += COPY_ROWS_CHUNK_SIZE
  ) {
    const chunk = params.rows.slice(index, index + COPY_ROWS_CHUNK_SIZE);
    const sql = `${params.plan.insertVerb} INTO ${quoteIdentifier(
      params.plan.tableName,
    )} (${params.plan.quotedColumns}) VALUES ${chunk
      .map(() => params.plan.valuePlaceholders)
      .join(', ')}${params.plan.onDuplicateSql}`;
    const values = chunk.flatMap((row) =>
      params.plan.columns.map((column) => {
        const transform = params.targetTransforms?.[column];
        return normalizeSqlValue(
          transform ? transform(row[column], row) : row[column],
        );
      }),
    );
    await params.targetConnection.query(sql, values);
    await params.heartbeat?.();
  }

  return params.rows.length;
}

function normalizeWhereClause(whereSql?: string) {
  return String(whereSql || '')
    .trim()
    .replace(/^WHERE\s+/i, '')
    .trim();
}

async function copyRowsByCursor(
  params: CopyRowsCursorOptions & {
    sourceConnection: DbConnection;
    targetConnection: DbConnection;
  },
) {
  const plan = await prepareCopyRowsPlan(params);
  if (!plan) {
    return 0;
  }
  if (!plan.columns.includes(params.cursorColumn)) {
    throw new Error(
      `${params.tableName} 缺少游标列 ${params.cursorColumn}，无法分页迁移`,
    );
  }

  const normalizedWhereSql = normalizeWhereClause(params.whereSql);
  const quotedCursorColumn = quoteIdentifier(params.cursorColumn);
  const pageSize =
    Number.isFinite(params.pageSize) && Number(params.pageSize) > 0
      ? Math.floor(Number(params.pageSize))
      : COPY_ROWS_PAGE_SIZE;
  let copied = 0;
  let cursorValue: null | number | string = null;

  while (true) {
    const whereClauses: string[] = [];
    const queryParams = [...(params.params || [])];

    if (normalizedWhereSql) {
      whereClauses.push(`(${normalizedWhereSql})`);
    }
    if (cursorValue !== null) {
      whereClauses.push(`${quotedCursorColumn} > ?`);
      queryParams.push(cursorValue);
    }

    queryParams.push(pageSize);

    const rows = (await params.sourceConnection.query(
      `SELECT ${plan.columns
        .map((column) => quoteIdentifier(column))
        .join(', ')} FROM ${quoteIdentifier(params.tableName)}${
        whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''
      } ORDER BY ${quotedCursorColumn} ASC LIMIT ?`,
      queryParams,
    )) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return copied;
    }

    await params.beforeWritePage?.(rows);
    copied += await writeRowsInChunks({
      heartbeat: params.heartbeat,
      plan,
      rows,
      targetConnection: params.targetConnection,
      targetTransforms: params.targetTransforms,
    });
    await params.afterWritePage?.(rows);

    const nextCursorValue = rows.at(-1)?.[params.cursorColumn];
    if (nextCursorValue === null || nextCursorValue === undefined) {
      throw new Error(
        `${params.tableName} 最后一条记录缺少游标值 ${params.cursorColumn}`,
      );
    }
    cursorValue =
      typeof nextCursorValue === 'bigint'
        ? Number(nextCursorValue)
        : (nextCursorValue as number | string);
  }
}

function buildInWhere(column: string, ids: number[]) {
  return {
    params: ids,
    whereSql: `WHERE ${quoteIdentifier(column)} IN (${ids
      .map(() => '?')
      .join(', ')})`,
  };
}

function buildRawInWhere(column: string, ids: number[]) {
  return {
    params: ids,
    whereSql: `WHERE ${column} IN (${ids.map(() => '?').join(', ')})`,
  };
}

function toPositiveNumber(value: unknown) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function uniquePositiveNumbers(values: unknown[]) {
  const uniqueIds: number[] = [];
  for (const value of values) {
    const id = toPositiveNumber(value);
    if (id !== null && !uniqueIds.includes(id)) {
      uniqueIds.push(id);
    }
  }
  return uniqueIds;
}

function pickPositiveIds(rows: Array<Record<string, unknown>>, column: string) {
  return uniquePositiveNumbers(rows.map((row) => row[column]));
}

async function copyRowsByIds(params: {
  heartbeat?: () => Promise<void>;
  idColumn: string;
  ids: number[];
  sourceConnection: DbConnection;
  tableName: string;
  targetConnection: DbConnection;
  targetTransforms?: CopyRowsOptions['targetTransforms'];
}) {
  const ids = uniquePositiveNumbers(params.ids);
  if (ids.length === 0) {
    return 0;
  }
  const where = buildInWhere(params.idColumn, ids);
  return copyRows({
    ...where,
    sourceConnection: params.sourceConnection,
    tableName: params.tableName,
    targetConnection: params.targetConnection,
    targetTransforms: params.targetTransforms,
    heartbeat: params.heartbeat,
  });
}

async function copyParksForPage(params: {
  heartbeat?: () => Promise<void>;
  rows: Array<Record<string, unknown>>;
  sourceConnection: DbConnection;
  targetConnection: DbConnection;
}) {
  return copyRowsByIds({
    heartbeat: params.heartbeat,
    idColumn: 'park_id',
    ids: pickPositiveIds(params.rows, 'park_id'),
    sourceConnection: params.sourceConnection,
    tableName: 'park',
    targetConnection: params.targetConnection,
  });
}

async function copyImagesForLinkOwners(params: {
  heartbeat?: () => Promise<void>;
  linkOwnerColumn: string;
  linkOwnerIds: number[];
  linkTableName: string;
  sourceConnection: DbConnection;
  targetConnection: DbConnection;
}) {
  const ownerIds = uniquePositiveNumbers(params.linkOwnerIds);
  if (ownerIds.length === 0) {
    return 0;
  }

  const where = buildInWhere(params.linkOwnerColumn, ownerIds);
  return copyRowsByCursor({
    ...where,
    beforeWritePage: async (rows) => {
      await copyRowsByIds({
        heartbeat: params.heartbeat,
        idColumn: 'img_id',
        ids: pickPositiveIds(rows, 'img_id'),
        sourceConnection: params.sourceConnection,
        tableName: 'image',
        targetConnection: params.targetConnection,
      });
    },
    cursorColumn: 'id',
    heartbeat: params.heartbeat,
    sourceConnection: params.sourceConnection,
    tableName: params.linkTableName,
    targetConnection: params.targetConnection,
  });
}

async function copyImagesForOwnerPage(params: {
  heartbeat?: () => Promise<void>;
  linkOwnerColumn: string;
  linkTableName: string;
  ownerIdColumn: string;
  rows: Array<Record<string, unknown>>;
  sourceConnection: DbConnection;
  targetConnection: DbConnection;
}) {
  return copyImagesForLinkOwners({
    heartbeat: params.heartbeat,
    linkOwnerColumn: params.linkOwnerColumn,
    linkOwnerIds: pickPositiveIds(params.rows, params.ownerIdColumn),
    linkTableName: params.linkTableName,
    sourceConnection: params.sourceConnection,
    targetConnection: params.targetConnection,
  });
}

function buildInvestmentPhones(context: UserMigrationContext) {
  return [context.username, context.centerUser.phone]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

async function getRoleIdByName(
  connection: DbConnection,
  roleName = TENANT_CREATOR_ROLE_NAME,
) {
  const rows = (await connection.query(
    'SELECT role_id AS roleId FROM `role` WHERE name = ? LIMIT 1',
    [roleName],
  )) as Array<{ roleId: bigint | number | string }>;
  const roleId = Number(rows[0]?.roleId || 0);
  if (!roleId) {
    throw new Error(`目标权限角色不存在: ${roleName}`);
  }
  return roleId;
}

async function copyRowsByIdsOrdered(params: {
  heartbeat?: () => Promise<void>;
  idColumn: string;
  ids: number[];
  orderColumn?: string;
  sourceConnection: DbConnection;
  tableName: string;
  targetConnection: DbConnection;
  targetTransforms?: CopyRowsOptions['targetTransforms'];
}) {
  const ids = uniquePositiveNumbers(params.ids);
  if (ids.length === 0) {
    return 0;
  }
  const where = buildInWhere(params.idColumn, ids);
  return copyRows({
    ...where,
    heartbeat: params.heartbeat,
    sourceConnection: params.sourceConnection,
    tableName: params.tableName,
    targetConnection: params.targetConnection,
    targetTransforms: params.targetTransforms,
    whereSql: `${where.whereSql} ORDER BY ${quoteIdentifier(
      params.orderColumn || params.idColumn,
    )} ASC`,
  });
}

async function resolveSuperPermissionClosure(
  connection: DbConnection,
): Promise<SuperPermissionClosure> {
  const roleId = await getRoleIdByName(connection);
  const roleMenuRows = (await connection.query(
    'SELECT id FROM `role_menu` WHERE role_id = ?',
    [roleId],
  )) as Array<Record<string, unknown>>;
  const roleCodeRows = (await connection.query(
    'SELECT code_id AS codeId FROM `role_code` WHERE role_id = ?',
    [roleId],
  )) as Array<Record<string, unknown>>;
  const codeIds = uniquePositiveNumbers(roleCodeRows.map((row) => row.codeId));

  return {
    codeIds,
    roleCodeCount: roleCodeRows.length,
    roleId,
    roleMenuCount: roleMenuRows.length,
  };
}

async function copySuperPermissionClosure(params: {
  heartbeat?: () => Promise<void>;
  sourceConnection: DbConnection;
  targetConnection: DbConnection;
}) {
  const closure = await resolveSuperPermissionClosure(params.sourceConnection);

  await params.targetConnection.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await copyRows({
      heartbeat: params.heartbeat,
      sourceConnection: params.sourceConnection,
      tableName: 'menu',
      targetConnection: params.targetConnection,
    });
    await copyRows({
      heartbeat: params.heartbeat,
      sourceConnection: params.sourceConnection,
      tableName: 'menu_meta',
      targetConnection: params.targetConnection,
    });
    await copyRows({
      heartbeat: params.heartbeat,
      params: [closure.roleId],
      sourceConnection: params.sourceConnection,
      tableName: 'role',
      targetConnection: params.targetConnection,
      targetTransforms: {
        parent_id: () => null,
      },
      whereSql: 'WHERE role_id = ?',
    });
    await copyRowsByIdsOrdered({
      heartbeat: params.heartbeat,
      idColumn: 'code_id',
      ids: closure.codeIds,
      sourceConnection: params.sourceConnection,
      tableName: 'code',
      targetConnection: params.targetConnection,
    });
    await copyRows({
      heartbeat: params.heartbeat,
      params: [closure.roleId],
      sourceConnection: params.sourceConnection,
      tableName: 'role_menu',
      targetConnection: params.targetConnection,
      whereSql: 'WHERE role_id = ?',
    });
    await copyRows({
      heartbeat: params.heartbeat,
      params: [closure.roleId],
      sourceConnection: params.sourceConnection,
      tableName: 'role_code',
      targetConnection: params.targetConnection,
      whereSql: 'WHERE role_id = ?',
    });
  } finally {
    await params.targetConnection
      .query('SET FOREIGN_KEY_CHECKS = 1')
      .catch(() => undefined);
  }

  return closure.roleId;
}

async function copyBaseDataTables(params: {
  heartbeat?: () => Promise<void>;
  sourceConnection: DbConnection;
  targetConnection: DbConnection;
}) {
  let copied = 0;
  for (const tableName of BASE_DATA_TABLES) {
    copied += await copyRows({
      sourceConnection: params.sourceConnection,
      tableName,
      targetConnection: params.targetConnection,
      heartbeat: params.heartbeat,
    });
  }
  return copied;
}

async function getOrganizationRoleRows(params: {
  sourceConnection: DbConnection;
  sourceOrgId: number;
}) {
  return (await params.sourceConnection.query(
    `
      SELECT
        role_id AS roleId,
        parent_id AS parentId,
        name
      FROM \`role\`
      WHERE scope = 'organization'
        AND organization_id = ?
      ORDER BY role_id ASC
    `,
    [params.sourceOrgId],
  )) as Array<{
    name: null | string;
    parentId: bigint | null | number | string;
    roleId: bigint | number | string;
  }>;
}

async function copyOrganizationRoleSnapshot(params: {
  heartbeat?: () => Promise<void>;
  jobId: number;
  sourceConnection: DbConnection;
  sourceOrgId: number;
  targetConnection: DbConnection;
}): Promise<OrganizationRoleSnapshotPlan> {
  const roleRows = await getOrganizationRoleRows({
    sourceConnection: params.sourceConnection,
    sourceOrgId: params.sourceOrgId,
  });
  const roleIds = uniquePositiveNumbers(roleRows.map((row) => row.roleId));
  if (roleIds.length === 0) {
    return {
      roleMap: new Map<number, number>(),
      snapshots: [],
    };
  }

  const roleIdSet = new Set(roleIds);
  const invalidParent = roleRows.find((row) => {
    const parentId = toPositiveNumber(row.parentId);
    return parentId !== null && !roleIdSet.has(parentId);
  });
  if (invalidParent) {
    throw new Error(
      `组织角色树存在跨组织父级: sourceOrgId=${params.sourceOrgId}, roleId=${invalidParent.roleId}`,
    );
  }

  const where = buildInWhere('role_id', roleIds);
  const rawRoleWhere = buildRawInWhere('role_id', roleIds);
  await copyRows({
    ...where,
    heartbeat: params.heartbeat,
    sourceConnection: params.sourceConnection,
    tableName: 'role',
    targetConnection: params.targetConnection,
    targetTransforms: {
      organization_id: () => null,
      scope: () => 'system',
    },
    whereSql: `${where.whereSql} ORDER BY role_id ASC`,
  });

  const roleCodeRows = (await params.sourceConnection.query(
    `SELECT code_id AS codeId FROM role_code WHERE role_id IN (${roleIds
      .map(() => '?')
      .join(', ')})`,
    roleIds,
  )) as Array<{ codeId: bigint | number | string }>;
  await copyRowsByIdsOrdered({
    heartbeat: params.heartbeat,
    idColumn: 'code_id',
    ids: uniquePositiveNumbers(roleCodeRows.map((row) => row.codeId)),
    sourceConnection: params.sourceConnection,
    tableName: 'code',
    targetConnection: params.targetConnection,
  });

  const roleParkRows = (await params.sourceConnection.query(
    `SELECT park_id AS parkId FROM role_park WHERE role_id IN (${roleIds
      .map(() => '?')
      .join(', ')})`,
    roleIds,
  )) as Array<{ parkId: bigint | number | string }>;
  await copyRowsByIds({
    heartbeat: params.heartbeat,
    idColumn: 'park_id',
    ids: uniquePositiveNumbers(roleParkRows.map((row) => row.parkId)),
    sourceConnection: params.sourceConnection,
    tableName: 'park',
    targetConnection: params.targetConnection,
  });

  await copyRows({
    ...rawRoleWhere,
    heartbeat: params.heartbeat,
    sourceConnection: params.sourceConnection,
    tableName: 'role_menu',
    targetConnection: params.targetConnection,
    whereSql: rawRoleWhere.whereSql,
  });

  await copyRows({
    ...rawRoleWhere,
    heartbeat: params.heartbeat,
    sourceConnection: params.sourceConnection,
    tableName: 'role_park',
    targetConnection: params.targetConnection,
    whereSql: rawRoleWhere.whereSql,
  });

  await copyRows({
    ...rawRoleWhere,
    heartbeat: params.heartbeat,
    sourceConnection: params.sourceConnection,
    tableName: 'role_code',
    targetConnection: params.targetConnection,
    whereSql: rawRoleWhere.whereSql,
  });

  const roleMap = new Map<number, number>();
  const snapshots = roleRows
    .map((row) => ({
      roleName: row.name ? String(row.name) : null,
      roleId: toPositiveNumber(row.roleId),
    }))
    .filter((item): item is { roleId: number; roleName: null | string } =>
      Boolean(item.roleId),
    )
    .map((item) => {
      roleMap.set(item.roleId, item.roleId);
      return {
        roleName: item.roleName,
        sourceRoleId: item.roleId,
        targetRoleId: item.roleId,
      };
    });

  return { roleMap, snapshots };
}

async function saveTenantProvisioningRoleSnapshots(params: {
  jobId: number;
  snapshots: OrganizationRoleSnapshotItem[];
  sourceOrgId: number;
}) {
  await systemDbClient.$transaction(async (tx) => {
    await tx.tenantProvisioningRoleSnapshot.deleteMany({
      where: { jobId: params.jobId },
    });
    for (const item of params.snapshots) {
      await tx.tenantProvisioningRoleSnapshot.create({
        data: {
          jobId: params.jobId,
          roleName: item.roleName,
          sourceOrgId: params.sourceOrgId,
          sourceRoleId: item.sourceRoleId,
          targetRoleId: item.targetRoleId,
        },
      });
    }
  });
}

async function resolveSourceTenantUser(params: {
  centerUser: CenterUserSnapshot;
  centerUserId: number;
  sourceConnection: DbConnection;
  sourceCustomerId: string;
  sourceUserId?: null | number;
}) {
  const sourceUserId = toPositiveNumber(params.sourceUserId);
  const mapping = sourceUserId
    ? null
    : await systemDbClient.userCustomerMapping.findUnique({
        select: { customerUserId: true },
        where: {
          centerUserId_customerId: {
            centerUserId: params.centerUserId,
            customerId: params.sourceCustomerId,
          },
        },
      });

  const rows = (await params.sourceConnection.query(
    sourceUserId || mapping?.customerUserId
      ? 'SELECT id, username, real_name AS realName, password, status, phone, home_path AS homePath FROM `user` WHERE id = ? LIMIT 1'
      : 'SELECT id, username, real_name AS realName, password, status, phone, home_path AS homePath FROM `user` WHERE username = ? LIMIT 1',
    [
      sourceUserId ||
        (mapping?.customerUserId
          ? Number(mapping.customerUserId)
          : params.centerUser.username),
    ],
  )) as SourceTenantUserSnapshot[];

  const sourceUser = rows[0];
  if (!sourceUser) {
    throw new Error(
      `未找到 public 库用户，centerUserId=${params.centerUserId}, username=${params.centerUser.username}`,
    );
  }
  return sourceUser;
}

async function resolveOrganizationMembers(params: {
  sourceConnection: DbConnection;
  sourceCustomerId: string;
  sourceOrgId: number;
}) {
  const members = await systemDbClient.organizationMember.findMany({
    orderBy: [{ memberRole: 'desc' }, { id: 'asc' }],
    select: {
      centerUserId: true,
      memberRole: true,
      sourceUserId: true,
    },
    where: {
      organizationId: params.sourceOrgId,
      sourceCustomerId: params.sourceCustomerId,
      status: 'active',
    },
  });

  if (members.length === 0) {
    throw new Error(`组织缺少 active 成员: sourceOrgId=${params.sourceOrgId}`);
  }

  const resolved: OrganizationMemberSnapshot[] = [];
  for (const member of members) {
    const centerUser = await systemDbClient.user.findUnique({
      select: {
        customerType: true,
        homePath: true,
        id: true,
        password: true,
        phone: true,
        realName: true,
        status: true,
        tokenVersion: true,
        username: true,
      },
      where: { id: Number(member.centerUserId) },
    });
    if (!centerUser) {
      throw new Error(`组织成员中心用户不存在: ${member.centerUserId}`);
    }
    if (Number(centerUser.status ?? 1) !== 1) {
      throw new Error(`组织成员中心用户已禁用: ${member.centerUserId}`);
    }

    const sourceUser = await resolveSourceTenantUser({
      centerUser,
      centerUserId: Number(member.centerUserId),
      sourceConnection: params.sourceConnection,
      sourceCustomerId: params.sourceCustomerId,
      sourceUserId: member.sourceUserId ? Number(member.sourceUserId) : null,
    });

    resolved.push({
      centerUser,
      centerUserId: Number(member.centerUserId),
      memberRole: String(member.memberRole || 'member'),
      sourceUser,
      sourceUserId: Number(sourceUser.id),
      targetUserId: 0,
    });
  }

  return resolved;
}

async function assertOrganizationMigrationScope(params: {
  sourceCustomerId: string;
  sourceOrgId: number;
}) {
  const organization = await systemDbClient.organization.findFirst({
    select: {
      id: true,
      sourceCustomerId: true,
      status: true,
    },
    where: {
      id: params.sourceOrgId,
      sourceCustomerId: params.sourceCustomerId,
      status: 'active',
    },
  });
  if (!organization) {
    throw new Error(
      `源组织不存在或不可迁移: sourceOrgId=${params.sourceOrgId}, sourceCustomerId=${params.sourceCustomerId}`,
    );
  }

  const existingMapping =
    await systemDbClient.organizationTenantMapping.findFirst({
      select: { targetCustomerId: true },
      where: {
        organizationId: params.sourceOrgId,
        status: 'active',
      },
    });
  if (existingMapping?.targetCustomerId) {
    throw new Error(
      `源组织已有 active 租户映射: sourceOrgId=${params.sourceOrgId}, targetCustomerId=${existingMapping.targetCustomerId}`,
    );
  }
}

async function assertOrganizationMembersCanSwitch(params: {
  sourceCustomerId: string;
  sourceOrgId: number;
  targetCustomerId: string;
}) {
  const members = await systemDbClient.organizationMember.findMany({
    select: { centerUserId: true },
    where: {
      organizationId: params.sourceOrgId,
      sourceCustomerId: params.sourceCustomerId,
      status: 'active',
    },
  });
  if (members.length === 0) {
    throw new Error(`组织缺少 active 成员: sourceOrgId=${params.sourceOrgId}`);
  }

  const centerUserIds = uniquePositiveNumbers(
    members.map((member) => member.centerUserId),
  );
  const centerUsers = await systemDbClient.user.findMany({
    select: {
      customerType: true,
      id: true,
      status: true,
    },
    where: { id: { in: centerUserIds } },
  });
  const centerUsersById = new Map(centerUsers.map((user) => [user.id, user]));

  for (const centerUserId of centerUserIds) {
    const centerUser = centerUsersById.get(centerUserId);
    if (!centerUser) {
      throw new Error(`组织成员中心用户不存在: ${centerUserId}`);
    }
    if (Number(centerUser.status ?? 1) !== 1) {
      throw new Error(`组织成员中心用户已禁用: ${centerUserId}`);
    }

    const customerType = String(centerUser.customerType || '');
    if (
      customerType &&
      customerType !== params.sourceCustomerId &&
      customerType !== params.targetCustomerId
    ) {
      throw new Error(
        `组织成员已归属到其他租户: centerUserId=${centerUserId}, customerType=${customerType}，停止自动切换`,
      );
    }
  }
}

async function assertInitiatorOwnsOrganization(params: {
  centerUserId: number;
  sourceCustomerId: string;
  sourceOrgId: number;
}) {
  const membership =
    await resolveSingleActiveOwnedSourceOrganizationForCenterUser({
      centerUserId: params.centerUserId,
      sourceCustomerId: params.sourceCustomerId,
    });
  if (membership?.organization.id !== params.sourceOrgId) {
    throw new Error(
      `开通发起人不是组织 active owner: centerUserId=${params.centerUserId}, sourceOrgId=${params.sourceOrgId}`,
    );
  }
}

async function ensureTargetTenantUser(params: {
  centerUser: CenterUserSnapshot;
  sourceUser: SourceTenantUserSnapshot;
  targetConnection: DbConnection;
  targetCustomerId: string;
}) {
  await params.targetConnection.query(
    `
      INSERT INTO \`user\`
        (username, real_name, password, customer_type, status, token_version, phone, home_path, park_id, create_time, update_time)
      VALUES (?, ?, ?, ?, 1, 1, ?, ?, NULL, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        real_name = VALUES(real_name),
        password = VALUES(password),
        customer_type = VALUES(customer_type),
        status = 1,
        phone = VALUES(phone),
        home_path = VALUES(home_path),
        update_time = NOW()
    `,
    [
      params.centerUser.username,
      params.centerUser.realName || params.sourceUser.realName,
      params.centerUser.password || params.sourceUser.password,
      params.targetCustomerId,
      params.centerUser.phone || params.sourceUser.phone || null,
      params.centerUser.homePath || params.sourceUser.homePath || null,
    ],
  );

  const rows = (await params.targetConnection.query(
    'SELECT id FROM `user` WHERE username = ? LIMIT 1',
    [params.centerUser.username],
  )) as Array<{ id: bigint | number | string }>;
  const targetUserId = Number(rows[0]?.id || 0);
  if (!targetUserId) {
    throw new Error('目标租户用户创建失败');
  }
  return targetUserId;
}

function userIdTransforms(context: UserMigrationContext) {
  return {
    audit_user_id: (value: unknown) =>
      Number(value) === context.sourceUserId ? context.targetUserId : null,
    center_user_id: () => context.centerUserId,
    customer_id: () => context.targetCustomerId,
    user_id: () => context.targetUserId,
  };
}

async function assignTenantCreatorSuperRole(params: {
  context: UserMigrationContext;
  heartbeat?: () => Promise<void>;
  targetConnection: DbConnection;
}) {
  await params.targetConnection.query(
    'DELETE FROM user_role WHERE user_id = ?',
    [params.context.targetUserId],
  );
  await params.targetConnection.query(
    'DELETE FROM user_code WHERE user_id = ?',
    [params.context.targetUserId],
  );

  const roleId = await getRoleIdByName(params.targetConnection);
  await params.targetConnection.query(
    'INSERT INTO user_role (user_id, role_id, create_time, update_time) VALUES (?, ?, NOW(), NOW())',
    [params.context.targetUserId, roleId],
  );
  await params.heartbeat?.();
}

async function assignOrganizationMemberRoles(params: {
  heartbeat?: () => Promise<void>;
  members: OrganizationMemberSnapshot[];
  roleMap: Map<number, number>;
  sourceConnection: DbConnection;
  sourceOrgId: number;
  targetConnection: DbConnection;
}) {
  for (const member of params.members) {
    await params.targetConnection.query(
      'DELETE FROM user_role WHERE user_id = ?',
      [member.targetUserId],
    );
    await params.targetConnection.query(
      'DELETE FROM user_code WHERE user_id = ?',
      [member.targetUserId],
    );

    if (member.memberRole === 'owner') {
      const roleId = await getRoleIdByName(params.targetConnection);
      await params.targetConnection.query(
        'INSERT INTO user_role (user_id, role_id, create_time, update_time) VALUES (?, ?, NOW(), NOW())',
        [member.targetUserId, roleId],
      );
      await params.heartbeat?.();
      continue;
    }

    const sourceRoleRows = (await params.sourceConnection.query(
      `
        SELECT user_role.role_id AS roleId
          FROM user_role
          INNER JOIN \`role\`
            ON \`role\`.role_id = user_role.role_id
         WHERE user_role.user_id = ?
           AND \`role\`.scope = 'organization'
           AND \`role\`.organization_id = ?
      `,
      [member.sourceUserId, params.sourceOrgId],
    )) as Array<{ roleId: bigint | number | string }>;
    const targetRoleIds = uniquePositiveNumbers(
      sourceRoleRows
        .map((row) => params.roleMap.get(Number(row.roleId)))
        .filter((roleId) => roleId !== undefined),
    );

    if (targetRoleIds.length > 0) {
      await params.targetConnection.query(
        `INSERT INTO user_role (user_id, role_id, create_time, update_time)
         VALUES ${targetRoleIds.map(() => '(?, ?, NOW(), NOW())').join(', ')}`,
        targetRoleIds.flatMap((roleId) => [member.targetUserId, roleId]),
      );
    }
    await params.heartbeat?.();
  }
}

async function migrateUserScopedData(params: {
  context: UserMigrationContext;
  heartbeat?: () => Promise<void>;
  sourceConnection: DbConnection;
  targetConnection: DbConnection;
}) {
  const transforms = userIdTransforms(params.context);
  const copyParks = (rows: Array<Record<string, unknown>>) =>
    copyParksForPage({
      heartbeat: params.heartbeat,
      rows,
      sourceConnection: params.sourceConnection,
      targetConnection: params.targetConnection,
    });

  await copyRowsByCursor({
    cursorColumn: 'localization_id',
    params: [params.context.sourceUserId, params.context.username],
    sourceConnection: params.sourceConnection,
    tableName: 'localization',
    targetConnection: params.targetConnection,
    targetTransforms: transforms,
    whereSql: 'WHERE user_id = ? OR user_name = ?',
    heartbeat: params.heartbeat,
  });
  await copyRowsByCursor({
    cursorColumn: 'attendanceId',
    params: [params.context.sourceUserId, params.context.username],
    sourceConnection: params.sourceConnection,
    tableName: 'attendances',
    targetConnection: params.targetConnection,
    targetTransforms: transforms,
    whereSql: 'WHERE user_id = ? OR username = ?',
    heartbeat: params.heartbeat,
  });
  await copyRowsByCursor({
    cursorColumn: 'id',
    params: [
      params.context.sourceUserId,
      params.context.centerUserId,
      params.context.username,
    ],
    sourceConnection: params.sourceConnection,
    tableName: 'feedback',
    targetConnection: params.targetConnection,
    targetTransforms: transforms,
    whereSql: 'WHERE user_id = ? OR center_user_id = ? OR username = ?',
    heartbeat: params.heartbeat,
  });
  await copyRowsByCursor({
    cursorColumn: 'id',
    params: [
      params.context.sourceUserId,
      params.context.username,
      params.context.username,
    ],
    sourceConnection: params.sourceConnection,
    tableName: 'leave_application',
    targetConnection: params.targetConnection,
    targetTransforms: transforms,
    whereSql: 'WHERE user_id = ? OR username = ? OR user = ?',
    beforeWritePage: copyParks,
    heartbeat: params.heartbeat,
  });

  await copyRowsByCursor({
    afterWritePage: (rows) =>
      copyImagesForOwnerPage({
        heartbeat: params.heartbeat,
        linkOwnerColumn: 'reimbursement_id',
        linkTableName: 'reimbursement_image',
        ownerIdColumn: 'id',
        rows,
        sourceConnection: params.sourceConnection,
        targetConnection: params.targetConnection,
      }),
    beforeWritePage: copyParks,
    cursorColumn: 'id',
    params: [params.context.sourceUserId, params.context.username],
    sourceConnection: params.sourceConnection,
    tableName: 'reimbursement',
    targetConnection: params.targetConnection,
    targetTransforms: transforms,
    whereSql: 'WHERE user_id = ? OR username = ?',
    heartbeat: params.heartbeat,
  });

  const investmentWhere = buildInvestmentPhoneWhere(params.context);
  if (investmentWhere) {
    await copyRowsByCursor({
      afterWritePage: (rows) =>
        copyImagesForOwnerPage({
          heartbeat: params.heartbeat,
          linkOwnerColumn: 'investment_id',
          linkTableName: 'investment_image',
          ownerIdColumn: 'investment_id',
          rows,
          sourceConnection: params.sourceConnection,
          targetConnection: params.targetConnection,
        }),
      beforeWritePage: copyParks,
      cursorColumn: 'investment_id',
      params: investmentWhere.params,
      sourceConnection: params.sourceConnection,
      tableName: 'investment',
      targetConnection: params.targetConnection,
      whereSql: investmentWhere.whereSql,
      heartbeat: params.heartbeat,
    });
  }
}

async function migrateOrganizationScopedData(params: {
  context: OrganizationMigrationContext;
  heartbeat?: () => Promise<void>;
  members: OrganizationMemberSnapshot[];
  roleMap: Map<number, number>;
  sourceConnection: DbConnection;
  sourceOrgId: number;
  targetConnection: DbConnection;
}) {
  for (const member of params.members) {
    member.targetUserId = await ensureTargetTenantUser({
      centerUser: member.centerUser,
      sourceUser: member.sourceUser,
      targetConnection: params.targetConnection,
      targetCustomerId: params.context.targetCustomerId,
    });
  }

  await assignOrganizationMemberRoles({
    heartbeat: params.heartbeat,
    members: params.members,
    roleMap: params.roleMap,
    sourceConnection: params.sourceConnection,
    sourceOrgId: params.sourceOrgId,
    targetConnection: params.targetConnection,
  });

  for (const member of params.members) {
    await migrateUserScopedData({
      context: {
        centerUser: member.centerUser,
        centerUserId: member.centerUserId,
        sourceCustomerId: params.context.sourceCustomerId,
        sourceOrgId: params.sourceOrgId,
        sourceUserId: member.sourceUserId,
        targetCustomerId: params.context.targetCustomerId,
        targetUserId: member.targetUserId,
        username: member.sourceUser.username || member.centerUser.username,
      },
      heartbeat: params.heartbeat,
      sourceConnection: params.sourceConnection,
      targetConnection: params.targetConnection,
    });
  }
}

async function ensureJobTargetIdentity(job: TenantProvisioningJobRecord) {
  if (!job.targetCustomerId) {
    throw new Error(
      `租户开通任务缺少 targetCustomerId，无法建库 jobId=${job.id}`,
    );
  }

  const targetCustomerId = normalizeCustomerId(job.targetCustomerId);
  const targetDbName = job.targetDbName
    ? normalizeDatabaseName(job.targetDbName)
    : getDatabaseNameFromUrl(resolveCustomerDbUrl(targetCustomerId));

  const result = await systemDbClient.tenantProvisioningJob.updateMany({
    data: {
      heartbeatAt: new Date(),
      targetCustomerId,
      targetDbName,
    },
    where: {
      id: job.id,
      lockOwner: job.lockOwner,
      status: 'provisioning',
    },
  });
  if (result.count === 0) {
    throw new Error(`租户开通任务租约已失效，无法固化目标库 jobId=${job.id}`);
  }

  return {
    targetCustomerId,
    targetDbName,
  };
}

async function markJobFailed(job: TenantProvisioningJobRecord, error: unknown) {
  const retryCount = Number(job.retryCount || 0) + 1;
  const maxRetry = getWorkerMaxRetry();
  const failedManual = retryCount >= maxRetry;
  const result = await systemDbClient.tenantProvisioningJob.updateMany({
    data: {
      errorMessage: error instanceof Error ? error.message : String(error),
      heartbeatAt: null,
      lockedAt: null,
      lockOwner: null,
      retryCount,
      status: failedManual ? 'failed_manual' : 'failed_retryable',
      step: failedManual ? 'failed' : 'retry_waiting',
    },
    where: {
      id: job.id,
      lockOwner: job.lockOwner,
      status: 'provisioning',
    },
  });

  if (result.count === 0) {
    console.warn(`租户开通任务租约已失效，跳过失败标记 jobId=${job.id}`);
  }
}

async function switchCenterUserToTarget(params: {
  centerUserId: number;
  city?: null | string;
  companyShortName?: null | string;
  customerName: string;
  jobId: number;
  lockOwner: string;
  organizationMembers?: OrganizationMemberSnapshot[];
  sourceCustomerId: string;
  sourceOrgId?: null | number;
  targetCustomerId: string;
  targetDbName: string;
  targetUserId: number;
}) {
  await systemDbClient.$transaction(async (tx) => {
    const lease = await tx.tenantProvisioningJob.findFirst({
      select: { id: true },
      where: {
        id: params.jobId,
        lockOwner: params.lockOwner,
        status: 'provisioning',
      },
    });
    if (!lease) {
      throw new Error(
        `租户开通任务租约已失效，无法切换租户 jobId=${params.jobId}`,
      );
    }

    const current = await tx.user.findUnique({
      select: { customerType: true },
      where: { id: params.centerUserId },
    });
    if (!current) {
      throw new Error('中心用户不存在，无法切换租户');
    }

    const memberMappings =
      params.organizationMembers && params.organizationMembers.length > 0
        ? params.organizationMembers.map((member) => ({
            centerUserId: member.centerUserId,
            targetUserId: member.targetUserId,
          }))
        : [
            {
              centerUserId: params.centerUserId,
              targetUserId: params.targetUserId,
            },
          ];
    const invalidMember = memberMappings.find((item) => !item.targetUserId);
    if (invalidMember) {
      throw new Error(
        `组织成员缺少目标用户映射，centerUserId=${invalidMember.centerUserId}`,
      );
    }

    await tx.customer.upsert({
      create: {
        code: params.targetCustomerId,
        city: params.city || null,
        companyShortName: params.companyShortName || null,
        customerId: params.targetCustomerId,
        dbName: params.targetDbName,
        name: params.customerName,
        status: 1,
      },
      update: {
        city: params.city || null,
        companyShortName: params.companyShortName || null,
        dbName: params.targetDbName,
        name: params.customerName,
        status: 1,
      },
      where: { customerId: params.targetCustomerId },
    });

    for (const member of memberMappings) {
      await tx.userCustomerMapping.upsert({
        create: {
          centerUserId: member.centerUserId,
          customerId: params.targetCustomerId,
          customerUserId: member.targetUserId,
          dbName: params.targetDbName,
        },
        update: {
          customerUserId: member.targetUserId,
          dbName: params.targetDbName,
        },
        where: {
          centerUserId_customerId: {
            centerUserId: member.centerUserId,
            customerId: params.targetCustomerId,
          },
        },
      });

      const memberCurrent = await tx.user.findUnique({
        select: { customerType: true },
        where: { id: member.centerUserId },
      });
      if (!memberCurrent) {
        throw new Error(`中心用户不存在，无法切换租户: ${member.centerUserId}`);
      }
      const memberCustomerType = String(memberCurrent.customerType || '');
      if (
        memberCustomerType &&
        memberCustomerType !== params.sourceCustomerId &&
        memberCustomerType !== params.targetCustomerId
      ) {
        throw new Error(
          `中心用户已归属到其他租户: centerUserId=${member.centerUserId}, customerType=${memberCustomerType}，停止自动切换`,
        );
      }
      if (memberCustomerType !== params.targetCustomerId) {
        await tx.user.update({
          data: {
            customerType: params.targetCustomerId,
            tokenVersion: { increment: 1 },
          },
          where: { id: member.centerUserId },
        });
        await tx.refreshToken.updateMany({
          data: { revokedAt: new Date() },
          where: {
            revokedAt: null,
            userId: member.centerUserId,
          },
        });
      }
    }

    if (params.sourceOrgId) {
      await tx.organizationTenantMapping.upsert({
        create: {
          legacy: false,
          organizationId: params.sourceOrgId,
          status: 'active',
          targetCustomerId: params.targetCustomerId,
          targetDbName: params.targetDbName,
          tenantProvisioningJobId: params.jobId,
        },
        update: {
          status: 'active',
          targetDbName: params.targetDbName,
          tenantProvisioningJobId: params.jobId,
        },
        where: { targetCustomerId: params.targetCustomerId },
      });
    }

    const completed = await tx.tenantProvisioningJob.updateMany({
      data: {
        completedAt: new Date(),
        errorMessage: null,
        heartbeatAt: null,
        lockedAt: null,
        lockOwner: null,
        status: 'active',
        step: 'completed',
      },
      where: {
        id: params.jobId,
        lockOwner: params.lockOwner,
        status: 'provisioning',
      },
    });
    if (completed.count === 0) {
      throw new Error(
        `租户开通任务租约已失效，无法完成任务 jobId=${params.jobId}`,
      );
    }
  });
}

async function assertTableCountMatches(params: {
  label: string;
  sourceConnection: DbConnection;
  sourceParams?: unknown[];
  sourceTableName: string;
  sourceWhereSql?: string;
  targetConnection: DbConnection;
  targetParams?: unknown[];
  targetTableName: string;
  targetWhereSql?: string;
}) {
  const expected = await getTableCount(
    params.sourceConnection,
    params.sourceTableName,
    params.sourceWhereSql || '',
    params.sourceParams || [],
  );
  const actual = await getTableCount(
    params.targetConnection,
    params.targetTableName,
    params.targetWhereSql || '',
    params.targetParams || [],
  );

  if (expected !== actual) {
    throw new Error(
      `${params.label} 校验失败，期望 ${expected} 条，实际 ${actual} 条`,
    );
  }
}

async function assertQueryCountMatches(params: {
  label: string;
  sourceConnection: DbConnection;
  sourceParams?: unknown[];
  sourceSql: string;
  targetConnection: DbConnection;
  targetParams?: unknown[];
  targetSql: string;
}) {
  const expected = await getQueryCount(
    params.sourceConnection,
    params.sourceSql,
    params.sourceParams || [],
  );
  const actual = await getQueryCount(
    params.targetConnection,
    params.targetSql,
    params.targetParams || [],
  );

  if (expected !== actual) {
    throw new Error(
      `${params.label} 校验失败，期望 ${expected} 条，实际 ${actual} 条`,
    );
  }
}

function buildInvestmentPhoneWhere(
  context: UserMigrationContext,
  columnName = 'phone_number',
) {
  const phones = buildInvestmentPhones(context);
  if (phones.length === 0) {
    return null;
  }
  return {
    params: phones,
    whereSql: `WHERE ${columnName} IN (${phones.map(() => '?').join(', ')})`,
  };
}

function buildReferencedParkQuery(params: {
  context: UserMigrationContext;
  userId: number;
}) {
  const sqlParts = [
    'SELECT park_id FROM leave_application WHERE park_id IS NOT NULL AND (user_id = ? OR username = ? OR user = ?)',
    'SELECT park_id FROM reimbursement WHERE park_id IS NOT NULL AND (user_id = ? OR username = ?)',
  ];
  const queryParams: unknown[] = [
    params.userId,
    params.context.username,
    params.context.username,
    params.userId,
    params.context.username,
  ];
  const investmentPhones = buildInvestmentPhones(params.context);
  if (investmentPhones.length > 0) {
    sqlParts.push(
      `SELECT park_id FROM investment WHERE park_id IS NOT NULL AND phone_number IN (${investmentPhones
        .map(() => '?')
        .join(', ')})`,
    );
    queryParams.push(...investmentPhones);
  }

  return {
    params: queryParams,
    sql: sqlParts.join(' UNION '),
  };
}

async function assertReferencedParksCopied(params: {
  context: UserMigrationContext;
  sourceConnection: DbConnection;
  targetConnection: DbConnection;
}) {
  const sourceRefs = buildReferencedParkQuery({
    context: params.context,
    userId: params.context.sourceUserId,
  });
  const targetRefs = buildReferencedParkQuery({
    context: params.context,
    userId: params.context.targetUserId,
  });
  const expected = await getQueryCount(
    params.sourceConnection,
    `SELECT COUNT(DISTINCT park_id) AS total FROM (${sourceRefs.sql}) referenced_parks`,
    sourceRefs.params,
  );
  const actualReferences = await getQueryCount(
    params.targetConnection,
    `SELECT COUNT(DISTINCT park_id) AS total FROM (${targetRefs.sql}) referenced_parks`,
    targetRefs.params,
  );
  if (expected !== actualReferences) {
    throw new Error(
      `园区引用校验失败，期望 ${expected} 个，实际 ${actualReferences} 个`,
    );
  }

  const actualParkRows = await getQueryCount(
    params.targetConnection,
    `SELECT COUNT(DISTINCT park.park_id) AS total
       FROM park
       INNER JOIN (${targetRefs.sql}) referenced_parks
         ON referenced_parks.park_id = park.park_id`,
    targetRefs.params,
  );
  if (actualParkRows !== actualReferences) {
    throw new Error(
      `园区基础数据校验失败，期望 ${actualReferences} 条，实际 ${actualParkRows} 条`,
    );
  }
}

async function validateProvisionedTenant(params: {
  context: UserMigrationContext;
  sourceConnection: DbConnection;
  targetConnection: DbConnection;
  targetUserId: number;
  templateConnection: DbConnection;
}) {
  for (const tableName of BASE_DATA_TABLES) {
    await assertTableCountMatches({
      label: `基础表 ${tableName}`,
      sourceConnection: params.templateConnection,
      sourceTableName: tableName,
      targetConnection: params.targetConnection,
      targetTableName: tableName,
    });
  }
  for (const tableName of ['menu', 'menu_meta']) {
    await assertTableCountMatches({
      label: `菜单基础表 ${tableName}`,
      sourceConnection: params.sourceConnection,
      sourceTableName: tableName,
      targetConnection: params.targetConnection,
      targetTableName: tableName,
    });
  }

  const sourceClosure = await resolveSuperPermissionClosure(
    params.sourceConnection,
  );
  const superRoleId = await getRoleIdByName(params.targetConnection);
  if (superRoleId !== sourceClosure.roleId) {
    throw new Error(
      `Super 角色 ID 校验失败，期望 ${sourceClosure.roleId}，实际 ${superRoleId}`,
    );
  }

  await assertTableCountMatches({
    label: 'Super 菜单权限',
    sourceConnection: params.sourceConnection,
    sourceParams: [sourceClosure.roleId],
    sourceTableName: 'role_menu',
    sourceWhereSql: 'WHERE role_id = ?',
    targetConnection: params.targetConnection,
    targetParams: [sourceClosure.roleId],
    targetTableName: 'role_menu',
    targetWhereSql: 'WHERE role_id = ?',
  });
  await assertTableCountMatches({
    label: 'Super 权限码',
    sourceConnection: params.sourceConnection,
    sourceParams: [sourceClosure.roleId],
    sourceTableName: 'role_code',
    sourceWhereSql: 'WHERE role_id = ?',
    targetConnection: params.targetConnection,
    targetParams: [sourceClosure.roleId],
    targetTableName: 'role_code',
    targetWhereSql: 'WHERE role_id = ?',
  });

  const superRoleCount = await getTableCount(
    params.targetConnection,
    'user_role',
    'WHERE user_id = ? AND role_id = ?',
    [params.targetUserId, superRoleId],
  );
  if (superRoleCount !== 1) {
    throw new Error(
      `创建者 Super 角色校验失败，targetUserId=${params.targetUserId}`,
    );
  }

  const userCodeCount = await getTableCount(
    params.targetConnection,
    'user_code',
    'WHERE user_id = ?',
    [params.targetUserId],
  );
  if (userCodeCount !== 0) {
    throw new Error(
      `创建者直绑权限码校验失败，期望 0 条，实际 ${userCodeCount} 条`,
    );
  }

  const targetUserCount = await getTableCount(
    params.targetConnection,
    'user',
    'WHERE id = ? AND username = ?',
    [params.targetUserId, params.context.username],
  );
  if (targetUserCount !== 1) {
    throw new Error(
      `目标租户用户校验失败，targetUserId=${params.targetUserId}, username=${params.context.username}`,
    );
  }

  await assertTableCountMatches({
    label: '定位记录',
    sourceConnection: params.sourceConnection,
    sourceParams: [params.context.sourceUserId, params.context.username],
    sourceTableName: 'localization',
    sourceWhereSql: 'WHERE user_id = ? OR user_name = ?',
    targetConnection: params.targetConnection,
    targetParams: [params.targetUserId, params.context.username],
    targetTableName: 'localization',
    targetWhereSql: 'WHERE user_id = ? OR user_name = ?',
  });
  await assertTableCountMatches({
    label: '考勤记录',
    sourceConnection: params.sourceConnection,
    sourceParams: [params.context.sourceUserId, params.context.username],
    sourceTableName: 'attendances',
    sourceWhereSql: 'WHERE user_id = ? OR username = ?',
    targetConnection: params.targetConnection,
    targetParams: [params.targetUserId, params.context.username],
    targetTableName: 'attendances',
    targetWhereSql: 'WHERE user_id = ? OR username = ?',
  });
  await assertTableCountMatches({
    label: '反馈记录',
    sourceConnection: params.sourceConnection,
    sourceParams: [
      params.context.sourceUserId,
      params.context.centerUserId,
      params.context.username,
    ],
    sourceTableName: 'feedback',
    sourceWhereSql: 'WHERE user_id = ? OR center_user_id = ? OR username = ?',
    targetConnection: params.targetConnection,
    targetParams: [
      params.targetUserId,
      params.context.centerUserId,
      params.context.username,
    ],
    targetTableName: 'feedback',
    targetWhereSql: 'WHERE user_id = ? OR center_user_id = ? OR username = ?',
  });
  await assertTableCountMatches({
    label: '请假记录',
    sourceConnection: params.sourceConnection,
    sourceParams: [
      params.context.sourceUserId,
      params.context.username,
      params.context.username,
    ],
    sourceTableName: 'leave_application',
    sourceWhereSql: 'WHERE user_id = ? OR username = ? OR user = ?',
    targetConnection: params.targetConnection,
    targetParams: [
      params.targetUserId,
      params.context.username,
      params.context.username,
    ],
    targetTableName: 'leave_application',
    targetWhereSql: 'WHERE user_id = ? OR username = ? OR user = ?',
  });
  await assertTableCountMatches({
    label: '报销记录',
    sourceConnection: params.sourceConnection,
    sourceParams: [params.context.sourceUserId, params.context.username],
    sourceTableName: 'reimbursement',
    sourceWhereSql: 'WHERE user_id = ? OR username = ?',
    targetConnection: params.targetConnection,
    targetParams: [params.context.targetUserId, params.context.username],
    targetTableName: 'reimbursement',
    targetWhereSql: 'WHERE user_id = ? OR username = ?',
  });
  await assertQueryCountMatches({
    label: '报销图片',
    sourceConnection: params.sourceConnection,
    sourceParams: [params.context.sourceUserId, params.context.username],
    sourceSql: `
      SELECT COUNT(*) AS total
        FROM reimbursement_image image_link
        INNER JOIN reimbursement owner
          ON owner.id = image_link.reimbursement_id
       WHERE owner.user_id = ? OR owner.username = ?
    `,
    targetConnection: params.targetConnection,
    targetParams: [params.context.targetUserId, params.context.username],
    targetSql: `
      SELECT COUNT(*) AS total
        FROM reimbursement_image image_link
        INNER JOIN reimbursement owner
          ON owner.id = image_link.reimbursement_id
       WHERE owner.user_id = ? OR owner.username = ?
    `,
  });

  const investmentWhere = buildInvestmentPhoneWhere(params.context);
  const investmentOwnerWhere = buildInvestmentPhoneWhere(
    params.context,
    'owner.phone_number',
  );
  if (investmentWhere && investmentOwnerWhere) {
    await assertTableCountMatches({
      label: '招商记录',
      sourceConnection: params.sourceConnection,
      sourceParams: investmentWhere.params,
      sourceTableName: 'investment',
      sourceWhereSql: investmentWhere.whereSql,
      targetConnection: params.targetConnection,
      targetParams: investmentWhere.params,
      targetTableName: 'investment',
      targetWhereSql: investmentWhere.whereSql,
    });
    await assertQueryCountMatches({
      label: '招商图片',
      sourceConnection: params.sourceConnection,
      sourceParams: investmentOwnerWhere.params,
      sourceSql: `
        SELECT COUNT(*) AS total
          FROM investment_image image_link
          INNER JOIN investment owner
            ON owner.investment_id = image_link.investment_id
         ${investmentOwnerWhere.whereSql}
      `,
      targetConnection: params.targetConnection,
      targetParams: investmentOwnerWhere.params,
      targetSql: `
        SELECT COUNT(*) AS total
          FROM investment_image image_link
          INNER JOIN investment owner
            ON owner.investment_id = image_link.investment_id
         ${investmentOwnerWhere.whereSql}
      `,
    });
  }

  await assertReferencedParksCopied({
    context: params.context,
    sourceConnection: params.sourceConnection,
    targetConnection: params.targetConnection,
  });
}

async function validateProvisionedOrganizationTenant(params: {
  context: OrganizationMigrationContext;
  members: OrganizationMemberSnapshot[];
  roleSnapshots: OrganizationRoleSnapshotItem[];
  sourceConnection: DbConnection;
  sourceOrgId: number;
  targetConnection: DbConnection;
  templateConnection: DbConnection;
}) {
  for (const tableName of BASE_DATA_TABLES) {
    await assertTableCountMatches({
      label: `基础表 ${tableName}`,
      sourceConnection: params.templateConnection,
      sourceTableName: tableName,
      targetConnection: params.targetConnection,
      targetTableName: tableName,
    });
  }
  for (const tableName of ['menu', 'menu_meta']) {
    await assertTableCountMatches({
      label: `菜单基础表 ${tableName}`,
      sourceConnection: params.sourceConnection,
      sourceTableName: tableName,
      targetConnection: params.targetConnection,
      targetTableName: tableName,
    });
  }

  const sourceClosure = await resolveSuperPermissionClosure(
    params.sourceConnection,
  );
  const superRoleId = await getRoleIdByName(params.targetConnection);
  if (superRoleId !== sourceClosure.roleId) {
    throw new Error(
      `Super 角色 ID 校验失败，期望 ${sourceClosure.roleId}，实际 ${superRoleId}`,
    );
  }

  if (params.roleSnapshots.length > 0) {
    const targetSnapshotCount = await getQueryCount(
      params.targetConnection,
      `SELECT COUNT(*) AS total
         FROM role
        WHERE role_id IN (${params.roleSnapshots.map(() => '?').join(', ')})`,
      params.roleSnapshots.map((item) => item.targetRoleId),
    );
    if (targetSnapshotCount !== params.roleSnapshots.length) {
      throw new Error(
        `组织角色快照校验失败，期望 ${params.roleSnapshots.length} 条，实际 ${targetSnapshotCount} 条`,
      );
    }
  }

  const publicSuperMigrated = params.roleSnapshots.some(
    (item) => item.sourceRoleId === sourceClosure.roleId,
  );
  if (publicSuperMigrated) {
    throw new Error('public 系统 Super 不能作为组织角色快照迁移');
  }

  for (const member of params.members) {
    const targetUserCount = await getTableCount(
      params.targetConnection,
      'user',
      'WHERE id = ? AND username = ?',
      [member.targetUserId, member.sourceUser.username],
    );
    if (targetUserCount !== 1) {
      throw new Error(
        `组织成员目标用户校验失败，centerUserId=${member.centerUserId}, targetUserId=${member.targetUserId}`,
      );
    }

    if (member.memberRole === 'owner') {
      const ownerSuperCount = await getTableCount(
        params.targetConnection,
        'user_role',
        'WHERE user_id = ? AND role_id = ?',
        [member.targetUserId, superRoleId],
      );
      if (ownerSuperCount !== 1) {
        throw new Error(
          `组织 owner 未获得目标租户 Super，centerUserId=${member.centerUserId}`,
        );
      }
      continue;
    }

    const sourceRoleCount = await getQueryCount(
      params.sourceConnection,
      `
        SELECT COUNT(*) AS total
          FROM user_role
          INNER JOIN \`role\`
            ON \`role\`.role_id = user_role.role_id
         WHERE user_role.user_id = ?
           AND \`role\`.scope = 'organization'
           AND \`role\`.organization_id = ?
      `,
      [member.sourceUserId, params.sourceOrgId],
    );
    const targetRoleCount = await getTableCount(
      params.targetConnection,
      'user_role',
      'WHERE user_id = ?',
      [member.targetUserId],
    );
    if (sourceRoleCount !== targetRoleCount) {
      throw new Error(
        `组织成员角色快照校验失败，centerUserId=${member.centerUserId}, 期望 ${sourceRoleCount} 条，实际 ${targetRoleCount} 条`,
      );
    }
  }
}

async function processProvisioningJob(job: TenantProvisioningJobRecord) {
  const centerUser = await systemDbClient.user.findUnique({
    select: {
      customerType: true,
      homePath: true,
      id: true,
      password: true,
      phone: true,
      realName: true,
      status: true,
      tokenVersion: true,
      username: true,
    },
    where: { id: job.initiatorCenterUserId },
  });
  if (!centerUser) {
    throw new Error(`中心用户不存在: ${job.initiatorCenterUserId}`);
  }
  if (Number(centerUser.status ?? 1) !== 1) {
    throw new Error(`中心用户已禁用: ${job.initiatorCenterUserId}`);
  }

  const sourceCustomerId = normalizeCustomerId(job.sourceCustomerId);
  const { targetCustomerId, targetDbName } = await ensureJobTargetIdentity(job);
  if (sourceCustomerId !== 'public') {
    throw new Error('租户开通 worker 当前只支持 public -> 专属租户');
  }
  if (
    centerUser.customerType &&
    centerUser.customerType !== sourceCustomerId &&
    centerUser.customerType !== targetCustomerId
  ) {
    throw new Error(
      `中心用户已归属到其他租户: ${centerUser.customerType}，停止自动切换`,
    );
  }

  const sourceOrgId = toPositiveNumber(job.sourceOrgId);
  if (sourceOrgId) {
    await assertOrganizationMigrationScope({
      sourceCustomerId,
      sourceOrgId,
    });
    await assertInitiatorOwnsOrganization({
      centerUserId: job.initiatorCenterUserId,
      sourceCustomerId,
      sourceOrgId,
    });
    await assertOrganizationMembersCanSwitch({
      sourceCustomerId,
      sourceOrgId,
      targetCustomerId,
    });
  }

  const targetDatabaseUrl = resolveCustomerDbUrl(targetCustomerId, {
    dbName: targetDbName,
  });
  const sourceDatabaseUrl = resolveCustomerDbUrl(sourceCustomerId);
  const templateDatabaseUrl = sourceDatabaseUrl;
  assertSafeTargetDatabase({
    sourceDatabaseUrl,
    targetCustomerId,
    targetDbName,
    templateDatabaseUrl,
  });
  const targetAdminConnection = await openConnection(targetDatabaseUrl, {
    withoutDatabase: true,
  });
  let targetUserId = 0;
  let organizationMembers: OrganizationMemberSnapshot[] = [];
  let roleSnapshots: OrganizationRoleSnapshotItem[] = [];

  try {
    await updateJobStep(job, 'rebuilding_database');
    await rebuildTargetDatabase(targetAdminConnection, targetDbName);

    let sourceConnection: DbConnection | null = null;
    let templateConnection: DbConnection | null = null;
    let targetConnection: DbConnection | null = null;

    try {
      sourceConnection = await openConnection(sourceDatabaseUrl);
      templateConnection = sourceConnection;
      targetConnection = await openConnection(targetDatabaseUrl);

      await updateJobStep(job, 'cloning_schema');
      await cloneSchemaFromTemplate({
        heartbeat: () => updateJobHeartbeat(job),
        targetConnection,
        templateConnection,
      });

      await updateJobStep(job, 'seeding_base_data');
      await copySuperPermissionClosure({
        heartbeat: () => updateJobHeartbeat(job),
        sourceConnection: templateConnection,
        targetConnection,
      });
      await copyBaseDataTables({
        heartbeat: () => updateJobHeartbeat(job),
        sourceConnection: templateConnection,
        targetConnection,
      });

      const sourceUser = sourceOrgId
        ? null
        : await resolveSourceTenantUser({
            centerUser,
            centerUserId: job.initiatorCenterUserId,
            sourceConnection,
            sourceCustomerId,
          });
      if (sourceOrgId) {
        organizationMembers = await resolveOrganizationMembers({
          sourceConnection,
          sourceCustomerId,
          sourceOrgId,
        });
      }

      await targetConnection.beginTransaction();
      try {
        if (sourceOrgId) {
          await updateJobStep(job, 'copying_organization_roles');
          const roleSnapshotPlan = await copyOrganizationRoleSnapshot({
            heartbeat: () => updateJobHeartbeat(job),
            jobId: job.id,
            sourceConnection,
            sourceOrgId,
            targetConnection,
          });
          roleSnapshots = roleSnapshotPlan.snapshots;

          await updateJobStep(job, 'migrating_organization_members');
          const orgContext: OrganizationMigrationContext = {
            centerUser,
            centerUserId: job.initiatorCenterUserId,
            sourceCustomerId,
            sourceOrgId,
            targetCustomerId,
            targetUserId: 0,
          };
          await migrateOrganizationScopedData({
            context: orgContext,
            heartbeat: () => updateJobHeartbeat(job),
            members: organizationMembers,
            roleMap: roleSnapshotPlan.roleMap,
            sourceConnection,
            sourceOrgId,
            targetConnection,
          });
          targetUserId =
            organizationMembers.find(
              (member) => member.centerUserId === job.initiatorCenterUserId,
            )?.targetUserId ||
            organizationMembers[0]?.targetUserId ||
            0;
          orgContext.targetUserId = targetUserId;
        } else {
          if (!sourceUser) {
            throw new Error('源用户缺失，无法执行单用户迁移');
          }

          await updateJobStep(job, 'creating_tenant_user');
          targetUserId = await ensureTargetTenantUser({
            centerUser,
            sourceUser,
            targetConnection,
            targetCustomerId,
          });

          const context: UserMigrationContext = {
            centerUser,
            centerUserId: job.initiatorCenterUserId,
            sourceCustomerId,
            sourceUserId: Number(sourceUser.id),
            targetCustomerId,
            targetUserId,
            username: String(centerUser.username),
          };

          await assignTenantCreatorSuperRole({
            context,
            heartbeat: () => updateJobHeartbeat(job),
            targetConnection,
          });

          await updateJobStep(job, 'migrating_user_data');
          await migrateUserScopedData({
            context,
            heartbeat: () => updateJobHeartbeat(job),
            sourceConnection,
            targetConnection,
          });
        }

        await updateJobStep(job, 'committing_data');
        await targetConnection.commit();

        await updateJobStep(job, 'validating_data');
        if (sourceOrgId) {
          await validateProvisionedOrganizationTenant({
            context: {
              centerUser,
              centerUserId: job.initiatorCenterUserId,
              sourceCustomerId,
              sourceOrgId,
              targetCustomerId,
              targetUserId,
            },
            members: organizationMembers,
            roleSnapshots,
            sourceConnection,
            sourceOrgId,
            targetConnection,
            templateConnection,
          });
        } else {
          if (!sourceUser) {
            throw new Error('源用户缺失，无法校验单用户迁移');
          }
          await validateProvisionedTenant({
            context: {
              centerUser,
              centerUserId: job.initiatorCenterUserId,
              sourceCustomerId,
              sourceUserId: Number(sourceUser.id),
              targetCustomerId,
              targetUserId,
              username: String(centerUser.username),
            },
            sourceConnection,
            targetConnection,
            targetUserId,
            templateConnection,
          });
        }
      } catch (error) {
        await targetConnection.rollback().catch(() => undefined);
        throw error;
      }
    } finally {
      await sourceConnection?.end().catch(() => undefined);
      await targetConnection?.end().catch(() => undefined);
    }
  } finally {
    await targetAdminConnection.end().catch(() => undefined);
  }

  if (!targetUserId) {
    throw new Error(`目标租户用户缺失，无法完成切库 jobId=${job.id}`);
  }

  await updateJobStep(job, 'switching_customer');
  if (sourceOrgId) {
    await saveTenantProvisioningRoleSnapshots({
      jobId: job.id,
      snapshots: roleSnapshots,
      sourceOrgId,
    });
  }
  await switchCenterUserToTarget({
    centerUserId: job.initiatorCenterUserId,
    city: job.targetCity,
    companyShortName: job.targetCompanyShortName,
    customerName:
      job.targetCompanyShortName ||
      `${centerUser.realName || centerUser.username}的专属空间`,
    jobId: job.id,
    lockOwner: job.lockOwner,
    organizationMembers: sourceOrgId ? organizationMembers : undefined,
    sourceCustomerId,
    sourceOrgId,
    targetCustomerId,
    targetDbName,
    targetUserId,
  });
}

export async function runTenantProvisioningWorkerOnce() {
  let processed = 0;
  const batchSize = getWorkerBatchSize();

  for (let index = 0; index < batchSize; index += 1) {
    const claimed = await claimNextProvisioningJob();
    if (!claimed) {
      break;
    }
    const job = {
      id: Number(claimed.id),
      initiatorCenterUserId: Number(claimed.initiatorCenterUserId),
      lockOwner: String(claimed.lockOwner || WORKER_ID),
      retryCount: Number(claimed.retryCount || 0),
      sourceOrgId: claimed.sourceOrgId ? Number(claimed.sourceOrgId) : null,
      sourceCustomerId: String(claimed.sourceCustomerId),
      status: String(claimed.status),
      targetCity: claimed.targetCity ? String(claimed.targetCity) : null,
      targetCompanyShortName: claimed.targetCompanyShortName
        ? String(claimed.targetCompanyShortName)
        : null,
      targetCustomerId: claimed.targetCustomerId
        ? String(claimed.targetCustomerId)
        : null,
      targetDbName: claimed.targetDbName ? String(claimed.targetDbName) : null,
    } satisfies TenantProvisioningJobRecord;

    try {
      await processProvisioningJob(job);
      processed += 1;
    } catch (error) {
      console.error('租户开通任务执行失败:', error);
      await markJobFailed(job, error).catch((markError) => {
        console.error('标记租户开通任务失败状态失败:', markError);
      });
    }
  }

  return processed;
}

async function runTenantProvisioningWorkerTick(state: { running: boolean }) {
  if (state.running) {
    return;
  }

  state.running = true;
  try {
    await runTenantProvisioningWorkerOnce();
  } catch (error) {
    console.error('租户开通 worker 执行失败:', error);
  } finally {
    state.running = false;
  }
}

export function startTenantProvisioningWorker() {
  if (!isWorkerEnabled()) {
    console.info('[tenant-provisioning] worker disabled');
    return;
  }
  if (globalForTenantProvisioning.__tenantProvisioningWorker) {
    return;
  }

  const intervalMs = getPositiveIntegerEnv(
    'TENANT_PROVISIONING_WORKER_INTERVAL_MS',
    DEFAULT_WORKER_INTERVAL_MS,
  );
  const state = {
    intervalId: setInterval(() => {
      void runTenantProvisioningWorkerTick(state);
    }, intervalMs),
    running: false,
  };
  state.intervalId.unref?.();
  globalForTenantProvisioning.__tenantProvisioningWorker = state;

  setTimeout(() => {
    void runTenantProvisioningWorkerTick(state);
  }, 1000).unref?.();
}
