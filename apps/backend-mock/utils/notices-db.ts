import { PrismaClient } from '@prisma/.prisma/notices-client/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function createMariaDbAdapter(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const database = parsed.pathname.replace(/^\//, '');
  const connectionLimit = Math.max(
    1,
    Number(parsed.searchParams.get('connection_limit') ?? '5') || 5,
  );

  return new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionLimit,
  });
}

const globalForPrisma = globalThis as unknown as {
  noticesPrisma?: PrismaClient;
};

export const noticesPrismaClient =
  globalForPrisma.noticesPrisma ||
  new PrismaClient({
    adapter: createMariaDbAdapter(process.env.NOTICES_DATABASE_URL ?? ''),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.noticesPrisma = noticesPrismaClient;
}
