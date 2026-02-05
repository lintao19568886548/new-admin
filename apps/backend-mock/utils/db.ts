import { PrismaClient } from '@prisma/.prisma/client/client.js';
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

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: createMariaDbAdapter(databaseUrl),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient;
}
