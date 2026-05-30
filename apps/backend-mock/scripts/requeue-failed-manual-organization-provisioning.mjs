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
  console.log(`重排 failed_manual 组织空间开通任务

用法:
  pnpm -F @vben/backend-mock run organization-provisioning:requeue-failed-manual -- --job-id=123
  pnpm -F @vben/backend-mock run organization-provisioning:requeue-failed-manual -- --job-id=123 --execute --confirmation=requeue_failed_manual:123:target_customer_id

参数:
  --job-id=<id>            必填，tenant_provisioning_job.id
  --execute                执行写入；不传时只预览并输出 confirmation
  --confirmation=<text>    执行写入时必填，必须匹配预览输出的 confirmation
  --operator=<name>        可选，记录操作者，默认取 USER/USERNAME/cli
  --reason=<text>          可选，记录重排原因
  --help, -h               输出帮助

说明:
  只允许重排 failed_manual、source_customer_id=public 且已有 target_customer_id 的任务。
  执行后任务会回到 pending，worker 下一轮会全量重建目标库。`);
}

function parseArgs(argv) {
  const options = {
    confirmation: '',
    execute: false,
    jobId: null,
    operator: process.env.USER || process.env.USERNAME || 'cli',
    reason: '',
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`未知参数: ${arg}`);
    }
    const [, key, value] = match;
    if (key === 'confirmation') {
      options.confirmation = value;
      continue;
    }
    if (key === 'job-id') {
      options.jobId = normalizePositiveInteger(value);
      continue;
    }
    if (key === 'operator') {
      options.operator = value.trim() || options.operator;
      continue;
    }
    if (key === 'reason') {
      options.reason = value.trim();
      continue;
    }
    throw new Error(`未知参数: ${arg}`);
  }

  if (!options.jobId) {
    throw new Error('必须提供 --job-id=<id>');
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

function normalizePositiveInteger(value) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function buildConfirmation(job) {
  return `requeue_failed_manual:${job.id}:${job.targetCustomerId || 'missing_target'}`;
}

function assertRequeueable(job) {
  if (!job) {
    throw new Error('组织空间开通任务不存在');
  }
  if (job.status !== 'failed_manual') {
    throw new Error(`仅允许重排 failed_manual 任务，当前状态为 ${job.status}`);
  }
  if (job.sourceCustomerId !== 'public') {
    throw new Error(
      `仅允许重排 public -> 组织空间任务，当前 sourceCustomerId=${job.sourceCustomerId}`,
    );
  }
  if (!job.targetCustomerId) {
    throw new Error('任务缺少 targetCustomerId，不能安全重排，请先定位根因');
  }
}

function normalizeJob(row) {
  if (!row) {
    return null;
  }
  return {
    completedAt: row.completedAt,
    createTime: row.createTime,
    errorMessage: row.errorMessage,
    heartbeatAt: row.heartbeatAt,
    id: Number(row.id),
    initiatorCenterUserId: Number(row.initiatorCenterUserId),
    lastPaymentOutTradeNo: row.lastPaymentOutTradeNo,
    lockedAt: row.lockedAt,
    lockOwner: row.lockOwner,
    retryCount: Number(row.retryCount || 0),
    sourceCustomerId: String(row.sourceCustomerId || ''),
    startedAt: row.startedAt,
    status: String(row.status || ''),
    step: row.step,
    targetCity: row.targetCity,
    targetCompanyShortName: row.targetCompanyShortName,
    targetCustomerId: row.targetCustomerId,
    targetDbName: row.targetDbName,
    updateTime: row.updateTime,
  };
}

async function getJob(connection, jobId) {
  const rows = await connection.query(
    `
      SELECT
        id,
        initiator_center_user_id AS initiatorCenterUserId,
        source_customer_id AS sourceCustomerId,
        target_customer_id AS targetCustomerId,
        target_city AS targetCity,
        target_company_short_name AS targetCompanyShortName,
        target_db_name AS targetDbName,
        status,
        step,
        retry_count AS retryCount,
        last_payment_out_trade_no AS lastPaymentOutTradeNo,
        error_message AS errorMessage,
        lock_owner AS lockOwner,
        locked_at AS lockedAt,
        heartbeat_at AS heartbeatAt,
        started_at AS startedAt,
        completed_at AS completedAt,
        create_time AS createTime,
        update_time AS updateTime
      FROM tenant_provisioning_job
      WHERE id = ?
      LIMIT 1
    `,
    [jobId],
  );
  return normalizeJob(rows[0]);
}

function buildOutput(payload) {
  return JSON.stringify(payload, null, 2);
}

async function main() {
  const argv = normalizeArgv(process.argv.slice(2));
  if (shouldPrintHelp(argv)) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  const dbUrl = parseDbUrl(requireEnv('CENTER_DATABASE_URL'));
  const connection = await mariadb.createConnection({
    database: dbUrl.pathname.replace(/^\//, ''),
    host: dbUrl.hostname,
    password: decodeURIComponent(dbUrl.password),
    port: dbUrl.port ? Number(dbUrl.port) : 3306,
    user: decodeURIComponent(dbUrl.username),
  });

  try {
    const job = await getJob(connection, options.jobId);
    assertRequeueable(job);

    const confirmation = buildConfirmation(job);
    if (!options.execute) {
      console.log(
        buildOutput({
          confirmation,
          execute: false,
          job,
          message:
            '预览模式，未写入。确认已修复根因后，追加 --execute 和 --confirmation 执行重排。',
        }),
      );
      return;
    }

    if (options.confirmation !== confirmation) {
      throw new Error(`确认串不匹配，请使用 --confirmation=${confirmation}`);
    }

    const result = await connection.query(
      `
        UPDATE tenant_provisioning_job
        SET
          status = 'pending',
          step = 'manual_requeued',
          retry_count = 0,
          error_message = NULL,
          lock_owner = NULL,
          locked_at = NULL,
          heartbeat_at = NULL,
          started_at = NULL,
          completed_at = NULL,
          update_time = NOW()
        WHERE id = ? AND status = 'failed_manual'
      `,
      [job.id],
    );

    if (Number(result.affectedRows || 0) !== 1) {
      throw new Error('任务状态已变化，重排未执行，请重新预览后再操作');
    }

    const updatedJob = await getJob(connection, job.id);
    console.log(
      buildOutput({
        confirmation,
        execute: true,
        job: updatedJob,
        message: '任务已重置为 pending，worker 下一轮将全量重建目标库。',
        operator: options.operator,
        previousJob: job,
        reason: options.reason,
      }),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
