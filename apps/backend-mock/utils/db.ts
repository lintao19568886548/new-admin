import { AsyncLocalStorage } from 'node:async_hooks';

import { PrismaClient as CenterPrismaClient } from '@prisma/.prisma/center-client/client.js';
import { PrismaClient as CustomerPrismaClient } from '@prisma/.prisma/client/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function createMariaDbAdapter(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const getPositiveInt = (key: string, fallback: number) => {
    const value = Number(parsed.searchParams.get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  const database = parsed.pathname.replace(/^\//, '');
  const connectionLimit = getPositiveInt('connection_limit', 10);
  const acquireTimeout = getPositiveInt('pool_timeout', 30) * 1000;
  const connectTimeout = getPositiveInt('connect_timeout', 5) * 1000;
  const idleTimeout = getPositiveInt('max_idle_connection_lifetime', 1800);

  return new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionLimit,
    acquireTimeout,
    connectTimeout,
    idleTimeout,
  });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const publicDatabaseUrl = process.env.PUBLIC_DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prismaCenter: CenterPrismaClient;
  prismaCustomers?: Map<
    string,
    { client: CustomerPrismaClient; expiresAt: number; lastUsedAt: number }
  >;
};

const centerDatabaseUrl = process.env.CENTER_DATABASE_URL;
if (!centerDatabaseUrl) {
  throw new Error('CENTER_DATABASE_URL is required');
}

export const systemDbClient =
  globalForPrisma.prismaCenter ||
  new CenterPrismaClient({
    adapter: createMariaDbAdapter(centerDatabaseUrl),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaCenter = systemDbClient;
}

type PrismaScope = {
  customerId: string;
};

export const prismaScopeStorage = new AsyncLocalStorage<PrismaScope>();

function getDefaultCustomerId() {
  return String(process.env.DEFAULT_CUSTOMER_ID || 'default');
}

function buildCustomerDatabaseUrl(customerId: string) {
  const normalizedCustomerId = String(customerId || '').trim();
  if (normalizedCustomerId && !/^\w+$/.test(normalizedCustomerId)) {
    throw new Error(
      `Invalid customerId: ${normalizedCustomerId}. Only [a-zA-Z0-9_] is allowed.`,
    );
  }

  if (normalizedCustomerId === 'public') {
    if (!publicDatabaseUrl) {
      throw new Error('PUBLIC_DATABASE_URL is required for public customer');
    }
    return publicDatabaseUrl;
  }

  const template = process.env.CUSTOMER_DATABASE_URL_TEMPLATE;
  if (template) {
    if (!template.includes('{customerId}')) {
      throw new Error(
        'CUSTOMER_DATABASE_URL_TEMPLATE must include "{customerId}" placeholder',
      );
    }
    return template.replaceAll('{customerId}', normalizedCustomerId);
  }

  const defaultCustomerId = getDefaultCustomerId();
  if (!normalizedCustomerId || normalizedCustomerId === defaultCustomerId) {
    return databaseUrl;
  }

  const url = new URL(databaseUrl);
  const prefix = process.env.CUSTOMER_DB_PREFIX || 'customer_';
  url.pathname = `/${prefix}${normalizedCustomerId}`;
  return url.toString();
}

function getCustomerPrismaClient(customerId: string) {
  if (!globalForPrisma.prismaCustomers) {
    globalForPrisma.prismaCustomers = new Map<
      string,
      { client: CustomerPrismaClient; expiresAt: number; lastUsedAt: number }
    >();
  }

  const normalizedCustomerId = customerId || getDefaultCustomerId();
  const cache = globalForPrisma.prismaCustomers;
  const now = Date.now();
  const ttlSeconds = Number(
    process.env.CUSTOMER_PRISMA_POOL_TTL_SECONDS || 1800,
  );
  const ttlMs =
    Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? Math.floor(ttlSeconds * 1000)
      : 1800 * 1000;

  const maxSize = Number(process.env.CUSTOMER_PRISMA_POOL_MAX || 30);
  const max =
    Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 30;

  const cached = cache.get(normalizedCustomerId);
  if (cached) {
    if (cached.expiresAt > now) {
      cached.lastUsedAt = now;
      return cached.client;
    }
    cache.delete(normalizedCustomerId);
    cached.client.$disconnect().catch(() => undefined);
  }

  const client = new CustomerPrismaClient({
    adapter: createMariaDbAdapter(
      buildCustomerDatabaseUrl(normalizedCustomerId),
    ),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  cache.set(normalizedCustomerId, {
    client,
    expiresAt: now + ttlMs,
    lastUsedAt: now,
  });

  if (cache.size > max) {
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
      const evicted = cache.get(oldestKey);
      cache.delete(oldestKey);
      evicted?.client.$disconnect().catch(() => undefined);
    }
  }

  return client;
}

function getRequestScopedPrismaClient() {
  const scope = prismaScopeStorage.getStore();
  if (!scope?.customerId) {
    throw new Error('Missing customer scope');
  }
  return getCustomerPrismaClient(scope.customerId);
}

export const prismaClient: CustomerPrismaClient = new Proxy(
  systemDbClient as any,
  {
    get(_target, prop) {
      const client = getRequestScopedPrismaClient() as any;
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  },
) as any;
