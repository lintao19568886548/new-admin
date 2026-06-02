import { prismaClient } from '~/utils/db';
import { ensureCrawlerSourceCatalog } from '~/utils/investment-radar/crawler-source-repository';
import {
  getPublicOpportunityProgressSourceCodes,
  normalizePublicOpportunityProgressType,
} from '~/utils/investment-radar/public-opportunity-progress-policy';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
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
    const opportunityType = normalizePublicOpportunityProgressType(
      query.opportunityType,
    );
    const sourceCodes =
      getPublicOpportunityProgressSourceCodes(opportunityType);

    const result = await runWithRadarSharedScope(async () => {
      await ensureCrawlerSourceCatalog();

      const sourceCodePlaceholders = sourceCodes.map(() => '?').join(', ');
      const [sourceRows, taskRows, itemRows] = await Promise.all([
        prismaClient.$queryRawUnsafe<
          Array<{
            enabled: bigint | number;
            lastCrawledAt?: Date | null | string;
            sourceCode: string;
            sourceId: bigint | number;
            sourceName: string;
          }>
        >(
          `
            SELECT
              source_id AS sourceId,
              source_code AS sourceCode,
              source_name AS sourceName,
              enabled,
              last_crawled_at AS lastCrawledAt
            FROM crawler_source
            WHERE source_code IN (${sourceCodePlaceholders})
              AND enabled = 1
            ORDER BY source_id ASC
          `,
          ...sourceCodes,
        ),
        prismaClient.$queryRawUnsafe<
          Array<{
            createdLeadCount: bigint | number;
            errorMessage?: null | string;
            fetchedCount: bigint | number;
            finishedAt?: Date | null | string;
            skippedCount: bigint | number;
            sourceCode: string;
            startedAt?: Date | null | string;
            status: string;
            taskId: bigint | number;
            updatedLeadCount: bigint | number;
          }>
        >(
          `
            SELECT *
            FROM (
              SELECT
                s.source_code AS sourceCode,
                t.task_id AS taskId,
                t.status,
                t.started_at AS startedAt,
                t.finished_at AS finishedAt,
                t.fetched_count AS fetchedCount,
                t.created_lead_count AS createdLeadCount,
                t.updated_lead_count AS updatedLeadCount,
                t.skipped_count AS skippedCount,
                t.error_message AS errorMessage,
                ROW_NUMBER() OVER (
                  PARTITION BY t.source_id
                  ORDER BY t.create_time DESC, t.task_id DESC
                ) AS task_rank
              FROM crawler_task t
              INNER JOIN crawler_source s ON s.source_id = t.source_id
              WHERE s.source_code IN (${sourceCodePlaceholders})
            ) latest_task
            WHERE task_rank = 1
          `,
          ...sourceCodes,
        ),
        prismaClient.$queryRawUnsafe<
          Array<{
            count: bigint | number;
            sourceCode: string;
            status: string;
          }>
        >(
          `
            SELECT
              s.source_code AS sourceCode,
              i.status,
              COUNT(*) AS count
            FROM crawler_task_item i
            INNER JOIN crawler_source s ON s.source_id = i.source_id
            WHERE s.source_code IN (${sourceCodePlaceholders})
            GROUP BY s.source_code, i.status
          `,
          ...sourceCodes,
        ),
      ]);

      const taskBySourceCode = new Map(
        taskRows.map((row) => [row.sourceCode, row]),
      );
      const itemStatusBySourceCode = new Map<string, Record<string, number>>();
      for (const row of itemRows) {
        const bucket = itemStatusBySourceCode.get(row.sourceCode) || {};
        bucket[row.status || 'UNKNOWN'] = Number(row.count || 0);
        itemStatusBySourceCode.set(row.sourceCode, bucket);
      }

      const sources = sourceRows.map((row) => {
        const latestTask = taskBySourceCode.get(row.sourceCode);
        return {
          itemStatus: itemStatusBySourceCode.get(row.sourceCode) || {},
          latestTask: latestTask
            ? {
                createdLeadCount: Number(latestTask.createdLeadCount || 0),
                errorMessage: latestTask.errorMessage || null,
                fetchedCount: Number(latestTask.fetchedCount || 0),
                finishedAt: latestTask.finishedAt || null,
                skippedCount: Number(latestTask.skippedCount || 0),
                startedAt: latestTask.startedAt || null,
                status: latestTask.status,
                taskId: Number(latestTask.taskId),
                updatedLeadCount: Number(latestTask.updatedLeadCount || 0),
              }
            : null,
          sourceCode: row.sourceCode,
          sourceId: Number(row.sourceId),
          sourceName: row.sourceName,
        };
      });

      return {
        note: 'crawler_progress_only_not_effective_counts',
        opportunityType: opportunityType || null,
        sourceCount: sources.length,
        sources,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get effective public opportunity progress failed:', error);
    return serverErrorResponse('获取公开采集过程进度失败', event);
  }
});
