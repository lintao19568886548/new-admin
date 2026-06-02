import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import mariadb from 'mariadb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');

const DEFAULT_TARGET_EFFECTIVE_COUNT = 3000;

const DEFAULT_OUTREACH_TEMPLATES = [
  {
    channel: 'SMS',
    content:
      '您好，{companyName}近期有{intentArea}厂房需求，我们在{parkName}有匹配房源，可安排专人对接。',
    placeholderJson: ['companyName', 'parkName', 'intentArea'],
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_SMS',
    templateName: 'A级线索短信首触达',
  },
  {
    channel: 'CALL',
    content:
      '电话确认{companyName}的面积、层高、用电和入驻时间，优先推荐{parkName}现有空置房源。',
    placeholderJson: ['companyName', 'parkName'],
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_A_CALL',
    templateName: 'A级线索电话外呼',
  },
  {
    channel: 'SMS',
    content:
      '您好，关注到贵司可能有扩产或租赁需求，我们可提供{parkName}可租厂房清单供参考。',
    placeholderJson: ['companyName', 'parkName'],
    priorityLevel: 'B',
    taskType: 'OUTREACH',
    templateCode: 'RADAR_B_SMS',
    templateName: 'B级线索短信培育',
  },
  {
    channel: 'WECHAT',
    content:
      '补充核实{companyName}的具体需求和时间窗口，确认后进入正式招商跟进。',
    placeholderJson: ['companyName', 'parkName'],
    priorityLevel: 'C',
    taskType: 'FOLLOW_UP',
    templateCode: 'RADAR_C_WECHAT',
    templateName: 'C级线索微信跟进',
  },
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
    const rawValue =
      line
        .slice(equalsIndex + 1)
        .split(/\s+#/)[0]
        ?.trim() || '';
    const value = rawValue.replaceAll(/^["']|["']$/g, '');
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

async function ensureOutreachTemplateTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS investment_outreach_template (
      template_id BIGINT NOT NULL AUTO_INCREMENT,
      template_code VARCHAR(100) NOT NULL,
      template_name VARCHAR(100) NOT NULL,
      task_type VARCHAR(50) NOT NULL,
      channel VARCHAR(50) NOT NULL,
      priority_level VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      placeholder_json TEXT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (template_id),
      UNIQUE KEY uk_investment_outreach_template_code (template_code),
      INDEX idx_investment_outreach_template_enabled (enabled),
      INDEX idx_investment_outreach_template_type_channel (task_type, channel),
      INDEX idx_investment_outreach_template_priority (priority_level)
    )
  `);

  for (const template of DEFAULT_OUTREACH_TEMPLATES) {
    await connection.query(
      `
        INSERT INTO investment_outreach_template
          (template_code, template_name, task_type, channel, priority_level, content, placeholder_json, enabled, create_time, update_time)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE
          template_code = template_code
      `,
      [
        template.templateCode,
        template.templateName,
        template.taskType,
        template.channel,
        template.priorityLevel,
        template.content,
        JSON.stringify(template.placeholderJson),
      ],
    );
  }
}

async function queryOptionalTable(connection, tableName, sql) {
  if (!(await tableExists(connection, tableName))) {
    return [];
  }
  return serializeRows(await connection.query(sql));
}

function getEffectiveCount(rows, opportunityType) {
  const matched = rows.find((row) => row.opportunityType === opportunityType);
  return Number(matched?.total || 0);
}

function buildEffectiveGaps(effectiveCounts) {
  const demandEffectiveCount = getEffectiveCount(effectiveCounts, 'DEMAND');
  const supplyEffectiveCount = getEffectiveCount(effectiveCounts, 'SUPPLY');

  return {
    demand: Math.max(DEFAULT_TARGET_EFFECTIVE_COUNT - demandEffectiveCount, 0),
    supply: Math.max(DEFAULT_TARGET_EFFECTIVE_COUNT - supplyEffectiveCount, 0),
    targetEachType: DEFAULT_TARGET_EFFECTIVE_COUNT,
  };
}

async function main() {
  loadEnvFile();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const connectionConfig = buildConnectionConfig(databaseUrl);
  const connection = await mariadb.createConnection({
    ...connectionConfig,
    connectTimeout: 5000,
  });

  try {
    await ensureOutreachTemplateTable(connection);

    const statusCounts = serializeRows(
      await connection.query(`
        SELECT
          opportunity_type AS opportunityType,
          opportunity_status AS opportunityStatus,
          COUNT(*) AS total
        FROM investment_public_opportunity
        GROUP BY opportunity_type, opportunity_status
        ORDER BY opportunity_type, opportunity_status
      `),
    );

    const effectiveCounts = serializeRows(
      await connection.query(`
        SELECT
          opportunity_type AS opportunityType,
          COUNT(*) AS total
        FROM investment_public_opportunity
        WHERE opportunity_status = 'EFFECTIVE'
        GROUP BY opportunity_type
        ORDER BY opportunity_type
      `),
    );

    const templateSummary = serializeRows(
      await connection.query(`
        SELECT enabled, COUNT(*) AS total
        FROM investment_outreach_template
        GROUP BY enabled
        ORDER BY enabled DESC
      `),
    );

    const result = {
      database: {
        database: connectionConfig.database,
        host: connectionConfig.host,
        port: connectionConfig.port,
      },
      outreachTaskSummary: await queryOptionalTable(
        connection,
        'investment_outreach_task',
        `
          SELECT status, reply_status AS replyStatus, COUNT(*) AS total
          FROM investment_outreach_task
          GROUP BY status, reply_status
          ORDER BY status, reply_status
        `,
      ),
      rawEffectiveCounts: effectiveCounts,
      rawEffectiveGaps: buildEffectiveGaps(effectiveCounts),
      restrictionSummary: await queryOptionalTable(
        connection,
        'contact_restriction',
        `
          SELECT status, restriction_type AS restrictionType, COUNT(*) AS total
          FROM contact_restriction
          GROUP BY status, restriction_type
          ORDER BY status, restriction_type
        `,
      ),
      statusCounts,
      templateSummary,
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
