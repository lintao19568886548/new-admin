import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import mariadb from 'mariadb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');
const defaultOutputDir = resolve(
  backendRoot,
  'tmp',
  'public-opportunity-backup',
);
const outputDir = process.argv.includes('--output')
  ? resolve(
      process.argv[process.argv.indexOf('--output') + 1] || defaultOutputDir,
    )
  : defaultOutputDir;

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
      .join('')
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

function serializeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value;
}

async function main() {
  loadEnvFile();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const connection = await mariadb.createConnection({
    ...buildConnectionConfig(process.env.DATABASE_URL),
    connectTimeout: 5000,
  });
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const outputPath = resolve(
    outputDir,
    `investment-public-opportunity-${timestamp}.jsonl`,
  );
  const stream = createWriteStream(outputPath, { encoding: 'utf8' });
  let lastId = 0;
  let total = 0;

  try {
    for (;;) {
      const rows = await connection.query(
        `
          SELECT *
          FROM investment_public_opportunity
          WHERE opportunity_id > ?
          ORDER BY opportunity_id ASC
          LIMIT 1000
        `,
        [lastId],
      );
      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        lastId = Number(row.opportunity_id || row.opportunityId || lastId);
        stream.write(
          `${JSON.stringify(row, (_key, value) => serializeValue(value))}\n`,
        );
        total += 1;
      }
    }
  } finally {
    stream.end();
    await connection.end();
  }

  console.log(
    JSON.stringify(
      {
        outputPath,
        table: 'investment_public_opportunity',
        total,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
