import { AsyncLocalStorage } from 'node:async_hooks';

import { PrismaClient as CenterPrismaClient } from '@prisma/.prisma/center-client/index.js';
import { PrismaClient as CustomerPrismaClient } from '@prisma/.prisma/client/index.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const isProduction = process.env.NODE_ENV === 'production';

const DEFAULT_DATABASE_CONNECTION_LIMIT = isProduction ? 10 : 3;
const DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS = isProduction ? 5 : 10;
const DEFAULT_DATABASE_IDLE_TIMEOUT_SECONDS = isProduction ? 1800 : 120;
const DEFAULT_CUSTOMER_PRISMA_POOL_MAX = isProduction ? 30 : 6;
const DEFAULT_CUSTOMER_PRISMA_POOL_SWEEP_INTERVAL_SECONDS = 60;
const DEFAULT_CUSTOMER_PRISMA_POOL_TTL_SECONDS = isProduction ? 1800 : 120;

type CustomerPrismaCacheEntry = {
  client: CustomerPrismaClient;
  disconnectAfterInFlight: boolean;
  disconnectClient: CustomerPrismaClient;
  disconnected: boolean;
  expiresAt: number;
  inFlight: number;
  lastUsedAt: number;
};

function decodeBase64Utf8(varName: string, rawValue: string | undefined) {
  if (!rawValue) {
    return undefined;
  }

  const compact = rawValue.replaceAll(/\s+/g, '');

  if (!compact) {
    return undefined;
  }

  if (compact.length % 4 !== 0 || /[^A-Z0-9+/=]/i.test(compact)) {
    throw new Error(`${varName} must be a valid base64 string`);
  }

  const decoded = Buffer.from(compact, 'base64').toString('utf8').trim();

  if (!decoded) {
    throw new Error(`${varName} decodes to an empty value`);
  }

  return decoded;
}

function createMariaDbAdapter(
  databaseUrl: string,
  cachingRsaPublicKey: string | undefined,
) {
  const parsed = new URL(databaseUrl);
  const getPositiveInt = (key: string, fallback: number) => {
    const value = Number(parsed.searchParams.get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  const database = parsed.pathname.replace(/^\//, '');
  const connectionLimit = getPositiveInt(
    'connection_limit',
    DEFAULT_DATABASE_CONNECTION_LIMIT,
  );
  const acquireTimeout =
    getPositiveInt('pool_timeout', DEFAULT_DATABASE_POOL_TIMEOUT_SECONDS) *
    1000;
  const connectTimeout = getPositiveInt('connect_timeout', 5) * 1000;
  const idleTimeout = getPositiveInt(
    'max_idle_connection_lifetime',
    DEFAULT_DATABASE_IDLE_TIMEOUT_SECONDS,
  );

  const allowPublicKeyRetrieval = !cachingRsaPublicKey;
  const adapterConfig = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionLimit,
    acquireTimeout,
    connectTimeout,
    idleTimeout,
    allowPublicKeyRetrieval,
    ...(cachingRsaPublicKey ? { cachingRsaPublicKey } : {}),
  };

  console.info(
    '[backend-mock][db] PrismaMariaDb adapter config',
    JSON.stringify({
      host: adapterConfig.host,
      port: adapterConfig.port,
      database: adapterConfig.database,
      connectionLimit: adapterConfig.connectionLimit,
      acquireTimeout: adapterConfig.acquireTimeout,
      connectTimeout: adapterConfig.connectTimeout,
      idleTimeout: adapterConfig.idleTimeout,
      allowPublicKeyRetrieval: adapterConfig.allowPublicKeyRetrieval,
      hasCachingRsaPublicKey: Boolean(cachingRsaPublicKey),
    }),
  );

  return new PrismaMariaDb(adapterConfig);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const centerDatabaseUrl = process.env.CENTER_DATABASE_URL;
if (!centerDatabaseUrl) {
  throw new Error('CENTER_DATABASE_URL is required');
}

const publicDatabaseUrl = process.env.PUBLIC_DATABASE_URL;

const cachingRsaPublicKey = decodeBase64Utf8(
  'DATABASE_CACHING_RSA_PUBLIC_KEY_BASE64',
  process.env.DATABASE_CACHING_RSA_PUBLIC_KEY_BASE64,
);

if (process.env.NODE_ENV === 'production' && !cachingRsaPublicKey) {
  console.warn(
    '[backend-mock][db] DATABASE_CACHING_RSA_PUBLIC_KEY_BASE64 is not configured; allowing MariaDB public key retrieval',
  );
}

const globalForPrisma = globalThis as unknown as {
  customerPrismaPoolSweepInterval?: ReturnType<typeof setInterval>;
  prismaCenter?: CenterPrismaClient;
  prismaCustomers?: Map<string, CustomerPrismaCacheEntry>;
};

export const systemDbClient =
  globalForPrisma.prismaCenter ||
  new CenterPrismaClient({
    adapter: createMariaDbAdapter(centerDatabaseUrl, cachingRsaPublicKey),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaCenter = systemDbClient;
}

type PrismaScope = {
  customerId: string;
  dbName?: null | string;
};

export const prismaScopeStorage = new AsyncLocalStorage<PrismaScope>();

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getCustomerPrismaPoolTtlMs() {
  return Math.floor(
    getPositiveNumberEnv(
      'CUSTOMER_PRISMA_POOL_TTL_SECONDS',
      DEFAULT_CUSTOMER_PRISMA_POOL_TTL_SECONDS,
    ) * 1000,
  );
}

function getCustomerPrismaPoolMax() {
  return Math.floor(
    getPositiveNumberEnv(
      'CUSTOMER_PRISMA_POOL_MAX',
      DEFAULT_CUSTOMER_PRISMA_POOL_MAX,
    ),
  );
}

function touchCustomerPrismaCacheEntry(
  entry: CustomerPrismaCacheEntry,
  now = Date.now(),
) {
  entry.expiresAt = now + getCustomerPrismaPoolTtlMs();
  entry.lastUsedAt = now;
}

function disconnectCustomerPrismaEntry(entry: CustomerPrismaCacheEntry) {
  if (entry.disconnected) {
    return;
  }

  entry.disconnected = true;
  entry.disconnectClient.$disconnect().catch(() => undefined);
}

function retireCustomerPrismaEntry(entry: CustomerPrismaCacheEntry) {
  entry.disconnectAfterInFlight = true;
  if (entry.inFlight === 0) {
    disconnectCustomerPrismaEntry(entry);
  }
}

function releaseCustomerPrismaEntry(entry: CustomerPrismaCacheEntry) {
  entry.inFlight = Math.max(entry.inFlight - 1, 0);
  entry.lastUsedAt = Date.now();

  if (entry.inFlight === 0 && entry.disconnectAfterInFlight) {
    disconnectCustomerPrismaEntry(entry);
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    Boolean(value) &&
    (typeof value === 'function' || typeof value === 'object') &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

function trackCustomerPrismaOperation<T>(
  entry: CustomerPrismaCacheEntry,
  operation: () => T,
): T {
  entry.inFlight += 1;
  touchCustomerPrismaCacheEntry(entry);

  try {
    const result = operation();
    if (isPromiseLike(result)) {
      return Promise.resolve(result).finally(() =>
        releaseCustomerPrismaEntry(entry),
      ) as T;
    }

    releaseCustomerPrismaEntry(entry);
    return result;
  } catch (error) {
    releaseCustomerPrismaEntry(entry);
    throw error;
  }
}

function evictCustomerPrismaClient(
  cache: Map<string, CustomerPrismaCacheEntry>,
  cacheKey: string,
) {
  const cached = cache.get(cacheKey);
  if (!cached) {
    return;
  }

  cache.delete(cacheKey);
  retireCustomerPrismaEntry(cached);
}

function enforceCustomerPrismaPoolMax(
  cache: Map<string, CustomerPrismaCacheEntry>,
) {
  const max = getCustomerPrismaPoolMax();

  while (cache.size > max) {
    let oldestKey: null | string = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, value] of cache.entries()) {
      if (value.lastUsedAt < oldestAt) {
        oldestAt = value.lastUsedAt;
        oldestKey = key;
      }
    }
    if (!oldestKey) {
      break;
    }
    evictCustomerPrismaClient(cache, oldestKey);
  }
}

function sweepExpiredCustomerPrismaClients() {
  const cache = globalForPrisma.prismaCustomers;
  if (!cache?.size) {
    return;
  }

  const now = Date.now();
  for (const [cacheKey, cached] of cache.entries()) {
    if (cached.expiresAt <= now) {
      evictCustomerPrismaClient(cache, cacheKey);
    }
  }
}

function startCustomerPrismaPoolSweeper() {
  if (globalForPrisma.customerPrismaPoolSweepInterval) {
    return;
  }

  const intervalMs = Math.floor(
    getPositiveNumberEnv(
      'CUSTOMER_PRISMA_POOL_SWEEP_INTERVAL_SECONDS',
      DEFAULT_CUSTOMER_PRISMA_POOL_SWEEP_INTERVAL_SECONDS,
    ) * 1000,
  );

  const intervalId = setInterval(() => {
    try {
      sweepExpiredCustomerPrismaClients();
    } catch (error) {
      console.error(
        '[backend-mock][db] customer Prisma pool sweep failed:',
        error,
      );
    }
  }, intervalMs);
  intervalId.unref?.();
  globalForPrisma.customerPrismaPoolSweepInterval = intervalId;
}

startCustomerPrismaPoolSweeper();

function getDefaultCustomerId() {
  return String(process.env.DEFAULT_CUSTOMER_ID || 'default');
}

function normalizeDatabaseName(dbName: unknown) {
  const normalized = String(dbName || '').trim();
  if (normalized && !/^\w+$/.test(normalized)) {
    throw new Error(
      `Invalid database name: ${normalized}. Only [a-zA-Z0-9_] is allowed.`,
    );
  }
  return normalized;
}

function applyDatabaseName(databaseUrl: string, dbName: string) {
  const normalizedDbName = normalizeDatabaseName(dbName);
  if (!normalizedDbName) {
    return databaseUrl;
  }

  const url = new URL(databaseUrl);
  url.pathname = `/${normalizedDbName}`;
  return url.toString();
}

function buildCustomerDatabaseUrl(customerId: string, dbName?: null | string) {
  const normalizedCustomerId = String(customerId || '').trim();
  if (normalizedCustomerId && !/^\w+$/.test(normalizedCustomerId)) {
    throw new Error(
      `Invalid customerId: ${normalizedCustomerId}. Only [a-zA-Z0-9_] is allowed.`,
    );
  }
  const normalizedDbName = normalizeDatabaseName(dbName);

  if (normalizedCustomerId === 'public') {
    if (!publicDatabaseUrl) {
      throw new Error('PUBLIC_DATABASE_URL is required for public customer');
    }
    return normalizedDbName
      ? applyDatabaseName(publicDatabaseUrl, normalizedDbName)
      : publicDatabaseUrl;
  }

  const template = process.env.CUSTOMER_DATABASE_URL_TEMPLATE;
  if (template) {
    if (!template.includes('{customerId}')) {
      throw new Error(
        'CUSTOMER_DATABASE_URL_TEMPLATE must include "{customerId}" placeholder',
      );
    }
    const resolved = template.replaceAll('{customerId}', normalizedCustomerId);
    return normalizedDbName
      ? applyDatabaseName(resolved, normalizedDbName)
      : resolved;
  }

  const defaultCustomerId = getDefaultCustomerId();
  if (!normalizedCustomerId || normalizedCustomerId === defaultCustomerId) {
    return normalizedDbName
      ? applyDatabaseName(databaseUrl, normalizedDbName)
      : databaseUrl;
  }

  const url = new URL(databaseUrl);
  const prefix = process.env.CUSTOMER_DB_PREFIX || 'customer_';
  url.pathname = `/${prefix}${normalizedCustomerId}`;
  return normalizedDbName
    ? applyDatabaseName(url.toString(), normalizedDbName)
    : url.toString();
}

function getCustomerPrismaClient(customerId: string, dbName?: null | string) {
  if (!globalForPrisma.prismaCustomers) {
    globalForPrisma.prismaCustomers = new Map<
      string,
      CustomerPrismaCacheEntry
    >();
  }

  const normalizedCustomerId = customerId || getDefaultCustomerId();
  const normalizedDbName = normalizeDatabaseName(dbName);
  const cacheKey = normalizedDbName
    ? `${normalizedCustomerId}:${normalizedDbName}`
    : normalizedCustomerId;
  const cache = globalForPrisma.prismaCustomers;
  const now = Date.now();
  const ttlMs = getCustomerPrismaPoolTtlMs();

  const cached = cache.get(cacheKey);
  if (cached) {
    if (cached.expiresAt > now) {
      touchCustomerPrismaCacheEntry(cached, now);
      return cached.client;
    }
    evictCustomerPrismaClient(cache, cacheKey);
  }

  let entry: CustomerPrismaCacheEntry | undefined;
  const disconnectClient = new CustomerPrismaClient({
    adapter: createMariaDbAdapter(
      buildCustomerDatabaseUrl(normalizedCustomerId, normalizedDbName),
      cachingRsaPublicKey,
    ),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  const client = disconnectClient.$extends({
    query: {
      async $allOperations({ args, query }) {
        return entry
          ? trackCustomerPrismaOperation(entry, () => query(args))
          : query(args);
      },
    },
  }) as unknown as CustomerPrismaClient;

  entry = {
    client,
    disconnectAfterInFlight: false,
    disconnectClient,
    disconnected: false,
    expiresAt: now + ttlMs,
    inFlight: 0,
    lastUsedAt: now,
  };
  cache.set(cacheKey, entry);

  enforceCustomerPrismaPoolMax(cache);

  return client;
}

function getRequestScopedPrismaClientEntry() {
  const scope = prismaScopeStorage.getStore();
  if (!scope?.customerId) {
    throw new Error('Missing customer scope');
  }
  const client = getCustomerPrismaClient(scope.customerId, scope.dbName);
  const cache = globalForPrisma.prismaCustomers;
  const cacheKey = scope.dbName
    ? `${scope.customerId}:${normalizeDatabaseName(scope.dbName)}`
    : scope.customerId;
  const entry = cache?.get(cacheKey);
  if (!entry || entry.client !== client) {
    throw new Error('Missing customer Prisma cache entry');
  }
  return entry;
}

export const prismaClient: CustomerPrismaClient = new Proxy(
  systemDbClient as any,
  {
    get(_target, prop) {
      const entry = getRequestScopedPrismaClientEntry();
      const client = entry.client as any;
      const value = client[prop];
      if (typeof value !== 'function') {
        return value;
      }
      if (prop === '$transaction') {
        return (...args: unknown[]) =>
          trackCustomerPrismaOperation(entry, () => value.apply(client, args));
      }
      return value.bind(client);
    },
  },
) as any;
