import { PrismaClient } from '@prisma/.prisma/notices-client/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

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
  const connectionLimit = getPositiveInt('connection_limit', 10);
  const acquireTimeout = getPositiveInt('pool_timeout', 5) * 1000;
  const connectTimeout = getPositiveInt('connect_timeout', 5) * 1000;
  const idleTimeout = getPositiveInt('max_idle_connection_lifetime', 1800);
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
    '[backend-mock][notices-db] PrismaMariaDb adapter config',
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

const globalForPrisma = globalThis as unknown as {
  noticesPrisma?: PrismaClient;
};

const databaseUrl = process.env.NOTICES_DATABASE_URL;
const noticesRsaPublicKeyBase64 =
  process.env.NOTICES_DATABASE_CACHING_RSA_PUBLIC_KEY_BASE64?.trim();
const defaultRsaPublicKeyBase64 =
  process.env.DATABASE_CACHING_RSA_PUBLIC_KEY_BASE64;
const cachingRsaPublicKey = decodeBase64Utf8(
  noticesRsaPublicKeyBase64
    ? 'NOTICES_DATABASE_CACHING_RSA_PUBLIC_KEY_BASE64'
    : 'DATABASE_CACHING_RSA_PUBLIC_KEY_BASE64',
  noticesRsaPublicKeyBase64 || defaultRsaPublicKeyBase64,
);

if (!databaseUrl) {
  throw new Error('NOTICES_DATABASE_URL is required');
}

if (process.env.NODE_ENV === 'production' && !cachingRsaPublicKey) {
  console.warn(
    '[backend-mock][notices-db] Notices RSA public key is not configured; allowing MariaDB public key retrieval',
  );
}

export const noticesPrismaClient =
  globalForPrisma.noticesPrisma ||
  new PrismaClient({
    adapter: createMariaDbAdapter(databaseUrl, cachingRsaPublicKey),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.noticesPrisma = noticesPrismaClient;
}
