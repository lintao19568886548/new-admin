import dotenv from 'dotenv';

import { runPublicOpportunityBatchCrawler } from '../utils/investment-radar/public-opportunity-batch-runner';
import { runPublicOpportunityUrlCrawlerTask } from '../utils/investment-radar/public-opportunity-url-crawler';
import { runWithRadarSharedScope } from '../utils/investment-radar/shared-scope';

dotenv.config({ path: 'apps/backend-mock/.env' });

function readArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : '';
}

function readBooleanArg(name: string, fallback: boolean) {
  const value = readArg(name).toLowerCase();
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'y', 'yes'].includes(value);
}

function readNumberArg(name: string, fallback: number) {
  const rawValue = readArg(name);
  if (!rawValue) {
    return fallback;
  }
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

const sourceCode = readArg('sourceCode');
const mode = readArg('mode') || 'ALL';
const options = {
  batchSize: readNumberArg('batchSize', 10),
  discoverList: readBooleanArg('discoverList', true),
  freshnessDays: readNumberArg('freshnessDays', 180),
  ignoreInterval: readBooleanArg('ignoreInterval', true),
  maxConcurrency: readNumberArg('maxConcurrency', 4),
  maxListPages: readNumberArg('maxListPages', 60),
  maxRetryCount: readNumberArg('maxRetryCount', 3),
  maxRounds: readNumberArg('maxRounds', 1),
  reprocessSuccess: readBooleanArg('reprocessSuccess', false),
  retryDelayMinutes: readNumberArg('retryDelayMinutes', 30),
  staleReprocessMinutes: readNumberArg('staleReprocessMinutes', 24 * 60),
  targetCount: readNumberArg('targetCount', 0),
};

const result = sourceCode
  ? await runWithRadarSharedScope(() =>
      runPublicOpportunityUrlCrawlerTask({
        ...options,
        sourceCode,
      }),
    )
  : await runWithRadarSharedScope(() =>
      runPublicOpportunityBatchCrawler({
        ...options,
        continueOnError: true,
        mode,
        targetCount: options.targetCount || undefined,
      }),
    );

console.log(
  JSON.stringify(
    result,
    (_key, value) => (typeof value === 'bigint' ? Number(value) : value),
    2,
  ),
);

// Prisma keeps connection pools alive after the one-shot CLI finishes.
// eslint-disable-next-line unicorn/no-process-exit
process.exit(0);
