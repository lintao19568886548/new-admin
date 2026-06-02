import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

import { buildPublicOpportunityMaterializedFields } from '../utils/investment-radar/public-opportunity-materialized-fields';
import {
  evaluatePublicOpportunityQuality,
  parsePublicPublishedAt,
} from '../utils/investment-radar/public-opportunity-quality';

dotenv.config({ path: 'apps/backend-mock/.env' });

const batchSize = Math.max(
  1,
  Math.min(500, Number(process.argv[2] || 200) || 200),
);

function parseJsonObject(value: unknown): null | Record<string, unknown> {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function toDateOrNull(value: unknown) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePublishedAt(row: {
  publishedAt?: Date | null | string;
  publishedDateText?: null | string;
}) {
  const current = toDateOrNull(row.publishedAt);
  if (current) {
    return current;
  }
  return parsePublicPublishedAt(row.publishedDateText);
}

function parseJsonArray(value: unknown) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function buildTagsJson(row: { tagsJson?: null | string }, status: string) {
  const tags = parseJsonArray(row.tagsJson);
  const withoutStatus = tags.filter(
    (tag) => !['EFFECTIVE', 'VERIFIED'].includes(tag),
  );
  return JSON.stringify([...new Set([status, ...withoutStatus])]);
}

function parseTagsJson(value: unknown) {
  const tags = parseJsonArray(value);
  return tags.length > 0 ? tags : [];
}

function isVisibleQualityStatus(status: string) {
  return ['EFFECTIVE', 'VERIFIED'].includes(status);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const stats = {
    demoted: 0,
    promoted: 0,
    scanned: 0,
    unchanged: 0,
    updated: 0,
  };

  try {
    let lastId = 0;
    for (;;) {
      const [rows] = await connection.query<any[]>(
        `
          SELECT
            opportunity_id AS opportunityId,
            opportunity_type AS opportunityType,
            source_site AS sourceSite,
            source_url AS sourceUrl,
            title,
            city,
            district,
            area_text AS areaText,
            area_sqm AS areaSqm,
            price_text AS priceText,
            contact_name AS contactName,
            phone_number AS phoneNumber,
            description,
            published_at AS publishedAt,
            published_date_text AS publishedDateText,
            opportunity_status AS opportunityStatus,
            source_code AS sourceCode,
            is_guangdong AS isGuangdong,
            has_detail_evidence AS hasDetailEvidence,
            quality_grade AS qualityGrade,
            tags_json AS tagsJson,
            detail_json AS detailJson
          FROM investment_public_opportunity
          WHERE opportunity_id > ?
            AND opportunity_status IN ('EFFECTIVE', 'VERIFIED')
          ORDER BY opportunity_id ASC
          LIMIT ?
        `,
        [lastId, batchSize],
      );
      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        lastId = Number(row.opportunityId || lastId);
        stats.scanned += 1;
        const detailJson = parseJsonObject(row.detailJson) || {};
        const qualityResult = evaluatePublicOpportunityQuality({
          areaSqm:
            row.areaSqm === null || row.areaSqm === undefined
              ? null
              : Number(row.areaSqm),
          areaText: row.areaText,
          city: row.city,
          contactName: row.contactName,
          description: row.description,
          detailJson,
          district: row.district,
          opportunityStatus: row.opportunityStatus,
          opportunityType: row.opportunityType,
          phoneNumber: row.phoneNumber,
          priceText: row.priceText,
          publishedAt: normalizePublishedAt(row),
          publishedDateText: row.publishedDateText,
          sourceSite: row.sourceSite,
          sourceUrl: row.sourceUrl,
          title: row.title,
        });
        const nextDetailJson = JSON.stringify({
          ...detailJson,
          qualityResult,
        });
        const nextTagsJson = buildTagsJson(row, qualityResult.status);
        const materializedFields = buildPublicOpportunityMaterializedFields({
          detailJson,
          opportunityType: row.opportunityType,
          qualityResult,
          sourceSite: row.sourceSite,
          tagsJson: parseTagsJson(row.tagsJson),
        });
        if (
          qualityResult.status === row.opportunityStatus &&
          materializedFields.sourceCode === (row.sourceCode || null) &&
          Number(row.isGuangdong || 0) ===
            (materializedFields.isGuangdong ? 1 : 0) &&
          Number(row.hasDetailEvidence || 0) ===
            (materializedFields.hasDetailEvidence ? 1 : 0) &&
          materializedFields.qualityGrade === (row.qualityGrade || null) &&
          JSON.stringify(detailJson.qualityResult || null) ===
            JSON.stringify(qualityResult)
        ) {
          stats.unchanged += 1;
          continue;
        }

        await connection.execute(
          `
            UPDATE investment_public_opportunity
            SET
              opportunity_status = ?,
              source_code = ?,
              is_guangdong = ?,
              has_detail_evidence = ?,
              quality_grade = ?,
              tags_json = ?,
              detail_json = ?,
              update_time = NOW(3)
            WHERE opportunity_id = ?
              AND opportunity_status IN ('EFFECTIVE', 'VERIFIED')
          `,
          [
            qualityResult.status,
            materializedFields.sourceCode,
            materializedFields.isGuangdong ? 1 : 0,
            materializedFields.hasDetailEvidence ? 1 : 0,
            materializedFields.qualityGrade,
            nextTagsJson,
            nextDetailJson,
            row.opportunityId,
          ],
        );
        stats.updated += 1;
        if (!isVisibleQualityStatus(qualityResult.status)) {
          stats.demoted += 1;
        } else if (
          row.opportunityStatus === 'VERIFIED' &&
          qualityResult.status === 'EFFECTIVE'
        ) {
          stats.promoted += 1;
        } else if (
          row.opportunityStatus === 'EFFECTIVE' &&
          qualityResult.status === 'VERIFIED'
        ) {
          stats.demoted += 1;
        }
      }
    }

    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await connection.end();
  }
}

await main();

// mysql2 keeps connection internals alive briefly after one-shot scripts.
// eslint-disable-next-line unicorn/no-process-exit
process.exit(0);
