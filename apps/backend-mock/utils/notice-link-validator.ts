import {
  GD_NOTICE_INVALID_REASONS,
  parseGuangdongNoticeQuery,
  validateGuangdongNoticeDetail,
} from './guangdong-notice-detail-validator';

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_CHECK_TIMEOUT_MS = 5000;
const MAX_TEXT_CONTENT_LENGTH = 2 * 1024 * 1024;
const CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

interface LinkCacheEntry {
  checkedAt: number;
  normalizedLink?: string;
  valid: boolean;
}

interface LinkValidationResult {
  normalizedLink?: string;
  valid: boolean;
}

const linkValidityCache = new Map<string, LinkCacheEntry>();

function cleanupExpiredCacheEntries() {
  const now = Date.now();
  const ttl = getCacheTtl();
  for (const [key, entry] of linkValidityCache.entries()) {
    if (now - entry.checkedAt >= ttl) {
      linkValidityCache.delete(key);
    }
  }
}

setInterval(cleanupExpiredCacheEntries, CACHE_CLEANUP_INTERVAL_MS).unref?.();

function compactText(value: string) {
  return value.replaceAll(/\s+/g, '').toLowerCase();
}

function decodeEscapedText(value: string) {
  return value
    .replaceAll(/\\u([\dA-Fa-f]{4})/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replaceAll(/&#x([\dA-Fa-f]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll(/&nbsp;/gi, ' ');
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeNoticeLink(link?: null | string) {
  const raw = String(link ?? '').trim();
  if (!raw) return '';

  try {
    const url = raw.startsWith('//') ? new URL(`https:${raw}`) : new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (['0.0.0.0', '::1', 'localhost'].includes(host)) return true;
  if (host.endsWith('.localhost')) return true;

  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isSafeNoticeUrl(value: string) {
  try {
    const url = new URL(value);
    return !isBlockedHostname(url.hostname);
  } catch {
    return false;
  }
}

function getCacheTtl(): number {
  return readPositiveNumber(
    process.env.NOTICE_LINK_CHECK_CACHE_TTL_MS,
    DEFAULT_CACHE_TTL_MS,
  );
}

function getCheckTimeout(): number {
  return readPositiveNumber(
    process.env.NOTICE_LINK_CHECK_TIMEOUT_MS,
    DEFAULT_CHECK_TIMEOUT_MS,
  );
}

function decodeTextCandidates(buffer: ArrayBuffer, contentType: string) {
  const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim();
  const labels = [...new Set([charset, 'utf8', 'gb18030'].filter(Boolean))];

  return labels
    .map((label) => {
      try {
        return new TextDecoder(label).decode(buffer);
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function getVisibleText(html: string) {
  return html
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replaceAll(/<!--[\s\S]*?-->/g, ' ')
    .replaceAll(/<[^>]+>/g, ' ');
}

function hasNoDataMessage(text: string) {
  const normalizedText = compactText(decodeEscapedText(text));
  const noDataMessages = [
    '暂无数据',
    '暫無數據',
    '暫無資料',
    '没有数据',
    '沒有資料',
    '无数据',
    '無資料',
    '未查询到相关数据',
    '未查到相关数据',
    '查询无结果',
    '没有查询到',
    '信息不存在',
    '公告不存在',
    '页面不存在',
    '内容不存在',
    '数据不存在',
    '记录不存在',
    'nodata',
    'norecord',
    'norecords',
    'notfound',
    'pagenotfound',
  ];

  return noDataMessages.some((message) =>
    normalizedText.includes(compactText(message)),
  );
}

async function fetchNoticeLink(url: string, signal: AbortSignal) {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    if (!isSafeNoticeUrl(currentUrl)) return null;

    const response = await fetch(currentUrl, {
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Range: 'bytes=0-131071',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      },
      redirect: 'manual',
      signal,
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) return response;

    currentUrl = new URL(location, currentUrl).href;
  }

  return null;
}

async function probeNoticeLink(href: string, _title?: null | string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getCheckTimeout());

  try {
    const response = await fetchNoticeLink(href, controller.signal);
    if (!response) {
      return true;
    }

    if (!isSafeNoticeUrl(response.url)) {
      return false;
    }
    if ([404, 410].includes(response.status)) {
      return false;
    }
    if (!response.ok) {
      return true;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!/html|json|text|xml/i.test(contentType)) {
      return true;
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_TEXT_CONTENT_LENGTH) {
      return true;
    }

    const buffer = await response.arrayBuffer();
    const textCandidates = decodeTextCandidates(buffer, contentType);
    const visibleTextCandidates = textCandidates.map((text) =>
      getVisibleText(decodeEscapedText(text)),
    );

    // 只检测明确的"暂无数据"等失效提示，其他情况都视为有效
    const hasNoData = visibleTextCandidates.some((text) =>
      hasNoDataMessage(text),
    );

    return !hasNoData;
  } catch {
    // 网络错误时保守处理，视为有效
    return true;
  } finally {
    clearTimeout(timer);
  }
}

function isTransientGuangdongNoticeReason(reason?: string) {
  return (
    reason === GD_NOTICE_INVALID_REASONS.DETAIL_EMPTY_OR_LOADING ||
    reason === GD_NOTICE_INVALID_REASONS.DETAIL_FETCH_FAILED
  );
}

async function probeGuangdongNoticeLink(
  href: string,
): Promise<LinkValidationResult> {
  const result = await validateGuangdongNoticeDetail(href, {
    timeoutMs: getCheckTimeout(),
  });

  if (!result.valid && isTransientGuangdongNoticeReason(result.reason)) {
    return { valid: true };
  }

  return {
    normalizedLink: result.valid ? result.normalizedLink : undefined,
    valid: result.valid,
  };
}

async function validateNoticeLink(
  link?: null | string,
  title?: null | string,
): Promise<LinkValidationResult> {
  const href = normalizeNoticeLink(link);
  if (!href) return { valid: false };
  if (!isSafeNoticeUrl(href)) return { valid: false };

  const now = Date.now();
  const cacheEntry = linkValidityCache.get(href);
  if (cacheEntry && now - cacheEntry.checkedAt < getCacheTtl()) {
    return {
      normalizedLink: cacheEntry.normalizedLink,
      valid: cacheEntry.valid,
    };
  }

  let result: LinkValidationResult = { valid: true };
  try {
    result = parseGuangdongNoticeQuery(href)
      ? await probeGuangdongNoticeLink(href)
      : { valid: await probeNoticeLink(href, title) };
  } catch {
    result = { valid: true };
  }

  linkValidityCache.set(href, {
    checkedAt: now,
    normalizedLink: result.normalizedLink,
    valid: result.valid,
  });
  return result;
}

export async function isNoticeLinkValid(
  link?: null | string,
  title?: null | string,
) {
  const result = await validateNoticeLink(link, title);
  return result.valid;
}

export async function filterValidNoticeLinks<
  T extends { link?: null | string; title?: null | string },
>(rows: T[], concurrency = 6) {
  if (rows.length === 0) return rows;

  const validFlags = Array.from({ length: rows.length }, () => false);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < rows.length) {
      const index = nextIndex;
      nextIndex += 1;
      const result = await validateNoticeLink(
        rows[index]?.link,
        rows[index]?.title,
      );
      validFlags[index] = result.valid;
      if (result.valid && result.normalizedLink && rows[index]) {
        rows[index].link = result.normalizedLink;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()),
  );

  return rows.filter((_, index) => validFlags[index]);
}
