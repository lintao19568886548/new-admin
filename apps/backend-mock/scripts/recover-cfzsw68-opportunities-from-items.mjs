import { createHash } from 'node:crypto';
import process from 'node:process';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: 'apps/backend-mock/.env' });

const SOURCE_CODE = 'PUBLIC_FACTORY_LISTING_CFZSW68';
const SOURCE_SITE = 'cfzsw68.com';
const SOURCE_TYPE = 'SUPPLY';

const DISTRICT_NAMES = [
  '宝安',
  '光明',
  '龙岗',
  '坪山',
  '龙华',
  '南山',
  '福田',
  '罗湖',
  '盐田',
  '大鹏',
  '布吉',
  '坂田',
  '横岗',
  '平湖',
  '坪地',
  '沙井',
  '松岗',
  '福永',
  '西乡',
  '石岩',
  '观澜',
  '公明',
  '新桥',
  '燕罗',
  '坑梓',
  '龙田',
  '葵涌',
  '南澳',
];

function readArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : fallback;
}

function readPositiveIntArg(name, fallback) {
  const value = Number(readArg(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const limit = readPositiveIntArg('limit', 1800);
const concurrency = Math.min(12, readPositiveIntArg('concurrency', 8));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

function decodeHtml(value) {
  return String(value || '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&ensp;', ' ')
    .replaceAll('&emsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/&#x([\da-f]+);/gi, (_match, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number(code)),
    );
}

function stripHtml(value) {
  return decodeHtml(value)
    .replaceAll(/<script[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<br\s*\/?>/gi, ' ')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function extractByClass(html, className) {
  const pattern = new RegExp(
    `<([a-z0-9]+)(?:\\s[^>]*)?class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  );
  return pattern.exec(html)?.[2] || '';
}

function compact(value) {
  return stripHtml(value).replaceAll(/\s+/g, ' ').trim();
}

function normalizeTitle(html) {
  const raw =
    extractByClass(html, 'listcontwo_1') ||
    /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i.exec(html)?.[1] ||
    '';
  return compact(raw)
    .replaceAll(/^\[[^\]]+\]\s*[-－]?\s*/gu, '')
    .replaceAll(/\s*[-_|].*(?:厂房招商网|cfzsw68).*$/giu, '')
    .trim()
    .slice(0, 255);
}

function normalizePhone(value) {
  const phone = String(value || '')
    .match(/((?:\+?86[-\s]?)?1[3-9]\d(?:[-\s]?\d){8})/)?.[1]
    ?.replaceAll(/[-\s]/g, '');
  return phone && /^1[3-9]\d{9}$/.test(phone) ? phone : null;
}

function normalizeContact(value, phoneNumber) {
  const text = String(value || '')
    .replaceAll(phoneNumber || '', ' ')
    .replaceAll(/服务热线|全国客服热线|电话|手机|联系人|咨询/g, ' ')
    .replaceAll(/[：:，,;；|｜/\\]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return /^[\u4E00-\u9FA5A-Za-z]{1,12}(?:先生|女士|经理|总)?$/u.test(text)
    ? text
    : null;
}

function normalizeAreaText(value) {
  const text = compact(value);
  const match = text.match(
    /(\d[\d,.]*(?:\s*[~\-至到]\s*\d[\d,.]*)?\s*(?:万\s*)?(?:平方米|平米|平方|m²|m2|[㎡亩平])?)/iu,
  );
  if (!match) {
    return null;
  }
  const area = match[1].replaceAll(/\s+/g, ' ').trim();
  return /(?:平方米|平米|平方|m²|m2|[㎡亩平])$/iu.test(area)
    ? area
    : `${area} ㎡`;
}

function normalizeAreaSqm(areaText) {
  if (!areaText || /[~\-至到]/u.test(areaText)) {
    return null;
  }
  const match = areaText.replaceAll(',', '').match(/(\d+(?:\.\d+)?)(\s*万)?/u);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * (match[2] ? 10_000 : 1));
}

function normalizePriceText(value) {
  const text = compact(value);
  if (/面议|电议|价格面谈|价格可面议/u.test(text)) {
    return text.match(/价格可面议|价格面谈|面议|电议/u)?.[0] || null;
  }
  return (
    text
      .match(
        /\d[\d,.]*(?:\s*万)?\s*(?:元\/㎡\/月|元\/平米\/月|元\/平方米\/月|块钱|[元块¥￥])(?:\s*(?:[/.／·・]\s*)?(?:m²|m2|平方米|平米|平方|[㎡亩平月天日年]))*/iu,
      )?.[0]
      ?.trim() || null
  );
}

function extractPublishedDateText(html) {
  const text = compact(extractByClass(html, 'listcontwo_2'));
  return (
    text
      .match(/\d+\s*(?:分钟|小时|[天日周月年])前/u)?.[0]
      ?.replaceAll(/\s+/g, '') ||
    text.match(
      /20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/u,
    )?.[0] ||
    text.match(/\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2})?/u)?.[0] ||
    null
  );
}

function parsePublishedAt(text) {
  const now = new Date();
  if (!text) {
    return now;
  }
  const relative = text.match(/(\d+)\s*(分钟|小时|[天日周月年])前/u);
  if (relative) {
    const amount = Number(relative[1]);
    const result = new Date(now);
    const unit = relative[2];
    switch (unit) {
      case '分钟': {
        result.setMinutes(result.getMinutes() - amount);
        break;
      }
      case '周': {
        result.setDate(result.getDate() - amount * 7);
        break;
      }
      case '天':
      case '日': {
        result.setDate(result.getDate() - amount);
        break;
      }
      case '小时': {
        result.setHours(result.getHours() - amount);
        break;
      }
      case '年': {
        result.setFullYear(result.getFullYear() - amount);
        break;
      }
      case '月': {
        result.setMonth(result.getMonth() - amount);
        break;
      }
    }
    return result;
  }
  const normalized = text
    .replaceAll('年', '-')
    .replaceAll('月', '-')
    .replaceAll('日', '')
    .replaceAll('/', '-')
    .replaceAll('.', '-');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

function extractDistrict(html, title) {
  const bracket = compact(extractByClass(html, 'listcontwo_1')).match(
    /\[([^\]]+)\]/u,
  )?.[1];
  const metrics = compact(extractByClass(html, 'listconn_3_Rr_b'));
  const regionText =
    metrics.match(
      /所在区域[:：]?\s*([\u4E00-\u9FA5A-Za-z0-9\-\s]{1,60})(?:面积|租金|楼层|结构|$)/u,
    )?.[1] ||
    bracket ||
    title;
  return (
    DISTRICT_NAMES.find((name) => String(regionText || '').includes(name)) ||
    null
  );
}

function extractListing(html, sourceUrl) {
  const title = normalizeTitle(html);
  const metrics = compact(extractByClass(html, 'listconn_3_Rr_b'));
  const detailText = compact(html);
  const contactText =
    compact(extractByClass(html, 'listconn_3_R_d')) || detailText;
  const phoneNumber = normalizePhone(contactText);
  const contactName = normalizeContact(contactText, phoneNumber);
  const publishedDateText = extractPublishedDateText(html);
  const areaText = normalizeAreaText(metrics) || normalizeAreaText(title);
  const priceText =
    normalizePriceText(
      metrics.match(/(?:租金|报价|价格)[:：]?([^\n\r。；;]{0,80})/u)?.[1],
    ) ||
    normalizePriceText(metrics) ||
    normalizePriceText(title);
  const district = extractDistrict(html, title);
  const missingFields = [];
  for (const [field, value] of Object.entries({
    areaText,
    contactName,
    district,
    phoneNumber,
    priceText,
    publishedDateText,
    title,
  })) {
    if (!value) missingFields.push(field);
  }

  return {
    areaSqm: normalizeAreaSqm(areaText),
    areaText,
    city: '深圳',
    contactName,
    description: detailText.slice(0, 5000),
    district,
    missingFields,
    phoneNumber,
    priceText,
    publishedAt: parsePublishedAt(publishedDateText),
    publishedDateText,
    sourceUrl,
    title,
  };
}

function buildSourceId(sourceUrl) {
  const hash = createHash('sha256').update(sourceUrl).digest('hex');
  return Number.parseInt(hash.slice(0, 7), 16);
}

function buildResponseHash(bodyText) {
  return createHash('sha256').update(bodyText).digest('hex');
}

function isListPageUrl(sourceUrl) {
  return /\/sz\/cfcz\/(?:index(?:_\d+)?\.html)?$/i.test(sourceUrl);
}

function extractDetailUrlsFromListHtml(html, listUrl) {
  const urls = new Set();
  for (const match of html.matchAll(
    /(?:href=["'])?((?:https?:\/\/cfzsw68\.com)?\/sz\/cfcz\/\d+\.html)/gi,
  )) {
    try {
      const url = new URL(match[1], listUrl);
      url.hash = '';
      urls.add(url.toString());
    } catch {
      // Ignore malformed href values from old pages.
    }
  }
  return [...urls];
}

async function fetchHtml(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
    },
    signal: AbortSignal.timeout(15_000),
  });
  const bodyText = await response.text();
  return {
    bodyText,
    httpStatus: response.status,
    ok: response.ok,
    responseHash: buildResponseHash(bodyText),
  };
}

async function loadItems(connection) {
  const [rows] = await connection.query(
    `
      SELECT item.item_id AS itemId, item.source_url AS sourceUrl
      FROM crawler_task_item item
      JOIN crawler_source source ON source.source_id = item.source_id
      LEFT JOIN investment_public_opportunity opportunity
        ON opportunity.opportunity_type = ?
        AND opportunity.source_url = item.source_url
      WHERE source.source_code = ?
        AND item.source_url IS NOT NULL
        AND item.source_url <> ''
        AND item.status IN ('PENDING', 'SKIPPED', 'RETRY_WAITING')
        AND opportunity.opportunity_id IS NULL
      ORDER BY item.update_time DESC, item.item_id ASC
      LIMIT ?
    `,
    [SOURCE_TYPE, SOURCE_CODE, limit],
  );
  return rows;
}

async function discoverDetailUrlsFromListItems(listItems) {
  const discovered = new Set();
  for (const item of listItems) {
    try {
      const fetched = await fetchHtml(item.sourceUrl);
      if (!fetched.ok || fetched.bodyText.trim().length === 0) {
        continue;
      }
      for (const sourceUrl of extractDetailUrlsFromListHtml(
        fetched.bodyText,
        item.sourceUrl,
      )) {
        discovered.add(sourceUrl);
      }
    } catch {
      // List pages are only expansion inputs; detail parsing below owns errors.
    }
  }
  return [...discovered];
}

async function insertOpportunity(connection, parsed, responseHash) {
  const detailJson = JSON.stringify({
    crawlerSourceCode: SOURCE_CODE,
    qualityResult: {
      city: parsed.city,
      missingFields: [],
      reasons: [],
      status: 'EFFECTIVE',
    },
    rawEvidenceText: parsed.description.slice(0, 1200),
    responseHash,
    sourceCode: SOURCE_CODE,
  });
  const tagsJson = JSON.stringify([
    'crawler',
    SOURCE_TYPE,
    'EFFECTIVE',
    SOURCE_CODE,
  ]);
  const [result] = await connection.query(
    `
      INSERT INTO investment_public_opportunity (
        opportunity_type, source_site, source_url, source_key, source_table, source_id,
        title, city, district, area_text, area_sqm, price_text, industry_text,
        contact_name, phone_number, description, published_at,
        published_date_text, opportunity_status, source_code, is_guangdong,
        has_detail_evidence, quality_grade, score, tags_json,
        detail_json, last_synced_at, create_time, update_time
      )
      SELECT ?, ?, ?, ?, 'crawler', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?,
        'EFFECTIVE', ?, 1, 1, 'EFFECTIVE', 70, ?, ?, NOW(3), NOW(3), NOW(3)
      WHERE NOT EXISTS (
        SELECT 1
        FROM investment_public_opportunity
        WHERE opportunity_type = ? AND source_url = ?
        LIMIT 1
      )
    `,
    [
      SOURCE_TYPE,
      SOURCE_SITE,
      parsed.sourceUrl,
      parsed.sourceUrl.slice(0, 160),
      buildSourceId(parsed.sourceUrl),
      parsed.title,
      parsed.city,
      parsed.district,
      parsed.areaText,
      parsed.areaSqm,
      parsed.priceText,
      parsed.contactName,
      parsed.phoneNumber,
      parsed.description,
      parsed.publishedAt,
      parsed.publishedDateText || parsed.publishedAt.toISOString().slice(0, 10),
      SOURCE_CODE,
      tagsJson,
      detailJson,
      SOURCE_TYPE,
      parsed.sourceUrl,
    ],
  );
  return Number(result.affectedRows || 0);
}

async function markItemSuccess(
  connection,
  itemId,
  parsed,
  httpStatus,
  responseHash,
) {
  if (!itemId) {
    return;
  }
  await connection.query(
    `
      UPDATE crawler_task_item
      SET status = 'SUCCESS',
        last_http_status = ?,
        last_finished_at = NOW(3),
        last_success_at = NOW(3),
        response_hash = ?,
        parsed_payload_json = ?,
        last_error = NULL,
        skip_reason = NULL,
        update_time = NOW(3)
      WHERE item_id = ?
    `,
    [
      httpStatus,
      responseHash,
      JSON.stringify({
        opportunityCreated: true,
        parseMeta: parsed,
        qualityResult: {
          city: parsed.city,
          missingFields: [],
          reasons: [],
          status: 'EFFECTIVE',
        },
        responseHash,
      }),
      itemId,
    ],
  );
}

async function markItemSkipped(connection, itemId, reason, payload = null) {
  if (!itemId) {
    return;
  }
  await connection.query(
    `
      UPDATE crawler_task_item
      SET status = 'SKIPPED',
        skip_reason = ?,
        parsed_payload_json = ?,
        last_finished_at = NOW(3),
        update_time = NOW(3)
      WHERE item_id = ?
    `,
    [reason.slice(0, 120), payload ? JSON.stringify(payload) : null, itemId],
  );
}

async function processItem(connection, item) {
  try {
    const fetched = await fetchHtml(item.sourceUrl);
    if (!fetched.ok || fetched.bodyText.trim().length === 0) {
      await markItemSkipped(
        connection,
        item.itemId,
        `HTTP_${fetched.httpStatus}`,
        {
          sourceUrl: item.sourceUrl,
        },
      );
      return { inserted: 0, skipped: 1 };
    }
    const parsed = extractListing(fetched.bodyText, item.sourceUrl);
    if (parsed.missingFields.length > 0) {
      await markItemSkipped(connection, item.itemId, 'KEY_FIELDS_INCOMPLETE', {
        missingFields: parsed.missingFields,
        sourceUrl: item.sourceUrl,
      });
      return { inserted: 0, skipped: 1 };
    }
    const inserted = await insertOpportunity(
      connection,
      parsed,
      fetched.responseHash,
    );
    await markItemSuccess(
      connection,
      item.itemId,
      parsed,
      fetched.httpStatus,
      fetched.responseHash,
    );
    return { inserted, skipped: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markItemSkipped(
      connection,
      item.itemId,
      `FETCH_OR_PARSE_FAILED:${message}`,
      {
        sourceUrl: item.sourceUrl,
      },
    );
    return { inserted: 0, skipped: 1 };
  }
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
      [SOURCE_TYPE],
    );
    const items = await loadItems(connection);
    const listItems = items.filter((item) => isListPageUrl(item.sourceUrl));
    const detailItems = items.filter((item) => !isListPageUrl(item.sourceUrl));
    const discoveredUrls = await discoverDetailUrlsFromListItems(listItems);
    const virtualDetailItems = discoveredUrls.map((sourceUrl) => ({
      itemId: null,
      sourceUrl,
    }));
    const workItems = [...virtualDetailItems, ...detailItems].slice(0, limit);
    let cursor = 0;
    let inserted = 0;
    let skipped = 0;
    async function worker() {
      while (cursor < workItems.length) {
        const item = workItems[cursor++];
        const result = await processItem(connection, item);
        inserted += result.inserted;
        skipped += result.skipped;
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, items.length) }, () =>
        worker(),
      ),
    );
    const [afterRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM investment_public_opportunity
        WHERE opportunity_type = ? AND opportunity_status = 'EFFECTIVE'
      `,
      [SOURCE_TYPE],
    );
    console.log(
      JSON.stringify(
        {
          after: Number(afterRows[0]?.count || 0),
          before: Number(beforeRows[0]?.count || 0),
          discoveredFromListPages: discoveredUrls.length,
          inserted,
          loaded: items.length,
          processed: workItems.length,
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
