import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const parkId = Number(query.parkId || 0);
    const keyword = String(query.keyword || '').trim();

    const result = await runWithRadarSharedScope(async () => {
      const whereClauses = ['COALESCE(u.status, 1) = 1'];
      const whereParams: any[] = [];

      if (Number.isFinite(parkId) && parkId > 0) {
        whereClauses.push('(u.park_id = ? OR u.park_id IS NULL)');
        whereParams.push(parkId);
      }
      if (keyword) {
        whereClauses.push('(u.real_name LIKE ? OR u.username LIKE ?)');
        const likeKeyword = `%${keyword}%`;
        whereParams.push(likeKeyword, likeKeyword);
      }

      const rows = await prismaClient.$queryRawUnsafe<any[]>(
        `
          SELECT
            u.id AS userId,
            COALESCE(NULLIF(u.real_name, ''), u.username) AS userName,
            u.park_id AS parkId,
            p.park_name AS parkName,
            COUNT(l.lead_id) AS activeLeadCount
          FROM user u
          LEFT JOIN park p ON p.park_id = u.park_id
          LEFT JOIN investment_lead l
            ON l.owner_user_id = u.id
            AND l.is_deleted = 0
            AND l.stage NOT IN ('CLOSED', 'DEAL', 'INVALID')
          WHERE ${whereClauses.join(' AND ')}
          GROUP BY u.id, userName, u.park_id, p.park_name
          ORDER BY
            CASE WHEN u.park_id = ? THEN 0 ELSE 1 END,
            activeLeadCount ASC,
            userName ASC
          LIMIT 100
        `,
        ...whereParams,
        Number.isFinite(parkId) && parkId > 0 ? parkId : 0,
      );

      return {
        items: rows.map((item) => ({
          activeLeadCount: Number(item.activeLeadCount || 0),
          parkName: item.parkName || '',
          userId: Number(item.userId),
          userName: item.userName || '',
        })),
        total: rows.length,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar sales user list failed:', error);
    return serverErrorResponse('获取销售负责人列表失败', event);
  }
});
