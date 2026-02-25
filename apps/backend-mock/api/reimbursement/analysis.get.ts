import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

interface ParkStat {
  count: number;
  parkId: number;
  park: string;
  totalAmount: number;
}

interface TrendStat {
  count: number;
  date: string;
  totalAmount: number;
}

function createEmptyAnalysisData() {
  return {
    parkStats: [],
    summary: {
      averageAmount: 0,
      count: 0,
      parkCount: 0,
      totalAmount: 0,
    },
    topParks: [],
    trend: [],
  };
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toStartOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function toEndOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  if ((userinfo.reimbursementAuth || 0) <= 0) {
    return forbiddenResponse(event, '无报销分析权限');
  }

  try {
    const query = getQuery(event);
    const now = new Date();

    const parsedStatus =
      query.status === undefined
        ? 1
        : Number.parseInt(String(query.status), 10);
    if (Number.isNaN(parsedStatus)) {
      setResponseStatus(event, 400);
      return useResponseError('状态参数无效', '状态参数无效', 400);
    }

    const startDate = query.startDate
      ? toStartOfDay(new Date(String(query.startDate)))
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endDate = query.endDate
      ? toEndOfDay(new Date(String(query.endDate)))
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setResponseStatus(event, 400);
      return useResponseError('日期参数无效', '日期参数无效', 400);
    }

    const parkId =
      query.parkId === undefined
        ? undefined
        : Number.parseInt(String(query.parkId), 10);
    if (query.parkId !== undefined && Number.isNaN(parkId)) {
      setResponseStatus(event, 400);
      return useResponseError('园区参数无效', '园区参数无效', 400);
    }

    const allowedParkIds = (userinfo.parks || [])
      .map((park) => Number(park.parkId))
      .filter((id) => !Number.isNaN(id));

    if (allowedParkIds.length === 0) {
      return useResponseSuccess(createEmptyAnalysisData());
    }

    if (parkId !== undefined && !allowedParkIds.includes(parkId)) {
      return useResponseSuccess(createEmptyAnalysisData());
    }

    const where: Record<string, any> = {
      date: {
        gte: startDate,
        lte: endDate,
      },
      isDeleted: false,
      status: parsedStatus,
      parkId:
        parkId === undefined
          ? {
              in: allowedParkIds,
            }
          : parkId,
    };

    const reimbursements = await prismaClient.reimbursement.findMany({
      where,
      select: {
        amount: true,
        date: true,
        park: {
          select: {
            parkId: true,
            parkName: true,
          },
        },
      },
    });

    const parkMap = new Map<string, ParkStat>();
    const trendMap = new Map<string, TrendStat>();

    let totalAmount = 0;
    for (const item of reimbursements) {
      const amount = Number(item.amount || 0);
      const currentParkId = Number(item.park?.parkId ?? -1);
      const park = item.park?.parkName?.trim() || '未设置园区';
      const dateKey = formatLocalDate(item.date);
      const parkKey = `${currentParkId}`;

      totalAmount += amount;

      const parkStat = parkMap.get(parkKey) ?? {
        count: 0,
        parkId: currentParkId,
        park,
        totalAmount: 0,
      };
      parkStat.count += 1;
      parkStat.totalAmount += amount;
      parkMap.set(parkKey, parkStat);

      const trendStat = trendMap.get(dateKey) ?? {
        count: 0,
        date: dateKey,
        totalAmount: 0,
      };
      trendStat.count += 1;
      trendStat.totalAmount += amount;
      trendMap.set(dateKey, trendStat);
    }

    const parkStats = [...parkMap.values()].sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );
    const trend = [...trendMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const totalCount = reimbursements.length;
    const summary = {
      averageAmount: totalCount > 0 ? totalAmount / totalCount : 0,
      count: totalCount,
      parkCount: parkStats.length,
      totalAmount,
    };

    const topParks = parkStats.slice(0, 10).map((item) => ({
      ...item,
      ratio: totalAmount > 0 ? item.totalAmount / totalAmount : 0,
    }));

    return useResponseSuccess({
      parkStats,
      summary,
      topParks,
      trend,
    });
  } catch (error) {
    console.error('获取报销分析数据失败:', error);
    setResponseStatus(event, 500);
    return useResponseError('获取报销分析数据失败', error, 500);
  }
});
