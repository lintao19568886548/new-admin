import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const DEFAULT_CUSTOMER_ID = 'default';
const DEFAULT_ENV_FILE = '.env';
const SYSTEM_DATABASE_NAMES = new Set([
  'information_schema',
  'mysql',
  'performance_schema',
  'sys',
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');
const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve('prisma/build/index.js', {
  paths: [backendMockDir],
});

class PushMultiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'PushMultiError';
    this.cause = options.cause;
    this.exitCode = options.exitCode ?? 1;
    this.stderr = options.stderr ?? '';
  }
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/prisma-push-multi.mjs [options]
  pnpm -F @vben/backend-mock push:multi -- --execute

Options:
  --execute             真正执行 prisma db push，默认只预览
  --dry-run             只预览要 push 的租户库
  --env-file <path>     指定环境变量文件，默认 apps/backend-mock/.env
  --only <ids>          只处理指定 customer_id，多个用英文逗号分隔
  --exclude <ids>       额外排除指定 customer_id，多个用英文逗号分隔
  --accept-data-loss    透传给 prisma db push，用于确认允许数据丢失变更
  --continue-on-error   单个租户失败后继续处理后续租户
  -h, --help            显示帮助`);
}

function readOptionValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new PushMultiError(`${optionName} 需要一个参数值`);
  }
  return value;
}

function addCsvValues(target, rawValue) {
  for (const item of String(rawValue || '').split(',')) {
    const normalized = String(item || '').trim();
    if (normalized) {
      target.add(normalizeCustomerId(normalized));
    }
  }
}

function parseArgs(args) {
  const options = {
    acceptDataLoss: false,
    continueOnError: false,
    dryRun: true,
    envFile: DEFAULT_ENV_FILE,
    excludes: new Set(),
    help: false,
    only: new Set(),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      continue;
    }
    if (arg === '--execute') {
      options.dryRun = false;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--accept-data-loss') {
      options.acceptDataLoss = true;
      continue;
    }
    if (arg === '--continue-on-error') {
      options.continueOnError = true;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--env-file') {
      options.envFile = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--env-file=')) {
      options.envFile = arg.slice('--env-file='.length);
      continue;
    }
    if (arg === '--only') {
      addCsvValues(options.only, readOptionValue(args, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--only=')) {
      addCsvValues(options.only, arg.slice('--only='.length));
      continue;
    }
    if (arg === '--exclude') {
      addCsvValues(options.excludes, readOptionValue(args, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--exclude=')) {
      addCsvValues(options.excludes, arg.slice('--exclude='.length));
      continue;
    }

    throw new PushMultiError(`未知参数: ${arg}`);
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
    throw new PushMultiError(`${name} 未配置`);
  }
  return value;
}

function parseDbUrl(rawUrl) {
  try {
    return new URL(stripWrappingQuotes(rawUrl));
  } catch (error) {
    throw new PushMultiError(`数据库 URL 不合法: ${maskSecret(rawUrl)}`, {
      cause: error,
    });
  }
}

function normalizeCustomerId(customerId) {
  const normalized = String(customerId || '').trim();
  if (!normalized || !/^\w+$/.test(normalized)) {
    throw new PushMultiError(
      `customer_id 不合法: ${normalized || '(empty)'}，仅支持字母、数字、下划线`,
    );
  }
  return normalized;
}

function normalizeOptionalDatabaseName(dbName) {
  const normalized = String(dbName || '').trim();
  if (!normalized) {
    return '';
  }
  if (!/^\w+$/.test(normalized)) {
    throw new PushMultiError(
      `数据库名不合法: ${normalized}，仅支持字母、数字、下划线`,
    );
  }
  if (normalized.length > 100) {
    throw new PushMultiError(`数据库名超过 100 字符: ${normalized}`);
  }
  return normalized;
}

function normalizeDatabaseName(dbName) {
  const normalized = normalizeOptionalDatabaseName(dbName);
  if (!normalized) {
    throw new PushMultiError('数据库名不能为空');
  }
  return normalized;
}

function getDefaultCustomerId() {
  return normalizeCustomerId(
    process.env.DEFAULT_CUSTOMER_ID || DEFAULT_CUSTOMER_ID,
  );
}

function applyDatabaseName(rawUrl, dbName) {
  const url = parseDbUrl(rawUrl);
  url.pathname = `/${normalizeDatabaseName(dbName)}`;
  return url.toString();
}

function getDatabaseNameFromUrl(rawUrl) {
  const url = parseDbUrl(rawUrl);
  return normalizeDatabaseName(
    decodeURIComponent(url.pathname.replace(/^\//, '')),
  );
}

function resolveCustomerDbUrl(customerId, dbName) {
  const normalizedCustomerId = normalizeCustomerId(customerId);
  const normalizedDbName = normalizeOptionalDatabaseName(dbName);
  const defaultCustomerId = getDefaultCustomerId();
  const databaseUrl = requireEnv('DATABASE_URL');
  const publicDatabaseUrl = stripWrappingQuotes(
    process.env.PUBLIC_DATABASE_URL,
  );
  const template = stripWrappingQuotes(
    process.env.CUSTOMER_DATABASE_URL_TEMPLATE,
  );

  let resolvedUrl;
  if (normalizedCustomerId === 'public') {
    if (!publicDatabaseUrl) {
      throw new PushMultiError(
        'PUBLIC_DATABASE_URL 未配置，无法解析 public 租户库',
      );
    }
    resolvedUrl = publicDatabaseUrl;
  } else if (template) {
    if (!template.includes('{customerId}')) {
      throw new PushMultiError(
        'CUSTOMER_DATABASE_URL_TEMPLATE 必须包含 {customerId} 占位符',
      );
    }
    resolvedUrl = template.replaceAll('{customerId}', normalizedCustomerId);
  } else if (normalizedCustomerId === defaultCustomerId) {
    resolvedUrl = databaseUrl;
  } else {
    const url = parseDbUrl(databaseUrl);
    const prefix = process.env.CUSTOMER_DB_PREFIX || 'customer_';
    url.pathname = `/${prefix}${normalizedCustomerId}`;
    resolvedUrl = url.toString();
  }

  return normalizedDbName
    ? applyDatabaseName(resolvedUrl, normalizedDbName)
    : resolvedUrl;
}

function maskSecret(value) {
  return String(value || '').replaceAll(
    /:\/\/([^:/?#]+):([^@/?#]+)@/g,
    '://$1:***@',
  );
}

function maskDatabaseUrl(rawUrl) {
  const url = parseDbUrl(rawUrl);
  const username = url.username ? decodeURIComponent(url.username) : '';
  const auth = username ? `${username}:***@` : '';
  return `${url.protocol}//${auth}${url.host}${url.pathname}${
    url.search ? '?...' : ''
  }`;
}

function getDefaultPort(protocol) {
  return protocol === 'mysql:' ? '3306' : '';
}

function getDatabaseTargetKey(rawUrl) {
  const url = parseDbUrl(rawUrl);
  return [
    url.protocol,
    decodeURIComponent(url.username),
    url.hostname.toLowerCase(),
    url.port || getDefaultPort(url.protocol),
    decodeURIComponent(url.pathname),
  ].join('|');
}

function createConnectionConfig(rawUrl) {
  const url = parseDbUrl(rawUrl);
  const database = url.pathname.replace(/^\//, '');

  return {
    acquireTimeout: 5000,
    connectTimeout: 5000,
    database,
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
  };
}

async function openConnection(rawUrl) {
  return mariadb.createConnection(createConnectionConfig(rawUrl));
}

async function getCenterCustomers(connection) {
  const rows = await connection.query(
    'SELECT customer_id AS customerId, db_name AS dbName, status FROM customer ORDER BY customer_id',
  );

  return rows.map((row) => ({
    customerId: String(row.customerId ?? row.customer_id ?? '').trim(),
    dbName: String(row.dbName ?? row.db_name ?? '').trim(),
    status:
      row.status === null || row.status === undefined
        ? null
        : Number(row.status),
  }));
}

function loadEnvFile(envFile) {
  const envPath = path.isAbsolute(envFile)
    ? envFile
    : path.resolve(backendMockDir, envFile);
  const result = dotenv.config({ override: true, path: envPath, quiet: true });

  if (result.error) {
    throw new PushMultiError(`无法加载环境文件: ${envPath}`, {
      cause: result.error,
    });
  }

  return envPath;
}

function getProtectedDatabaseNames() {
  const names = new Set(SYSTEM_DATABASE_NAMES);
  for (const envName of [
    'DATABASE_URL',
    'CENTER_DATABASE_URL',
    'NOTICES_DATABASE_URL',
  ]) {
    const rawUrl = stripWrappingQuotes(process.env[envName]);
    if (rawUrl) {
      names.add(getDatabaseNameFromUrl(rawUrl));
    }
  }
  return names;
}

function assertTargetDatabaseIsAllowed(target, protectedDatabaseNames) {
  if (!protectedDatabaseNames.has(target.databaseName)) {
    return;
  }

  throw new PushMultiError(
    `拒绝 push 受保护数据库 ${target.databaseName} (customer_id=${target.customerId})`,
  );
}

function buildTargets(customers, options) {
  const defaultCustomerIds = new Set([
    DEFAULT_CUSTOMER_ID,
    getDefaultCustomerId(),
  ]);
  const protectedDatabaseNames = getProtectedDatabaseNames();
  const seenDatabaseKeys = new Map();
  const skipped = [];
  const targets = [];

  for (const customer of customers) {
    const customerId = normalizeCustomerId(customer.customerId);

    if (defaultCustomerIds.has(customerId)) {
      skipped.push({ customerId, reason: '默认租户' });
      continue;
    }
    if (options.excludes.has(customerId)) {
      skipped.push({ customerId, reason: '--exclude' });
      continue;
    }
    if (options.only.size > 0 && !options.only.has(customerId)) {
      skipped.push({ customerId, reason: '不在 --only 范围' });
      continue;
    }

    const dbName = normalizeOptionalDatabaseName(customer.dbName);
    const databaseUrl = resolveCustomerDbUrl(customerId, dbName);
    const databaseName = getDatabaseNameFromUrl(databaseUrl);
    const target = {
      customerId,
      databaseName,
      databaseUrl,
      dbName: dbName || null,
      status: customer.status,
    };

    assertTargetDatabaseIsAllowed(target, protectedDatabaseNames);

    const databaseKey = getDatabaseTargetKey(databaseUrl);
    const duplicatedCustomerId = seenDatabaseKeys.get(databaseKey);
    if (duplicatedCustomerId) {
      skipped.push({
        customerId,
        reason: `目标库与 ${duplicatedCustomerId} 重复: ${databaseName}`,
      });
      continue;
    }

    seenDatabaseKeys.set(databaseKey, customerId);
    targets.push(target);
  }

  return { skipped, targets };
}

function printPlan({ customerCount, envPath, options, skipped, targets }) {
  console.log('[push:multi] 当前配置');
  console.log(
    JSON.stringify(
      {
        acceptDataLoss: options.acceptDataLoss,
        continueOnError: options.continueOnError,
        defaultCustomerId: getDefaultCustomerId(),
        envFile: path.relative(backendMockDir, envPath) || envPath,
        mode: options.dryRun ? 'dry-run' : 'execute',
        sourceCustomerCount: customerCount,
        targetCount: targets.length,
      },
      null,
      2,
    ),
  );

  if (targets.length > 0) {
    console.log('[push:multi] 待 push 租户库');
    for (const [index, target] of targets.entries()) {
      console.log(
        `[push:multi] ${index + 1}. customer_id=${target.customerId}, db=${
          target.databaseName
        }, status=${target.status ?? 'null'}, url=${maskDatabaseUrl(
          target.databaseUrl,
        )}`,
      );
    }
  }

  if (skipped.length > 0) {
    console.log('[push:multi] 已跳过');
    for (const item of skipped) {
      console.log(`[push:multi] - ${item.customerId}: ${item.reason}`);
    }
  }
}

function runPrismaDbPush(target, options, index, total) {
  const args = [prismaCliPath, 'db', 'push'];
  if (options.acceptDataLoss) {
    args.push('--accept-data-loss');
  }

  console.log(
    `[push:multi] (${index}/${total}) 执行 db push: customer_id=${target.customerId}, db=${target.databaseName}`,
  );

  const result = spawnSync(process.execPath, args, {
    cwd: backendMockDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: target.databaseUrl,
      PRISMA_TARGET: '',
    },
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw new PushMultiError(
      `[push:multi] 无法启动 db push: ${target.customerId}`,
      {
        cause: result.error,
      },
    );
  }

  if (result.status !== 0) {
    throw new PushMultiError(
      `[push:multi] db push 失败: ${target.customerId} (exit code: ${
        result.status ?? 1
      })`,
      {
        exitCode: result.status ?? 1,
        stderr: result.stderr ?? '',
      },
    );
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const envPath = loadEnvFile(options.envFile);
  const centerDatabaseUrl = requireEnv('CENTER_DATABASE_URL');
  const centerConnection = await openConnection(centerDatabaseUrl);
  let customers;

  try {
    customers = await getCenterCustomers(centerConnection);
  } finally {
    await centerConnection.end().catch(() => undefined);
  }

  const { skipped, targets } = buildTargets(customers, options);
  printPlan({
    customerCount: customers.length,
    envPath,
    options,
    skipped,
    targets,
  });

  if (targets.length === 0) {
    throw new PushMultiError('[push:multi] 没有可 push 的生产租户库');
  }

  if (options.dryRun) {
    console.log('[push:multi] 当前为预览模式，确认无误后加 --execute 再执行');
    return;
  }

  const failures = [];
  for (const [index, target] of targets.entries()) {
    try {
      runPrismaDbPush(target, options, index + 1, targets.length);
    } catch (error) {
      failures.push(error);
      if (!options.continueOnError) {
        throw error;
      }
      console.error(
        '[push:multi] 单库 push 失败，继续后续租户:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  if (failures.length > 0) {
    throw new PushMultiError(
      `[push:multi] 执行完成，但有 ${failures.length} 个租户库失败`,
    );
  }

  console.log('[push:multi] 全部生产租户库 db push 完成');
}

run().catch((error) => {
  const exitCode = error instanceof PushMultiError ? error.exitCode : 1;
  process.exitCode = exitCode;
  console.error(
    '[push:multi] 执行失败:',
    error instanceof Error ? error.message : String(error),
  );
  if (error instanceof PushMultiError && error.cause instanceof Error) {
    console.error('[push:multi] 原始错误:', error.cause.message);
  }
  if (error instanceof PushMultiError && error.stderr.trim()) {
    console.error('[push:multi] 子进程 stderr 已如上输出');
  }
});
