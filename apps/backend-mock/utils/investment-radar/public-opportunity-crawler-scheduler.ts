import { reclaimStaleOrDisabledActiveCrawlerTasks } from './crawler-task-repository';
import { PUBLIC_OPPORTUNITY_FRESHNESS_DAYS } from './crawler-types';
import { runPublicOpportunityBatchCrawler } from './public-opportunity-batch-runner';
import { runWithRadarSharedScope } from './shared-scope';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_DAILY_RUN_HOUR = 8;
const DEFAULT_FRESHNESS_DAYS = PUBLIC_OPPORTUNITY_FRESHNESS_DAYS;
const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_MAX_LIST_PAGES = 60;
const DEFAULT_STALE_REPROCESS_MINUTES = 24 * 60;
const DEFAULT_ENABLED = true;
const DEFAULT_SCHEDULER_MODE = 'DEMAND';
const SCHEDULER_CODE_VERSION = 'public-crawler-daily-8-demand-v1';

const globalForPublicOpportunityCrawler = globalThis as typeof globalThis & {
  __publicOpportunityCrawlerScheduler?: {
    dailyRunHour?: number;
    enabledOverride?: boolean;
    intervalId?: ReturnType<typeof setTimeout>;
    intervalMs?: number;
    lastError?: null | string;
    lastSkipReason?: null | string;
    lastTaskId?: null | number;
    lastTickFinishedAt?: null | string;
    lastTickStartedAt?: null | string;
    mode?: 'ALL' | 'DEMAND' | 'SUPPLY';
    nextRunAt?: null | string;
    running: boolean;
    startedAt?: null | string;
    startSource?: 'api' | 'plugin';
    stoppedAt?: null | string;
  };
};

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getDailyRunHour() {
  const value = Number(process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_DAILY_HOUR);
  return Number.isFinite(value) && value >= 0 && value <= 23
    ? Math.floor(value)
    : DEFAULT_DAILY_RUN_HOUR;
}

export function getNextPublicOpportunityCrawlerSchedulerRunAt(
  now = new Date(),
  dailyRunHour = getDailyRunHour(),
) {
  const nextRunAt = new Date(now);
  nextRunAt.setHours(dailyRunHour, 0, 0, 0);
  if (nextRunAt.getTime() <= now.getTime()) {
    nextRunAt.setDate(nextRunAt.getDate() + 1);
  }
  return nextRunAt;
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
  const enabled = isPublicOpportunityCrawlerSchedulerEnabled();
  return {
    active: Boolean(state?.intervalId),
    dailyRunHour: state?.dailyRunHour ?? getDailyRunHour(),
    enabled,
    envEnabled,
    intervalMs: getPositiveIntegerEnv(
      'INVESTMENT_RADAR_PUBLIC_CRAWLER_INTERVAL_MS',
      24 * 60 * 60 * 1000,
    ),
    lastError: state?.lastError || null,
    lastSkipReason: state?.lastSkipReason || null,
    lastTaskId: state?.lastTaskId || null,
    lastTickFinishedAt: state?.lastTickFinishedAt || null,
    lastTickStartedAt: state?.lastTickStartedAt || null,
    mode: state?.mode || DEFAULT_SCHEDULER_MODE,
    nextRunAt:
      state?.nextRunAt ||
      (enabled
        ? getNextPublicOpportunityCrawlerSchedulerRunAt().toISOString()
        : null),
    running: Boolean(state?.running),
    scheduleType: 'DAILY',
    startSource: state?.startSource || null,
    startedAt: state?.startedAt || null,
    stoppedAt: state?.stoppedAt || null,
    version: SCHEDULER_CODE_VERSION,
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
    await runWithRadarSharedScope(() =>
      reclaimStaleOrDisabledActiveCrawlerTasks(5),
    );
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
      maxListPages: getPositiveIntegerEnv(
        'INVESTMENT_RADAR_PUBLIC_CRAWLER_MAX_LIST_PAGES',
        DEFAULT_MAX_LIST_PAGES,
      ),
      maxConcurrency: getPositiveIntegerEnv(
        'INVESTMENT_RADAR_PUBLIC_CRAWLER_MAX_CONCURRENCY',
        DEFAULT_MAX_CONCURRENCY,
      ),
      retryDelayMinutes: getPositiveIntegerEnv(
        'INVESTMENT_RADAR_PUBLIC_CRAWLER_RETRY_DELAY_MINUTES',
        30,
      ),
      staleReprocessMinutes: getPositiveIntegerEnv(
        'INVESTMENT_RADAR_PUBLIC_CRAWLER_STALE_REPROCESS_MINUTES',
        DEFAULT_STALE_REPROCESS_MINUTES,
      ),
    };
    const batchResult = await runWithRadarSharedScope(() =>
      runPublicOpportunityBatchCrawler({
        ...runOptions,
        continueOnError: true,
        mode: DEFAULT_SCHEDULER_MODE,
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
      let lastSkipReason: null | string = null;
      if (batchResult.total.onlyZeroOutput) {
        lastSkipReason = 'public crawler tick produced zero useful output';
      } else if (batchResult.total.failedPlatformCount > 0) {
        lastSkipReason = `${batchResult.total.failedPlatformCount} public crawler platforms failed or skipped`;
      }
      runtimeState.lastSkipReason = lastSkipReason;
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

function scheduleNextDailyTick(
  state: NonNullable<
    typeof globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler
  >,
) {
  if (state.intervalId) {
    clearTimeout(state.intervalId);
  }
  const nextRunAt = getNextPublicOpportunityCrawlerSchedulerRunAt(
    new Date(),
    state.dailyRunHour ?? getDailyRunHour(),
  );
  state.nextRunAt = nextRunAt.toISOString();
  const delayMs = Math.max(0, nextRunAt.getTime() - Date.now());
  state.intervalId = setTimeout(() => {
    state.intervalId = undefined;
    void runSchedulerTick(state).finally(() => {
      if (isPublicOpportunityCrawlerSchedulerEnabled()) {
        scheduleNextDailyTick(state);
      }
    });
  }, delayMs);
  state.intervalId.unref?.();
}

export function startPublicOpportunityCrawlerScheduler(
  options: {
    force?: boolean;
    runImmediately?: boolean;
    startSource?: 'api' | 'plugin';
  } = {},
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
  state.dailyRunHour = schedulerConfig.dailyRunHour;
  state.lastError = null;
  state.mode = DEFAULT_SCHEDULER_MODE;
  state.startSource = options.startSource || 'plugin';
  state.startedAt = new Date().toISOString();
  state.stoppedAt = null;
  scheduleNextDailyTick(state);
  state.running = false;
  globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler = state;

  if (options.runImmediately === true) {
    setTimeout(() => {
      if (isPublicOpportunityCrawlerSchedulerEnabled()) {
        void runSchedulerTick(state);
      }
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
    clearTimeout(state.intervalId);
    state.intervalId = undefined;
  }
  state.nextRunAt = null;
  state.enabledOverride = false;
  state.stoppedAt = new Date().toISOString();
  state.running = false;
  globalForPublicOpportunityCrawler.__publicOpportunityCrawlerScheduler = state;
  return getPublicOpportunityCrawlerSchedulerConfig();
}

export function getPublicOpportunityCrawlerSchedulerRuntimeStatus() {
  return getPublicOpportunityCrawlerSchedulerConfig();
}
