import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runPublicOpportunityBatchCrawler } from '../public-opportunity-batch-runner';
import {
  getNextPublicOpportunityCrawlerSchedulerRunAt,
  getPublicOpportunityCrawlerSchedulerConfig,
  isPublicOpportunityCrawlerSchedulerEnabled,
  startPublicOpportunityCrawlerScheduler,
} from '../public-opportunity-crawler-scheduler';

vi.mock('../public-opportunity-batch-runner', () => ({
  runPublicOpportunityBatchCrawler: vi.fn(),
}));

vi.mock('../crawler-task-repository', () => ({
  reclaimStaleOrDisabledActiveCrawlerTasks: vi.fn(),
}));

vi.mock('../shared-scope', () => ({
  runWithRadarSharedScope: vi.fn((runner: () => unknown) => runner()),
}));

describe('public opportunity crawler scheduler', () => {
  const originalEnabled = process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED;
  const originalFreshnessDays =
    process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_FRESHNESS_DAYS;
  const originalDailyHour =
    process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_DAILY_HOUR;

  function resetSchedulerRuntimeState() {
    const globalState = globalThis as typeof globalThis & {
      __publicOpportunityCrawlerScheduler?: {
        intervalId?: ReturnType<typeof setTimeout>;
      };
    };
    if (globalState.__publicOpportunityCrawlerScheduler?.intervalId) {
      clearTimeout(globalState.__publicOpportunityCrawlerScheduler.intervalId);
    }
    globalState.__publicOpportunityCrawlerScheduler = undefined;
  }

  beforeEach(() => {
    resetSchedulerRuntimeState();
  });

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED;
    } else {
      process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED = originalEnabled;
    }
    if (originalFreshnessDays === undefined) {
      delete process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_FRESHNESS_DAYS;
    } else {
      process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_FRESHNESS_DAYS =
        originalFreshnessDays;
    }
    if (originalDailyHour === undefined) {
      delete process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_DAILY_HOUR;
    } else {
      process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_DAILY_HOUR =
        originalDailyHour;
    }
    resetSchedulerRuntimeState();
  });

  it('is enabled by default for automatic public crawler startup', () => {
    delete process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED;
    delete process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_FRESHNESS_DAYS;

    expect(isPublicOpportunityCrawlerSchedulerEnabled()).toBe(true);
    expect(getPublicOpportunityCrawlerSchedulerConfig()).toMatchObject({
      active: false,
      dailyRunHour: 8,
      enabled: true,
      envEnabled: true,
      intervalMs: 24 * 60 * 60 * 1000,
      mode: 'DEMAND',
      scheduleType: 'DAILY',
      startSource: null,
      version: 'public-crawler-daily-8-demand-v1',
    });
  });

  it('computes the next daily 8am scheduler run', () => {
    expect(
      getNextPublicOpportunityCrawlerSchedulerRunAt(
        new Date('2026-05-20T07:59:00+08:00'),
        8,
      ).toISOString(),
    ).toBe(new Date('2026-05-20T08:00:00+08:00').toISOString());
    expect(
      getNextPublicOpportunityCrawlerSchedulerRunAt(
        new Date('2026-05-20T08:00:00+08:00'),
        8,
      ).toISOString(),
    ).toBe(new Date('2026-05-21T08:00:00+08:00').toISOString());
  });

  it('can still be disabled explicitly by environment', () => {
    process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED = 'false';

    expect(isPublicOpportunityCrawlerSchedulerEnabled()).toBe(false);
    expect(getPublicOpportunityCrawlerSchedulerConfig().envEnabled).toBe(false);
  });

  it('can still be enabled explicitly by environment', () => {
    process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED = 'true';

    expect(isPublicOpportunityCrawlerSchedulerEnabled()).toBe(true);
    expect(getPublicOpportunityCrawlerSchedulerConfig().envEnabled).toBe(true);
  });

  it('records explicit api starts separately from plugin starts', () => {
    process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED = 'false';

    const config = startPublicOpportunityCrawlerScheduler({
      force: true,
      runImmediately: false,
      startSource: 'api',
    });

    expect(config).toMatchObject({
      active: true,
      enabled: true,
      envEnabled: false,
      mode: 'DEMAND',
      scheduleType: 'DAILY',
      startSource: 'api',
      version: 'public-crawler-daily-8-demand-v1',
    });
  });

  it('runs scheduled ticks with the safe crawler defaults', async () => {
    vi.useFakeTimers();
    process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_ENABLED = 'true';
    delete process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_BATCH_SIZE;
    delete process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_FRESHNESS_DAYS;
    delete process.env.INVESTMENT_RADAR_PUBLIC_CRAWLER_MAX_LIST_PAGES;
    vi.mocked(runPublicOpportunityBatchCrawler).mockResolvedValue({
      finishedAt: '2026-05-20T00:00:00.000Z',
      items: [],
      mode: 'DEMAND',
      sourceCodes: [],
      startedAt: '2026-05-20T00:00:00.000Z',
      total: {
        collectedEffectiveCount: 0,
        discoveredUrlCount: 0,
        effectiveCount: 0,
        failedPlatformCount: 0,
        fetchedCount: 0,
        fetchSuccessCount: 0,
        hasEffectiveOutput: false,
        hasUsefulOutput: false,
        onlyZeroOutput: true,
        platformCount: 0,
        productivePlatformCount: 0,
        skippedCount: 0,
        successPlatformCount: 0,
        taskCount: 0,
        upsertedCount: 0,
        zeroOutputPlatformCount: 0,
      },
    });

    startPublicOpportunityCrawlerScheduler({ runImmediately: true });
    await vi.advanceTimersByTimeAsync(3000);

    expect(runPublicOpportunityBatchCrawler).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSize: 10,
        freshnessDays: 180,
        maxListPages: 60,
        mode: 'DEMAND',
        staleReprocessMinutes: 24 * 60,
      }),
    );
    vi.useRealTimers();
  });
});
