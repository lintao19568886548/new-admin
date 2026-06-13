import { getSingleProjectMonthSortKey } from '~/utils/amount-bill-project-period';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatDateLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getMonthsBetween(start: Date, end: Date) {
  const months: Date[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return months;
}

function parseDateOnly(value: unknown) {
  const rawDate = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function resolveRevenuePeriod(
  dateValue: unknown,
  endDateValue: unknown,
  monthValue: unknown,
  referenceDate: Date,
  startDateValue: unknown,
): RevenuePeriod {
  const selectedStartDate = parseDateOnly(startDateValue);
  const selectedEndDate = parseDateOnly(endDateValue);
  if (selectedStartDate && selectedEndDate) {
    const periodStartDate = new Date(
      Math.min(selectedStartDate.getTime(), selectedEndDate.getTime()),
    );
    const periodEndDate = new Date(
      Math.max(selectedStartDate.getTime(), selectedEndDate.getTime()),
    );
    const periodStart = startOfDay(periodStartDate);
    const periodEnd = addDays(startOfDay(periodEndDate), 1);

    return {
      months: getMonthsBetween(periodStart, periodEndDate),
      periodEnd,
      periodLabel: `${formatDateLabel(periodStart)}-${formatDateLabel(
        periodEndDate,
      )}`,
      periodStart,
    };
  }

  const selectedDate = parseDateOnly(dateValue);
  if (selectedDate) {
    const monthStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1,
    );
    return {
      months: [monthStart],
      periodEnd: addDays(startOfDay(selectedDate), 1),
      periodLabel: `${getMonthPeriodLabel(monthStart)}1日-${formatDateLabel(
        selectedDate,
      )}`,
      periodStart: monthStart,
    };
  }

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
  const emptySeries = Array.from({ length: months.length }, () => 0);

  return {
    periodLabel: period.periodLabel,
    summary: {
      billCount: 0,
      expenseTotal: 0,
      incomeTotal: 0,
      overpaidTotal: 0,
      profit: 0,
      receivableTotal: 0,
      receivedTotal: 0,
      remainingTotal: 0,
    },
    trend: {
      expense: [...emptySeries],
      income: [...emptySeries],
      months,
      overpaid: [...emptySeries],
      profit: [...emptySeries],
      receivable: [...emptySeries],
      received: [...emptySeries],
      remaining: [...emptySeries],
    },
  };
}

function toCents(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function toMoney(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function toMonthSortKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth() + 1;
}

function getProjectMonthContainsValues(months: Date[]) {
  const values = new Set<string>();

  for (const month of months) {
    const year = month.getFullYear();
    const monthNumber = month.getMonth() + 1;
    const paddedMonth = String(monthNumber).padStart(2, '0');

    values.add(`${year}年${monthNumber}月`);
    values.add(`${year}年${paddedMonth}月`);
    values.add(`${year}-${paddedMonth}`);
    values.add(`${year}.${paddedMonth}`);
    values.add(`${year}/${paddedMonth}`);
    values.add(`${year}${paddedMonth}`);
  }

  return [...values];
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
    const revenuePeriod = resolveRevenuePeriod(
      query.date,
      query.endDate,
      query.month,
      now,
      query.startDate,
    );

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
    const monthIndexMap = new Map(
      months.map((month, index) => [toMonthSortKey(month), index]),
    );
    const projectMonthValues = getProjectMonthContainsValues(months);

    if (projectMonthValues.length === 0) {
      return useResponseSuccess(createEmptyRevenueStats(revenuePeriod));
    }

    const amountBillList = await prismaClient.amountBill.findMany({
      select: {
        projectName: true,
        receiptAmount: true,
        totalFee: true,
      },
      where: {
        parkId: {
          in: parkIds,
        },
        OR: projectMonthValues.map((value) => ({
          projectName: {
            contains: value,
          },
        })),
      },
    });

    const receivableCents = Array.from({ length: monthLabels.length }).fill(
      0,
    ) as number[];
    const receivedCents = Array.from({ length: monthLabels.length }).fill(
      0,
    ) as number[];
    const remainingCents = Array.from({ length: monthLabels.length }).fill(
      0,
    ) as number[];
    const overpaidCents = Array.from({ length: monthLabels.length }).fill(
      0,
    ) as number[];
    let billCount = 0;

    for (const item of amountBillList) {
      const projectMonthKey = getSingleProjectMonthSortKey(item.projectName);
      const monthIndex =
        projectMonthKey === null
          ? undefined
          : monthIndexMap.get(projectMonthKey);
      if (monthIndex === undefined) {
        continue;
      }

      const totalFeeCents = toCents(item.totalFee);
      const receivedAmountCents = toCents(item.receiptAmount);
      receivableCents[monthIndex] += totalFeeCents;
      receivedCents[monthIndex] += receivedAmountCents;
      remainingCents[monthIndex] += Math.max(
        totalFeeCents - receivedAmountCents,
        0,
      );
      overpaidCents[monthIndex] += Math.max(
        receivedAmountCents - totalFeeCents,
        0,
      );
      billCount += 1;
    }

    const receivableTotalCents = receivableCents.reduce(
      (sum, item) => sum + item,
      0,
    );
    const receivedTotalCents = receivedCents.reduce(
      (sum, item) => sum + item,
      0,
    );
    const remainingTotalCents = remainingCents.reduce(
      (sum, item) => sum + item,
      0,
    );
    const overpaidTotalCents = overpaidCents.reduce(
      (sum, item) => sum + item,
      0,
    );

    return useResponseSuccess({
      periodLabel: revenuePeriod.periodLabel,
      summary: {
        billCount,
        expenseTotal: toMoney(receivableTotalCents),
        incomeTotal: toMoney(receivedTotalCents),
        overpaidTotal: toMoney(overpaidTotalCents),
        profit: toMoney(receivedTotalCents - receivableTotalCents),
        receivableTotal: toMoney(receivableTotalCents),
        receivedTotal: toMoney(receivedTotalCents),
        remainingTotal: toMoney(remainingTotalCents),
      },
      trend: {
        expense: receivableCents.map((item) => toMoney(item)),
        income: receivedCents.map((item) => toMoney(item)),
        months: monthLabels,
        overpaid: overpaidCents.map((item) => toMoney(item)),
        profit: receivedCents.map((item, index) =>
          toMoney(item - receivableCents[index]),
        ),
        receivable: receivableCents.map((item) => toMoney(item)),
        received: receivedCents.map((item) => toMoney(item)),
        remaining: remainingCents.map((item) => toMoney(item)),
      },
    });
  } catch (error) {
    console.error('获取营收统计数据失败:', error);
    return serverErrorResponse('获取营收统计数据失败', event);
  }
});
