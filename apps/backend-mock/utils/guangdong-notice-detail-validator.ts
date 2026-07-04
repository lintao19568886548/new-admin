const DEFAULT_GD_NOTICE_CHECK_TIMEOUT_MS = 8000;

export const GD_NOTICE_INVALID_REASONS = {
  DETAIL_EMPTY_OR_LOADING: 'DETAIL_EMPTY_OR_LOADING',
  DETAIL_FETCH_FAILED: 'DETAIL_FETCH_FAILED',
  DETAIL_NO_DATA: 'DETAIL_NO_DATA',
  DETAIL_STRUCTURE_INVALID: 'DETAIL_STRUCTURE_INVALID',
  LINK_INVALID: 'LINK_INVALID',
} as const;

interface GuangdongNoticeQuery {
  bizCode: string;
  nodeId: string;
  noticeId: string;
  projectCode: string;
  publishDate: string;
  siteCode: string;
  tradingType: string;
}

interface ValidateGuangdongNoticeDetailOptions {
  timeoutMs?: number;
}

interface ValidateGuangdongNoticeDetailResult {
  checkedAt: Date;
  normalizedLink?: string;
  originalNodeId?: string;
  reason?: string;
  resolvedNodeId?: string;
  valid: boolean;
}

interface GuangdongNoticeCandidate {
  link?: null | string;
  [key: string]: unknown;
}

const GUANGDONG_NOTICE_DETAIL_API =
  'https://ygp.gdzwfw.gov.cn/ggzy-portal/center/apis/trading-notice/new/detail';
const GUANGDONG_NOTICE_SINGLE_NODE_API =
  'https://ygp.gdzwfw.gov.cn/ggzy-portal/center/apis/trading-notice/new/singleNode';

function readPositiveNumber(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getCheckTimeout(options: ValidateGuangdongNoticeDetailOptions) {
  return (
    options.timeoutMs ||
    readPositiveNumber(
      process.env.GD_NOTICE_DETAIL_CHECK_TIMEOUT_MS,
      DEFAULT_GD_NOTICE_CHECK_TIMEOUT_MS,
    )
  );
}

function decodeText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function compactText(value: string) {
  return value.replaceAll(/\s+/g, '').toLowerCase();
}

function hasNoDataMessage(text: string) {
  const normalized = compactText(decodeText(text));
  return [
    '暂无数据',
    '暫無數據',
    '没有数据',
    '未查询到相关数据',
    '未查到相关数据',
    '查询无结果',
    '信息不存在',
    '公告不存在',
    '数据不存在',
    'nodata',
    'norecord',
    'notfound',
  ].some((message) => normalized.includes(compactText(message)));
}

function getQueryValue(url: URL, name: string) {
  const fromSearch = url.searchParams.get(name);
  if (fromSearch) {
    return fromSearch.trim();
  }

  const hashText = url.hash.replace(/^#/, '');
  const queryStart = hashText.indexOf('?');
  if (queryStart === -1) {
    return '';
  }

  return (
    new URLSearchParams(hashText.slice(queryStart + 1)).get(name)?.trim() || ''
  );
}

function parseGuangdongNoticeQuery(link?: null | string) {
  const href = String(link || '').trim();
  if (!href) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (!url.hostname.toLowerCase().endsWith('gdzwfw.gov.cn')) {
    return null;
  }

  const query: GuangdongNoticeQuery = {
    bizCode: getQueryValue(url, 'bizCode'),
    nodeId: getQueryValue(url, 'nodeId'),
    noticeId: getQueryValue(url, 'noticeId'),
    projectCode: getQueryValue(url, 'projectCode'),
    publishDate: getQueryValue(url, 'publishDate'),
    siteCode: getQueryValue(url, 'siteCode'),
    tradingType: '',
  };
  const pathMatch = /\/jygg\/v\d+\/([^/?#]+)/i.exec(url.hash);
  query.tradingType =
    getQueryValue(url, 'tradingType') || pathMatch?.[1]?.trim() || '';

  return query.noticeId ? query : null;
}

function normalizeGuangdongNoticeLinkNodeId(
  link: string,
  resolvedNodeId: string,
) {
  const href = String(link || '').trim();
  if (!href || !resolvedNodeId) {
    return href;
  }

  try {
    const url = new URL(href);
    const hashText = url.hash.replace(/^#/, '');
    const hashQueryStart = hashText.indexOf('?');

    if (hashQueryStart !== -1) {
      const hashPath = hashText.slice(0, hashQueryStart);
      const hashParams = new URLSearchParams(
        hashText.slice(hashQueryStart + 1),
      );
      hashParams.set('nodeId', resolvedNodeId);
      url.hash = `${hashPath}?${hashParams.toString()}`;
      return url.href;
    }

    if (url.searchParams.has('nodeId')) {
      url.searchParams.set('nodeId', resolvedNodeId);
      return url.href;
    }

    if (hashText) {
      const hashParams = new URLSearchParams();
      hashParams.set('nodeId', resolvedNodeId);
      url.hash = `${hashText}?${hashParams.toString()}`;
      return url.href;
    }

    url.searchParams.set('nodeId', resolvedNodeId);
    return url.href;
  } catch {
    return href;
  }
}

function hasValidDetailData(payload: any) {
  const data = payload?.data;
  if (!data || typeof data !== 'object') {
    return false;
  }

  const title = String(data.title || '').trim();
  if (!title) {
    return false;
  }

  return (
    Array.isArray(data.tradingNoticeColumnModelList) &&
    data.tradingNoticeColumnModelList.length > 0
  );
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildSingleNodeApiUrl(query: GuangdongNoticeQuery) {
  const url = new URL(GUANGDONG_NOTICE_SINGLE_NODE_API);
  for (const name of ['siteCode', 'tradingType', 'bizCode'] as const) {
    if (query[name]) {
      url.searchParams.set(name, query[name]);
    }
  }
  return url.href;
}

function buildDetailApiUrl(query: GuangdongNoticeQuery, nodeId: string) {
  const url = new URL(GUANGDONG_NOTICE_DETAIL_API);
  url.searchParams.set('nodeId', nodeId);
  url.searchParams.set('version', 'v3');
  for (const name of [
    'tradingType',
    'noticeId',
    'bizCode',
    'projectCode',
    'siteCode',
  ] as const) {
    if (query[name]) {
      url.searchParams.set(name, query[name]);
    }
  }
  return url.href;
}

async function validateByDetailApi(
  query: GuangdongNoticeQuery,
  href: string,
  timeoutMs: number,
) {
  try {
    const singleNodeResponse = await fetchWithTimeout(
      buildSingleNodeApiUrl(query),
      timeoutMs,
    );
    if (!singleNodeResponse.ok) {
      return {
        reason: GD_NOTICE_INVALID_REASONS.DETAIL_FETCH_FAILED,
        valid: false,
      };
    }

    const singleNodeText = await singleNodeResponse.text();
    if (hasNoDataMessage(singleNodeText)) {
      return {
        reason: GD_NOTICE_INVALID_REASONS.DETAIL_NO_DATA,
        valid: false,
      };
    }

    const singleNodePayload = JSON.parse(singleNodeText);
    const nodeId = String(singleNodePayload?.data || '').trim();
    if (!nodeId) {
      return {
        reason: GD_NOTICE_INVALID_REASONS.DETAIL_STRUCTURE_INVALID,
        valid: false,
      };
    }

    const normalizedLink =
      query.nodeId === nodeId
        ? undefined
        : normalizeGuangdongNoticeLinkNodeId(href, nodeId);

    const detailResponse = await fetchWithTimeout(
      buildDetailApiUrl(query, nodeId),
      timeoutMs,
    );
    if (!detailResponse.ok) {
      return {
        reason: GD_NOTICE_INVALID_REASONS.DETAIL_FETCH_FAILED,
        valid: false,
      };
    }

    const detailText = await detailResponse.text();
    if (hasNoDataMessage(detailText)) {
      return {
        reason: GD_NOTICE_INVALID_REASONS.DETAIL_NO_DATA,
        valid: false,
      };
    }

    const detailPayload = JSON.parse(detailText);
    if (hasValidDetailData(detailPayload)) {
      return {
        normalizedLink,
        originalNodeId: query.nodeId || undefined,
        resolvedNodeId: nodeId,
        valid: true,
      };
    }
    return {
      reason: GD_NOTICE_INVALID_REASONS.DETAIL_STRUCTURE_INVALID,
      valid: false,
    };
  } catch (error) {
    return {
      reason:
        (error as Error)?.name === 'AbortError'
          ? GD_NOTICE_INVALID_REASONS.DETAIL_EMPTY_OR_LOADING
          : GD_NOTICE_INVALID_REASONS.DETAIL_FETCH_FAILED,
      valid: false,
    };
  }
}

async function validateGuangdongNoticeDetail(
  link?: null | string,
  options: ValidateGuangdongNoticeDetailOptions = {},
): Promise<ValidateGuangdongNoticeDetailResult> {
  const checkedAt = new Date();
  const href = String(link || '').trim();
  if (!href) {
    return {
      checkedAt,
      reason: GD_NOTICE_INVALID_REASONS.LINK_INVALID,
      valid: false,
    };
  }

  const query = parseGuangdongNoticeQuery(href);
  if (!query) {
    return { checkedAt, valid: true };
  }

  const timeoutMs = getCheckTimeout(options);
  return { checkedAt, ...(await validateByDetailApi(query, href, timeoutMs)) };
}

async function filterValidGuangdongNoticeCandidatesBeforeInsert<
  T extends GuangdongNoticeCandidate,
>(rows: T[], options: ValidateGuangdongNoticeDetailOptions = {}) {
  const validRows: T[] = [];
  const invalidRows: Array<{
    item: T;
    result: ValidateGuangdongNoticeDetailResult;
  }> = [];

  for (const row of rows) {
    const result = await validateGuangdongNoticeDetail(row.link, options);
    if (result.valid) {
      validRows.push(
        result.normalizedLink
          ? ({ ...row, link: result.normalizedLink } as T)
          : row,
      );
    } else {
      invalidRows.push({ item: row, result });
    }
  }

  return {
    invalidRows,
    validRows,
  };
}

export {
  filterValidGuangdongNoticeCandidatesBeforeInsert,
  normalizeGuangdongNoticeLinkNodeId,
  parseGuangdongNoticeQuery,
  validateGuangdongNoticeDetail,
};
export type {
  GuangdongNoticeCandidate,
  ValidateGuangdongNoticeDetailOptions,
  ValidateGuangdongNoticeDetailResult,
};
