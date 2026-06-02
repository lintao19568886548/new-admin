import { createHash } from 'node:crypto';
import process from 'node:process';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: 'apps/backend-mock/.env' });

function readArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : fallback;
}

function readPositiveIntArg(name, fallback) {
  const value = Number(readArg(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function readBooleanArg(name, fallback = false) {
  const value = readArg(name);
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'y', 'yes'].includes(value.toLowerCase());
}

const sourceCode = readArg('sourceCode');
const opportunityType = readArg('opportunityType', 'SUPPLY').toUpperCase();
const sourceSite = readArg('sourceSite', 'cfzsw68.com');
const limit = readPositiveIntArg('limit', 5000);
const recoverDemandVerified = readBooleanArg('recoverDemandVerified', false);

const GUANGDONG_CITY_NAMES = new Set([
  '东莞',
  '中山',
  '云浮',
  '佛山',
  '广州',
  '惠州',
  '揭阳',
  '梅州',
  '汕头',
  '汕尾',
  '江门',
  '河源',
  '深圳',
  '清远',
  '湛江',
  '潮州',
  '珠海',
  '肇庆',
  '茂名',
  '阳江',
  '韶关',
]);

const GUANGDONG_99CFW_HOST_CODES = new Set([
  'dg',
  'fs',
  'gz',
  'hy',
  'jm',
  'jy',
  'mm',
  'mz',
  'qy',
  'sg',
  'st',
  'sw',
  'sz',
  'yf',
  'yj',
  'zh',
  'zj',
  'zq',
  'zs',
]);

const GUANGDONG_99CFW_CITY_SLUGS = new Set([
  'chaozhou',
  'dg',
  'fs',
  'gz',
  'heyuan',
  'huizhou',
  'jiangmen',
  'jieyang',
  'mm',
  'mz',
  'qingyuan',
  'sd',
  'sg',
  'st',
  'sw',
  'sz',
  'taishan',
  'yf',
  'yj',
  'zh',
  'zj',
  'zq',
  'zs',
]);

const RECOVERABLE_DEMAND_MISSING_FIELDS = new Set([
  'contactName',
  'phoneNumber',
  'priceText',
]);

const NON_GUANGDONG_TEXT_PATTERN =
  // eslint-disable-next-line regexp/no-dupe-disjunctions
  /北京|上海|天津|重庆|杭州|杭州市|萧山|余杭|西安|武汉|长沙|南京|苏州|无锡|嘉兴|宁波|温州|湖州|绍兴|金华|台州|成都|郑州|合肥|南昌|厦门|福州|泉州|青岛|济南/u;

function parseJsonObject(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeString(value) {
  return String(value || '').trim();
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

function isLikelyDetailSlug(value) {
  const slug = String(value || '').replace(/\.(?:html|htm)$/i, '');
  if (!slug || /^(?:fabu|list|page|index|search|3929[a-z]*)$/i.test(slug)) {
    return false;
  }
  if (/^\d+(?:_\d+)*$/.test(slug) && slug.split('_').length === 5) {
    return false;
  }
  return /^[\w-]{2,120}$/.test(slug);
}

function isSafeGuangdong99CfwDemandUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    const segments = url.pathname
      .split('/')
      .map((segment) => segment.trim().toLowerCase())
      .filter(Boolean);
    const [prefix, regionOrSlug, detailSlug, ...extraSegments] = segments;
    if (
      !prefix ||
      !regionOrSlug ||
      extraSegments.length > 0 ||
      !['cangkuqiu', 'changfangxuqiu', 'xuqiu'].includes(prefix)
    ) {
      return false;
    }
    if (hostname === 'www.99cfw.com') {
      return (
        Boolean(detailSlug) &&
        GUANGDONG_99CFW_CITY_SLUGS.has(regionOrSlug) &&
        isLikelyDetailSlug(detailSlug)
      );
    }
    const hostCode = hostname.replace(/\.99cfw\.com$/i, '');
    return (
      GUANGDONG_99CFW_HOST_CODES.has(hostCode) &&
      prefix === 'xuqiu' &&
      !detailSlug &&
      isLikelyDetailSlug(regionOrSlug)
    );
  } catch {
    return false;
  }
}

function hasOnlyRecoverableDemandMissingFields(qualityResult) {
  const missingFields = Array.isArray(qualityResult?.missingFields)
    ? qualityResult.missingFields.map((field) => String(field || '').trim())
    : [];
  return missingFields.every((field) =>
    RECOVERABLE_DEMAND_MISSING_FIELDS.has(field),
  );
}

function buildRecoverableDemandOpportunity(row) {
  const payload = parseJsonObject(row.parsedPayloadJson);
  const qualityResult = parseJsonObject(payload?.qualityResult);
  const parseMeta = parseJsonObject(payload?.parseMeta);
  const sourceUrl = normalizeString(row.sourceUrl || payload?.sourceUrl);
  const title = normalizeString(parseMeta?.title || payload?.title);
  const city = normalizeString(parseMeta?.city || qualityResult?.city);
  const areaText = normalizeString(parseMeta?.areaText || payload?.areaText);
  const publishedDateText = normalizeString(
    parseMeta?.publishedAt || payload?.publishedDateText,
  );
  const evidenceText = [
    title,
    city,
    parseMeta?.district,
    parseMeta?.description,
    payload?.description,
    payload?.locationEvidenceText,
  ]
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .join(' ');

  if (qualityResult?.status !== 'VERIFIED') {
    return null;
  }
  if (!hasOnlyRecoverableDemandMissingFields(qualityResult)) {
    return null;
  }
  if (!sourceUrl || !isSafeGuangdong99CfwDemandUrl(sourceUrl)) {
    return null;
  }
  if (!title || !city || !areaText || !publishedDateText) {
    return null;
  }
  if (!GUANGDONG_CITY_NAMES.has(city)) {
    return null;
  }
  if (NON_GUANGDONG_TEXT_PATTERN.test(evidenceText)) {
    return null;
  }

  return {
    areaText,
    city,
    contactName: normalizeString(parseMeta?.contactName) || null,
    detailJson: JSON.stringify({
      crawlerSourceCode: sourceCode,
      qualityResult,
      recoveredFromCrawlerItem: true,
      recoveredVerifiedDemand: true,
      responseHash: payload?.responseHash || null,
      sourceCode,
    }),
    district: normalizeString(parseMeta?.district) || null,
    industryText: normalizeString(parseMeta?.industryText) || null,
    phoneNumber: normalizeString(parseMeta?.phoneNumber) || null,
    priceText: normalizeString(parseMeta?.priceText) || null,
    publishedAt: toMysqlDate(publishedDateText),
    publishedDateText: publishedDateText.slice(0, 100),
    sourceId: sourceIdFromUrl(sourceUrl),
    sourceKey: sourceUrl.slice(0, 160),
    sourceUrl,
    tagsJson: JSON.stringify([
      'crawler',
      opportunityType,
      'EFFECTIVE',
      sourceCode,
      'RECOVERED_VERIFIED_DEMAND',
    ]),
    title: title.slice(0, 255),
  };
}

async function insertRecoverableDemandOpportunity(connection, opportunity) {
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
        1, 'EFFECTIVE', 68, ?,
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
      opportunityType,
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
      opportunity.title,
      opportunity.publishedAt,
      opportunity.publishedDateText,
      sourceCode,
      opportunity.tagsJson,
      opportunity.detailJson,
      opportunityType,
      opportunity.sourceUrl,
    ],
  );
  return Number(result.affectedRows || 0);
}

if (!sourceCode) {
  throw new Error(
    'usage: node apps/backend-mock/scripts/backfill-public-opportunities-from-crawler-success.mjs --sourceCode=PUBLIC_FACTORY_LISTING_CFZSW68 --opportunityType=SUPPLY --sourceSite=cfzsw68.com',
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [beforeRows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM investment_public_opportunity
      WHERE opportunity_type = ? AND opportunity_status = 'EFFECTIVE'
    `,
    [opportunityType],
  );
  const [candidateRows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM crawler_task_item item
      JOIN crawler_source source ON source.source_id = item.source_id
      WHERE source.source_code = ?
        AND item.status = 'SUCCESS'
        AND item.source_url IS NOT NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.qualityResult.status')) = 'EFFECTIVE'
        AND NOT EXISTS (
          SELECT 1
          FROM investment_public_opportunity opportunity
          WHERE opportunity.opportunity_type = ?
            AND opportunity.source_url = item.source_url
          LIMIT 1
        )
    `,
    [sourceCode, opportunityType],
  );

  const [insertResult] = await connection.query(
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
        ? AS opportunity_type,
        ? AS source_site,
        item.source_url,
        LEFT(item.source_url, 160) AS source_key,
        'crawler' AS source_table,
        CAST(CONV(SUBSTR(SHA2(item.source_url, 256), 1, 7), 16, 10) AS UNSIGNED) AS source_id,
        LEFT(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.title')), item.source_url), 255) AS title,
        COALESCE(
          JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.city')),
          JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.qualityResult.city'))
        ) AS city,
        JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.district')) AS district,
        JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.areaText')) AS area_text,
        JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.priceText')) AS price_text,
        JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.industryText')) AS industry_text,
        JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.contactName')) AS contact_name,
        JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.phoneNumber')) AS phone_number,
        LEFT(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.title')), item.source_url), 5000) AS description,
        COALESCE(
          STR_TO_DATE(
            REPLACE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.publishedAt')), 19), 'T', ' '),
            '%Y-%m-%d %H:%i:%s'
          ),
          NOW(3)
        ) AS published_at,
        COALESCE(
          LEFT(JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.parseMeta.publishedAt')), 10),
          DATE_FORMAT(NOW(), '%Y-%m-%d')
        ) AS published_date_text,
        'EFFECTIVE' AS opportunity_status,
        ? AS source_code,
        1 AS is_guangdong,
        1 AS has_detail_evidence,
        'EFFECTIVE' AS quality_grade,
        70 AS score,
        JSON_ARRAY('crawler', ?, 'EFFECTIVE', ?) AS tags_json,
        JSON_OBJECT(
          'responseHash', JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.responseHash')),
          'qualityResult', JSON_EXTRACT(item.parsed_payload_json, '$.qualityResult'),
          'crawlerSourceCode', ?,
          'sourceCode', ?,
          'recoveredFromCrawlerItem', true
        ) AS detail_json,
        NOW(3) AS last_synced_at,
        NOW(3) AS create_time,
        NOW(3) AS update_time
      FROM crawler_task_item item
      JOIN crawler_source source ON source.source_id = item.source_id
      WHERE source.source_code = ?
        AND item.status = 'SUCCESS'
        AND item.source_url IS NOT NULL
        AND JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.qualityResult.status')) = 'EFFECTIVE'
        AND NOT EXISTS (
          SELECT 1
          FROM investment_public_opportunity opportunity
          WHERE opportunity.opportunity_type = ?
            AND opportunity.source_url = item.source_url
          LIMIT 1
        )
      LIMIT ?
    `,
    [
      opportunityType,
      sourceSite,
      sourceCode,
      opportunityType,
      sourceCode,
      sourceCode,
      sourceCode,
      sourceCode,
      opportunityType,
      limit,
    ],
  );

  let recoveredVerifiedCandidates = 0;
  let recoveredVerifiedInserted = 0;
  if (recoverDemandVerified && opportunityType === 'DEMAND') {
    const [verifiedRows] = await connection.query(
      `
        SELECT
          item.source_url AS sourceUrl,
          item.parsed_payload_json AS parsedPayloadJson
        FROM crawler_task_item item
        JOIN crawler_source source ON source.source_id = item.source_id
        WHERE source.source_code = ?
          AND item.status = 'SUCCESS'
          AND item.source_url IS NOT NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(item.parsed_payload_json, '$.qualityResult.status')) = 'VERIFIED'
          AND NOT EXISTS (
            SELECT 1
            FROM investment_public_opportunity opportunity
            WHERE opportunity.opportunity_type = ?
              AND opportunity.source_url = item.source_url
            LIMIT 1
          )
        ORDER BY item.update_time DESC
        LIMIT ?
      `,
      [sourceCode, opportunityType, limit],
    );
    for (const row of verifiedRows) {
      const opportunity = buildRecoverableDemandOpportunity(row);
      if (!opportunity) {
        continue;
      }
      recoveredVerifiedCandidates += 1;
      recoveredVerifiedInserted += await insertRecoverableDemandOpportunity(
        connection,
        opportunity,
      );
    }
  }

  const [afterRows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM investment_public_opportunity
      WHERE opportunity_type = ? AND opportunity_status = 'EFFECTIVE'
    `,
    [opportunityType],
  );

  console.log(
    JSON.stringify(
      {
        after: Number(afterRows[0]?.count || 0),
        before: Number(beforeRows[0]?.count || 0),
        candidates: Number(candidateRows[0]?.count || 0),
        inserted: Number(insertResult.affectedRows || 0),
        recoveredVerifiedCandidates,
        recoveredVerifiedInserted,
        sourceCode,
      },
      null,
      2,
    ),
  );
} finally {
  await connection.end();
}
