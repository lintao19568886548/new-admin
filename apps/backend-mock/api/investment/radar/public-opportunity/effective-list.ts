import { prismaClient } from '~/utils/db';
import {
  buildAuditScopeParams,
  buildAuditScopeSql,
  buildStrictEffectiveOpportunityWhereParams,
  buildStrictEffectiveOpportunityWhereSql,
} from '~/utils/investment-radar/public-opportunity-audit-rules';
import { ensurePublicOpportunityStorage } from '~/utils/investment-radar/public-opportunity-repository';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type PublicOpportunityListScope = 'collected' | 'strict';

function normalizeListScope(value: unknown): PublicOpportunityListScope {
  return String(value || '')
    .trim()
    .toLowerCase() === 'collected'
    ? 'collected'
    : 'strict';
}

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
    const scope = normalizeListScope(query.scope);
    const publishedAgeValue = Number.parseInt(
      publishedAgeLabel.replaceAll(/\D/g, ''),
      10,
    );

    const result = await runWithRadarSharedScope(async () => {
      await ensurePublicOpportunityStorage();

      const publishedAgeLabelSql = `
        CASE
          WHEN opo.published_at IS NULL THEN NULL
          WHEN TIMESTAMPDIFF(HOUR, opo.published_at, NOW()) < 24
            THEN CONCAT(TIMESTAMPDIFF(HOUR, opo.published_at, NOW()), ' 小时前')
          ELSE CONCAT(TIMESTAMPDIFF(DAY, opo.published_at, NOW()), ' 天前')
        END
      `;
      const publishedAgeLabelScopeSql = `
        CASE
          WHEN published_at IS NULL THEN NULL
          WHEN TIMESTAMPDIFF(HOUR, published_at, NOW()) < 24
            THEN CONCAT(TIMESTAMPDIFF(HOUR, published_at, NOW()), ' 小时前')
          ELSE CONCAT(TIMESTAMPDIFF(DAY, published_at, NOW()), ' 天前')
        END
      `;

      const reliableSupplySql = `
        (
          opo.opportunity_type <> 'SUPPLY'
          OR opo.source_site = 'manual'
          OR (
            JSON_UNQUOTE(JSON_EXTRACT(opo.detail_json, '$.extractionPolicy')) = 'STRICT_DETAIL_PAGE_LABELS_ONLY'
            AND JSON_UNQUOTE(JSON_EXTRACT(opo.detail_json, '$.responseHash')) IS NOT NULL
          )
        )
      `;
      const displayableCollectedSql = `
        audit_scope.isGuangdong = 1
        AND audit_scope.missingCity = 0
        AND audit_scope.missingSourceUrl = 0
        AND audit_scope.missingPublishedAt = 0
        AND audit_scope.suspiciousPublishedAt = 0
        AND audit_scope.missingSupplyLocation = 0
        AND audit_scope.missingHashOrDetailEvidence = 0
        AND opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
      `;

      const buildScopeQuery = (listScope: PublicOpportunityListScope) => {
        if (listScope === 'strict') {
          return {
            clauses: [
              buildStrictEffectiveOpportunityWhereSql('opo'),
              reliableSupplySql,
            ],
            fromSql: 'FROM investment_public_opportunity opo',
            params: buildStrictEffectiveOpportunityWhereParams(),
          };
        }

        return {
          clauses: [displayableCollectedSql],
          fromSql: `
            FROM investment_public_opportunity opo
            INNER JOIN (
              ${buildAuditScopeSql()}
            ) audit_scope ON audit_scope.opportunityId = opo.opportunity_id
          `,
          params: buildAuditScopeParams(),
        };
      };

      const appendQueryFilters = (clauses: string[], params: any[]) => {
        if (city) {
          clauses.push('opo.city LIKE ?');
          params.push(`%${city}%`);
        }
        if (sourceSite) {
          clauses.push('opo.source_site = ?');
          params.push(sourceSite);
        }
        if (publishedAgeLabel) {
          if (Number.isFinite(publishedAgeValue)) {
            if (/小时|hour/i.test(publishedAgeLabel)) {
              clauses.push(
                `opo.published_at IS NOT NULL
                  AND TIMESTAMPDIFF(HOUR, opo.published_at, NOW()) = ?
                  AND TIMESTAMPDIFF(HOUR, opo.published_at, NOW()) < 24`,
              );
              params.push(publishedAgeValue);
            } else {
              clauses.push(
                `opo.published_at IS NOT NULL
                  AND TIMESTAMPDIFF(DAY, opo.published_at, NOW()) = ?
                  AND TIMESTAMPDIFF(HOUR, opo.published_at, NOW()) >= 24`,
              );
              params.push(publishedAgeValue);
            }
          } else {
            clauses.push(`${publishedAgeLabelSql} = ?`);
            params.push(publishedAgeLabel);
          }
        }
        if (opportunityType) {
          clauses.push('opo.opportunity_type = ?');
          params.push(opportunityType);
        }
        if (keyword) {
          clauses.push(
            '(opo.title LIKE ? OR opo.contact_name LIKE ? OR opo.phone_number LIKE ? OR opo.source_url LIKE ?)',
          );
          const likeKeyword = `%${keyword}%`;
          params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
        }
      };

      const scopedQuery = buildScopeQuery(scope);
      appendQueryFilters(scopedQuery.clauses, scopedQuery.params);

      const strictQuery = buildScopeQuery('strict');
      appendQueryFilters(strictQuery.clauses, strictQuery.params);

      const buildDedupedSql = (queryScope: {
        clauses: string[];
        fromSql: string;
        params: any[];
      }) => `
        SELECT *
        FROM (
          SELECT
            opo.*,
            ROW_NUMBER() OVER (
              PARTITION BY opo.opportunity_type, COALESCE(NULLIF(opo.source_url, ''), CONCAT('id:', opo.opportunity_id))
              ORDER BY opo.last_synced_at DESC, opo.opportunity_id DESC
            ) AS dedupe_rank
          ${queryScope.fromSql}
          WHERE ${queryScope.clauses.join(' AND ')}
        ) deduped
        WHERE dedupe_rank = 1
      `;

      const dedupedSql = buildDedupedSql(scopedQuery);
      const strictDedupedSql = buildDedupedSql(strictQuery);
      const offset = (currentPage - 1) * pageSize;

      const [
        countRows,
        strictCountRows,
        rows,
        sourceSiteOptionRows,
        publishedAgeOptionRows,
      ] = await Promise.all([
        prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
          `
              SELECT COUNT(*) AS total
              FROM (${dedupedSql}) count_scope
            `,
          ...scopedQuery.params,
        ),
        prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
          `
              SELECT COUNT(*) AS total
              FROM (${strictDedupedSql}) count_scope
            `,
          ...strictQuery.params,
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
              ORDER BY
                CASE WHEN published_at IS NULL THEN 1 ELSE 0 END ASC,
                published_at DESC,
                last_synced_at DESC,
                opportunity_id DESC
              LIMIT ? OFFSET ?
            `,
          ...scopedQuery.params,
          pageSize,
          offset,
        ),
        prismaClient.$queryRawUnsafe<Array<{ value?: null | string }>>(
          `
              SELECT DISTINCT source_site AS value
              FROM (${dedupedSql}) source_scope
              WHERE source_site IS NOT NULL
                AND source_site <> ''
              ORDER BY source_site ASC
              LIMIT 100
            `,
          ...scopedQuery.params,
        ),
        prismaClient.$queryRawUnsafe<
          Array<{ sortValue: bigint | number; value?: null | string }>
        >(
          `
              SELECT
                ${publishedAgeLabelScopeSql} AS value,
                MIN(TIMESTAMPDIFF(HOUR, published_at, NOW())) AS sortValue
              FROM (${dedupedSql}) age_scope
              WHERE published_at IS NOT NULL
              GROUP BY value
              HAVING value IS NOT NULL AND value <> ''
              ORDER BY sortValue ASC
              LIMIT 100
            `,
          ...scopedQuery.params,
        ),
      ]);

      const total = Number(countRows[0]?.total || 0);
      const strictTotal = Number(strictCountRows[0]?.total || 0);

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
        scope,
        strictTotal,
        total,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get effective public opportunity list failed:', error);
    return serverErrorResponse('获取公开机会列表失败', event);
  }
});
