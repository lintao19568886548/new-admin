import dotenv from 'dotenv';

dotenv.config({ path: 'apps/backend-mock/.env' });
dotenv.config({ path: '.env' });

const { cleanupInvalidGuangdongNotices } =
  await import('../utils/guangdong-notice-cleanup');
const { noticesPrismaClient } = await import('../utils/notices-db');

function readArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : '';
}

function readNumberArg(name: string) {
  const rawValue = readArg(name);
  if (!rawValue) {
    return undefined;
  }
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function readBooleanArg(name: string, fallback: boolean) {
  const value = readArg(name).toLowerCase();
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'y', 'yes'].includes(value);
}

function readValidStateArg() {
  const value = readArg('validState');
  return ['all', 'invalid', 'valid'].includes(value)
    ? (value as 'all' | 'invalid' | 'valid')
    : undefined;
}

const execute = readBooleanArg('execute', false);
const summary = await cleanupInvalidGuangdongNotices({
  execute,
  limit: readNumberArg('limit'),
  noticeId: readArg('noticeId'),
  onItem(item) {
    console.log(JSON.stringify(item));
  },
  validState: readValidStateArg(),
});

console.log(
  JSON.stringify({
    checked: summary.checked,
    invalid: summary.invalid,
    persistedInvalid: summary.persistedInvalid,
    transient: summary.transient,
    updated: summary.updated,
    valid: summary.valid,
  }),
);

await noticesPrismaClient.$disconnect();

// Prisma keeps connection pools alive after the one-shot CLI finishes.
// eslint-disable-next-line unicorn/no-process-exit
process.exit(0);
