import type {
  CrawlerTask,
  PublicOpportunityCrawlerRunOptions,
} from './crawler-types';

import { prismaClient } from '~/utils/db';

import { listPublicOpportunityCrawlerSources } from './crawler-source-repository';
import {
  CrawlerTaskValidationError,
  listCrawlerTaskLogs,
} from './crawler-task-repository';
import {
  PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
  PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES,
} from './crawler-types';
import { getPublicCrawlerAdapter } from './public-crawler-adapters';
import {
  buildAuditScopeParams,
  buildAuditScopeSql,
} from './public-opportunity-audit-rules';
import {
  buildPublicOpportunityBatchTotals,
  isEffectiveBatchPayload,
} from './public-opportunity-batch-policy';
import { buildDisplayableCollectedOpportunityWhereSql } from './public-opportunity-effective-list-policy';
import { ensurePublicOpportunityStorage } from './public-opportunity-repository';
import { runPublicOpportunityUrlCrawlerTask } from './public-opportunity-url-crawler';

export type PublicOpportunityBatchRunMode = 'ALL' | 'DEMAND' | 'SUPPLY';

export interface PublicOpportunityBatchRunOptions extends Omit<
  PublicOpportunityCrawlerRunOptions,
  'sourceCode'
> {
  continueOnError?: boolean;
  maxConcurrency?: number;
  maxRounds?: number;
  mode?: null | string;
  targetCount?: number;
}

export interface PublicOpportunityBatchPlatformResult {
  collectedEffectiveCount: number;
  discoveredUrlCount: number;
  effectiveCount: number;
  errorMessage?: null | string;
  failedReasonTop5: Array<{ count: number; reason: string }>;
  fetchedCount: number;
  fetchSuccessCount: number;
  opportunityType: 'DEMAND' | 'SUPPLY';
  roundIndex?: number;
  skippedCount: number;
  sourceCode: string;
  sourceName?: null | string;
  status: 'FAILED' | 'SUCCESS';
  taskId?: null | number;
  upsertedCount: number;
  yieldedEffective: boolean;
  zeroOutput: boolean;
}

export interface PublicOpportunityBatchRunResult {
  finishedAt: string;
  items: PublicOpportunityBatchPlatformResult[];
  maxRounds?: number;
  mode: PublicOpportunityBatchRunMode;
  remainingCount?: number;
  roundCount?: number;
  sourceCodes: string[];
  startedAt: string;
  targetCount?: null | number;
  targetReached?: boolean;
  total: {
    collectedEffectiveCount: number;
    discoveredUrlCount: number;
    effectiveCount: number;
    failedPlatformCount: number;
    fetchedCount: number;
    fetchSuccessCount: number;
    hasEffectiveOutput: boolean;
    hasUsefulOutput: boolean;
    onlyZeroOutput: boolean;
    platformCount: number;
    productivePlatformCount: number;
    skippedCount: number;
    successPlatformCount: number;
    taskCount: number;
    upsertedCount: number;
    zeroOutputPlatformCount: number;
  };
}

interface TaskItemMetricRow {
  lastError?: null | string;
  parsedPayloadJson?: unknown;
  skipReason?: null | string;
  status?: null | string;
}

interface CollectedEffectiveCountRow {
  sourceCode?: null | string;
  total?: bigint | number | string;
}

const SOURCE_SITE_FALLBACKS: Array<{
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceCode: string;
  sourceSite: string;
}> = [
  {
    opportunityType: 'DEMAND',
    sourceCode: 'PUBLIC_DEMAND_99CFW_GD',
    sourceSite: '99cfw',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: PUBLIC_FACTORY_LISTING_CRAWLER_SOURCE_CODE,
    sourceSite: 'cfzsw68.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_99CFW_GD',
    sourceSite: '99cfw',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_FANG_GD',
    sourceSite: 'fang.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_SZAQFDC_DG',
    sourceSite: 'szaqfdc.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_TOODC_GD',
    sourceSite: 'toodc.cn',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_TZGD_GD',
    sourceSite: 'digitalgd.com.cn',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_TTCHANGFANG_GD',
    sourceSite: 'ttchangfang.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_GDCFZS_GD',
    sourceSite: 'gdcfzs.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_SZCFW_GD',
    sourceSite: 'szcfw.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_SZKKW_GD',
    sourceSite: 'szkkw.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_HFDPT_GD',
    sourceSite: 'hfdpt.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_CHANGFANG88_GD',
    sourceSite: 'changfang88.com',
  },
  {
    opportunityType: 'SUPPLY',
    sourceCode: 'PUBLIC_FACTORY_LISTING_YSOL_GD',
    sourceSite: 'ysol.com',
  },
  {
    opportunityType: 'DEMAND',
    sourceCode: 'PUBLIC_DEMAND_ZHAOSHANG_NET_GD',
    sourceSite: 'zhaoshang.net',
  },
];

function normalizeRunMode(value: unknown): PublicOpportunityBatchRunMode {
  const normalized = String(value || 'ALL')
    .trim()
    .toUpperCase();
  if (['ALL', 'DEMAND', 'SUPPLY'].includes(normalized)) {
    return normalized as PublicOpportunityBatchRunMode;
  }
  if (['LISTING', 'LISTINGS', '房源'].includes(normalized)) {
    return 'SUPPLY';
  }
  if (['需求'].includes(normalized)) {
    return 'DEMAND';
  }
  throw new CrawlerTaskValidationError('INVALID_PUBLIC_OPPORTUNITY_BATCH_MODE');
}

function resolveOpportunityType(sourceCode: string): 'DEMAND' | 'SUPPLY' {
  const adapter = getPublicCrawlerAdapter(sourceCode);
  if (adapter?.opportunityType) {
    return adapter.opportunityType;
  }
  return sourceCode.includes('DEMAND') ? 'DEMAND' : 'SUPPLY';
}

function toSqlStringLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function resolvePlatformSourceCodes(mode: PublicOpportunityBatchRunMode) {
  const sources = await listPublicOpportunityCrawlerSources();
  const enabledReadyCodes = sources
    .filter((source) => source.enabled && source.adapterStatus === 'READY')
    .map((source) => source.sourceCode)
    .filter((sourceCode) =>
      PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES.includes(sourceCode as any),
    );
  const sourceCodes =
    enabledReadyCodes.length > 0
      ? enabledReadyCodes
      : [...PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES];

  return sourceCodes.filter((sourceCode) => {
    if (mode === 'ALL') {
      return true;
    }
    return resolveOpportunityType(sourceCode) === mode;
  });
}

function parseJsonObject(value: unknown): null | Record<string, unknown> {
  if (!value) {
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
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

function addFailureReason(
  reasonCounts: Map<string, number>,
  reason: unknown,
  count = 1,
) {
  const normalized = String(reason || '').trim();
  if (!normalized) {
    return;
  }
  reasonCounts.set(
    normalized.slice(0, 200),
    (reasonCounts.get(normalized.slice(0, 200)) || 0) + count,
  );
}

function buildFailureReasonTop5(reasonCounts: Map<string, number>) {
  return [...reasonCounts.entries()]
    .map(([reason, count]) => ({ count, reason }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

function readNumberField(
  record: null | Record<string, unknown> | undefined,
  key: string,
) {
  const value = record?.[key];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasOpportunityUpsert(payload: null | Record<string, unknown>) {
  return (
    Boolean(Number(payload?.opportunityId || 0)) &&
    payload?.opportunityCreated !== undefined
  );
}

function collectPayloadFailureReasons(
  payload: null | Record<string, unknown>,
  reasonCounts: Map<string, number>,
) {
  if (!payload) {
    return;
  }
  const qualityResult = parseJsonObject(payload.qualityResult);
  if (
    qualityResult?.status &&
    !['EFFECTIVE', 'VERIFIED'].includes(String(qualityResult.status))
  ) {
    addFailureReason(reasonCounts, qualityResult.status);
  }
  const reasons = Array.isArray(qualityResult?.reasons)
    ? qualityResult.reasons
    : [];
  for (const reason of reasons) {
    addFailureReason(reasonCounts, reason);
  }
  addFailureReason(reasonCounts, payload.leadSkipReason);
}

async function listTaskItemMetricRows(taskId: number) {
  return prismaClient.$queryRawUnsafe<TaskItemMetricRow[]>(
    `
      SELECT
        status,
        skip_reason AS skipReason,
        last_error AS lastError,
        parsed_payload_json AS parsedPayloadJson
      FROM crawler_task_item
      WHERE last_task_id = ?
    `,
    taskId,
  );
}

async function listCollectedEffectiveCountBySourceCode(sourceCodes: string[]) {
  const normalizedSourceCodes = sourceCodes
    .map((sourceCode) => String(sourceCode || '').trim())
    .filter(Boolean);
  const counts = new Map<string, number>();

  if (normalizedSourceCodes.length === 0) {
    return counts;
  }

  await ensurePublicOpportunityStorage();

  const sourceCodeCases = normalizedSourceCodes
    .map((sourceCode) => {
      const sourceCodeLiteral = toSqlStringLiteral(sourceCode);
      return `
        WHEN JSON_UNQUOTE(
          JSON_EXTRACT(opo.detail_json, '$.crawlerSourceCode')
        ) = ${sourceCodeLiteral} THEN ${sourceCodeLiteral}
        WHEN JSON_UNQUOTE(
          JSON_EXTRACT(opo.detail_json, '$.sourceCode')
        ) = ${sourceCodeLiteral} THEN ${sourceCodeLiteral}
        WHEN JSON_CONTAINS(opo.tags_json, JSON_QUOTE(${sourceCodeLiteral}))
          THEN ${sourceCodeLiteral}
      `;
    })
    .join('\n');
  const requestedSourceCodes = new Set(normalizedSourceCodes);
  const sourceSiteCases = SOURCE_SITE_FALLBACKS.filter((fallback) =>
    requestedSourceCodes.has(fallback.sourceCode),
  )
    .map((fallback) => {
      return `
        WHEN opo.opportunity_type = ${toSqlStringLiteral(
          fallback.opportunityType,
        )}
          AND opo.source_site = ${toSqlStringLiteral(fallback.sourceSite)}
          THEN ${toSqlStringLiteral(fallback.sourceCode)}
      `;
    })
    .join('\n');
  const sourceCodeSql = `
    CASE
      ${sourceCodeCases}
      ${sourceSiteCases}
      ELSE NULL
    END
  `;
  const rows = await prismaClient.$queryRawUnsafe<CollectedEffectiveCountRow[]>(
    `
      SELECT sourceCode, COUNT(*) AS total
      FROM (
        SELECT
          ${sourceCodeSql} AS sourceCode,
          ROW_NUMBER() OVER (
            PARTITION BY
              opo.opportunity_type,
              COALESCE(
                NULLIF(opo.source_url, ''),
                CONCAT('id:', opo.opportunity_id)
              )
            ORDER BY opo.last_synced_at DESC, opo.opportunity_id DESC
          ) AS dedupeRank
        FROM investment_public_opportunity opo
        LEFT JOIN (
          ${buildAuditScopeSql(['EFFECTIVE', 'VERIFIED'])}
        ) audit_scope ON audit_scope.opportunityId = opo.opportunity_id
        WHERE ${buildDisplayableCollectedOpportunityWhereSql('opo', 'audit_scope')}
          AND (
            opo.opportunity_type <> 'SUPPLY'
            OR (
              JSON_UNQUOTE(JSON_EXTRACT(opo.detail_json, '$.extractionPolicy'))
                = 'STRICT_DETAIL_PAGE_LABELS_ONLY'
              AND JSON_UNQUOTE(JSON_EXTRACT(opo.detail_json, '$.responseHash'))
                IS NOT NULL
            )
          )
      ) collected_scope
      WHERE dedupeRank = 1
        AND sourceCode IS NOT NULL
        AND sourceCode <> ''
      GROUP BY sourceCode
    `,
    ...buildAuditScopeParams(),
  );

  for (const row of rows) {
    const sourceCode = String(row.sourceCode || '').trim();
    if (!sourceCode) {
      continue;
    }
    counts.set(sourceCode, Number(row.total || 0));
  }

  return counts;
}

async function buildPlatformResultFromTask(params: {
  collectedEffectiveCount: number;
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceCode: string;
  task: CrawlerTask;
}): Promise<PublicOpportunityBatchPlatformResult> {
  const [logs, itemRows] = await Promise.all([
    listCrawlerTaskLogs(params.task.taskId),
    listTaskItemMetricRows(params.task.taskId),
  ]);
  const reasonCounts = new Map<string, number>();
  let discoveredUrlCount = 0;
  let effectiveCount = 0;
  let fetchSuccessCount = 0;
  let upsertedCount = 0;

  for (const log of logs.items) {
    if (log.stage === 'DISCOVER') {
      discoveredUrlCount += readNumberField(log.detailJson, 'discoveredCount');
    }
    if (
      log.stage === 'FETCH' &&
      log.level === 'INFO' &&
      log.message === 'public page fetched'
    ) {
      fetchSuccessCount += 1;
    }
    if (log.level === 'ERROR') {
      addFailureReason(
        reasonCounts,
        log.detailJson?.errorMessage || log.message,
      );
    }
    addFailureReason(reasonCounts, log.detailJson?.reason);
    addFailureReason(reasonCounts, log.detailJson?.listPolicyFailureReason);
  }

  for (const row of itemRows) {
    addFailureReason(reasonCounts, row.lastError);
    addFailureReason(reasonCounts, row.skipReason);
    const payload = parseJsonObject(row.parsedPayloadJson);
    if (hasOpportunityUpsert(payload)) {
      upsertedCount += 1;
    }
    if (isEffectiveBatchPayload(payload)) {
      effectiveCount += 1;
    }
    collectPayloadFailureReasons(payload, reasonCounts);
  }

  addFailureReason(reasonCounts, params.task.errorMessage);
  addFailureReason(reasonCounts, params.task.skipReason);
  const zeroOutput =
    discoveredUrlCount <= 0 &&
    params.task.fetchedCount <= 0 &&
    upsertedCount <= 0 &&
    effectiveCount <= 0;

  return {
    collectedEffectiveCount: params.collectedEffectiveCount,
    discoveredUrlCount,
    effectiveCount,
    errorMessage: params.task.errorMessage || null,
    failedReasonTop5: buildFailureReasonTop5(reasonCounts),
    fetchedCount: params.task.fetchedCount,
    fetchSuccessCount,
    opportunityType: params.opportunityType,
    skippedCount: params.task.skippedCount,
    sourceCode: params.sourceCode,
    sourceName: params.task.sourceName || null,
    status: params.task.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
    taskId: params.task.taskId,
    upsertedCount,
    yieldedEffective: effectiveCount > 0,
    zeroOutput,
  };
}

function buildFailedPlatformResult(params: {
  collectedEffectiveCount: number;
  error: unknown;
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceCode: string;
}): PublicOpportunityBatchPlatformResult {
  const message =
    params.error instanceof Error ? params.error.message : String(params.error);
  const adapter = getPublicCrawlerAdapter(params.sourceCode);
  return {
    collectedEffectiveCount: params.collectedEffectiveCount,
    discoveredUrlCount: 0,
    effectiveCount: 0,
    errorMessage: message,
    failedReasonTop5: [{ count: 1, reason: message }],
    fetchedCount: 0,
    fetchSuccessCount: 0,
    opportunityType: params.opportunityType,
    skippedCount: 0,
    sourceCode: params.sourceCode,
    sourceName: adapter?.platformName || adapter?.sourceSite || null,
    status: 'FAILED',
    taskId: null,
    upsertedCount: 0,
    yieldedEffective: false,
    zeroOutput: true,
  };
}

function normalizeMaxConcurrency(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 4;
  }
  return Math.max(1, Math.min(8, Math.floor(parsed)));
}

function normalizeMaxRounds(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.min(10, Math.floor(parsed)));
}

function normalizeTargetCount(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(1, Math.min(100_000, Math.floor(parsed)));
}

function sumCollectedEffectiveCount(
  counts: Map<string, number>,
  sourceCodes: string[],
) {
  return sourceCodes.reduce(
    (sum, sourceCode) => sum + (counts.get(sourceCode) || 0),
    0,
  );
}

async function runOnePlatform(
  sourceCode: string,
  options: PublicOpportunityBatchRunOptions,
  roundIndex = 1,
) {
  const opportunityType = resolveOpportunityType(sourceCode);
  try {
    const task = await runPublicOpportunityUrlCrawlerTask({
      batchSize: options.batchSize,
      discoverList: options.discoverList,
      freshnessDays: options.freshnessDays,
      ignoreInterval: options.ignoreInterval,
      listDiscoveryDelayMs: options.listDiscoveryDelayMs,
      maxListPages: options.maxListPages,
      maxRetryCount: options.maxRetryCount,
      retryDelayMinutes: options.retryDelayMinutes,
      reprocessSuccess: options.reprocessSuccess,
      staleReprocessMinutes: options.staleReprocessMinutes,
      sourceCode,
    });
    const result = await buildPlatformResultFromTask({
      collectedEffectiveCount: 0,
      opportunityType,
      sourceCode,
      task,
    });
    return {
      ...result,
      roundIndex,
    };
  } catch (error) {
    return {
      ...buildFailedPlatformResult({
        collectedEffectiveCount: 0,
        error,
        opportunityType,
        sourceCode,
      }),
      roundIndex,
    };
  }
}

export async function runPublicOpportunityBatchCrawler(
  options: PublicOpportunityBatchRunOptions = {},
): Promise<PublicOpportunityBatchRunResult> {
  const startedAt = new Date().toISOString();
  const mode = normalizeRunMode(options.mode);
  const sourceCodes = await resolvePlatformSourceCodes(mode);
  const items: PublicOpportunityBatchPlatformResult[] = [];
  const continueOnError = options.continueOnError !== false;
  const maxConcurrency = normalizeMaxConcurrency(options.maxConcurrency);
  const maxRounds = normalizeMaxRounds(options.maxRounds);
  const targetCount = normalizeTargetCount(options.targetCount);
  let roundCount = 0;
  let targetReached = false;

  for (let roundIndex = 1; roundIndex <= maxRounds; roundIndex += 1) {
    if (targetCount) {
      const beforeCounts =
        await listCollectedEffectiveCountBySourceCode(sourceCodes);
      if (
        sumCollectedEffectiveCount(beforeCounts, sourceCodes) >= targetCount
      ) {
        targetReached = true;
        break;
      }
    }

    const roundItems: PublicOpportunityBatchPlatformResult[] = [];
    roundCount += 1;
    for (let index = 0; index < sourceCodes.length; index += maxConcurrency) {
      const chunk = sourceCodes.slice(index, index + maxConcurrency);
      const chunkItems = await Promise.all(
        chunk.map((sourceCode) =>
          runOnePlatform(sourceCode, options, roundIndex),
        ),
      );
      roundItems.push(...chunkItems);
      if (
        !continueOnError &&
        chunkItems.some((item) => item.status === 'FAILED')
      ) {
        break;
      }
    }
    items.push(...roundItems);

    const afterCounts =
      await listCollectedEffectiveCountBySourceCode(sourceCodes);
    const collectedEffectiveCount = sumCollectedEffectiveCount(
      afterCounts,
      sourceCodes,
    );
    if (targetCount && collectedEffectiveCount >= targetCount) {
      targetReached = true;
      break;
    }

    const roundTotal = buildPublicOpportunityBatchTotals(roundItems);
    if (
      targetCount &&
      roundTotal.discoveredUrlCount === 0 &&
      roundTotal.fetchedCount === 0
    ) {
      break;
    }
  }

  const collectedEffectiveCounts =
    await listCollectedEffectiveCountBySourceCode(sourceCodes);
  const collectedEffectiveCount = sumCollectedEffectiveCount(
    collectedEffectiveCounts,
    sourceCodes,
  );
  for (const item of items) {
    item.collectedEffectiveCount =
      collectedEffectiveCounts.get(item.sourceCode) || 0;
  }
  const total = buildPublicOpportunityBatchTotals(items);
  total.collectedEffectiveCount = collectedEffectiveCount;

  return {
    finishedAt: new Date().toISOString(),
    items,
    maxRounds,
    mode,
    remainingCount: targetCount
      ? Math.max(0, targetCount - collectedEffectiveCount)
      : undefined,
    roundCount,
    sourceCodes,
    startedAt,
    targetCount,
    targetReached: targetCount ? targetReached : undefined,
    total,
  };
}
