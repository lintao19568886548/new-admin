import { filterValidNoticeLinks } from '~/utils/notice-link-validator';
import { noticesPrismaClient } from '~/utils/notices-db';
import { useResponseSuccess } from '~/utils/response';

const LINK_FILTER_BATCH_SIZE = 40;
const LINK_FILTER_MAX_SCAN = 500;

function isTruthyQueryValue(value: unknown) {
  return ['1', 'true', 'yes'].includes(String(value ?? '').toLowerCase());
}

function isFalsyQueryValue(value: unknown) {
  return ['0', 'false', 'no'].includes(String(value ?? '').toLowerCase());
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const keyword = String(query.keyword ?? '').trim();
  const currentPage = Math.max(1, Number(query.currentPage ?? 1) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, Number(query.pageSize ?? 20) || 20),
  );
  const regionCode = String(query.regionCode ?? '').trim();
  const validOnly =
    query.validOnly === undefined
      ? true
      : isTruthyQueryValue(query.validOnly) ||
        !isFalsyQueryValue(query.validOnly);

  try {
    const where: any = keyword
      ? {
          OR: [
            { title: { contains: keyword } },
            { owner: { contains: keyword } },
            { category: { contains: keyword } },
            { projectType: { contains: keyword } },
            { type: { contains: keyword } },
          ],
        }
      : {};
    const andConditions: any[] = [];
    if (validOnly) {
      andConditions.push(
        { isValid: true },
        { link: { not: null } },
        { link: { not: '' } },
      );
    }
    if (regionCode) {
      const prefix = regionCode.slice(0, 4);
      if (prefix) {
        where.siteCode = { startsWith: prefix };
      }
    }
    if (andConditions.length > 0) {
      where.AND = [...(where.AND ?? []), ...andConditions];
    }

    // 过滤标题中包含【】符号的数据
    const rowsWithBracketsFiltered = (rows: any[]) =>
      rows.filter((row) => !String(row.title ?? '').includes('【'));

    if (validOnly) {
      const targetStart = (currentPage - 1) * pageSize;
      const targetEnd = targetStart + pageSize;
      const targetValidCount = targetEnd + 1;
      const maxScan = Math.min(
        LINK_FILTER_MAX_SCAN,
        Math.max(targetValidCount * 3, pageSize * 5),
      );

      const totalCandidates = await noticesPrismaClient.notice.count({ where });
      const validRows: any[] = [];
      let scanned = 0;

      while (
        scanned < totalCandidates &&
        scanned < maxScan &&
        validRows.length < targetValidCount
      ) {
        const rows = await noticesPrismaClient.notice.findMany({
          orderBy: { date: 'desc' },
          skip: scanned,
          take: Math.min(
            LINK_FILTER_BATCH_SIZE,
            totalCandidates - scanned,
            maxScan - scanned,
          ),
          where,
        });

        if (rows.length === 0) break;

        scanned += rows.length;
        // 先过滤标题带【】的，再校验链接
        const bracketFiltered = rowsWithBracketsFiltered(rows);
        validRows.push(...(await filterValidNoticeLinks(bracketFiltered)));
      }

      const items = validRows.slice(targetStart, targetEnd);
      const hasMoreValidRows =
        validRows.length > targetEnd ||
        (scanned < totalCandidates && items.length === pageSize);

      return useResponseSuccess({
        currentPage,
        pageSize,
        total: hasMoreValidRows
          ? Math.max(targetEnd + 1, validRows.length)
          : validRows.length,
        items,
      });
    }

    const start = (currentPage - 1) * pageSize;
    const [total, rows] = await Promise.all([
      noticesPrismaClient.notice.count({ where }),
      noticesPrismaClient.notice.findMany({
        orderBy: { date: 'desc' },
        skip: start,
        take: pageSize,
        where,
      }),
    ]);

    return useResponseSuccess({
      currentPage,
      pageSize,
      total,
      items: rows,
    });
  } catch (error) {
    console.error('[notices/list] 查询公告列表失败:', error);
    return useResponseSuccess({
      currentPage,
      items: [],
      pageSize,
      total: 0,
    });
  }
});
