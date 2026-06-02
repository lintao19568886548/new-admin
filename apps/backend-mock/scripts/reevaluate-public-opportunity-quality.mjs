import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const esbuildCmd = 'node_modules/.pnpm/node_modules/esbuild/bin/esbuild';
const outputFile =
  'apps/backend-mock/.nitro/reevaluate-public-opportunity-quality.mjs';

if (!existsSync(esbuildCmd)) {
  throw new Error(`esbuild CLI not found: ${esbuildCmd}`);
}

const buildResult = spawnSync(
  process.execPath,
  [
    esbuildCmd,
    'apps/backend-mock/scripts/reevaluate-public-opportunity-quality.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node20',
    `--outfile=${outputFile}`,
    '--external:dotenv',
    '--external:mysql2/promise',
  ],
  {
    encoding: 'utf8',
    stdio: 'pipe',
  },
);

if (buildResult.status !== 0) {
  process.stderr.write(buildResult.stderr || buildResult.stdout);
  throw new Error(
    `reevaluate public opportunity quality script build failed: ${
      buildResult.status || 1
    }`,
  );
}

await import(
  `../.nitro/reevaluate-public-opportunity-quality.mjs?ts=${Date.now()}`
);
