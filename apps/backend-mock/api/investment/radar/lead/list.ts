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
    const currentPage = Math.max(1, Number(query.currentPage || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
    const keyword = String(query.keyword || '').trim();
    const priorityLevel = String(query.priorityLevel || '').trim();
    const stage = String(query.stage || '').trim();
    const parkId = Number(query.parkId || 0);

    const result = await runWithRadarSharedScope(async () => {
      const whereClauses = ['l.is_deleted = 0'];
      const whereParams: any[] = [];

      if (priorityLevel) {
        whereClauses.push('l.priority_level = ?');
        whereParams.push(priorityLevel);
      }
      if (stage) {
        whereClauses.push('l.stage = ?');
        whereParams.push(stage);
      }
      if (parkId > 0) {
        whereClauses.push('l.park_id = ?');
        whereParams.push(parkId);
      }
      if (keyword) {
        whereClauses.push(
          '(e.enterprise_name LIKE ? OR e.phone_number LIKE ? OR p.park_name LIKE ?)',
        );
        const likeKeyword = `%${keyword}%`;
        whereParams.push(likeKeyword, likeKeyword, likeKeyword);
      }

      const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
      const offset = (currentPage - 1) * pageSize;

      const [countRows, rows] = await Promise.all([
        prismaClient.$queryRawUnsafe<Array<{ total: bigint | number }>>(
          `
            SELECT COUNT(*) AS total
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            LEFT JOIN park p ON p.park_id = l.park_id
            ${whereSql}
          `,
          ...whereParams,
        ),
        prismaClient.$queryRawUnsafe<
          Array<{
            enterpriseName: string;
            intentArea: null | number | string;
            intentScore: number;
            latestContactTime: Date | null;
            latestSignalTime: Date | null;
            latestSignalType: null | string;
            leadId: number;
            leadSource: string;
            matchScore: number;
            ownerName: null | string;
            parkName: null | string;
            phoneNumber: null | string;
            priorityLevel: string;
            reachableScore: number;
            stage: string;
            totalScore: number;
          }>
        >(
          `
            SELECT
              l.lead_id AS leadId,
              e.enterprise_name AS enterpriseName,
              e.phone_number AS phoneNumber,
              p.park_name AS parkName,
              l.lead_source AS leadSource,
              l.intent_area AS intentArea,
              l.intent_score AS intentScore,
              l.match_score AS matchScore,
              l.reachable_score AS reachableScore,
              l.total_score AS totalScore,
              l.priority_level AS priorityLevel,
              l.stage AS stage,
              l.latest_contact_time AS latestContactTime,
              e.last_signal_time AS latestSignalTime,
              e.source_latest AS latestSignalType,
              COALESCE(u.real_name, u.username) AS ownerName
            FROM investment_lead l
            LEFT JOIN investment_enterprise e ON e.enterprise_id = l.enterprise_id
            LEFT JOIN park p ON p.park_id = l.park_id
            LEFT JOIN user u ON u.id = l.owner_user_id
            ${whereSql}
            ORDER BY
              l.update_time DESC,
              l.lead_id DESC
            LIMIT ? OFFSET ?
          `,
          ...whereParams,
          pageSize,
          offset,
        ),
      ]);
      const total = Number(countRows[0]?.total || 0);

      return {
        items: rows.map((item) => ({
          enterpriseName: item.enterpriseName || '-',
          intentArea:
            item.intentArea === null || item.intentArea === undefined
              ? null
              : Number(item.intentArea),
          intentScore: Number(item.intentScore || 0),
          latestContactTime: item.latestContactTime,
          latestSignalTime: item.latestSignalTime,
          latestSignalType: item.latestSignalType,
          leadId: Number(item.leadId),
          leadSource: item.leadSource,
          matchScore: Number(item.matchScore || 0),
          ownerName: item.ownerName || undefined,
          parkName: item.parkName || undefined,
          phoneNumber: item.phoneNumber || null,
          priorityLevel: item.priorityLevel,
          reachableScore: Number(item.reachableScore || 0),
          stage: item.stage,
          totalScore: Number(item.totalScore || 0),
        })),
        page: {
          currentPage,
          pageSize,
          total,
        },
        total,
      };
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('get radar lead list failed:', error);
    return serverErrorResponse('获取雷达线索列表失败', event);
  }
});
