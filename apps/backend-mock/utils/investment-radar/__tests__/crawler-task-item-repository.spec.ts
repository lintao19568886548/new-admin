import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  claimCrawlerTaskItem,
  listRunnableCrawlerTaskItems,
  markCrawlerTaskItemFailed,
  markCrawlerTaskItemSkipped,
  markCrawlerTaskItemSuccess,
  seedCrawlerTaskItems,
} from '../crawler-task-item-repository';

const executeRawUnsafe = vi.hoisted(() => vi.fn());
const queryRawUnsafe = vi.hoisted(() => vi.fn());

vi.mock('../../db', () => ({
  prismaClient: {
    $executeRawUnsafe: executeRawUnsafe,
    $queryRawUnsafe: queryRawUnsafe,
  },
}));

vi.mock('../crawler-source-repository', () => ({
  ensureCrawlerSourceCatalog: vi.fn(),
}));

describe('crawler task item repository', () => {
  beforeEach(() => {
    executeRawUnsafe.mockReset();
    queryRawUnsafe.mockReset();
  });

  it('clears stale parsed payload when a task item is skipped', async () => {
    await markCrawlerTaskItemSkipped({
      itemId: 123,
      reason: 'QUALITY_INVALID:GUANGDONG_CITY_UNCONFIRMED',
      taskId: 456,
    });

    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, taskId, reason, parsedPayload, publishedAt, itemId] =
      executeRawUnsafe.mock.calls[0] as unknown[];

    expect(String(sql)).toContain('parsed_payload_json = ?');
    expect(String(sql)).toContain('published_at = COALESCE(?, published_at)');
    expect(taskId).toBe(456);
    expect(reason).toBe('QUALITY_INVALID:GUANGDONG_CITY_UNCONFIRMED');
    expect(parsedPayload).toBeNull();
    expect(publishedAt).toBeNull();
    expect(itemId).toBe(123);
  });

  it('stores the latest quality result when a skipped item has fresh diagnostics', async () => {
    await markCrawlerTaskItemSkipped({
      itemId: 124,
      parsedPayload: {
        qualityResult: {
          missingFields: ['city'],
          reasons: ['GUANGDONG_CITY_UNCONFIRMED'],
          status: 'INVALID',
        },
        sourceUrl: 'https://hz.99cfw.com/xuqiu/demo.htm',
      },
      reason: 'QUALITY_INVALID:GUANGDONG_CITY_UNCONFIRMED',
      taskId: 457,
    });

    const parsedPayload = executeRawUnsafe.mock.calls[0]?.[3];

    expect(JSON.parse(String(parsedPayload))).toEqual({
      qualityResult: {
        missingFields: ['city'],
        reasons: ['GUANGDONG_CITY_UNCONFIRMED'],
        status: 'INVALID',
      },
      sourceUrl: 'https://hz.99cfw.com/xuqiu/demo.htm',
    });
  });

  it('stores parsed published time when a task item succeeds', async () => {
    await markCrawlerTaskItemSuccess({
      httpStatus: 200,
      itemId: 125,
      parsedPayload: { sourceUrl: 'https://dg.99cfw.com/xuqiu/demo.htm' },
      publishedAt: '2026-05-19T16:00:00.000Z',
      responseText: 'detail html',
      taskId: 458,
    });

    const [sql, taskId, httpStatus, responseHash, parsedPayload, publishedAt] =
      executeRawUnsafe.mock.calls[0] as unknown[];

    expect(String(sql)).toContain('published_at = COALESCE(?, published_at)');
    expect(taskId).toBe(458);
    expect(httpStatus).toBe(200);
    expect(responseHash).toBeTypeOf('string');
    expect(JSON.parse(String(parsedPayload))).toEqual({
      sourceUrl: 'https://dg.99cfw.com/xuqiu/demo.htm',
    });
    expect(publishedAt).toEqual(new Date('2026-05-19T16:00:00.000Z'));
  });

  it('does not overwrite a parsed item published time with an empty list date', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ itemId: 125n }]);

    await seedCrawlerTaskItems([
      {
        maxRetryCount: 2,
        publishedAt: null,
        sourceId: 30_148,
        sourceUrl: 'https://dg.99cfw.com/xuqiu/demo.htm',
      },
    ]);

    const sql = String(executeRawUnsafe.mock.calls[0]?.[0] || '');

    expect(sql).toContain(
      'published_at = COALESCE(VALUES(published_at), published_at)',
    );
  });

  it('selects stale successful URL items for recurring detail refresh', async () => {
    const staleReprocessAfter = new Date('2026-05-20T10:00:00.000Z');
    queryRawUnsafe.mockResolvedValueOnce([]);

    await listRunnableCrawlerTaskItems({
      allowUnknownPublishedAt: true,
      freshAfter: new Date('2025-11-21T00:00:00.000Z'),
      limit: 10,
      sourceId: 30_148,
      staleReprocessAfter,
    });

    const [sql, sourceId, reprocessSuccess, staleAfterA, staleAfterB] =
      queryRawUnsafe.mock.calls[0] as unknown[];

    expect(String(sql)).toContain("status = 'SUCCESS'");
    expect(String(sql)).toContain(
      'AND (last_finished_at IS NULL OR last_finished_at <= ?)',
    );
    expect(sourceId).toBe(30_148);
    expect(reprocessSuccess).toBe(0);
    expect(staleAfterA).toBe(staleReprocessAfter);
    expect(staleAfterB).toBe(staleReprocessAfter);
  });

  it('can claim stale successful URL items without enabling full success reprocess', async () => {
    executeRawUnsafe.mockResolvedValueOnce(1);

    const staleReprocessAfter = new Date('2026-05-20T10:00:00.000Z');
    const claimed = await claimCrawlerTaskItem({
      itemId: 126,
      staleReprocessAfter,
      taskId: 459,
    });

    const [sql, taskId, itemId, reprocessSuccess, staleAfterA, staleAfterB] =
      executeRawUnsafe.mock.calls[0] as unknown[];

    expect(claimed).toBe(true);
    expect(String(sql)).toContain("status = 'SUCCESS'");
    expect(taskId).toBe(459);
    expect(itemId).toBe(126);
    expect(reprocessSuccess).toBe(0);
    expect(staleAfterA).toBe(staleReprocessAfter);
    expect(staleAfterB).toBe(staleReprocessAfter);
  });

  it.each([
    [0, 1, 5],
    [1, 2, 15],
    [2, 3, 45],
  ])(
    'backs off retry %s to %s with %s minutes',
    async (currentRetryCount, nextRetryCount, expectedDelayMinutes) => {
      queryRawUnsafe.mockResolvedValueOnce([{ retryCount: currentRetryCount }]);

      const result = await markCrawlerTaskItemFailed({
        itemId: 123,
        maxRetryCount: 4,
        message: 'HTTP_429',
        retryDelayMinutes: 30,
        taskId: 456,
      });

      expect(result).toEqual({
        finalStatus: 'RETRY_WAITING',
        retryCount: nextRetryCount,
      });
      expect(executeRawUnsafe.mock.calls[0]?.[6]).toBe(expectedDelayMinutes);
    },
  );

  it('does not schedule a next retry when max retry count is reached', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ retryCount: 2 }]);

    const result = await markCrawlerTaskItemFailed({
      itemId: 123,
      maxRetryCount: 3,
      message: 'HTTP_500',
      retryDelayMinutes: 30,
      taskId: 456,
    });

    expect(result).toEqual({ finalStatus: 'FAILED', retryCount: 3 });
    expect(executeRawUnsafe.mock.calls[0]?.[5]).toBe('FAILED');
  });
});
