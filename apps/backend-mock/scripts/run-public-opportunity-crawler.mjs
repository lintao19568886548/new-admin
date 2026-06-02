import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

import dotenv from 'dotenv';

dotenv.config({ path: 'apps/backend-mock/.env' });

const esbuildCmd = 'node_modules/.pnpm/node_modules/esbuild/bin/esbuild';
const outputFile =
  'apps/backend-mock/.nitro/run-public-opportunity-crawler.mjs';

if (!existsSync(esbuildCmd)) {
  throw new Error(`esbuild CLI not found: ${esbuildCmd}`);
}

const buildResult = spawnSync(
  process.execPath,
  [
    esbuildCmd,
    'apps/backend-mock/scripts/run-public-opportunity-crawler.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node20',
    `--outfile=${outputFile}`,
    '--external:@prisma/.prisma/*',
    '--external:@prisma/adapter-mariadb',
    '--external:@prisma/client',
    '--external:db0',
    '--external:dotenv',
  ],
  {
    encoding: 'utf8',
    stdio: 'pipe',
  },
);

if (buildResult.status !== 0) {
  process.stderr.write(buildResult.stderr || buildResult.stdout);
  throw new Error(`crawler script build failed: ${buildResult.status || 1}`);
}

await import(`../.nitro/run-public-opportunity-crawler.mjs?ts=${Date.now()}`);
