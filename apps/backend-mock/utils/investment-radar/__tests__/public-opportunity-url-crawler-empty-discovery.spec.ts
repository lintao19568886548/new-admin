import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runPublicOpportunityUrlCrawlerTask } from '../public-opportunity-url-crawler';

const appendCrawlerTaskLog = vi.hoisted(() => vi.fn());
const claimCrawlerTaskItem = vi.hoisted(() => vi.fn());
const createCrawlerTask = vi.hoisted(() => vi.fn());
const getCrawlerTaskDetail = vi.hoisted(() => vi.fn());
const getPublicCrawlerAdapter = vi.hoisted(() => vi.fn());
const getPublicCrawlerSourceByCode = vi.hoisted(() => vi.fn());
const getPublicFactoryListingCrawlerSource = vi.hoisted(() => vi.fn());
const getPublicOpportunityCrawlerSource = vi.hoisted(() => vi.fn());
const listRunnableCrawlerTaskItems = vi.hoisted(() => vi.fn());
const markCrawlerSourceCrawled = vi.hoisted(() => vi.fn());
const markCrawlerTaskItemFailed = vi.hoisted(() => vi.fn());
const markCrawlerTaskItemSkipped = vi.hoisted(() => vi.fn());
const markCrawlerTaskItemSuccess = vi.hoisted(() => vi.fn());
const prismaQueryRawUnsafe = vi.hoisted(() => vi.fn());
const reclaimStaleRunningCrawlerTaskItems = vi.hoisted(() => vi.fn());
const seedCrawlerTaskItems = vi.hoisted(() => vi.fn());
const updateCrawlerTaskStatus = vi.hoisted(() => vi.fn());
const upsertCrawlerPublicOpportunity = vi.hoisted(() => vi.fn());
const upsertExternalLeadFromCrawler = vi.hoisted(() => vi.fn());

const CrawlerTaskValidationError = vi.hoisted(
  () =>
    class CrawlerTaskValidationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CrawlerTaskValidationError';
      }
    },
);

const PublicOpportunityQualitySkipError = vi.hoisted(
  () =>
    class PublicOpportunityQualitySkipError extends Error {
      qualityResult: unknown;
      skipReason: string;

      constructor(skipReason: string, qualityResult: unknown) {
        super(skipReason);
        this.name = 'PublicOpportunityQualitySkipError';
        this.qualityResult = qualityResult;
        this.skipReason = skipReason;
      }
    },
);

vi.mock('../../db', () => ({
  prismaClient: {
    $queryRawUnsafe: prismaQueryRawUnsafe,
  },
}));

vi.mock('../crawler-source-repository', () => ({
  getPublicCrawlerSourceByCode,
  getPublicFactoryListingCrawlerSource,
  getPublicOpportunityCrawlerSource,
  markCrawlerSourceCrawled,
}));

vi.mock('../crawler-task-item-repository', () => ({
  claimCrawlerTaskItem,
  listRunnableCrawlerTaskItems,
  markCrawlerTaskItemFailed,
  markCrawlerTaskItemSkipped,
  markCrawlerTaskItemSuccess,
  reclaimStaleRunningCrawlerTaskItems,
  seedCrawlerTaskItems,
}));

vi.mock('../crawler-task-repository', () => ({
  appendCrawlerTaskLog,
  CrawlerTaskValidationError,
  createCrawlerTask,
  getCrawlerTaskDetail,
  updateCrawlerTaskStatus,
}));

vi.mock('../external-lead-repository', () => ({
  upsertExternalLeadFromCrawler,
}));

vi.mock('../public-crawler-adapters', () => ({
  getPublicCrawlerAdapter,
}));

vi.mock('../public-opportunity-lead-rebuilder', () => ({
  buildExternalLeadInputFromPublicOpportunityRow: vi.fn(() => ({
    input: {},
    matchedKeywords: [],
    skipReason: null,
  })),
}));

vi.mock('../public-opportunity-repository', () => ({
  PublicOpportunityQualitySkipError,
  upsertCrawlerPublicOpportunity,
}));

const sourceCode = 'PUBLIC_FACTORY_LISTING_99CFW_DG';
const listUrl = 'https://dg.example.com/changfang/';

function buildSource() {
  return {
    allowedPathsJson: ['/changfang/'],
    baseUrl: listUrl,
    blockedPathsJson: [],
    crawlIntervalMinutes: 5,
    enabled: true,
    keywordExcludeJson: [],
    keywordIncludeJson: [],
    lastCrawledAt: null,
    rateLimitPerMinute: 120,
    regionScopeJson: ['广东'],
    robotsUrl: null,
    sourceCode,
    sourceId: 9001,
    sourceName: 'empty discovery test source',
    sourceType: 'PUBLIC_OPPORTUNITY',
  };
}

function buildAdapter() {
  return {
    allowedPaths: ['/changfang/'],
    buildListUrl: () => listUrl,
    buildListUrls: () => [listUrl],
    extractDetailUrlsFromListHtml: vi.fn(() => []),
    opportunityType: 'SUPPLY',
    platformName: 'empty discovery test adapter',
    sourceCode,
    sourceSite: 'example.com',
    validateDetailUrl: vi.fn(() => 'URL_DETAIL_PATH_NOT_ALLOWED'),
    validateListUrl: vi.fn(() => null),
  };
}

function buildHtmlResponse(body: string, finalUrl = listUrl) {
  const response = new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    status: 200,
  });
  Object.defineProperty(response, 'url', { value: finalUrl });
  return response;
}

function getLog(stage: string, message: string) {
  return appendCrawlerTaskLog.mock.calls
    .map((call) => call[0])
    .find((entry) => entry.stage === stage && entry.message === message);
}

async function runWithListBody(body: string) {
  const fetchMock = vi.fn().mockResolvedValue(buildHtmlResponse(body));
  vi.stubGlobal('fetch', fetchMock);

  const task = await runPublicOpportunityUrlCrawlerTask({
    batchSize: 10,
    discoverList: true,
    ignoreInterval: true,
    maxListPages: 1,
    sourceCode,
  });
  return { fetchMock, task };
}

describe('public opportunity URL crawler empty list discovery', () => {
  let lastTaskStatus:
    | undefined
    | {
        createdLeadCount?: number;
        errorMessage?: null | string;
        fetchedCount?: number;
        skippedCount?: number;
        skipReason?: null | string;
        status?: string;
        updatedLeadCount?: number;
      };

  beforeEach(() => {
    lastTaskStatus = undefined;
    appendCrawlerTaskLog.mockReset().mockResolvedValue(undefined);
    claimCrawlerTaskItem.mockReset().mockResolvedValue(true);
    createCrawlerTask.mockReset().mockResolvedValue(123);
    getPublicCrawlerAdapter.mockReset().mockReturnValue(buildAdapter());
    getPublicCrawlerSourceByCode.mockReset().mockResolvedValue(buildSource());
    getPublicFactoryListingCrawlerSource.mockReset().mockResolvedValue(null);
    getPublicOpportunityCrawlerSource.mockReset().mockResolvedValue(null);
    listRunnableCrawlerTaskItems.mockReset().mockResolvedValue([]);
    markCrawlerSourceCrawled.mockReset().mockResolvedValue(undefined);
    markCrawlerTaskItemFailed.mockReset().mockResolvedValue({
      finalStatus: 'FAILED',
      retryCount: 1,
    });
    markCrawlerTaskItemSkipped.mockReset().mockResolvedValue(undefined);
    markCrawlerTaskItemSuccess.mockReset().mockResolvedValue(undefined);
    prismaQueryRawUnsafe.mockReset().mockResolvedValue([]);
    reclaimStaleRunningCrawlerTaskItems.mockReset().mockResolvedValue({
      reclaimedCount: 0,
    });
    seedCrawlerTaskItems.mockReset().mockResolvedValue({
      createdCount: 0,
      updatedCount: 0,
    });
    updateCrawlerTaskStatus.mockReset().mockImplementation(async (params) => {
      lastTaskStatus = { ...lastTaskStatus, ...params };
    });
    getCrawlerTaskDetail.mockReset().mockImplementation(async (taskId) => ({
      createdLeadCount: lastTaskStatus?.createdLeadCount || 0,
      errorMessage: lastTaskStatus?.errorMessage || null,
      fetchedCount: lastTaskStatus?.fetchedCount || 0,
      retryCount: 0,
      skippedCount: lastTaskStatus?.skippedCount || 0,
      skipReason: lastTaskStatus?.skipReason || null,
      sourceCode,
      sourceId: 9001,
      sourceName: 'empty discovery test source',
      status: lastTaskStatus?.status || 'PENDING',
      taskId,
      taskType: 'PUBLIC_OPPORTUNITY_URL_BATCH',
      updatedLeadCount: lastTaskStatus?.updatedLeadCount || 0,
    }));
    upsertCrawlerPublicOpportunity.mockReset();
    upsertExternalLeadFromCrawler.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails an OK list page with an empty body and records list diagnostics', async () => {
    const { task } = await runWithListBody('');

    expect(task).toMatchObject({
      errorMessage: 'LIST_DISCOVERY_EMPTY:EMPTY_BODY',
      status: 'FAILED',
    });

    const fetchLog = getLog('DISCOVER', 'public opportunity list page fetched');
    expect(fetchLog?.detail).toMatchObject({
      finalUrl: listUrl,
      httpStatus: 200,
      listUrl,
    });

    const finishLog = getLog(
      'FINISH',
      'public opportunity URL crawler task finished with list discovery failure',
    );
    expect(finishLog?.detail).toMatchObject({
      discoveredCount: 0,
      errorMessage: 'LIST_DISCOVERY_EMPTY:EMPTY_BODY',
      httpStatus: null,
      listFinalUrl: listUrl,
      seedCreatedCount: 0,
      seedUpdatedCount: 0,
      status: 'FAILED',
    });
    expect(finishLog?.detail?.contentIssueSamples).toMatchObject([
      {
        finalUrl: listUrl,
        httpStatus: 200,
        issueCode: 'EMPTY_BODY',
        listUrl,
      },
    ]);
  });

  it('fails an OK page without listing signals or detail URLs', async () => {
    const { task } = await runWithListBody(
      '<html><title>About</title><body><main>Company profile</main></body></html>',
    );

    expect(task).toMatchObject({
      errorMessage: 'LIST_DISCOVERY_EMPTY:NO_LISTING_SIGNAL',
      status: 'FAILED',
    });

    const finishLog = getLog(
      'FINISH',
      'public opportunity URL crawler task finished with list discovery failure',
    );
    expect(finishLog?.detail?.contentIssueSamples).toMatchObject([
      {
        finalUrl: listUrl,
        httpStatus: 200,
        issueCode: 'NO_LISTING_SIGNAL',
        listUrl,
        title: 'About',
      },
    ]);
  });

  it('fails an OK listing-looking shell without detail URLs', async () => {
    const { task } = await runWithListBody(
      '<html><title>厂房出租</title><body>厂房 出租 面积 租金 房源供应</body></html>',
    );

    expect(task).toMatchObject({
      errorMessage: 'LIST_DISCOVERY_EMPTY:NO_DETAIL_URLS',
      status: 'FAILED',
    });

    const discoverLog = getLog(
      'DISCOVER',
      'public opportunity list URLs discovered and queued',
    );
    expect(discoverLog?.detail).toMatchObject({
      discoveredCount: 0,
      listContentIssue: 'NO_DETAIL_URLS',
      seedCreatedCount: 0,
      seedUpdatedCount: 0,
    });

    const finishLog = getLog(
      'FINISH',
      'public opportunity URL crawler task finished with list discovery failure',
    );
    expect(finishLog?.detail?.contentIssueSamples).toMatchObject([
      {
        finalUrl: listUrl,
        httpStatus: 200,
        issueCode: 'NO_DETAIL_URLS',
        listUrl,
      },
    ]);
  });

  it('enables stale URL item reprocessing for recurring automatic collection', async () => {
    const task = await runPublicOpportunityUrlCrawlerTask({
      batchSize: 10,
      discoverList: false,
      ignoreInterval: true,
      sourceCode,
    });

    expect(task).toMatchObject({ status: 'SUCCESS' });
    expect(listRunnableCrawlerTaskItems).toHaveBeenCalledWith(
      expect.objectContaining({
        staleReprocessAfter: expect.any(Date),
      }),
    );
    expect(createCrawlerTask).toHaveBeenCalledWith(
      expect.objectContaining({
        requestConfig: expect.objectContaining({
          staleReprocessMinutes: 24 * 60,
        }),
      }),
    );
    expect(claimCrawlerTaskItem).not.toHaveBeenCalled();

    const queueLog = getLog('QUEUE', 'public opportunity URL batch claimed');
    expect(queueLog?.detail).toMatchObject({
      itemCount: 0,
      staleReprocessAfter: expect.any(String),
    });
  });

  it('passes stale reprocess cutoff into item claim when a stale item is selected', async () => {
    const staleItem = {
      itemId: 7788,
      lastFinishedAt: '2026-05-20T09:50:00.000Z',
      publishedAt: '2026-05-19T16:00:00.000Z',
      sourceUrl: 'https://dg.example.com/changfang/demo.html',
      status: 'SUCCESS',
    };
    listRunnableCrawlerTaskItems.mockResolvedValueOnce([staleItem]);
    claimCrawlerTaskItem.mockResolvedValueOnce(false);

    await runPublicOpportunityUrlCrawlerTask({
      batchSize: 10,
      discoverList: false,
      ignoreInterval: true,
      sourceCode,
    });

    const listCall = listRunnableCrawlerTaskItems.mock.calls[0]?.[0];
    expect(claimCrawlerTaskItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: staleItem.itemId,
        staleReprocessAfter: listCall.staleReprocessAfter,
        taskId: 123,
      }),
    );
  });

  it('filters invalid queued URLs before fetching detail pages', async () => {
    getPublicCrawlerAdapter.mockReturnValue({
      ...buildAdapter(),
      validateDetailUrl: vi.fn((sourceUrl: string) =>
        sourceUrl.includes('/changfang/valid.html')
          ? null
          : 'URL_DETAIL_PATH_NOT_ALLOWED',
      ),
    });
    listRunnableCrawlerTaskItems.mockResolvedValueOnce([
      {
        itemId: 7789,
        publishedAt: null,
        sourceUrl: 'https://dg.example.com/changfang/category/',
        status: 'PENDING',
      },
      {
        itemId: 7790,
        publishedAt: null,
        sourceUrl: 'https://dg.example.com/changfang/valid.html',
        status: 'PENDING',
      },
    ]);
    claimCrawlerTaskItem
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await runPublicOpportunityUrlCrawlerTask({
      batchSize: 10,
      discoverList: false,
      ignoreInterval: true,
      sourceCode,
    });

    expect(markCrawlerTaskItemSkipped).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 7789,
        reason: 'URL_DETAIL_PATH_NOT_ALLOWED',
        taskId: 123,
      }),
    );
    expect(claimCrawlerTaskItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ itemId: 7789 }),
    );
    expect(claimCrawlerTaskItem).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ itemId: 7790 }),
    );
    const cleanupLog = getLog(
      'QUEUE',
      'invalid queued public URLs skipped before fetch',
    );
    expect(cleanupLog?.detail).toMatchObject({
      candidateCount: 2,
      skippedCount: 1,
    });
    const queueLog = getLog('QUEUE', 'public opportunity URL batch claimed');
    expect(queueLog?.detail).toMatchObject({
      candidateCount: 2,
      itemCount: 1,
      policySkippedCount: 1,
    });
  });

  it('normalizes BigInt opportunity ids before seeding existing public rows', async () => {
    getPublicCrawlerAdapter.mockReturnValue({
      ...buildAdapter(),
      validateDetailUrl: vi.fn(() => null),
    });
    prismaQueryRawUnsafe.mockImplementation(async (_sql, ...params) => {
      if (params.includes('SUPPLY') && params.includes('example.com')) {
        return [
          {
            opportunityId: 2_050_097n,
            opportunityType: 'SUPPLY',
            publishedAt: '2026-05-19T16:00:00.000Z',
            sourceSite: 'example.com',
            sourceUrl: 'https://dg.example.com/changfang/demo.html',
            title: 'demo listing',
          },
        ];
      }
      return [];
    });

    await runPublicOpportunityUrlCrawlerTask({
      batchSize: 10,
      discoverList: false,
      ignoreInterval: true,
      sourceCode,
    });

    const seedInput = seedCrawlerTaskItems.mock.calls[0]?.[0]?.[0];

    expect(seedInput).toMatchObject({
      sourceRefId: 2_050_097,
      sourceRefType: 'investment_public_opportunity',
    });
    expect(
      appendCrawlerTaskLog.mock.calls.some(
        (call) =>
          call[0]?.stage === 'FINISH' &&
          String(call[0]?.detail?.errorMessage || '').includes('BigInt'),
      ),
    ).toBe(false);
  });
});
