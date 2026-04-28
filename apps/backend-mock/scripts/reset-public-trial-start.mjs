import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

function normalizeArgv(argv) {
  return argv.filter((arg) => arg !== '--');
}

function shouldPrintHelp(argv) {
  return argv.length === 0 || argv.includes('--help') || argv.includes('-h');
}

function printHelp() {
  console.log(`重置中心库用户会员试用开始时间

用法:
  pnpm -F @vben/backend-mock run trial:reset-public -- --customer-id=public
  pnpm -F @vben/backend-mock run trial:reset-public -- --customer-id=public --trial-start=now --only-empty
  pnpm -F @vben/backend-mock run trial:reset-public -- --customer-id=public --trial-start=2026-05-01T00:00:00+08:00 --execute

参数:
  --customer-id=<id>       目标 customerId，默认 public
  --trial-start=<time>     试用开始时间，默认 now；支持 Date 可解析的时间字符串
  --only-empty             只更新 membership_trial_start_at 为空的用户
  --include-disabled       包含 status=0 的禁用用户
  --execute                执行写入；不传时只预览
  --help, -h               输出帮助

说明:
  不带参数只输出帮助，不再执行默认预览。
  确认预览输出无误后，再追加 --execute 写入。`);
}

function parseArgs(argv) {
  const options = {
    customerId: 'public',
    execute: false,
    includeDisabled: false,
    onlyEmpty: false,
    trialStart: 'now',
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    if (arg === '--include-disabled') {
      options.includeDisabled = true;
      continue;
    }
    if (arg === '--only-empty') {
      options.onlyEmpty = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`未知参数: ${arg}`);
    }
    const [, key, value] = match;
    if (key === 'customer-id') {
      options.customerId = value;
      continue;
    }
    if (key === 'trial-start') {
      options.trialStart = value;
      continue;
    }
    throw new Error(`未知参数: ${arg}`);
  }

  return options;
}

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function requireEnv(name) {
  const value = stripWrappingQuotes(process.env[name]);
  if (!value) {
    throw new Error(`${name} 未配置`);
  }
  return value;
}

function parseDbUrl(rawUrl) {
  return new URL(stripWrappingQuotes(rawUrl));
}

function normalizeCustomerId(value) {
  const customerId = String(value || '').trim();
  if (!customerId || !/^\w+$/.test(customerId)) {
    throw new Error(`customerId 不合法: ${customerId}`);
  }
  return customerId;
}

function resolveTrialStart(value) {
  const normalized = String(value || '').trim();
  const date =
    !normalized || normalized.toLowerCase() === 'now'
      ? new Date()
      : new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`trial-start 时间不合法: ${value}`);
  }
  return date;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatSqlDateTime(date) {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
  ].join('');
}

function buildWhere(options) {
  const where = ['customer_type = ?'];
  const params = [options.customerId];

  if (!options.includeDisabled) {
    where.push('(status IS NULL OR status <> 0)');
  }

  if (options.onlyEmpty) {
    where.push('membership_trial_start_at IS NULL');
  }

  return {
    params,
    sql: where.join(' AND '),
  };
}

async function main() {
  const argv = normalizeArgv(process.argv.slice(2));
  if (shouldPrintHelp(argv)) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  options.customerId = normalizeCustomerId(options.customerId);
  const trialStartAt = resolveTrialStart(options.trialStart);
  const trialStartSql = formatSqlDateTime(trialStartAt);
  const dbUrl = parseDbUrl(requireEnv('CENTER_DATABASE_URL'));
  const connection = await mariadb.createConnection({
    database: dbUrl.pathname.replace(/^\//, ''),
    host: dbUrl.hostname,
    password: decodeURIComponent(dbUrl.password),
    port: dbUrl.port ? Number(dbUrl.port) : 3306,
    user: decodeURIComponent(dbUrl.username),
  });

  try {
    const where = buildWhere(options);
    const countRows = await connection.query(
      `SELECT COUNT(*) AS count FROM \`user\` WHERE ${where.sql}`,
      where.params,
    );
    const count = Number(countRows[0]?.count || 0);
    const sampleRows = await connection.query(
      `SELECT id, username, real_name AS realName, customer_type AS customerType, create_time AS createTime, membership_trial_start_at AS membershipTrialStartAt FROM \`user\` WHERE ${where.sql} ORDER BY id ASC LIMIT 10`,
      where.params,
    );

    console.log(
      JSON.stringify(
        {
          affectedUsers: count,
          customerId: options.customerId,
          execute: options.execute,
          includeDisabled: options.includeDisabled,
          onlyEmpty: options.onlyEmpty,
          preview: !options.execute,
          sampleRows,
          trialStartAt: trialStartSql,
        },
        null,
        2,
      ),
    );

    if (!options.execute) {
      console.log('预览模式，未写入。确认后追加 --execute 执行更新。');
      return;
    }

    const result = await connection.query(
      `UPDATE \`user\` SET membership_trial_start_at = ?, update_time = NOW() WHERE ${where.sql}`,
      [trialStartSql, ...where.params],
    );
    console.log(
      JSON.stringify(
        {
          changedRows: Number(result.changedRows || 0),
          updatedRows: Number(result.affectedRows || 0),
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
