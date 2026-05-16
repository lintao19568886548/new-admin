import { prismaClient } from '~/utils/db';
import { ensurePublicOpportunityStorage } from '~/utils/investment-radar/public-opportunity-repository';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Math.max(1, Number(query.currentPage || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
    const keyword = String(query.keyword || '').trim();
    const city = String(query.city || '').trim();
    const publishedAgeLabel = String(query.publishedAgeLabel || '').trim();
    const sourceSite = String(query.sourceSite || '').trim();
    const opportunityType = String(query.opportunityType || '').trim();

    const result = await runWithRadarSharedScope(async () => {
      await ensurePublicOpportunityStorage();

      const publishedAgeLabelSql = `
        CASE
          WHEN published_at IS NULL THEN NULL
          WHEN TIMESTAMPDIFF(HOUR, published_at, NOW()) < 24
            THEN CONCAT(TIMESTAMPDIFF(HOUR, published_at, NOW()), ' 小时前')
          ELSE CONCAT(TIMESTAMPDIFF(DAY, published_at, NOW()), ' 天前')
        END
      `;
      const whereClauses = ['1 = 1'];
      const whereParams: any[] = [];

      if (city) {
        whereClauses.push('city LIKE ?');
        whereParams.push(`%${city}%`);
      }
      if (sourceSite) {
        whereClauses.push('source_site LIKE ?');
        whereParams.push(`%${sourceSite}%`);
      }
      if (publishedAgeLabel) {
        whereClauses.push(`${publishedAgeLabelSql} LIKE ?`);
        whereParams.push(`%${publishedAgeLabel}%`);
      }
      if (opportunityType) {
        whereClauses.push('opportunity_type = ?');
        whereParams.push(opportunityType);
      }
      if (keyword) {
        whereClauses.push(
          '(title LIKE ? OR contact_name LIKE ? OR phone_number LIKE ? OR source_url LIKE ?)',
        );
        const likeKeyword = `%${keyword}%`;
        whereParams.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
      }

      const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
      const dedupedSql = `
        SELECT *
        FROM (
          SELECT
            opo.*,
            ROW_NUMBER() OVER (
              PARTITION BY opportunity_type, COALESCE(NULLIF(source_url, ''), CONCAT('id:', opportunity_id))
              ORDER BY last_synced_at DESC, opportunity_id DESC
            ) AS dedupe_rank
          FROM investment_public_opportunity opo
          ${whereSql}
        ) deduped
        WHERE dedupe_rank = 1
      `;
      const offset = (currentPage - 1) * pageSize;

      const [countRows, rows, sourceSiteOptionRows, publishedAgeOptionRows] =
        await Promise.all([
          prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
            `
            SELECT COUNT(*) AS total
            FROM (${dedupedSql}) count_scope
          `,
            ...whereParams,
          ),
          prismaClient.$queryRawUnsafe<any[]>(
            `
            SELECT
              opportunity_id AS opportunityId,
              opportunity_type AS opportunityType,
              source_site AS sourceSite,
              source_url AS sourceUrl,
              source_table AS sourceTable,
              source_id AS sourceId,
              title,
              city,
              district,
              area_text AS areaText,
              area_sqm AS areaSqm,
              price_text AS priceText,
              industry_text AS industryText,
              contact_name AS contactName,
              phone_number AS phoneNumber,
              description,
              published_at AS publishedAt,
              published_date_text AS publishedDateText,
              effective_until AS effectiveUntil,
              opportunity_status AS opportunityStatus,
              score,
              tags_json AS tagsJson,
              detail_json AS detailJson,
              last_synced_at AS lastSyncedAt,
              CASE
                WHEN published_at IS NULL THEN NULL
                WHEN TIMESTAMPDIFF(HOUR, published_at, NOW()) < 24
                  THEN CONCAT(TIMESTAMPDIFF(HOUR, published_at, NOW()), ' 小时前')
                ELSE CONCAT(TIMESTAMPDIFF(DAY, published_at, NOW()), ' 天前')
              END AS publishedAgeLabel
            FROM (${dedupedSql}) list_scope
            ORDER BY last_synced_at DESC, opportunity_id DESC
            LIMIT ? OFFSET ?
          `,
            ...whereParams,
            pageSize,
            offset,
          ),
          prismaClient.$queryRawUnsafe<Array<{ value?: null | string }>>(
            `
            SELECT DISTINCT source_site AS value
            FROM (${dedupedSql}) source_scope
            WHERE 1 = 1
              AND source_site IS NOT NULL
              AND source_site <> ''
            ORDER BY source_site ASC
            LIMIT 100
          `,
            ...whereParams,
          ),
          prismaClient.$queryRawUnsafe<
            Array<{ sortValue: bigint | number; value?: null | string }>
          >(
            `
            SELECT
              ${publishedAgeLabelSql} AS value,
              MIN(TIMESTAMPDIFF(HOUR, published_at, NOW())) AS sortValue
            FROM (${dedupedSql}) age_scope
            WHERE 1 = 1
              AND published_at IS NOT NULL
            GROUP BY value
            HAVING value IS NOT NULL AND value <> ''
            ORDER BY sortValue ASC
            LIMIT 100
          `,
            ...whereParams,
          ),
        ]);

      const total = Number(countRows[0]?.total || 0);

      return {
        filters: {
          publishedAgeLabels: publishedAgeOptionRows
            .map((row) => String(row.value || '').trim())
            .filter(Boolean),
          sourceSites: sourceSiteOptionRows
            .map((row) => String(row.value || '').trim())
            .filter(Boolean),
        },
        items: rows,
        page: {
          currentPage,
          pageSize,
          total,
        },
        total,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get effective public opportunity list failed:', error);
    return serverErrorResponse('获取公开机会列表失败', event);
  }
});
