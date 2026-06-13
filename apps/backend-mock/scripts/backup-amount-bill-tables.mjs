import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendMockDir = path.resolve(scriptDir, '..');
const defaultOutputDir = path.resolve(backendMockDir, 'backups');
const TABLES = ['amount_bill', 'ele_bill', 'water_bill', 'finance'];

dotenv.config({ path: path.resolve(backendMockDir, '.env') });

function stripWrappingQuotes(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function parseArgs(argv) {
  const options = {
    databaseUrl: '',
    outputDir: defaultOutputDir,
  };

  for (const arg of argv.filter((item) => item !== '--')) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`未知参数: ${arg}`);
    }

    const [, key, value] = match;
    if (key === 'database-url') {
      options.databaseUrl = stripWrappingQuotes(value);
      continue;
    }

    if (key === 'output-dir') {
      options.outputDir = path.resolve(
        process.cwd(),
        stripWrappingQuotes(value),
      );
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  return options;
}

function createConnectionConfig(rawUrl) {
  const url = new URL(stripWrappingQuotes(rawUrl));
  return {
    acquireTimeout: 5000,
    connectTimeout: 5000,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
  };
}

function maskDatabaseUrl(rawUrl) {
  return String(rawUrl || '').replaceAll(
    /:\/\/([^:/?#]+):([^@/?#]+)@/g,
    '://$1:***@',
  );
}

function toPlainValue(value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toPlainRows(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, toPlainValue(value)]),
    ),
  );
}

function buildBackupFileName() {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  return `amount-bill-tables-${timestamp}.json`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl =
    options.databaseUrl ||
    stripWrappingQuotes(process.env.DATABASE_URL) ||
    stripWrappingQuotes(process.env.PUBLIC_DATABASE_URL);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未配置，请传 --database-url');
  }

  const connection = await mariadb.createConnection(
    createConnectionConfig(databaseUrl),
  );

  try {
    const tables = {};
    const rowCounts = {};

    for (const table of TABLES) {
      const rows = await connection.query(`SELECT * FROM ${table}`);
      tables[table] = toPlainRows(rows);
      rowCounts[table] = rows.length;
    }

    await mkdir(options.outputDir, { recursive: true });
    const outputPath = path.join(options.outputDir, buildBackupFileName());
    const payload = {
      databaseUrl: maskDatabaseUrl(databaseUrl),
      generatedAt: new Date().toISOString(),
      rowCounts,
      tables,
    };

    await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(
      JSON.stringify(
        {
          outputPath,
          rowCounts,
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('[backup-amount-bill-tables] 执行失败:', error);
  process.exitCode = 1;
});
