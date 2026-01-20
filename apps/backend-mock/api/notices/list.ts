import dayjs from 'dayjs';
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

  try {
    const start = (currentPage - 1) * pageSize;

    const where = keyword
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
      items: rows.map((it) => {
        return {
          category: it.category ?? '',
          createdAt: dayjs(it.createdAt).format('YYYY-MM-DD HH:mm:ss'),
          date: it.date ?? '',
          link: it.link ?? '',
          noticeId: it.noticeId,
          owner: it.owner ?? '',
          platform: it.platform ?? '',
          projectType: it.projectType ?? '',
          title: it.title ?? '',
          type: it.type ?? '',
          updatedAt: dayjs(it.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
        };
      }),
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
