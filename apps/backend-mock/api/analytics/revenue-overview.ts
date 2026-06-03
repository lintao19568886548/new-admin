import dayjs from 'dayjs';
import { prismaClient } from '~/utils/db';
import { AUTO_RENTAL_EXPENSE_REVENUE_EXCLUSION_WHERE } from '~/utils/finance-revenue-policy';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

const TREND_MONTH_COUNT = 12;

interface RevenueSummary {
  expenseTotal: number;
  incomeTotal: number;
  netTotal: number;
  yearLabel: string;
}

interface RevenueTrend {
  expense: number[];
  income: number[];
  months: string[];
  net: number[];
}

function createEmptyTrend(months: string[]): RevenueTrend {
  return {
    expense: Array.from({ length: months.length }, () => 0),
    income: Array.from({ length: months.length }, () => 0),
    months,
    net: Array.from({ length: months.length }, () => 0),
  };
}

function resolveParkIds(
  queryParkId: unknown,
  accessibleParkIds: number[],
): null | number[] {
  if (
    queryParkId === undefined ||
    queryParkId === 'all' ||
    Number(queryParkId) === -1
  ) {
    return accessibleParkIds;
  }

  const parkId = Number(queryParkId);
  if (
    !Number.isInteger(parkId) ||
    parkId <= 0 ||
    !accessibleParkIds.includes(parkId)
  ) {
    return null;
  }

  return [parkId];
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const accessibleParkIds = (userinfo.parks || []).map(
    (park: { parkId: number }) => park.parkId,
  );
  const now = dayjs();
  const startOfWindow = now
    .startOf('month')
    .subtract(TREND_MONTH_COUNT - 1, 'month');
  const startOfYear = now.startOf('year');
  const monthLabels = Array.from({ length: TREND_MONTH_COUNT }, (_, index) =>
    startOfWindow.add(index, 'month').format('YYYY-MM'),
  );
  const emptySummary: RevenueSummary = {
    expenseTotal: 0,
    incomeTotal: 0,
    netTotal: 0,
    yearLabel: `${now.year()}年度`,
  };
  const emptyTrend = createEmptyTrend(monthLabels);

  try {
    const parkIds = resolveParkIds(query.parkId, accessibleParkIds);
    if (!parkIds || parkIds.length === 0) {
      return useResponseSuccess({
        summary: emptySummary,
        trend: emptyTrend,
      });
    }

    const where: Record<string, any> = {
      isDeleted: false,
      NOT: AUTO_RENTAL_EXPENSE_REVENUE_EXCLUSION_WHERE,
      parkId: {
        in: parkIds,
      },
      transactionTime: {
        gte: startOfWindow.toDate(),
        lte: now.endOf('day').toDate(),
      },
    };

    const financeRecords = await prismaClient.finance.findMany({
      orderBy: {
        transactionTime: 'asc',
      },
      select: {
        amount: true,
        transactionTime: true,
        transactionType: true,
      },
      where,
    });

    const trend = createEmptyTrend(monthLabels);
    const monthIndexMap = new Map(
      monthLabels.map((label, index) => [label, index] as const),
    );
    let incomeTotal = 0;
    let expenseTotal = 0;

    for (const record of financeRecords) {
      const amount = Number(record.amount) || 0;
      const monthKey = dayjs(record.transactionTime).format('YYYY-MM');
      const monthIndex = monthIndexMap.get(monthKey);
      const isCurrentYearRecord = dayjs(record.transactionTime).isSame(
        startOfYear,
        'year',
      );

      if (record.transactionType === '收入') {
        if (monthIndex !== undefined) {
          trend.income[monthIndex] += amount;
        }
        if (isCurrentYearRecord) {
          incomeTotal += amount;
        }
        continue;
      }

      if (record.transactionType === '支出') {
        if (monthIndex !== undefined) {
          trend.expense[monthIndex] += amount;
        }
        if (isCurrentYearRecord) {
          expenseTotal += amount;
        }
      }
    }

    trend.net = trend.income.map(
      (income, index) => income - trend.expense[index],
    );

    return useResponseSuccess({
      summary: {
        expenseTotal,
        incomeTotal,
        netTotal: incomeTotal - expenseTotal,
        yearLabel: `${now.year()}年度`,
      },
      trend,
    });
  } catch (error) {
    console.error('获取营收统计失败:', error);
    return useResponseSuccess({
      summary: emptySummary,
      trend: emptyTrend,
    });
  }
});
