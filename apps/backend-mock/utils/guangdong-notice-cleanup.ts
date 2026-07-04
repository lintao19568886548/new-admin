import {
  GD_NOTICE_INVALID_REASONS,
  validateGuangdongNoticeDetail,
} from './guangdong-notice-detail-validator';
import { noticesPrismaClient } from './notices-db';

interface NoticeCleanupRow {
  link: null | string;
  noticeId: string;
  title: null | string;
}

export interface GuangdongNoticeCleanupItem {
  invalidReason: null | string;
  noticeId: string;
  persistedInvalid: boolean;
  transient: boolean;
  title: null | string;
  valid: boolean;
  writeMode: 'dry-run' | 'execute';
}

export interface CleanupInvalidGuangdongNoticesOptions {
  execute?: boolean;
  limit?: number;
  noticeId?: string;
  onItem?: (item: GuangdongNoticeCleanupItem) => void;
  validState?: 'all' | 'invalid' | 'valid';
}

export interface CleanupInvalidGuangdongNoticesSummary {
  checked: number;
  invalid: number;
  items: GuangdongNoticeCleanupItem[];
  persistedInvalid: number;
  transient: number;
  updated: number;
  valid: number;
}

const DEFAULT_CLEANUP_LIMIT = 100;
const TRANSIENT_INVALID_REASONS = new Set<string>([
  GD_NOTICE_INVALID_REASONS.DETAIL_EMPTY_OR_LOADING,
  GD_NOTICE_INVALID_REASONS.DETAIL_FETCH_FAILED,
]);

function normalizeLimit(limit: number | undefined) {
  return Number.isFinite(limit) && Number(limit) > 0
    ? Math.floor(Number(limit))
    : DEFAULT_CLEANUP_LIMIT;
}

async function fetchRows(options: CleanupInvalidGuangdongNoticesOptions) {
  const noticeId = String(options.noticeId || '').trim();
  const limit = normalizeLimit(options.limit);
  const validState = options.validState || 'valid';

  const where: any = {
    AND: [
      { link: { contains: 'ygp.gdzwfw.gov.cn' } },
      { link: { not: null } },
      { link: { not: '' } },
    ],
  };

  if (noticeId) {
    where.noticeId = noticeId;
  } else if (validState === 'valid') {
    where.AND.push({ isValid: true });
  } else if (validState === 'invalid') {
    where.AND.push({ isValid: false });
  }

  return (await noticesPrismaClient.notice.findMany({
    orderBy: [{ lastCheckedAt: 'asc' }, { date: 'desc' }],
    select: {
      link: true,
      noticeId: true,
      title: true,
    },
    take: noticeId ? 1 : limit,
    where,
  })) as NoticeCleanupRow[];
}

function isTransientInvalidReason(reason?: null | string) {
  return Boolean(reason && TRANSIENT_INVALID_REASONS.has(reason));
}

async function markNoticeChecked(
  row: NoticeCleanupRow,
  result: Awaited<ReturnType<typeof validateGuangdongNoticeDetail>>,
) {
  await noticesPrismaClient.notice.update({
    data: {
      invalidReason: result.valid ? null : result.reason,
      isValid: result.valid,
      lastCheckedAt: result.checkedAt,
    },
    where: { noticeId: row.noticeId },
  });
}

export async function cleanupInvalidGuangdongNotices(
  options: CleanupInvalidGuangdongNoticesOptions = {},
): Promise<CleanupInvalidGuangdongNoticesSummary> {
  const execute = options.execute === true;
  const rows = await fetchRows(options);
  const items: GuangdongNoticeCleanupItem[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let persistedInvalidCount = 0;
  let transientCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const result = await validateGuangdongNoticeDetail(row.link);
    const transient = isTransientInvalidReason(result.reason);
    const persistedInvalid = !result.valid && !transient;
    if (execute && !transient) {
      await markNoticeChecked(row, result);
      updatedCount += 1;
    }

    if (persistedInvalid) {
      persistedInvalidCount += 1;
    }

    if (transient) {
      transientCount += 1;
    }

    if (result.valid) {
      validCount += 1;
    } else {
      invalidCount += 1;
    }

    const item: GuangdongNoticeCleanupItem = {
      invalidReason: result.reason || null,
      noticeId: row.noticeId,
      persistedInvalid,
      title: row.title,
      transient,
      valid: result.valid,
      writeMode: execute ? 'execute' : 'dry-run',
    };
    items.push(item);
    options.onItem?.(item);
  }

  return {
    checked: rows.length,
    invalid: invalidCount,
    items,
    persistedInvalid: persistedInvalidCount,
    transient: transientCount,
    updated: updatedCount,
    valid: validCount,
  };
}
