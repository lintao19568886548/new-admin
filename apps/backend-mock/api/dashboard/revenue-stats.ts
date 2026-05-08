import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type TransactionType = '支出' | '收入';

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getLastTwelveMonths(referenceDate: Date) {
  const currentMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );

  return Array.from({ length: 12 }).map((_item, index) =>
    addMonths(currentMonth, index - 11),
  );
}

function createEmptyRevenueStats(referenceDate: Date) {
  const months = getLastTwelveMonths(referenceDate).map((month) =>
    formatMonth(month),
  );

  return {
    periodLabel: '过去一年',
    summary: {
      expenseTotal: 0,
      incomeTotal: 0,
      profit: 0,
    },
    trend: {
      expense: Array.from({ length: 12 }, () => 0),
      income: Array.from({ length: 12 }, () => 0),
      months,
      profit: Array.from({ length: 12 }, () => 0),
    },
  };
}

function toCents(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function toMoney(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const now = new Date();

  try {
    const authorizedParkIds =
      userinfo.parks?.map((park) => Number(park.parkId)).filter(Boolean) ?? [];

    if (authorizedParkIds.length === 0) {
      return useResponseSuccess(createEmptyRevenueStats(now));
    }

    const query = getQuery(event);
    const selectedParkId =
      query.parkId === undefined || query.parkId === 'all'
        ? null
        : Number(query.parkId);

    if (selectedParkId && !authorizedParkIds.includes(Number(selectedParkId))) {
      return useResponseSuccess(createEmptyRevenueStats(now));
    }

    const months = getLastTwelveMonths(now);
    const monthLabels = months.map((month) => formatMonth(month));
    const periodStart = months[0];
    const periodEnd = addMonths(months[months.length - 1], 1);
    const parkIds = selectedParkId ? [selectedParkId] : authorizedParkIds;

    const financeList = await prismaClient.finance.findMany({
      select: {
        amount: true,
        transactionTime: true,
        transactionType: true,
      },
      where: {
        isDeleted: false,
        parkId: {
          in: parkIds,
        },
        transactionTime: {
          gte: periodStart,
          lt: periodEnd,
        },
        transactionType: {
          in: ['收入', '支出'],
        },
      },
    });

    const incomeCents = Array.from({ length: 12 }).fill(0) as number[];
    const expenseCents = Array.from({ length: 12 }).fill(0) as number[];

    for (const item of financeList) {
      const monthIndex = monthLabels.indexOf(formatMonth(item.transactionTime));
      if (monthIndex === -1) {
        continue;
      }

      const amountCents = toCents(item.amount);

      if ((item.transactionType as TransactionType) === '收入') {
        incomeCents[monthIndex] += amountCents;
      } else if ((item.transactionType as TransactionType) === '支出') {
        expenseCents[monthIndex] += amountCents;
      }
    }

    const incomeTotalCents = incomeCents.reduce((sum, item) => sum + item, 0);
    const expenseTotalCents = expenseCents.reduce((sum, item) => sum + item, 0);
    const profitCents = incomeTotalCents - expenseTotalCents;

    return useResponseSuccess({
      periodLabel: '过去一年',
      summary: {
        expenseTotal: toMoney(expenseTotalCents),
        incomeTotal: toMoney(incomeTotalCents),
        profit: toMoney(profitCents),
      },
      trend: {
        expense: expenseCents.map((item) => toMoney(item)),
        income: incomeCents.map((item) => toMoney(item)),
        months: monthLabels,
        profit: incomeCents.map((item, index) =>
          toMoney(item - expenseCents[index]),
        ),
      },
    });
  } catch (error) {
    console.error('获取营收统计数据失败:', error);
    return serverErrorResponse('获取营收统计数据失败', event);
  }
});
