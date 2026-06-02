import { prismaClient } from '~/utils/db';
import { ensurePublicOpportunityStorage } from '~/utils/investment-radar/public-opportunity-repository';
import { serializePublicOpportunityRow } from '~/utils/investment-radar/public-opportunity-serializer';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const opportunityId = Number(event.context.params?.id);
  if (!Number.isFinite(opportunityId) || opportunityId <= 0) {
    return badRequestResponse('opportunityId 无效', event);
  }

  try {
    const rows = await runWithRadarSharedScope(async () => {
      await ensurePublicOpportunityStorage();

      return prismaClient.$queryRawUnsafe<any[]>(
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
            source_code AS sourceCode,
            is_guangdong AS isGuangdong,
            has_detail_evidence AS hasDetailEvidence,
            quality_grade AS qualityGrade,
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
          FROM investment_public_opportunity
          WHERE opportunity_id = ?
          LIMIT 1
        `,
        opportunityId,
      );
    });

    const item = rows[0] || null;
    if (!item) {
      return badRequestResponse('公开机会不存在', event, 404);
    }

    return useResponseSuccess(serializePublicOpportunityRow(item));
  } catch (error) {
    console.error('get public opportunity detail failed:', error);
    return serverErrorResponse('获取公开机会详情失败', event);
  }
});
