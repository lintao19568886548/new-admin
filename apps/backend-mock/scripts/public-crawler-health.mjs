import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import mariadb from 'mariadb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');

const PUBLIC_SOURCE_CODES = [
  'PUBLIC_OPPORTUNITY_99CFW',
  'PUBLIC_FACTORY_LISTING_CFZSW68',
  'PUBLIC_DEMAND_99CFW_GD',
  'PUBLIC_DEMAND_ZHAOSHANG_NET_GD',
  'PUBLIC_FACTORY_LISTING_99CFW_GD',
  'PUBLIC_FACTORY_LISTING_TOODC_GD',
  'PUBLIC_FACTORY_LISTING_FANG_GD',
  'PUBLIC_FACTORY_LISTING_TZGD_GD',
  'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD',
  'PUBLIC_FACTORY_LISTING_GDCFZS_GD',
  'PUBLIC_FACTORY_LISTING_SZCFW_GD',
  'PUBLIC_FACTORY_LISTING_SZKKW_GD',
  'PUBLIC_FACTORY_LISTING_HFDPT_GD',
  'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD',
  'PUBLIC_FACTORY_LISTING_YSOL_GD',
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

function buildConnectionConfig(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    database: parsed.pathname.replace(/^\//, ''),
    host: parsed.hostname,
    password: decodeURIComponent(parsed.password),
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
  };
}

function serializeRows(rows) {
  return JSON.parse(
    JSON.stringify(rows, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value,
    ),
  );
}

async function tableExists(connection, tableName) {
  const rows = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [tableName],
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function main() {
  loadEnvFile();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const connection = await mariadb.createConnection({
    ...buildConnectionConfig(process.env.DATABASE_URL),
    connectTimeout: 5000,
  });

  try {
    const [hasCrawlerSource, hasCrawlerTask, hasTaskItem] = await Promise.all([
      tableExists(connection, 'crawler_source'),
      tableExists(connection, 'crawler_task'),
      tableExists(connection, 'crawler_task_item'),
    ]);
    if (!hasCrawlerSource) {
      console.log(
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            sourceCount: 0,
            warning: 'crawler_source table not found',
          },
          null,
          2,
        ),
      );
      return;
    }

    const placeholders = PUBLIC_SOURCE_CODES.map(() => '?').join(', ');
    const sourceRows = serializeRows(
      await connection.query(
        `
          SELECT source_id AS sourceId, source_code AS sourceCode, source_name AS sourceName, enabled
          FROM crawler_source
          WHERE source_code IN (${placeholders})
          ORDER BY source_code
        `,
        PUBLIC_SOURCE_CODES,
      ),
    );
    const sourceIds = sourceRows.map((row) => Number(row.sourceId));
    const idPlaceholders = sourceIds.map(() => '?').join(', ');
    const taskRows =
      hasCrawlerTask && sourceIds.length > 0
        ? serializeRows(
            await connection.query(
              `
                SELECT
                  source_id AS sourceId,
                  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedTasks,
                  SUM(CASE WHEN status = 'SUCCESS' AND fetched_count = 0 AND created_lead_count = 0 AND updated_lead_count = 0 THEN 1 ELSE 0 END) AS zeroOutputTasks
                FROM crawler_task
                WHERE source_id IN (${idPlaceholders})
                  AND create_time >= DATE_SUB(NOW(3), INTERVAL 7 DAY)
                GROUP BY source_id
              `,
              sourceIds,
            ),
          )
        : [];
    const itemRows =
      hasTaskItem && sourceIds.length > 0
        ? serializeRows(
            await connection.query(
              `
                SELECT
                  source_id AS sourceId,
                  COUNT(*) AS totalItems,
                  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS successItems,
                  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedItems,
                  SUM(CASE WHEN status IN ('PENDING', 'RUNNING', 'RETRY_WAITING') THEN 1 ELSE 0 END) AS pendingItems
                FROM crawler_task_item
                WHERE source_id IN (${idPlaceholders})
                GROUP BY source_id
              `,
              sourceIds,
            ),
          )
        : [];

    const taskBySource = new Map(
      taskRows.map((row) => [Number(row.sourceId), row]),
    );
    const itemBySource = new Map(
      itemRows.map((row) => [Number(row.sourceId), row]),
    );
    const sources = sourceRows.map((source) => {
      const task = taskBySource.get(Number(source.sourceId)) || {};
      const item = itemBySource.get(Number(source.sourceId)) || {};
      const totalItems = Number(item.totalItems || 0);
      const successItems = Number(item.successItems || 0);
      return {
        ...source,
        failedItems: Number(item.failedItems || 0),
        failedTasks: Number(task.failedTasks || 0),
        pendingItems: Number(item.pendingItems || 0),
        successItems,
        successRate:
          totalItems > 0
            ? Number(((successItems / totalItems) * 100).toFixed(1))
            : 0,
        totalItems,
        zeroOutputTasks: Number(task.zeroOutputTasks || 0),
      };
    });

    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          sourceCount: sources.length,
          sources,
          summary: {
            failedTasks: sources.reduce(
              (sum, source) => sum + source.failedTasks,
              0,
            ),
            warningSources: sources.filter(
              (source) => source.failedTasks > 0 || source.zeroOutputTasks > 0,
            ).length,
            zeroOutputTasks: sources.reduce(
              (sum, source) => sum + source.zeroOutputTasks,
              0,
            ),
          },
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
  console.error(error?.message || error);
  process.exitCode = 1;
});
