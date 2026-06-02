import type { CrawlerTaskStatus } from './crawler-types';

export interface PublicListPageContentSignals {
  hasAntiBotHint: boolean;
  hasBlockedHint: boolean;
  hasDetailHint: boolean;
  hasEmptyHint: boolean;
  hasLoginRedirectHint: boolean;
  hasListingHint: boolean;
  hasNotFoundHint: boolean;
}

export interface PublicListDiscoveryContentIssueSample {
  finalUrl?: null | string;
  httpStatus?: null | number;
  issueCode: string;
  listUrl: string;
  responseHash?: null | string;
  signals?: PublicListPageContentSignals;
  textSample?: null | string;
  title?: null | string;
}

export interface PublicListDiscoveryResult {
  contentIssueCount: number;
  contentIssueSamples: PublicListDiscoveryContentIssueSample[];
  discoveredDetailCount: number;
  discoveredListCount: number;
  failedListFetchCount: number;
  fetchErrorSamples: Array<{
    errorMessage?: string;
    errorName?: string;
    listUrl: string;
  }>;
  fetchedListCount: number;
  initialListUrlCount: number;
  nonOkListFetchCount: number;
  nonOkSamples: Array<{
    finalUrl?: null | string;
    httpStatus: number;
    listUrl: string;
    responseHash?: null | string;
  }>;
  policySkippedListCount: number;
  seedCreatedCount: number;
  seedUpdatedCount: number;
  visitedListUrlCount: number;
}

export interface PublicOpportunityTaskFinishOutcome {
  errorMessage?: null | string;
  status: Extract<CrawlerTaskStatus, 'FAILED' | 'SUCCESS'>;
}

export function createEmptyPublicListDiscoveryResult(
  initialListUrlCount = 0,
): PublicListDiscoveryResult {
  return {
    contentIssueCount: 0,
    contentIssueSamples: [],
    discoveredDetailCount: 0,
    discoveredListCount: 0,
    failedListFetchCount: 0,
    fetchErrorSamples: [],
    fetchedListCount: 0,
    initialListUrlCount,
    nonOkListFetchCount: 0,
    nonOkSamples: [],
    policySkippedListCount: 0,
    seedCreatedCount: 0,
    seedUpdatedCount: 0,
    visitedListUrlCount: 0,
  };
}

function buildListDiscoveryUnavailableReason(
  discovery: PublicListDiscoveryResult,
) {
  const firstError = discovery.fetchErrorSamples[0];
  if (firstError?.errorMessage) {
    return `LIST_DISCOVERY_UNAVAILABLE:${firstError.errorMessage}`;
  }
  const firstNonOk = discovery.nonOkSamples[0];
  if (firstNonOk?.httpStatus) {
    return `LIST_DISCOVERY_UNAVAILABLE:HTTP_${firstNonOk.httpStatus}`;
  }
  return 'LIST_DISCOVERY_UNAVAILABLE';
}

function buildListDiscoveryEmptyReason(discovery: PublicListDiscoveryResult) {
  const okListFetchCount =
    discovery.fetchedListCount - discovery.nonOkListFetchCount;
  if (okListFetchCount > 0) {
    const issuePriority = [
      'ANTI_BOT',
      'BLOCKED',
      'LOGIN_REQUIRED',
      'EMPTY_BODY',
      'NOT_FOUND',
      'EMPTY_LIST',
      'NO_LISTING_SIGNAL',
      'NO_DETAIL_URLS',
    ];
    const contentIssue =
      issuePriority.find((issueCode) =>
        discovery.contentIssueSamples.some(
          (sample) => sample.issueCode === issueCode,
        ),
      ) || discovery.contentIssueSamples[0]?.issueCode;
    if (contentIssue) {
      return `LIST_DISCOVERY_EMPTY:${contentIssue}`;
    }
    return 'LIST_DISCOVERY_EMPTY:NO_DETAIL_URLS';
  }
  if (discovery.policySkippedListCount > 0) {
    return 'LIST_DISCOVERY_EMPTY:LIST_URL_POLICY_SKIPPED';
  }
  return 'LIST_DISCOVERY_EMPTY';
}

export function resolvePublicOpportunityTaskFinishOutcome(params: {
  createdLeadCount: number;
  discoverList: boolean;
  discoveryResult?: null | PublicListDiscoveryResult;
  fetchedCount: number;
  itemCount: number;
  skippedCount: number;
  updatedLeadCount: number;
}): PublicOpportunityTaskFinishOutcome {
  const discovery = params.discoveryResult;
  if (!params.discoverList || !discovery) {
    return { errorMessage: null, status: 'SUCCESS' };
  }

  const taskHadItemWork =
    params.itemCount > 0 ||
    params.fetchedCount > 0 ||
    params.createdLeadCount > 0 ||
    params.updatedLeadCount > 0 ||
    params.skippedCount > 0;
  if (taskHadItemWork || discovery.discoveredDetailCount > 0) {
    return { errorMessage: null, status: 'SUCCESS' };
  }

  if (discovery.initialListUrlCount <= 0) {
    return {
      errorMessage: 'LIST_DISCOVERY_EMPTY:NO_LIST_URLS',
      status: 'FAILED',
    };
  }

  const listFetchAttemptCount =
    discovery.fetchedListCount + discovery.failedListFetchCount;
  const okListFetchCount =
    discovery.fetchedListCount - discovery.nonOkListFetchCount;
  if (listFetchAttemptCount > 0 && okListFetchCount <= 0) {
    return {
      errorMessage: buildListDiscoveryUnavailableReason(discovery),
      status: 'FAILED',
    };
  }

  if (
    discovery.initialListUrlCount > 0 &&
    discovery.discoveredDetailCount <= 0 &&
    (okListFetchCount > 0 || discovery.policySkippedListCount > 0)
  ) {
    return {
      errorMessage: buildListDiscoveryEmptyReason(discovery),
      status: 'FAILED',
    };
  }

  return { errorMessage: null, status: 'SUCCESS' };
}
