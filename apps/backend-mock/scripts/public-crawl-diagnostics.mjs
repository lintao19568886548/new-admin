import { createHash } from 'node:crypto';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const command = process.argv[2] || 'db';
const inspectUrl = process.argv[3] || '';
const inspectHost = process.argv[4] || '';

function decodeHtmlEntities(value) {
  return String(value || '')
    .replaceAll(/\\u002f/gi, '/')
    .replaceAll(String.raw`\/`, '/')
    .replaceAll(/&amp;/gi, '&')
    .replaceAll(/&lt;/gi, '<')
    .replaceAll(/&gt;/gi, '>')
    .replaceAll(/&quot;/gi, '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/&nbsp;/gi, ' ');
}

function normalizeDiscoveredUrl(value, baseUrl) {
  const decodedValue = decodeHtmlEntities(value).trim();
  if (!decodedValue || /^(?:#|javascript:|mailto:|tel:)/i.test(decodedValue)) {
    return null;
  }

  try {
    const protocolMatches = [...decodedValue.matchAll(/https?:\/\//gi)];
    const lastProtocolIndex = protocolMatches.at(-1)?.index;
    const absoluteUrlMatches = decodedValue.match(/https?:\/\/[^\s"'<>]+/gi);
    let normalizedValue = decodedValue;
    if (protocolMatches.length > 1 && lastProtocolIndex !== undefined) {
      normalizedValue = decodedValue.slice(lastProtocolIndex);
    } else if (absoluteUrlMatches?.length) {
      normalizedValue =
        absoluteUrlMatches[absoluteUrlMatches.length - 1] || decodedValue;
    }
    const url = new URL(normalizedValue, baseUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function stripHtml(value, maxLength = 120) {
  return String(value || '')
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/&nbsp;/gi, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function extractPageTitle(html) {
  const titleMatch = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i.exec(
    String(html || ''),
  );
  return titleMatch?.[1] ? stripHtml(titleMatch[1], 160) : null;
}

function buildListPageContentSignals(html) {
  const text = stripHtml(html, 1000).toLowerCase();
  return {
    hasAntiBotHint:
      /captcha|verify|verification|robot|security|访问验证|安全验证|验证码|人机验证/.test(
        text,
      ),
    hasBlockedHint: /403|forbidden|access denied|拒绝访问|禁止访问/.test(text),
    hasEmptyHint: /暂无|没有找到|无结果|no data|not found/.test(text),
    hasListingHint: /厂房|仓库|出租|面积|租金|房源|供应/.test(text),
  };
}

function parseJsonObject(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function addReason(reasonCounts, reason, count = 1) {
  const normalized = String(reason || '').trim();
  if (!normalized) {
    return;
  }
  const key = normalized.slice(0, 200);
  reasonCounts.set(key, (reasonCounts.get(key) || 0) + count);
}

function buildReasonRows(rows) {
  const reasonCounts = new Map();
  for (const row of rows) {
    addReason(reasonCounts, row.skipReason);
    addReason(reasonCounts, row.lastError);
    const payload = parseJsonObject(row.parsedPayloadJson);
    const qualityResult = parseJsonObject(payload?.qualityResult);
    if (
      qualityResult?.status &&
      !['EFFECTIVE', 'VERIFIED'].includes(String(qualityResult.status))
    ) {
      addReason(reasonCounts, qualityResult.status);
    }
    const reasons = Array.isArray(qualityResult?.reasons)
      ? qualityResult.reasons
      : [];
    for (const reason of reasons) {
      addReason(reasonCounts, reason);
    }
    addReason(reasonCounts, payload?.leadSkipReason);
  }
  return [...reasonCounts.entries()]
    .map(([reason, total]) => ({ reason, total }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 20);
}

function buildMissingFieldRows(rows) {
  const fieldCounts = new Map();
  for (const row of rows) {
    const payload = parseJsonObject(row.parsedPayloadJson);
    const qualityResult = parseJsonObject(payload?.qualityResult);
    const missingFields = Array.isArray(qualityResult?.missingFields)
      ? qualityResult.missingFields
      : [];
    for (const field of missingFields) {
      const key = String(field || '').trim();
      if (!key) {
        continue;
      }
      fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
    }
  }
  return [...fieldCounts.entries()]
    .map(([field, total]) => ({ field, total }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 20);
}

function buildPayloadSampleRows(rows) {
  return rows
    .map((row) => {
      const payload = parseJsonObject(row.parsedPayloadJson);
      if (!payload) {
        return null;
      }
      const qualityResult = parseJsonObject(payload.qualityResult);
      const parseMeta = parseJsonObject(payload.parseMeta);
      return {
        areaText: parseMeta?.areaText || payload.areaText || null,
        city: parseMeta?.city || payload.city || null,
        contactName: parseMeta?.contactName || payload.contactName || null,
        itemStatus: row.status || null,
        lastError: row.lastError || null,
        missingFields: Array.isArray(qualityResult?.missingFields)
          ? qualityResult.missingFields.join(',')
          : '',
        stalePayloadQualityStatus:
          qualityResult?.status || payload.opportunityStatus || null,
        phoneNumber: parseMeta?.phoneNumber || payload.phoneNumber || null,
        priceText: parseMeta?.priceText || payload.priceText || null,
        publishedDateText:
          parseMeta?.publishedAt || payload.publishedDateText || null,
        skipReason: row.skipReason || null,
        sourceUrl: payload.sourceUrl || null,
        title: parseMeta?.title || payload.title || null,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

async function createDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }
  return mysql.createConnection(process.env.DATABASE_URL);
}

async function printTargetGaps(connection) {
  const [rows] = await connection.query(`
    SELECT
      opportunity_type AS type,
      SUM(CASE WHEN opportunity_status = 'EFFECTIVE' THEN 1 ELSE 0 END) AS effective,
      SUM(CASE WHEN opportunity_status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified,
      COUNT(*) AS total
    FROM investment_public_opportunity
    GROUP BY opportunity_type
    ORDER BY opportunity_type
  `);
  const target = 3000;
  console.log('\n[target gap]');
  console.table(
    rows.map((row) => ({
      effective: Number(row.effective || 0),
      gapTo3000: Math.max(0, target - Number(row.effective || 0)),
      total: Number(row.total || 0),
      type: row.type,
      verifiedNotCounted: Number(row.verified || 0),
    })),
  );
}

async function inspectListPage(url, hostFilter) {
  if (!url) {
    throw new Error(
      'usage: node apps/backend-mock/scripts/public-crawl-diagnostics.mjs inspect-list <url> [host]',
    );
  }
  const response = await fetch(url, {
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
      Referer: new URL(url).origin,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    redirect: 'follow',
  });
  const html = await response.text();
  const responseHash = createHash('sha256').update(html).digest('hex');
  const candidates = [];
  const seen = new Set();
  const push = (rawUrl, label = null) => {
    const sourceUrl = normalizeDiscoveredUrl(rawUrl, url);
    if (!sourceUrl || seen.has(sourceUrl)) {
      return;
    }
    if (hostFilter && !new URL(sourceUrl).hostname.includes(hostFilter)) {
      return;
    }
    seen.add(sourceUrl);
    candidates.push({ label, sourceUrl });
  };

  const anchorPattern = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  for (const [anchorHtml] of html.matchAll(anchorPattern)) {
    const href = anchorHtml.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) {
      push(href, stripHtml(anchorHtml));
    }
  }

  const dataUrlPattern =
    /\b(?:data-url|data-href|data-link|data-detail-url|data-source-url)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(dataUrlPattern)) {
    push(match[1] || '', 'data-url');
  }

  const jsonUrlPattern =
    /["'](?:url|href|link|detailUrl|detail_url|houseUrl|house_url|pcUrl|pc_url|jumpUrl|jump_url|sourceUrl|source_url)["']\s*:\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(jsonUrlPattern)) {
    push(match[1] || '', 'json-url');
  }

  const absoluteUrlPattern = /(?:https?:)?\/\/[^\s"'<>\\]+/gi;
  for (const match of html.matchAll(absoluteUrlPattern)) {
    push(match[0] || '', 'absolute-url');
  }

  console.log(
    JSON.stringify(
      {
        candidateCount: candidates.length,
        contentLength: html.length,
        contentType: response.headers.get('content-type'),
        finalUrl: response.url,
        httpStatus: response.status,
        responseHash,
        sample: candidates.slice(0, 80),
        signals: buildListPageContentSignals(html),
        textSample: stripHtml(html, 500),
        title: extractPageTitle(html),
        url,
      },
      null,
      2,
    ),
  );
}

async function printDefaultDiagnostics(connection) {
  await printTargetGaps(connection);

  const [statusRows] = await connection.query(`
    SELECT
      opportunity_type AS type,
      opportunity_status AS status,
      COUNT(*) AS total
    FROM investment_public_opportunity
    GROUP BY opportunity_type, opportunity_status
    ORDER BY opportunity_type, opportunity_status
  `);
  console.log('\n[public opportunity status]');
  console.table(statusRows);

  const [sourceRows] = await connection.query(`
    SELECT
      source_site AS sourceSite,
      opportunity_type AS type,
      opportunity_status AS status,
      COUNT(*) AS total
    FROM investment_public_opportunity
    GROUP BY source_site, opportunity_type, opportunity_status
    ORDER BY total DESC
    LIMIT 30
  `);
  console.log('\n[public opportunity source distribution]');
  console.table(sourceRows);

  const [taskRows] = await connection.query(`
    SELECT
      cs.source_code AS sourceCode,
      cs.source_name AS sourceName,
      ct.status,
      ct.fetched_count AS fetched,
      ct.created_lead_count AS created,
      ct.updated_lead_count AS updated,
      ct.skipped_count AS skipped,
      ct.error_message AS error,
      ct.finished_at AS finishedAt
    FROM crawler_task ct
    JOIN crawler_source cs ON cs.source_id = ct.source_id
    WHERE cs.source_type = 'PUBLIC_OPPORTUNITY'
    ORDER BY ct.task_id DESC
    LIMIT 30
  `);
  console.log('\n[latest public crawler tasks]');
  console.table(taskRows);

  const [logRows] = await connection.query(`
    SELECT
      ct.task_id AS taskId,
      cs.source_code AS sourceCode,
      ctl.stage,
      ctl.level,
      ctl.message,
      ctl.detail_json AS detailJson
    FROM crawler_task ct
    JOIN crawler_source cs ON cs.source_id = ct.source_id
    JOIN crawler_task_log ctl ON ctl.task_id = ct.task_id
    WHERE cs.source_type = 'PUBLIC_OPPORTUNITY'
      AND ct.task_id IN (
        SELECT task_id
        FROM (
          SELECT ct2.task_id
          FROM crawler_task ct2
          JOIN crawler_source cs2 ON cs2.source_id = ct2.source_id
          WHERE cs2.source_type = 'PUBLIC_OPPORTUNITY'
          ORDER BY ct2.task_id DESC
          LIMIT 8
        ) latest_tasks
      )
    ORDER BY ct.task_id DESC, ctl.log_id ASC
  `);
  console.log('\n[latest public crawler logs]');
  for (const row of logRows) {
    console.log(
      `[${row.taskId}] ${row.sourceCode} ${row.stage}/${row.level} ${row.message}`,
    );
    if (row.detailJson) {
      console.log(
        typeof row.detailJson === 'string'
          ? row.detailJson.slice(0, 1000)
          : JSON.stringify(row.detailJson).slice(0, 1000),
      );
    }
  }
}

async function printSourceDiagnostics(connection, sourceCode) {
  if (!sourceCode) {
    throw new Error(
      'usage: node apps/backend-mock/scripts/public-crawl-diagnostics.mjs source <sourceCode>',
    );
  }
  const [sourceRows] = await connection.query(
    `
      SELECT
        source_id AS sourceId,
        source_code AS sourceCode,
        source_name AS sourceName,
        enabled,
        base_url AS baseUrl,
        crawl_interval_minutes AS crawlIntervalMinutes,
        rate_limit_per_minute AS rateLimitPerMinute,
        allowed_paths_json AS allowedPathsJson,
        region_scope_json AS regionScopeJson,
        last_crawled_at AS lastCrawledAt
      FROM crawler_source
      WHERE source_code = ?
      LIMIT 1
    `,
    [sourceCode],
  );
  const source = sourceRows[0];
  if (!source) {
    console.log(`[source not found] ${sourceCode}`);
    return;
  }
  console.log('\n[source]');
  console.table([source]);

  const [taskRows] = await connection.query(
    `
      SELECT
        task_id AS taskId,
        status,
        fetched_count AS fetched,
        created_lead_count AS created,
        updated_lead_count AS updated,
        skipped_count AS skipped,
        error_message AS error,
        started_at AS startedAt,
        finished_at AS finishedAt
      FROM crawler_task
      WHERE source_id = ?
      ORDER BY task_id DESC
      LIMIT 10
    `,
    [source.sourceId],
  );
  console.log('\n[source latest tasks]');
  console.table(taskRows);

  const [itemStatusRows] = await connection.query(
    `
      SELECT status, COUNT(*) AS total
      FROM crawler_task_item
      WHERE source_id = ?
      GROUP BY status
      ORDER BY total DESC
    `,
    [source.sourceId],
  );
  console.log('\n[source task item status]');
  console.table(itemStatusRows);

  const [itemRows] = await connection.query(
    `
      SELECT
        status,
        skip_reason AS skipReason,
        last_error AS lastError,
        parsed_payload_json AS parsedPayloadJson
      FROM crawler_task_item
      WHERE source_id = ?
      ORDER BY update_time DESC
      LIMIT 3000
    `,
    [source.sourceId],
  );
  console.log('\n[source failure top reasons]');
  console.table(buildReasonRows(itemRows));
  console.log('\n[source missing fields]');
  console.table(buildMissingFieldRows(itemRows));
  console.log(
    '\n[source queue item parsed payload samples - not boss EFFECTIVE counts]',
  );
  console.table(buildPayloadSampleRows(itemRows));

  if (taskRows[0]?.taskId) {
    await printTaskDiagnostics(connection, taskRows[0].taskId, {
      includeHeader: false,
      logLimit: 30,
    });
  }
}

async function printTaskDiagnostics(
  connection,
  taskId,
  { includeHeader = true, logLimit = 80 } = {},
) {
  const normalizedTaskId = Number(taskId);
  if (!Number.isFinite(normalizedTaskId) || normalizedTaskId <= 0) {
    throw new Error(
      'usage: node apps/backend-mock/scripts/public-crawl-diagnostics.mjs task <taskId>',
    );
  }
  const [taskRows] = await connection.query(
    `
      SELECT
        ct.task_id AS taskId,
        cs.source_code AS sourceCode,
        cs.source_name AS sourceName,
        ct.status,
        ct.fetched_count AS fetched,
        ct.created_lead_count AS created,
        ct.updated_lead_count AS updated,
        ct.skipped_count AS skipped,
        ct.error_message AS error,
        ct.started_at AS startedAt,
        ct.finished_at AS finishedAt
      FROM crawler_task ct
      JOIN crawler_source cs ON cs.source_id = ct.source_id
      WHERE ct.task_id = ?
      LIMIT 1
    `,
    [normalizedTaskId],
  );
  if (!taskRows[0]) {
    console.log(`[task not found] ${normalizedTaskId}`);
    return;
  }
  if (includeHeader) {
    console.log('\n[task]');
  } else {
    console.log('\n[latest task]');
  }
  console.table(taskRows);

  const [statusRows] = await connection.query(
    `
      SELECT status, COUNT(*) AS total
      FROM crawler_task_item
      WHERE last_task_id = ?
      GROUP BY status
      ORDER BY total DESC
    `,
    [normalizedTaskId],
  );
  console.log('\n[task item status]');
  console.table(statusRows);

  const [itemRows] = await connection.query(
    `
      SELECT
        status,
        skip_reason AS skipReason,
        last_error AS lastError,
        parsed_payload_json AS parsedPayloadJson
      FROM crawler_task_item
      WHERE last_task_id = ?
      ORDER BY update_time DESC
      LIMIT 3000
    `,
    [normalizedTaskId],
  );
  console.log('\n[task failure top reasons]');
  console.table(buildReasonRows(itemRows));
  console.log('\n[task missing fields]');
  console.table(buildMissingFieldRows(itemRows));
  console.log(
    '\n[task queue item parsed payload samples - not boss EFFECTIVE counts]',
  );
  console.table(buildPayloadSampleRows(itemRows));

  const [logRows] = await connection.query(
    `
      SELECT
        stage,
        level,
        message,
        detail_json AS detailJson
      FROM crawler_task_log
      WHERE task_id = ?
      ORDER BY log_id DESC
      LIMIT ?
    `,
    [normalizedTaskId, logLimit],
  );
  console.log('\n[task latest logs]');
  for (const row of logRows.reverse()) {
    console.log(`${row.stage}/${row.level} ${row.message}`);
    if (row.detailJson) {
      console.log(
        typeof row.detailJson === 'string'
          ? row.detailJson.slice(0, 1200)
          : JSON.stringify(row.detailJson).slice(0, 1200),
      );
    }
  }
}

if (command === 'inspect-list') {
  await inspectListPage(inspectUrl, inspectHost);
} else {
  const connection = await createDatabaseConnection();
  try {
    if (command === 'source') {
      await printSourceDiagnostics(connection, inspectUrl);
    } else if (command === 'task') {
      await printTaskDiagnostics(connection, inspectUrl);
    } else {
      await printDefaultDiagnostics(connection);
    }
  } finally {
    await connection.end();
  }
}
