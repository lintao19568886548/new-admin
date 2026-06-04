import { prismaClient } from '~/utils/db';
import { AUTO_RENTAL_EXPENSE_REVENUE_EXCLUSION_WHERE } from '~/utils/finance-revenue-policy';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type TransactionType = '支出' | '收入';

type RevenuePeriod = {
  months: Date[];
  periodEnd: Date;
  periodLabel: string;
  periodStart: Date;
};

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentYearMonths(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();

  return Array.from({ length: currentMonth + 1 }).map(
    (_item, index) => new Date(year, index, 1),
  );
}

function getCurrentYearPeriodLabel(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  return `${year}年1-${month}月`;
}

function getMonthPeriodLabel(month: Date) {
  return `${month.getFullYear()}年${month.getMonth() + 1}月`;
}

function resolveRevenuePeriod(
  monthValue: unknown,
  referenceDate: Date,
): RevenuePeriod {
  const rawMonth = String(monthValue || '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(rawMonth);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12
    ) {
      const selectedMonth = new Date(year, month - 1, 1);
      return {
        months: [selectedMonth],
        periodEnd: new Date(year, month, 1),
        periodLabel: getMonthPeriodLabel(selectedMonth),
        periodStart: selectedMonth,
      };
    }
  }

  const months = getCurrentYearMonths(referenceDate);
  return {
    months,
    periodEnd: new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      1,
    ),
    periodLabel: getCurrentYearPeriodLabel(referenceDate),
    periodStart: months[0],
  };
}

function createEmptyRevenueStats(period: RevenuePeriod) {
  const months = period.months.map((month) => formatMonth(month));

  return {
    periodLabel: period.periodLabel,
    summary: {
      expenseTotal: 0,
      incomeTotal: 0,
      profit: 0,
    },
    trend: {
      expense: Array.from({ length: months.length }, () => 0),
      income: Array.from({ length: months.length }, () => 0),
      months,
      profit: Array.from({ length: months.length }, () => 0),
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
    const query = getQuery(event);
    const revenuePeriod = resolveRevenuePeriod(query.month, now);

    if (authorizedParkIds.length === 0) {
      return useResponseSuccess(createEmptyRevenueStats(revenuePeriod));
    }

    const selectedParkId =
      query.parkId === undefined || query.parkId === 'all'
        ? null
        : Number(query.parkId);

    if (selectedParkId && !authorizedParkIds.includes(Number(selectedParkId))) {
      return useResponseSuccess(createEmptyRevenueStats(revenuePeriod));
    }

    const months = revenuePeriod.months;
    const monthLabels = months.map((month) => formatMonth(month));
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
          gte: revenuePeriod.periodStart,
          lt: revenuePeriod.periodEnd,
        },
        transactionType: {
          in: ['收入', '支出'],
        },
        NOT: AUTO_RENTAL_EXPENSE_REVENUE_EXCLUSION_WHERE,
      },
    });

    const incomeCents = Array.from({ length: monthLabels.length }).fill(
      0,
    ) as number[];
    const expenseCents = Array.from({ length: monthLabels.length }).fill(
      0,
    ) as number[];

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
      periodLabel: revenuePeriod.periodLabel,
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
