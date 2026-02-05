import { PrismaClient } from '@prisma/.prisma/notices-client/client.js';
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

const globalForPrisma = globalThis as unknown as {
  noticesPrisma?: PrismaClient;
};

const databaseUrl = process.env.NOTICES_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('NOTICES_DATABASE_URL is required');
}

export const noticesPrismaClient =
  globalForPrisma.noticesPrisma ||
  new PrismaClient({
    adapter: createMariaDbAdapter(databaseUrl),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.noticesPrisma = noticesPrismaClient;
}
