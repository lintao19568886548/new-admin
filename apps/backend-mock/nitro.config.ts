import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseDotenv } from 'dotenv';

import errorHandler from './error';

const currentDir = dirname(fileURLToPath(import.meta.url));

function isUsableEnvValue(value: unknown) {
  const normalized = String(value || '').trim();
  return Boolean(normalized) && !normalized.includes('{password}');
}

const protectedEnvNames = new Set(
  Object.entries(process.env)
    .filter(([, value]) => isUsableEnvValue(value))
    .map(([name]) => name),
);

function loadBackendEnvFile(
  fileName: string,
  options: { override?: boolean } = {},
) {
  const envPath = resolve(currentDir, fileName);
  if (!existsSync(envPath)) {
    return;
  }

  const parsed = parseDotenv(readFileSync(envPath));
  for (const [name, value] of Object.entries(parsed)) {
    if (!isUsableEnvValue(value)) {
      continue;
    }
    if (!options.override && protectedEnvNames.has(name)) {
      continue;
    }
    process.env[name] = value;
  }
}

loadBackendEnvFile('.env');
loadBackendEnvFile('.env.dev');
loadBackendEnvFile('.env.local', { override: true });

process.env.COMPATIBILITY_DATE = new Date().toISOString();
export default defineNitroConfig({
  devErrorHandler: errorHandler,
  errorHandler: '~/error',
  node: true,
  plugins: [
    '~/plugins/organization-provisioning-worker.ts',
    '~/plugins/rental-expense-finance-worker.ts',
    '~/plugins/vip-membership-refund-worker.ts',
    '~/plugins/investment-radar-public-crawler.ts',
    '~/plugins/attendance-automation-test-worker.ts',
    '~/plugins/amount-bill-collection-sms-worker.ts',
  ],
  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers':
          'Accept, Authorization, Content-Length, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-CSRF-TOKEN, X-Requested-With, X-Vip-Checkout-Flow-Token',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': '*',
      },
    },
  },
});
