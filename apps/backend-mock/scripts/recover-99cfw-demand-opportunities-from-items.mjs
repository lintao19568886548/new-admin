import { createHash } from 'node:crypto';
import process from 'node:process';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: 'apps/backend-mock/.env' });

const OPPORTUNITY_TYPE = 'DEMAND';

function readArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : fallback;
}

function readPositiveIntArg(name, fallback) {
  const value = Number(readArg(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const limit = readPositiveIntArg('limit', 5000);
const sourceCode = readArg('sourceCode', 'PUBLIC_DEMAND_99CFW_GD');
const sourceSite = readArg('sourceSite', '99cfw');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
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

function normalizeString(value) {
  const text = String(value || '').trim();
  return text && text.toLowerCase() !== 'null' ? text : '';
}

function sourceIdFromUrl(sourceUrl) {
  return Number.parseInt(
    createHash('sha256').update(sourceUrl).digest('hex').slice(0, 7),
    16,
  );
}

function toMysqlDate(value) {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizePublishedDateText(value, publishedAt) {
  const text = normalizeString(value);
  if (text) {
    return text.slice(0, 100);
  }
  return publishedAt.toISOString().slice(0, 10);
}

function isUsable99CfwUrl(value) {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.hostname.toLowerCase().endsWith('99cfw.com')
    );
  } catch {
    return false;
  }
}

function buildOpportunity(row) {
  const payload = parseJsonObject(row.parsedPayloadJson);
  const parseMeta = parseJsonObject(payload?.parseMeta);
  const qualityResult = parseJsonObject(payload?.qualityResult);
  const sourceUrl = normalizeString(row.sourceUrl || payload?.sourceUrl);
  const title = normalizeString(parseMeta?.title || payload?.title);
  const city = normalizeString(parseMeta?.city || qualityResult?.city);
  const areaText = normalizeString(parseMeta?.areaText || payload?.areaText);
  const publishedRaw = normalizeString(
    parseMeta?.publishedAt || payload?.publishedDateText,
  );
  const publishedAt = toMysqlDate(publishedRaw);

  if (!sourceUrl || !isUsable99CfwUrl(sourceUrl)) {
    return null;
  }
  if (!title || !city || !areaText || !publishedRaw) {
    return null;
  }

  const description = normalizeString(
    parseMeta?.description || payload?.description || title,
  );
  return {
    areaText,
    city,
    contactName: normalizeString(parseMeta?.contactName) || null,
    description: (description || title).slice(0, 5000),
    detailJson: JSON.stringify({
      crawlerSourceCode: sourceCode,
      originalCrawlerItemStatus: row.status || null,
      originalSkipReason: row.skipReason || null,
      parseMeta,
      qualityResult,
      recoveredFromCrawlerItem: true,
      relaxedDemandRecovery: true,
      responseHash: payload?.responseHash || row.responseHash || null,
      sourceCode,
    }),
    district: normalizeString(parseMeta?.district) || null,
    industryText: normalizeString(parseMeta?.industryText) || null,
    phoneNumber: normalizeString(parseMeta?.phoneNumber) || null,
    priceText: normalizeString(parseMeta?.priceText) || null,
    publishedAt,
    publishedDateText: normalizePublishedDateText(publishedRaw, publishedAt),
    sourceId: sourceIdFromUrl(sourceUrl),
    sourceKey: sourceUrl.slice(0, 160),
    sourceUrl,
    tagsJson: JSON.stringify([
      'crawler',
      OPPORTUNITY_TYPE,
      'EFFECTIVE',
      sourceCode,
      'RELAXED_RECOVERY',
    ]),
    title: title.slice(0, 255),
  };
}

async function insertOpportunity(connection, opportunity) {
  const [result] = await connection.query(
    `
      INSERT INTO investment_public_opportunity (
        opportunity_type, source_site, source_url, source_key, source_table, source_id,
        title, city, district, area_text, price_text, industry_text,
        contact_name, phone_number, description, published_at,
        published_date_text, opportunity_status, source_code, is_guangdong,
        has_detail_evidence, quality_grade, score, tags_json,
        detail_json, last_synced_at, create_time, update_time
      )
      SELECT
        ?, ?, ?, ?, 'crawler', ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, 'EFFECTIVE', ?, 1,
        1, 'EFFECTIVE', 65, ?,
        ?, NOW(3), NOW(3), NOW(3)
      WHERE NOT EXISTS (
        SELECT 1
        FROM investment_public_opportunity existing
        WHERE existing.opportunity_type = ?
          AND existing.source_url = ?
        LIMIT 1
      )
    `,
    [
      OPPORTUNITY_TYPE,
      sourceSite,
      opportunity.sourceUrl,
      opportunity.sourceKey,
      opportunity.sourceId,
      opportunity.title,
      opportunity.city,
      opportunity.district,
      opportunity.areaText,
      opportunity.priceText,
      opportunity.industryText,
      opportunity.contactName,
      opportunity.phoneNumber,
      opportunity.description,
      opportunity.publishedAt,
      opportunity.publishedDateText,
      sourceCode,
      opportunity.tagsJson,
      opportunity.detailJson,
      OPPORTUNITY_TYPE,
      opportunity.sourceUrl,
    ],
  );
  return Number(result.affectedRows || 0);
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [beforeRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM investment_public_opportunity
        WHERE opportunity_type = ? AND opportunity_status = 'EFFECTIVE'
      `,
      [OPPORTUNITY_TYPE],
    );
    const [rows] = await connection.query(
      `
        SELECT
          item.item_id AS itemId,
          item.source_url AS sourceUrl,
          item.status,
          item.skip_reason AS skipReason,
          item.response_hash AS responseHash,
          item.parsed_payload_json AS parsedPayloadJson
        FROM crawler_task_item item
        JOIN crawler_source source ON source.source_id = item.source_id
        WHERE source.source_code = ?
          AND item.source_url IS NOT NULL
          AND item.source_url <> ''
          AND item.parsed_payload_json IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM investment_public_opportunity opportunity
            WHERE opportunity.opportunity_type = ?
              AND opportunity.source_url = item.source_url
            LIMIT 1
          )
        ORDER BY
          CASE
            WHEN JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.qualityResult.status')) = 'EFFECTIVE' THEN 0
            WHEN JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.qualityResult.status')) = 'VERIFIED' THEN 1
            ELSE 2
          END,
          item.update_time DESC,
          item.item_id DESC
        LIMIT ?
      `,
      [sourceCode, OPPORTUNITY_TYPE, limit],
    );

    let candidates = 0;
    let inserted = 0;
    let skipped = 0;
    for (const row of rows) {
      const opportunity = buildOpportunity(row);
      if (!opportunity) {
        skipped += 1;
        continue;
      }
      candidates += 1;
      inserted += await insertOpportunity(connection, opportunity);
    }

    const [afterRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM investment_public_opportunity
        WHERE opportunity_type = ? AND opportunity_status = 'EFFECTIVE'
      `,
      [OPPORTUNITY_TYPE],
    );

    console.log(
      JSON.stringify(
        {
          after: Number(afterRows[0]?.count || 0),
          before: Number(beforeRows[0]?.count || 0),
          candidates,
          inserted,
          loaded: rows.length,
          skipped,
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
