import type {
  AuditCountRow,
  AuditPreviewRow,
  AuditTypeCountRow,
  PublicOpportunityAuditCounts,
  PublicOpportunityAuditPreviewItem,
  PublicOpportunityAuditTypeCounts,
} from './public-opportunity-audit-rules';

import { prismaClient, prismaScopeStorage } from '~/utils/db';

import { ensureCrawlerSourceCatalog } from './crawler-source-repository';
import {
  AUDIT_PREVIEW_LIMIT,
  buildAuditScopeParams,
  buildAuditScopeSql,
  buildPublishedObservedAtSql,
  CREATED_PUBLISHED_TOLERANCE_DAYS,
  createEmptyTypeCounts,
  EARLIEST_REASONABLE_PUBLISHED_AT,
  FUTURE_PUBLISHED_TOLERANCE_DAYS,
  normalizeCounts,
  normalizePreviewItem,
  normalizeTypeCounts,
  toCount,
  TRACEABLE_SOURCE_URL_PATTERN,
} from './public-opportunity-audit-rules';
import { buildMaterializedDashboardEffectiveSql } from './public-opportunity-dashboard-policy';
import {
  buildStrictMaterializedEffectiveOpportunityWhereParams,
  buildStrictMaterializedEffectiveOpportunityWhereSql,
} from './public-opportunity-effective-list-policy';

export type {
  PublicOpportunityAuditCounts,
  PublicOpportunityAuditPreviewItem,
  PublicOpportunityAuditTypeCounts,
};

const TARGET_LISTING_COUNT = 3000;
const TARGET_DEMAND_COUNT = 3000;
const AUDIT_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

type DashboardCountRow = {
  demandCount?: bigint | number | string;
  listingCount?: bigint | number | string;
  todayCount?: bigint | number | string;
  totalCount?: bigint | number | string;
};

type DashboardPlatformRow = {
  demandCount?: bigint | number | string;
  listingCount?: bigint | number | string;
  platformCode?: null | string;
  platformName?: null | string;
  sourceCode?: null | string;
  totalCount?: bigint | number | string;
};

type DashboardCityRow = {
  cityName?: null | string;
  demandCount?: bigint | number | string;
  listingCount?: bigint | number | string;
  totalCount?: bigint | number | string;
};

type DashboardRuntimeRow = {
  createdLeadCount?: bigint | number | string;
  createTime?: Date | null | string;
  fetchedCount?: bigint | number | string;
  finishedAt?: Date | null | string;
  sourceCode?: null | string;
  sourceName?: null | string;
  status?: null | string;
  taskId?: bigint | null | number | string;
  updatedLeadCount?: bigint | number | string;
};

type DashboardRuntimeItem = {
  fetchedCount: number;
  latestTaskStatus: null | string;
  sourceCode: string;
  sourceName: string;
  updatedCount: number;
  upsertedCount: number;
};

export type PublicOpportunityAuditSummaryResult = {
  auditMode: 'DRY_RUN';
  dashboard: Awaited<ReturnType<typeof getPublicOpportunityDashboard>>;
  dryRun: true;
  generatedAt: string;
  summary: PublicOpportunityAuditCounts;
  typeStats: Record<string, PublicOpportunityAuditTypeCounts>;
};

const auditSummaryCache = new Map<
  string,
  {
    expiresAt: number;
    result: PublicOpportunityAuditSummaryResult;
  }
>();
const auditSummaryInFlight = new Map<
  string,
  Promise<PublicOpportunityAuditSummaryResult>
>();

function getAuditSummaryCacheKey() {
  const scope = prismaScopeStorage.getStore();
  return `${scope?.customerId || 'default'}:${scope?.dbName || ''}`;
}

export function clearPublicOpportunityAuditSummaryCache() {
  auditSummaryCache.clear();
  auditSummaryInFlight.clear();
}

function normalizeDate(value: unknown) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function getPercent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Number(((value / total) * 100).toFixed(1));
}

function getTargetProgressPercent(value: number, target: number) {
  if (target <= 0) {
    return 0;
  }
  return Number(Math.min(100, (value / target) * 100).toFixed(1));
}

function withDistributionPercent<T extends { totalCount: number }>(items: T[]) {
  const total = items.reduce((sum, item) => sum + item.totalCount, 0);
  return items
    .map((item) => ({
      ...item,
      percent: getPercent(item.totalCount, total),
    }))
    .sort((left, right) => right.totalCount - left.totalCount);
}

function buildMaterializedAuditCountSelectSql(strictWhereSql: string) {
  const observedAtSql = buildPublishedObservedAtSql('opo');

  return `
    COUNT(*) AS totalCount,
    SUM(CASE WHEN ${strictWhereSql} THEN 1 ELSE 0 END) AS guangdongValidCount,
    SUM(CASE WHEN COALESCE(opo.is_guangdong, 0) = 0 THEN 1 ELSE 0 END) AS nonGuangdongCount,
    SUM(CASE
      WHEN opo.source_url IS NULL
        OR TRIM(opo.source_url) = ''
        OR LOWER(TRIM(opo.source_url)) NOT REGEXP ?
      THEN 1 ELSE 0
    END) AS missingSourceUrlCount,
    SUM(CASE
      WHEN opo.city IS NULL
        OR TRIM(opo.city) = ''
        OR (
          opo.opportunity_type = 'SUPPLY'
          AND (
            opo.district IS NULL
            OR TRIM(opo.district) = ''
          )
        )
      THEN 1 ELSE 0
    END) AS missingSupplyLocationCount,
    SUM(CASE WHEN opo.published_at IS NULL THEN 1 ELSE 0 END) AS missingPublishedAtCount,
    SUM(CASE
      WHEN opo.published_at IS NOT NULL
        AND (
          opo.published_at > DATE_ADD(NOW(3), INTERVAL ? DAY)
          OR opo.published_at < ?
          OR (
            ${observedAtSql} IS NOT NULL
            AND opo.published_at > DATE_ADD(${observedAtSql}, INTERVAL ? DAY)
          )
        )
      THEN 1 ELSE 0
    END) AS suspiciousPublishedAtCount,
    SUM(CASE WHEN COALESCE(opo.has_detail_evidence, 0) = 0 THEN 1 ELSE 0 END) AS missingHashOrDetailEvidenceCount,
    SUM(CASE
      WHEN opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
        AND NOT (${strictWhereSql})
      THEN 1 ELSE 0
    END) AS proposedDowngradeCount,
    SUM(CASE
      WHEN opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
        AND COALESCE(opo.is_guangdong, 0) = 0
      THEN 1 ELSE 0
    END) AS outOfScopeCount,
    SUM(CASE
      WHEN opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
        AND (
          opo.source_url IS NULL
          OR TRIM(opo.source_url) = ''
          OR LOWER(TRIM(opo.source_url)) NOT REGEXP ?
        )
      THEN 1 ELSE 0
    END) AS sourceLostCount,
    SUM(CASE
      WHEN opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
        AND (
          opo.published_at IS NULL
          OR (
            opo.published_at > DATE_ADD(NOW(3), INTERVAL ? DAY)
            OR opo.published_at < ?
            OR (
              ${observedAtSql} IS NOT NULL
              AND opo.published_at > DATE_ADD(${observedAtSql}, INTERVAL ? DAY)
            )
          )
        )
      THEN 1 ELSE 0
    END) AS unknownTimeCount,
    SUM(CASE
      WHEN opo.opportunity_status IN ('EFFECTIVE', 'VERIFIED')
        AND (
          opo.city IS NULL
          OR TRIM(opo.city) = ''
          OR COALESCE(opo.has_detail_evidence, 0) = 0
          OR (
            opo.opportunity_type = 'SUPPLY'
            AND (
              opo.district IS NULL
              OR TRIM(opo.district) = ''
            )
          )
        )
      THEN 1 ELSE 0
    END) AS invalidCount
  `;
}

function buildMaterializedAuditCountParams() {
  const strictParams = buildStrictMaterializedEffectiveOpportunityWhereParams();
  const suspiciousParams = [
    FUTURE_PUBLISHED_TOLERANCE_DAYS,
    EARLIEST_REASONABLE_PUBLISHED_AT,
    CREATED_PUBLISHED_TOLERANCE_DAYS,
  ];

  return [
    ...strictParams,
    TRACEABLE_SOURCE_URL_PATTERN,
    ...suspiciousParams,
    ...strictParams,
    TRACEABLE_SOURCE_URL_PATTERN,
    ...suspiciousParams,
  ];
}

function buildMaterializedAuditCountSql(options: { groupByType?: boolean }) {
  const strictWhereSql =
    buildStrictMaterializedEffectiveOpportunityWhereSql('opo');
  const selectSql = buildMaterializedAuditCountSelectSql(strictWhereSql);

  if (options.groupByType) {
    return `
      SELECT
        opo.opportunity_type AS opportunityType,
        ${selectSql}
      FROM investment_public_opportunity opo
      GROUP BY opo.opportunity_type
      ORDER BY opo.opportunity_type ASC
    `;
  }

  return `
    SELECT
      ${selectSql}
    FROM investment_public_opportunity opo
  `;
}

async function getDashboardRuntimeRows() {
  await ensureCrawlerSourceCatalog();

  return prismaClient.$queryRawUnsafe<DashboardRuntimeRow[]>(`
    SELECT
      cs.source_code AS sourceCode,
      cs.source_name AS sourceName,
      latest.task_id AS taskId,
      latest.status AS status,
      latest.fetched_count AS fetchedCount,
      latest.created_lead_count AS createdLeadCount,
      latest.updated_lead_count AS updatedLeadCount,
      latest.finished_at AS finishedAt,
      latest.create_time AS createTime
    FROM crawler_source cs
    LEFT JOIN (
      SELECT *
      FROM (
        SELECT
          ct.*,
          ROW_NUMBER() OVER (
            PARTITION BY ct.source_id
            ORDER BY ct.create_time DESC, ct.task_id DESC
          ) AS taskRank
        FROM crawler_task ct
        WHERE ct.task_type IN (
          'PUBLIC_OPPORTUNITY_DISCOVER',
          'PUBLIC_OPPORTUNITY_URL_BATCH',
          'PUBLIC_FACTORY_LISTING_URL_BATCH'
        )
      ) ranked_task
      WHERE taskRank = 1
    ) latest ON latest.source_id = cs.source_id
    WHERE cs.source_type = 'PUBLIC_OPPORTUNITY'
      AND cs.enabled = 1
    ORDER BY cs.source_id ASC
  `);
}

function normalizeRuntimeRows(rows: DashboardRuntimeRow[]) {
  const items = rows.map((row): DashboardRuntimeItem => {
    const createdLeadCount = toCount(row.createdLeadCount);
    const updatedLeadCount = toCount(row.updatedLeadCount);
    return {
      fetchedCount: toCount(row.fetchedCount),
      latestTaskStatus: row.status || null,
      sourceCode: String(row.sourceCode || '').trim(),
      sourceName: String(row.sourceName || row.sourceCode || '').trim(),
      updatedCount: updatedLeadCount,
      upsertedCount: createdLeadCount + updatedLeadCount,
    };
  });
  const latestTaskTime = rows
    .map((row) => normalizeDate(row.finishedAt || row.createTime))
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = new Date(left as string).getTime();
      const rightTime = new Date(right as string).getTime();
      return rightTime - leftTime;
    })[0] as string | undefined;

  return {
    items,
    latestTaskTime: latestTaskTime || null,
  };
}

async function getPublicOpportunityDashboard() {
  const effectiveSql = buildMaterializedDashboardEffectiveSql();
  const effectiveSqlParams =
    buildStrictMaterializedEffectiveOpportunityWhereParams();

  const [countRows, platformRows, cityRows, runtimeRows] = await Promise.all([
    prismaClient.$queryRawUnsafe<DashboardCountRow[]>(
      `
        SELECT
          COUNT(*) AS totalCount,
          SUM(CASE WHEN opportunity_type = 'SUPPLY' THEN 1 ELSE 0 END) AS listingCount,
          SUM(CASE WHEN opportunity_type = 'DEMAND' THEN 1 ELSE 0 END) AS demandCount,
          SUM(CASE WHEN DATE(last_synced_at) = CURDATE() THEN 1 ELSE 0 END) AS todayCount
        FROM (${effectiveSql}) effective_scope
      `,
      ...effectiveSqlParams,
    ),
    prismaClient.$queryRawUnsafe<DashboardPlatformRow[]>(
      `
        SELECT
          COALESCE(NULLIF(effective_scope.sourceCode, ''), effective_scope.source_site, effective_scope.source_table, 'UNKNOWN') AS platformCode,
          COALESCE(cs.source_name, effective_scope.source_site, effective_scope.source_table, effective_scope.sourceCode, '未知来源') AS platformName,
          effective_scope.sourceCode AS sourceCode,
          COUNT(*) AS totalCount,
          SUM(CASE WHEN effective_scope.opportunity_type = 'SUPPLY' THEN 1 ELSE 0 END) AS listingCount,
          SUM(CASE WHEN effective_scope.opportunity_type = 'DEMAND' THEN 1 ELSE 0 END) AS demandCount
        FROM (${effectiveSql}) effective_scope
        LEFT JOIN crawler_source cs ON cs.source_code = effective_scope.sourceCode
        GROUP BY platformCode, platformName, sourceCode
        ORDER BY totalCount DESC, platformName ASC
        LIMIT 50
      `,
      ...effectiveSqlParams,
    ),
    prismaClient.$queryRawUnsafe<DashboardCityRow[]>(
      `
        SELECT
          COALESCE(NULLIF(city, ''), '未识别城市') AS cityName,
          COUNT(*) AS totalCount,
          SUM(CASE WHEN opportunity_type = 'SUPPLY' THEN 1 ELSE 0 END) AS listingCount,
          SUM(CASE WHEN opportunity_type = 'DEMAND' THEN 1 ELSE 0 END) AS demandCount
        FROM (${effectiveSql}) effective_scope
        GROUP BY cityName
        ORDER BY totalCount DESC, cityName ASC
        LIMIT 30
      `,
      ...effectiveSqlParams,
    ),
    getDashboardRuntimeRows(),
  ]);

  const counts = countRows[0] || {};
  const listingCount = toCount(counts.listingCount);
  const demandCount = toCount(counts.demandCount);
  const totalCount = toCount(counts.totalCount);
  const runtime = normalizeRuntimeRows(runtimeRows);
  const runtimeBySourceCode = new Map(
    runtime.items.map((item) => [item.sourceCode, item]),
  );
  const runtimePlatformCount = runtime.items.length;
  const platformFetchedCount = runtime.items.reduce(
    (sum, item) => sum + item.fetchedCount,
    0,
  );
  const platformSuccessCount = runtime.items.filter(
    (item) => item.latestTaskStatus === 'SUCCESS',
  ).length;
  const failedPlatformCount = runtime.items.filter((item) =>
    ['CANCELED', 'FAILED'].includes(String(item.latestTaskStatus || '')),
  ).length;
  const zeroFetchedPlatformCount = runtime.items.filter(
    (item) => item.latestTaskStatus === 'SUCCESS' && item.fetchedCount <= 0,
  ).length;

  const platformGroups = new Map<
    string,
    {
      demandCount: number;
      fetchedCount: number;
      hiddenCount: number;
      latestTaskStatus: null | string;
      listingCount: number;
      platformCode: string;
      platformName: string;
      sourceCode: null | string;
      totalCount: number;
      updatedCount: number;
      upsertedCount: number;
      zeroFetched: boolean;
    }
  >();

  for (const row of platformRows) {
    const sourceCode = String(row.sourceCode || '').trim() || null;
    const platformCode = String(row.platformCode || sourceCode || 'UNKNOWN');
    const runtimeItem = sourceCode ? runtimeBySourceCode.get(sourceCode) : null;
    platformGroups.set(platformCode, {
      demandCount: toCount(row.demandCount),
      fetchedCount: runtimeItem?.fetchedCount || 0,
      hiddenCount: 0,
      latestTaskStatus: runtimeItem?.latestTaskStatus || null,
      listingCount: toCount(row.listingCount),
      platformCode,
      platformName:
        runtimeItem?.sourceName ||
        String(row.platformName || row.platformCode || '未知来源'),
      sourceCode,
      totalCount: toCount(row.totalCount),
      updatedCount: runtimeItem?.updatedCount || 0,
      upsertedCount: runtimeItem?.upsertedCount || 0,
      zeroFetched: Boolean(
        runtimeItem?.latestTaskStatus === 'SUCCESS' &&
        runtimeItem.fetchedCount <= 0,
      ),
    });
  }

  for (const item of runtime.items) {
    if (!item.sourceCode || platformGroups.has(item.sourceCode)) {
      continue;
    }
    platformGroups.set(item.sourceCode, {
      demandCount: 0,
      fetchedCount: item.fetchedCount,
      hiddenCount: 0,
      latestTaskStatus: item.latestTaskStatus,
      listingCount: 0,
      platformCode: item.sourceCode,
      platformName: item.sourceName || item.sourceCode,
      sourceCode: item.sourceCode,
      totalCount: 0,
      updatedCount: item.updatedCount,
      upsertedCount: item.upsertedCount,
      zeroFetched: Boolean(
        item.latestTaskStatus === 'SUCCESS' && item.fetchedCount <= 0,
      ),
    });
  }

  return {
    cityDistribution: withDistributionPercent(
      cityRows.map((row) => {
        const rowTotal = toCount(row.totalCount);
        return {
          cityName: String(row.cityName || '未识别城市'),
          demandCount: toCount(row.demandCount),
          effectiveCount: rowTotal,
          listingCount: toCount(row.listingCount),
          pendingVerifyCount: 0,
          totalCount: rowTotal,
        };
      }),
    ),
    platformDistribution: withDistributionPercent([...platformGroups.values()]),
    summary: {
      demandEffectiveRate: getTargetProgressPercent(
        demandCount,
        TARGET_DEMAND_COUNT,
      ),
      failedPlatformCount,
      fetchSuccessRate: getPercent(platformSuccessCount, runtimePlatformCount),
      guangdongDemandEffectiveCount: demandCount,
      guangdongListingEffectiveCount: listingCount,
      lastCrawledAt: runtime.latestTaskTime,
      nonGuangdongHiddenCount: 0,
      nonGuangdongHiddenRate: 0,
      pendingVerifyCount: 0,
      pendingVerifyOverdueCount: 0,
      platformCount: Math.max(platformRows.length, runtimePlatformCount),
      platformFetchedCount,
      platformSuccessCount,
      todayFetchedChange: null,
      todayFetchedCount: toCount(counts.todayCount),
      totalEffectiveCount: totalCount,
      zeroFetchedPlatformCount,
      listingEffectiveRate: getTargetProgressPercent(
        listingCount,
        TARGET_LISTING_COUNT,
      ),
    },
  };
}

async function buildPublicOpportunityAuditSummary(): Promise<PublicOpportunityAuditSummaryResult> {
  const materializedAuditCountParams = buildMaterializedAuditCountParams();

  const [summaryRows, typeRows, dashboard] = await Promise.all([
    prismaClient.$queryRawUnsafe<AuditCountRow[]>(
      buildMaterializedAuditCountSql({ groupByType: false }),
      ...materializedAuditCountParams,
    ),
    prismaClient.$queryRawUnsafe<AuditTypeCountRow[]>(
      buildMaterializedAuditCountSql({ groupByType: true }),
      ...materializedAuditCountParams,
    ),
    getPublicOpportunityDashboard(),
  ]);

  const typeStats: Record<string, PublicOpportunityAuditTypeCounts> = {
    DEMAND: createEmptyTypeCounts('DEMAND'),
    SUPPLY: createEmptyTypeCounts('SUPPLY'),
  };

  for (const row of typeRows) {
    const normalized = normalizeTypeCounts(row);
    typeStats[normalized.opportunityType] = normalized;
  }

  const summary = normalizeCounts(summaryRows[0] || {});
  dashboard.summary.nonGuangdongHiddenCount = summary.nonGuangdongCount;
  dashboard.summary.nonGuangdongHiddenRate = getPercent(
    summary.nonGuangdongCount,
    summary.totalCount,
  );
  dashboard.summary.pendingVerifyCount = summary.proposedDowngradeCount;
  dashboard.summary.pendingVerifyOverdueCount =
    summary.suspiciousPublishedAtCount;

  return {
    auditMode: 'DRY_RUN',
    dashboard,
    dryRun: true,
    generatedAt: new Date().toISOString(),
    summary,
    typeStats,
  };
}

export async function getPublicOpportunityAuditSummary(
  options: { refresh?: boolean } = {},
) {
  const cacheKey = getAuditSummaryCacheKey();
  const now = Date.now();
  if (!options.refresh) {
    const cached = auditSummaryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const pending = auditSummaryInFlight.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const pending = buildPublicOpportunityAuditSummary()
    .then((result) => {
      auditSummaryCache.set(cacheKey, {
        expiresAt: Date.now() + AUDIT_SUMMARY_CACHE_TTL_MS,
        result,
      });
      return result;
    })
    .finally(() => {
      auditSummaryInFlight.delete(cacheKey);
    });
  auditSummaryInFlight.set(cacheKey, pending);
  return pending;
}

export async function getPublicOpportunityAuditPreview() {
  const auditScopeSql = buildAuditScopeSql();
  const auditScopeParams = buildAuditScopeParams();
  const issueWhereSql = `
    proposedDowngradeStatus IS NOT NULL
  `;
  const [totalRows, rows] = await Promise.all([
    prismaClient.$queryRawUnsafe<AuditCountRow[]>(
      `
        SELECT COUNT(*) AS totalCount
        FROM (${auditScopeSql}) audit_scope
        WHERE ${issueWhereSql}
      `,
      ...auditScopeParams,
    ),
    prismaClient.$queryRawUnsafe<AuditPreviewRow[]>(
      `
        SELECT
          opportunityId,
          opportunityType,
          sourceSite,
          sourceUrl,
          sourceKey,
          sourceTable,
          sourceId,
          title,
          city,
          district,
          areaText,
          publishedAt,
          publishedDateText,
          opportunityStatus,
          score,
          descriptionPreview,
          detailJsonPreview,
          lastSyncedAt,
          createTime,
          updateTime,
          isGuangdong,
          isEffective,
          missingSourceUrl,
          missingSupplyLocation,
          missingPublishedAt,
          suspiciousPublishedAt,
          missingHashOrDetailEvidence,
          proposedDowngradeStatus
        FROM (${auditScopeSql}) audit_scope
        WHERE ${issueWhereSql}
        ORDER BY
          (
            (CASE WHEN isGuangdong = 0 THEN 16 ELSE 0 END)
            + (missingSourceUrl * 8)
            + (missingSupplyLocation * 6)
            + (missingPublishedAt * 4)
            + (suspiciousPublishedAt * 2)
            + missingHashOrDetailEvidence
          ) DESC,
          opportunityId ASC
        LIMIT ?
      `,
      ...auditScopeParams,
      AUDIT_PREVIEW_LIMIT,
    ),
  ]);

  return {
    auditMode: 'DRY_RUN',
    dryRun: true,
    generatedAt: new Date().toISOString(),
    items: rows.map((row) => normalizePreviewItem(row)),
    limit: AUDIT_PREVIEW_LIMIT,
    totalPreviewCount: normalizeCounts(totalRows[0] || {}).totalCount,
  };
}
