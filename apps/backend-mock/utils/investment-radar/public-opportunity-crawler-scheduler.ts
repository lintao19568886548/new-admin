import { runPublicOpportunityBatchCrawler } from './public-opportunity-batch-runner';
import { runWithRadarSharedScope } from './shared-scope';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 80;
const DEFAULT_FRESHNESS_DAYS = 365;
const DEFAULT_ENABLED = true;

const globalForPublicOpportunityCrawler = globalThis as typeof globalThis & {
  __publicOpportunityCrawlerScheduler?: {
    enabledOverride?: boolean;
    intervalId?: ReturnType<typeof setInterval>;
    intervalMs?: number;
    lastError?: null | string;
    lastSkipReason?: null | string;
    lastTaskId?: null | number;
    lastTickFinishedAt?: null | string;
    lastTickStartedAt?: null | string;
    running: boolean;
    startedAt?: null | string;
    stoppedAt?: null | string;
  };
};

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function isPublicOpportunityCrawlerSchedulerEnabled() {
  const runtimeEnabled =
    globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler
      ?.enabledOverride;
  if (runtimeEnabled !== undefined) {
    return runtimeEnabled;
  }
  return (
    String(
      process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED ?? DEFAULT_ENABLED,
    )
      .trim()
      .toLowerCase() === 'true'
  );
}

export function getPublicOpportunityCrawlerSchedulerConfig() {
  const state =
    globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler;
  const envEnabled =
    String(
      process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED ?? DEFAULT_ENABLED,
    )
      .trim()
      .toLowerCase() === 'true';
  return {
    active: Boolean(state?.intervalId),
    enabled: isPublicOpportunityCrawlerSchedulerEnabled(),
    envEnabled,
    intervalMs: getPositiveIntegerEnv(
      'INVESTMENT_RADAR_PUBLIC_CRAWLER_INTERVAL_MS',
      DEFAULT_INTERVAL_MS,
    ),
    lastError: state?.lastError || null,
    lastSkipReason: state?.lastSkipReason || null,
    lastTaskId: state?.lastTaskId || null,
    lastTickFinishedAt: state?.lastTickFinishedAt || null,
    lastTickStartedAt: state?.lastTickStartedAt || null,
    running: Boolean(state?.running),
    startedAt: state?.startedAt || null,
    stoppedAt: state?.stoppedAt || null,
  };
}

async function runSchedulerTick(state: { running: boolean }) {
  if (state.running) {
    return;
  }

  state.running = true;
  const runtimeState =
    globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler;
  if (runtimeState) {
    runtimeState.lastTickStartedAt = new Date().toISOString();
    runtimeState.lastTickFinishedAt = null;
    runtimeState.lastError = null;
    runtimeState.lastSkipReason = null;
  }
  try {
    const runOptions = {
      batchSize: getPositiveIntegerEnv(
        'INVESTMENT_RADAR_PUBLIC_CRAWLER_BATCH_SIZE',
        DEFAULT_BATCH_SIZE,
      ),
      freshnessDays: getPositiveIntegerEnv(
        'INVESTMENT_RADAR_PUBLIC_CRAWLER_FRESHNESS_DAYS',
        DEFAULT_FRESHNESS_DAYS,
      ),
      maxRetryCount: getPositiveIntegerEnv(
        'INVESTMENT_RADAR_PUBLIC_CRAWLER_MAX_RETRY_COUNT',
        3,
      ),
      retryDelayMinutes: getPositiveIntegerEnv(
        'INVESTMENT_RADAR_PUBLIC_CRAWLER_RETRY_DELAY_MINUTES',
        30,
      ),
    };
    const batchResult = await runWithRadarSharedScope(() =>
      runPublicOpportunityBatchCrawler({
        ...runOptions,
        continueOnError: true,
        mode: 'ALL',
      }),
    );
    const latestTask = [...batchResult.items]
      .reverse()
      .find((item) => item.taskId);
    const firstFailed = batchResult.items.find(
      (item) => item.status === 'FAILED',
    );
    if (runtimeState) {
      runtimeState.lastTaskId = latestTask?.taskId || null;
      runtimeState.lastSkipReason =
        batchResult.total.failedPlatformCount > 0
          ? `${batchResult.total.failedPlatformCount} public crawler platforms failed or skipped`
          : null;
      runtimeState.lastError = firstFailed?.errorMessage || null;
    }
    for (const failed of batchResult.items.filter(
      (item) =>
        item.status === 'FAILED' &&
        item.errorMessage !== 'CRAWL_INTERVAL_NOT_REACHED',
    )) {
      console.error(
        `[investment-radar-public-crawler] ${failed.sourceCode} tick failed: ${failed.errorMessage}`,
      );
    }
  } finally {
    state.running = false;
    if (runtimeState) {
      runtimeState.lastTickFinishedAt = new Date().toISOString();
      runtimeState.running = false;
    }
  }
}

export function startPublicOpportunityCrawlerScheduler(
  options: { force?: boolean; runImmediately?: boolean } = {},
) {
  let existingState =
    globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler;
  if (options.force) {
    existingState ||= { running: false };
    existingState.enabledOverride = true;
    globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler =
      existingState;
  }
  const schedulerConfig = getPublicOpportunityCrawlerSchedulerConfig();
  if (!schedulerConfig.enabled) {
    console.info('[investment-radar-public-crawler] scheduler disabled');
    return getPublicOpportunityCrawlerSchedulerConfig();
  }
  if (existingState?.intervalId) {
    return getPublicOpportunityCrawlerSchedulerConfig();
  }

  const state =
    existingState ||
    ({
      running: false,
    } satisfies NonNullable<
      typeof globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler
    >);
  state.enabledOverride = existingState?.enabledOverride;
  state.intervalMs = schedulerConfig.intervalMs;
  state.lastError = null;
  state.startedAt = new Date().toISOString();
  state.stoppedAt = null;
  state.intervalId = setInterval(() => {
    void runSchedulerTick(state);
  }, schedulerConfig.intervalMs);
  state.running = false;

  state.intervalId.unref?.();
  globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler = state;

  if (options.runImmediately !== false) {
    setTimeout(() => {
      void runSchedulerTick(state);
    }, 3000).unref?.();
  }

  return getPublicOpportunityCrawlerSchedulerConfig();
}

export function stopPublicOpportunityCrawlerScheduler() {
  const state =
    globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler ||
    ({
      running: false,
    } satisfies NonNullable<
      typeof globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler
    >);
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = undefined;
  }
  state.enabledOverride = false;
  state.stoppedAt = new Date().toISOString();
  state.running = false;
  globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler = state;
  return getPublicOpportunityCrawlerSchedulerConfig();
}

export function getPublicOpportunityCrawlerSchedulerRuntimeStatus() {
  return getPublicOpportunityCrawlerSchedulerConfig();
}
