import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

import dotenv from 'dotenv';

dotenv.config({ path: 'apps/backend-mock/.env' });

const esbuildCmd =
  process.platform === 'win32'
    ? 'node_modules/.pnpm/node_modules/esbuild/bin/esbuild'
    : 'node_modules/.pnpm/node_modules/esbuild/bin/esbuild';

if (!existsSync(esbuildCmd)) {
  throw new Error(`esbuild CLI not found: ${esbuildCmd}`);
}

const buildResult = spawnSync(
  process.execPath,
  [
    esbuildCmd,
    'apps/backend-mock/scripts/verify-investment-radar-lead-chain.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node20',
    '--outfile=apps/backend-mock/.nitro/verify-investment-radar-lead-chain.mjs',
    '--external:@prisma/.prisma/*',
    '--external:@prisma/adapter-mariadb',
    '--external:@prisma/client',
    '--external:db0',
  ],
  {
    encoding: 'utf8',
    stdio: 'pipe',
  },
);

if (buildResult.status !== 0) {
  process.stderr.write(buildResult.stderr || buildResult.stdout);
  throw new Error(`verify script build failed: ${buildResult.status || 1}`);
}

await import(
  `../.nitro/verify-investment-radar-lead-chain.mjs?ts=${Date.now()}`
);

// Verification is a one-shot CLI and Prisma keeps connection pools alive.
// eslint-disable-next-line unicorn/no-process-exit
process.exit(0);
