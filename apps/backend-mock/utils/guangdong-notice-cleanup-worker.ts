const WORKER_NAME = 'guangdong-notice-cleanup-worker';
const DEFAULT_CLEANUP_HOUR = 3;
const DEFAULT_CLEANUP_LIMIT = 200;
const DEFAULT_RECHECK_INVALID_LIMIT = 50;
const DEFAULT_ENABLED = true;
const SCHEDULER_VERSION = 'guangdong-notice-cleanup-daily-v1';

type WorkerState = {
  dailyRunHour: number;
  enabledOverride?: boolean;
  intervalId?: ReturnType<typeof setTimeout>;
  lastError?: null | string;
  lastSummary?: null | {
    checked: number;
    invalid: number;
    updated: number;
    valid: number;
  };
  lastTickFinishedAt?: null | string;
  lastTickStartedAt?: null | string;
  nextRunAt?: null | string;
  running: boolean;
  startedAt?: null | string;
  startSource?: 'api' | 'plugin';
  stoppedAt?: null | string;
};

const globalForGuangdongNoticeCleanup = globalThis as typeof globalThis & {
  __guangdongNoticeCleanupWorker?: WorkerState;
};

function normalizeBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return String(raw).trim().toLowerCase() === 'true';
}

function normalizePositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getDailyRunHour() {
  const value = Number(process.env.GD_NOTICE_CLEANUP_DAILY_HOUR);
  return Number.isFinite(value) && value >= 0 && value <= 23
    ? Math.floor(value)
    : DEFAULT_CLEANUP_HOUR;
}

function getCleanupLimit() {
  return normalizePositiveIntegerEnv(
    'GD_NOTICE_CLEANUP_LIMIT',
    DEFAULT_CLEANUP_LIMIT,
  );
}

function getRecheckInvalidLimit() {
  return normalizePositiveIntegerEnv(
    'GD_NOTICE_RECHECK_INVALID_LIMIT',
    DEFAULT_RECHECK_INVALID_LIMIT,
  );
}

export function getNextGuangdongNoticeCleanupRunAt(
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

export function isGuangdongNoticeCleanupWorkerEnabled() {
  const runtimeEnabled =
    globalForGuangdongNoticeCleanup.__guangdongNoticeCleanupWorker
      ?.enabledOverride;
  if (runtimeEnabled !== undefined) {
    return runtimeEnabled;
  }
  return normalizeBooleanEnv('GD_NOTICE_CLEANUP_ENABLED', DEFAULT_ENABLED);
}

export function getGuangdongNoticeCleanupWorkerStatus() {
  const state = globalForGuangdongNoticeCleanup.__guangdongNoticeCleanupWorker;
  const enabled = isGuangdongNoticeCleanupWorkerEnabled();
  const dailyRunHour = state?.dailyRunHour ?? getDailyRunHour();

  return {
    active: Boolean(state?.intervalId),
    dailyRunHour,
    enabled,
    envEnabled: normalizeBooleanEnv(
      'GD_NOTICE_CLEANUP_ENABLED',
      DEFAULT_ENABLED,
    ),
    lastError: state?.lastError || null,
    lastSummary: state?.lastSummary || null,
    lastTickFinishedAt: state?.lastTickFinishedAt || null,
    lastTickStartedAt: state?.lastTickStartedAt || null,
    limit: getCleanupLimit(),
    nextRunAt:
      state?.nextRunAt ||
      (enabled
        ? getNextGuangdongNoticeCleanupRunAt(
            new Date(),
            dailyRunHour,
          ).toISOString()
        : null),
    running: Boolean(state?.running),
    scheduleType: 'DAILY',
    startSource: state?.startSource || null,
    startedAt: state?.startedAt || null,
    stoppedAt: state?.stoppedAt || null,
    version: SCHEDULER_VERSION,
    recheckInvalidLimit: getRecheckInvalidLimit(),
  };
}

async function runCleanupTick(state: WorkerState) {
  if (state.running) {
    return;
  }

  state.running = true;
  state.lastTickStartedAt = new Date().toISOString();
  state.lastTickFinishedAt = null;
  state.lastError = null;

  try {
    const { cleanupInvalidGuangdongNotices } =
      await import('./guangdong-notice-cleanup');
    const summary = await cleanupInvalidGuangdongNotices({
      execute: true,
      limit: getCleanupLimit(),
      validState: 'valid',
    });
    const recheckSummary = await cleanupInvalidGuangdongNotices({
      execute: true,
      limit: getRecheckInvalidLimit(),
      validState: 'invalid',
    });
    state.lastSummary = {
      checked: summary.checked + recheckSummary.checked,
      invalid: summary.invalid + recheckSummary.invalid,
      updated: summary.updated + recheckSummary.updated,
      valid: summary.valid + recheckSummary.valid,
    };
    console.info(
      `[${WORKER_NAME}] tick finished checked=${state.lastSummary.checked} valid=${state.lastSummary.valid} invalid=${state.lastSummary.invalid} updated=${state.lastSummary.updated} recheckedInvalid=${recheckSummary.checked} restored=${recheckSummary.valid}`,
    );
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    console.error(`[${WORKER_NAME}] tick failed:`, error);
  } finally {
    state.running = false;
    state.lastTickFinishedAt = new Date().toISOString();
  }
}

function scheduleNextDailyTick(state: WorkerState) {
  if (state.intervalId) {
    clearTimeout(state.intervalId);
  }

  const nextRunAt = getNextGuangdongNoticeCleanupRunAt(
    new Date(),
    state.dailyRunHour,
  );
  state.nextRunAt = nextRunAt.toISOString();
  const delayMs = Math.max(0, nextRunAt.getTime() - Date.now());
  state.intervalId = setTimeout(() => {
    state.intervalId = undefined;
    void runCleanupTick(state).finally(() => {
      if (isGuangdongNoticeCleanupWorkerEnabled()) {
        scheduleNextDailyTick(state);
      }
    });
  }, delayMs);
  state.intervalId.unref?.();
}

export function startGuangdongNoticeCleanupWorker(
  options: {
    force?: boolean;
    runImmediately?: boolean;
    startSource?: 'api' | 'plugin';
  } = {},
) {
  let state = globalForGuangdongNoticeCleanup.__guangdongNoticeCleanupWorker;
  if (options.force) {
    state ||= { dailyRunHour: getDailyRunHour(), running: false };
    state.enabledOverride = true;
    globalForGuangdongNoticeCleanup.__guangdongNoticeCleanupWorker = state;
  }

  if (!isGuangdongNoticeCleanupWorkerEnabled()) {
    console.info(`[${WORKER_NAME}] worker disabled`);
    return getGuangdongNoticeCleanupWorkerStatus();
  }

  if (state?.intervalId) {
    return getGuangdongNoticeCleanupWorkerStatus();
  }

  state ||= {
    dailyRunHour: getDailyRunHour(),
    running: false,
  };
  state.dailyRunHour = getDailyRunHour();
  state.lastError = null;
  state.startSource = options.startSource || 'plugin';
  state.startedAt = new Date().toISOString();
  state.stoppedAt = null;
  scheduleNextDailyTick(state);
  globalForGuangdongNoticeCleanup.__guangdongNoticeCleanupWorker = state;

  console.info(
    `[${WORKER_NAME}] worker started dailyRunHour=${state.dailyRunHour} limit=${getCleanupLimit()} recheckInvalidLimit=${getRecheckInvalidLimit()}`,
  );

  if (options.runImmediately === true) {
    setTimeout(() => {
      if (isGuangdongNoticeCleanupWorkerEnabled()) {
        void runCleanupTick(state);
      }
    }, 3000).unref?.();
  }

  return getGuangdongNoticeCleanupWorkerStatus();
}

export function stopGuangdongNoticeCleanupWorker() {
  const state =
    globalForGuangdongNoticeCleanup.__guangdongNoticeCleanupWorker || {
      dailyRunHour: getDailyRunHour(),
      running: false,
    };
  if (state.intervalId) {
    clearTimeout(state.intervalId);
    state.intervalId = undefined;
  }
  state.enabledOverride = false;
  state.nextRunAt = null;
  state.running = false;
  state.stoppedAt = new Date().toISOString();
  globalForGuangdongNoticeCleanup.__guangdongNoticeCleanupWorker = state;
  return getGuangdongNoticeCleanupWorkerStatus();
}
