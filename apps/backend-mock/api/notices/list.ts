import { noticesPrismaClient } from '~/utils/notices-db';
import { useResponseSuccess } from '~/utils/response';

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

  try {
    const start = (currentPage - 1) * pageSize;

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
    if (regionCode) {
      const prefix = regionCode.slice(0, 4);
      if (prefix) {
        where.siteCode = { startsWith: prefix };
      }
    }

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
  } catch {
    return useResponseSuccess({
      currentPage,
      items: [],
      pageSize,
      total: 0,
    });
  }
});
