import { describe, expect, it } from 'vitest';

import {
  createEmptyPublicListDiscoveryResult,
  resolvePublicOpportunityTaskFinishOutcome,
} from '../public-opportunity-list-discovery';

describe('public opportunity list discovery finish outcome', () => {
  it('fails a task when list discovery cannot fetch any list page and no items were claimed', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(2);
    discoveryResult.failedListFetchCount = 2;
    discoveryResult.fetchErrorSamples.push({
      errorMessage: 'This operation was aborted',
      errorName: 'AbortError',
      listUrl: 'https://www.zgzsw.com/xuqiu/guangdong/',
    });

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 0,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({
      errorMessage: 'LIST_DISCOVERY_UNAVAILABLE:This operation was aborted',
      status: 'FAILED',
    });
  });

  it('does not fail the task when queue items were still available to process', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(1);
    discoveryResult.failedListFetchCount = 1;
    discoveryResult.fetchErrorSamples.push({
      errorMessage: 'fetch failed',
      errorName: 'TypeError',
      listUrl: 'https://www.cfzx.com/xuqiu/',
    });

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 1,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({ errorMessage: null, status: 'SUCCESS' });
  });

  it('fails a task when every fetched list page returned a non-OK status and no items were claimed', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(2);
    discoveryResult.fetchedListCount = 2;
    discoveryResult.nonOkListFetchCount = 2;
    discoveryResult.nonOkSamples.push({
      httpStatus: 403,
      listUrl: 'https://dg.99cfw.com/changfang/',
      responseHash: 'blocked-page-hash',
    });

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 0,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({
      errorMessage: 'LIST_DISCOVERY_UNAVAILABLE:HTTP_403',
      status: 'FAILED',
    });
  });

  it('fails a task when OK list pages do not yield any detail URLs and no items were claimed', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(2);
    discoveryResult.fetchedListCount = 2;

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 0,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({
      errorMessage: 'LIST_DISCOVERY_EMPTY:NO_DETAIL_URLS',
      status: 'FAILED',
    });
  });

  it('fails list discovery with no list URLs and no runnable queue items', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(0);

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 0,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({
      errorMessage: 'LIST_DISCOVERY_EMPTY:NO_LIST_URLS',
      status: 'FAILED',
    });
  });

  it('uses missing listing signal as the empty discovery reason', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(1);
    discoveryResult.fetchedListCount = 1;
    discoveryResult.contentIssueCount = 1;
    discoveryResult.contentIssueSamples.push({
      finalUrl: 'https://example.com/about',
      httpStatus: 200,
      issueCode: 'NO_LISTING_SIGNAL',
      listUrl: 'https://example.com/list',
      responseHash: 'about-page-hash',
      signals: {
        hasAntiBotHint: false,
        hasBlockedHint: false,
        hasDetailHint: false,
        hasEmptyHint: false,
        hasLoginRedirectHint: false,
        hasListingHint: false,
        hasNotFoundHint: false,
      },
      textSample: 'About us',
      title: 'About',
    });

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 0,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({
      errorMessage: 'LIST_DISCOVERY_EMPTY:NO_LISTING_SIGNAL',
      status: 'FAILED',
    });
  });

  it('uses no detail URL samples as the empty discovery reason', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(1);
    discoveryResult.contentIssueCount = 1;
    discoveryResult.fetchedListCount = 1;
    discoveryResult.contentIssueSamples.push({
      finalUrl: 'https://dg.example.com/factory/',
      httpStatus: 200,
      issueCode: 'NO_DETAIL_URLS',
      listUrl: 'https://dg.example.com/factory/',
      responseHash: 'listing-shell-hash',
      signals: {
        hasAntiBotHint: false,
        hasBlockedHint: false,
        hasDetailHint: true,
        hasEmptyHint: false,
        hasLoginRedirectHint: false,
        hasListingHint: true,
        hasNotFoundHint: false,
      },
      textSample: '厂房 出租 面积 租金',
      title: '厂房出租',
    });

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 0,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({
      errorMessage: 'LIST_DISCOVERY_EMPTY:NO_DETAIL_URLS',
      status: 'FAILED',
    });
  });

  it('uses anti-bot content issue as the empty discovery reason', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(1);
    discoveryResult.fetchedListCount = 1;
    discoveryResult.contentIssueCount = 1;
    discoveryResult.contentIssueSamples.push({
      finalUrl: 'https://callback.58.com/antibot/verifycode',
      issueCode: 'ANTI_BOT',
      listUrl: 'https://www.58.com/dg/cfcz-7-dg/',
      responseHash: 'captcha-page-hash',
      signals: {
        hasAntiBotHint: true,
        hasBlockedHint: false,
        hasDetailHint: false,
        hasEmptyHint: false,
        hasLoginRedirectHint: false,
        hasListingHint: false,
        hasNotFoundHint: false,
      },
      textSample: '验证码',
      title: '验证码',
    });

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 0,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({
      errorMessage: 'LIST_DISCOVERY_EMPTY:ANTI_BOT',
      status: 'FAILED',
    });
  });

  it('uses empty body content issue as the empty discovery reason', () => {
    const discoveryResult = createEmptyPublicListDiscoveryResult(1);
    discoveryResult.fetchedListCount = 1;
    discoveryResult.contentIssueCount = 1;
    discoveryResult.contentIssueSamples.push({
      finalUrl: 'https://dg.toodc.cn/map/u1',
      issueCode: 'EMPTY_BODY',
      listUrl: 'https://dg.toodc.cn/map/u1',
      responseHash: 'spa-shell-hash',
      signals: {
        hasAntiBotHint: false,
        hasBlockedHint: false,
        hasDetailHint: false,
        hasEmptyHint: false,
        hasLoginRedirectHint: false,
        hasListingHint: false,
        hasNotFoundHint: false,
      },
      textSample: null,
      title: null,
    });

    expect(
      resolvePublicOpportunityTaskFinishOutcome({
        createdLeadCount: 0,
        discoverList: true,
        discoveryResult,
        fetchedCount: 0,
        itemCount: 0,
        skippedCount: 0,
        updatedLeadCount: 0,
      }),
    ).toEqual({
      errorMessage: 'LIST_DISCOVERY_EMPTY:EMPTY_BODY',
      status: 'FAILED',
    });
  });
});
