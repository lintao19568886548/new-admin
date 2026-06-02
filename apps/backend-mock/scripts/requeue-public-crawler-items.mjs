import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const ALLOWED_STATUSES = new Set(['FAILED', 'RETRY_WAITING', 'SKIPPED']);

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : '';
}

function normalizeStatuses(value) {
  const statuses = String(value || 'SKIPPED')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => ALLOWED_STATUSES.has(item));
  return [...new Set(statuses)];
}

async function main() {
  const sourceCode = readArg('sourceCode');
  const statuses = normalizeStatuses(readArg('statuses'));

  if (!sourceCode) {
    throw new Error(
      'usage: node apps/backend-mock/scripts/requeue-public-crawler-items.mjs --sourceCode=PUBLIC_FACTORY_LISTING_CFZSW68 --statuses=SKIPPED',
    );
  }
  if (statuses.length === 0) {
    throw new Error('statuses must include FAILED, RETRY_WAITING, or SKIPPED');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [sourceRows] = await connection.query(
      `
        SELECT source_id AS sourceId, source_code AS sourceCode, source_name AS sourceName
        FROM crawler_source
        WHERE source_code = ?
          AND source_type = 'PUBLIC_OPPORTUNITY'
        LIMIT 1
      `,
      [sourceCode],
    );
    const source = sourceRows[0];
    if (!source) {
      throw new Error(`public crawler source not found: ${sourceCode}`);
    }

    const [beforeRows] = await connection.query(
      `
        SELECT status, COUNT(*) AS total
        FROM crawler_task_item
        WHERE source_id = ?
        GROUP BY status
        ORDER BY total DESC
      `,
      [source.sourceId],
    );

    const [result] = await connection.query(
      `
        UPDATE crawler_task_item
        SET status = 'PENDING',
          retry_count = 0,
          next_retry_at = NULL,
          last_error = NULL,
          skip_reason = NULL,
          update_time = NOW(3)
        WHERE source_id = ?
          AND status IN (${statuses.map(() => '?').join(', ')})
      `,
      [source.sourceId, ...statuses],
    );

    const [afterRows] = await connection.query(
      `
        SELECT status, COUNT(*) AS total
        FROM crawler_task_item
        WHERE source_id = ?
        GROUP BY status
        ORDER BY total DESC
      `,
      [source.sourceId],
    );

    console.log(
      JSON.stringify(
        {
          after: afterRows,
          before: beforeRows,
          requeuedCount: result.affectedRows || 0,
          source,
          statuses,
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

await main();
