import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');

const stableSourceCodes = [
  'PUBLIC_DEMAND_99CFW_GD',
  'PUBLIC_FACTORY_LISTING_CFZSW68',
];
const publicCrawlerIntervalMinutes = 24 * 60;

const disabledSourceCodes = [
  'PUBLIC_DEMAND_021CF_GD',
  'PUBLIC_DEMAND_CFZX_GD',
  'PUBLIC_DEMAND_CHANGFANGHOME_GD',
  'PUBLIC_DEMAND_ZGZSW_GD',
  'PUBLIC_DEMAND_ZHAOSHANG_NET_GD',
  'PUBLIC_FACTORY_LISTING_021CF_GD',
  'PUBLIC_FACTORY_LISTING_58_DG',
  'PUBLIC_FACTORY_LISTING_58_GD',
  'PUBLIC_FACTORY_LISTING_99CFW_DG',
  'PUBLIC_FACTORY_LISTING_99CFW_GD',
  'PUBLIC_FACTORY_LISTING_CANGXIAOER_DG',
  'PUBLIC_FACTORY_LISTING_CANGXIAOER_GD',
  'PUBLIC_FACTORY_LISTING_CFZX_GD',
  'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD',
  'PUBLIC_FACTORY_LISTING_CHANGFANGHOME_GD',
  'PUBLIC_FACTORY_LISTING_FANG_DG',
  'PUBLIC_FACTORY_LISTING_FANG_GD',
  'PUBLIC_FACTORY_LISTING_GDCFZS_GD',
  'PUBLIC_FACTORY_LISTING_HFDPT_GD',
  'PUBLIC_FACTORY_LISTING_SZCFW_GD',
  'PUBLIC_FACTORY_LISTING_SZKKW_GD',
  'PUBLIC_FACTORY_LISTING_SZAQFDC_DG',
  'PUBLIC_FACTORY_LISTING_TOODC_DG',
  'PUBLIC_FACTORY_LISTING_TOODC_GD',
  'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD',
  'PUBLIC_FACTORY_LISTING_TZGD_GD',
  'PUBLIC_FACTORY_LISTING_YSOL_GD',
  'PUBLIC_FACTORY_LISTING_ZGZSW_GD',
  'PUBLIC_OPPORTUNITY_99CFW',
];

function loadEnvFile() {
  const envPath = resolve(backendRoot, '.env');
  let content = '';
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }
    const key = line.slice(0, equalsIndex).trim();
    const value = line
      .slice(equalsIndex + 1)
      .split(/\s+#/)[0]
      .trim()
      .replaceAll(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await connection.query(
    `
      UPDATE crawler_source
      SET enabled = 1,
        crawl_interval_minutes = ?,
        rate_limit_per_minute = 120,
        update_time = NOW(3)
      WHERE source_code IN (?)
    `,
    [publicCrawlerIntervalMinutes, stableSourceCodes],
  );

  await connection.query(
    `
      UPDATE crawler_source
      SET enabled = 0,
        crawl_interval_minutes = ?,
        rate_limit_per_minute = 120,
        update_time = NOW(3)
      WHERE source_code IN (?)
    `,
    [publicCrawlerIntervalMinutes, disabledSourceCodes],
  );

  await connection.query(`
    UPDATE crawler_task task
    INNER JOIN crawler_source source ON source.source_id = task.source_id
    SET task.status = 'FAILED',
      task.finished_at = NOW(3),
      task.crawl_ended_at = COALESCE(task.crawl_ended_at, NOW(3)),
      task.error_message = 'SOURCE_DISABLED_ACTIVE_TASK_RECLAIMED',
      task.skip_reason = 'SOURCE_DISABLED_ACTIVE_TASK_RECLAIMED',
      task.update_time = NOW(3)
    WHERE task.status IN ('PENDING', 'RUNNING')
      AND source.enabled = 0
  `);

  await connection.query(`
    UPDATE crawler_task task
    INNER JOIN crawler_source source ON source.source_id = task.source_id
    SET task.status = 'FAILED',
      task.finished_at = NOW(3),
      task.crawl_ended_at = COALESCE(task.crawl_ended_at, NOW(3)),
      task.error_message = 'PUBLIC_CRAWLER_TASK_BUDGET_RECLAIMED',
      task.skip_reason = 'PUBLIC_CRAWLER_TASK_BUDGET_RECLAIMED',
      task.update_time = NOW(3)
    WHERE task.status IN ('PENDING', 'RUNNING')
      AND source.source_type = 'PUBLIC_OPPORTUNITY'
      AND task.create_time < DATE_SUB(NOW(3), INTERVAL 2 MINUTE)
  `);

  const [sources] = await connection.query(
    `
      SELECT
        source_code AS sourceCode,
        enabled,
        crawl_interval_minutes AS intervalMin,
        rate_limit_per_minute AS rateLimit,
        last_crawled_at AS lastCrawledAt
      FROM crawler_source
      WHERE source_type = 'PUBLIC_OPPORTUNITY'
      ORDER BY enabled DESC, source_code ASC
    `,
  );
  const [activeTasks] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM crawler_task
    WHERE status IN ('PENDING', 'RUNNING')
  `);

  console.table(
    sources.map((row) => ({
      enabled: Number(row.enabled),
      intervalMin: Number(row.intervalMin),
      lastCrawledAt: row.lastCrawledAt,
      rateLimit: Number(row.rateLimit),
      sourceCode: row.sourceCode,
    })),
  );
  console.table(
    activeTasks.map((row) => ({ activeTasks: Number(row.total || 0) })),
  );
} finally {
  await connection.end();
}
