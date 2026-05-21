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
import { PUBLIC_OPPORTUNITY_PLATFORM_SOURCE_CODES } from './crawler-types';
import { getPublicCrawlerAdapter } from './public-crawler-adapters';
import { runPublicOpportunityUrlCrawlerTask } from './public-opportunity-url-crawler';

export type PublicOpportunityBatchRunMode = 'ALL' | 'DEMAND' | 'SUPPLY';

export interface PublicOpportunityBatchRunOptions extends Omit<
  PublicOpportunityCrawlerRunOptions,
  'sourceCode'
> {
  continueOnError?: boolean;
  maxConcurrency?: number;
  mode?: null | string;
}

export interface PublicOpportunityBatchPlatformResult {
  discoveredUrlCount: number;
  effectiveCount: number;
  errorMessage?: null | string;
  failedReasonTop5: Array<{ count: number; reason: string }>;
  fetchedCount: number;
  fetchSuccessCount: number;
  opportunityType: 'DEMAND' | 'SUPPLY';
  skippedCount: number;
  sourceCode: string;
  sourceName?: null | string;
  status: 'FAILED' | 'SUCCESS';
  taskId?: null | number;
  upsertedCount: number;
}

export interface PublicOpportunityBatchRunResult {
  finishedAt: string;
  items: PublicOpportunityBatchPlatformResult[];
  mode: PublicOpportunityBatchRunMode;
  sourceCodes: string[];
  startedAt: string;
  total: {
    discoveredUrlCount: number;
    effectiveCount: number;
    failedPlatformCount: number;
    fetchedCount: number;
    fetchSuccessCount: number;
    platformCount: number;
    skippedCount: number;
    successPlatformCount: number;
    taskCount: number;
    upsertedCount: number;
  };
}

interface TaskItemMetricRow {
  lastError?: null | string;
  parsedPayloadJson?: unknown;
  skipReason?: null | string;
  status?: null | string;
}

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

function isEffectivePayload(payload: null | Record<string, unknown>) {
  const qualityResult = parseJsonObject(payload?.qualityResult);
  const status = String(
    qualityResult?.status || payload?.opportunityStatus || '',
  );
  return status === 'EFFECTIVE' || status === 'VERIFIED';
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

async function buildPlatformResultFromTask(params: {
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
    if (isEffectivePayload(payload)) {
      effectiveCount += 1;
    }
    collectPayloadFailureReasons(payload, reasonCounts);
  }

  addFailureReason(reasonCounts, params.task.errorMessage);
  addFailureReason(reasonCounts, params.task.skipReason);

  return {
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
  };
}

function buildFailedPlatformResult(params: {
  error: unknown;
  opportunityType: 'DEMAND' | 'SUPPLY';
  sourceCode: string;
}): PublicOpportunityBatchPlatformResult {
  const message =
    params.error instanceof Error ? params.error.message : String(params.error);
  const adapter = getPublicCrawlerAdapter(params.sourceCode);
  return {
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
  };
}

function buildTotals(items: PublicOpportunityBatchPlatformResult[]) {
  const total = {
    discoveredUrlCount: 0,
    effectiveCount: 0,
    failedPlatformCount: 0,
    fetchedCount: 0,
    fetchSuccessCount: 0,
    platformCount: items.length,
    skippedCount: 0,
    successPlatformCount: 0,
    taskCount: 0,
    upsertedCount: 0,
  };
  for (const item of items) {
    total.discoveredUrlCount += item.discoveredUrlCount;
    total.effectiveCount += item.effectiveCount;
    total.fetchedCount += item.fetchedCount;
    total.fetchSuccessCount += item.fetchSuccessCount;
    total.skippedCount += item.skippedCount;
    total.upsertedCount += item.upsertedCount;
    if (item.taskId) {
      total.taskCount += 1;
    }
    if (item.status === 'SUCCESS') {
      total.successPlatformCount += 1;
    } else {
      total.failedPlatformCount += 1;
    }
  }
  return total;
}

function normalizeMaxConcurrency(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 4;
  }
  return Math.max(1, Math.min(8, Math.floor(parsed)));
}

async function runOnePlatform(
  sourceCode: string,
  options: PublicOpportunityBatchRunOptions,
) {
  const opportunityType = resolveOpportunityType(sourceCode);
  try {
    const task = await runPublicOpportunityUrlCrawlerTask({
      batchSize: options.batchSize,
      discoverList: options.discoverList,
      freshnessDays: options.freshnessDays,
      ignoreInterval: options.ignoreInterval,
      maxRetryCount: options.maxRetryCount,
      retryDelayMinutes: options.retryDelayMinutes,
      reprocessSuccess: options.reprocessSuccess,
      sourceCode,
    });
    return buildPlatformResultFromTask({
      opportunityType,
      sourceCode,
      task,
    });
  } catch (error) {
    return buildFailedPlatformResult({
      error,
      opportunityType,
      sourceCode,
    });
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

  for (let index = 0; index < sourceCodes.length; index += maxConcurrency) {
    const chunk = sourceCodes.slice(index, index + maxConcurrency);
    const chunkItems = await Promise.all(
      chunk.map((sourceCode) => runOnePlatform(sourceCode, options)),
    );
    items.push(...chunkItems);
    if (
      !continueOnError &&
      chunkItems.some((item) => item.status === 'FAILED')
    ) {
      break;
    }
  }

  return {
    finishedAt: new Date().toISOString(),
    items,
    mode,
    sourceCodes,
    startedAt,
    total: buildTotals(items),
  };
}
