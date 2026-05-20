import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

interface WaterBillItem {
  meterName: string;
  totalUsage: unknown;
}

function createEmptyStats(referenceDate: Date, message?: string) {
  const months = getCurrentYearMonths(referenceDate).map((month) =>
    formatMonth(month),
  );

  return {
    hasData: false,
    message,
    months,
    water: {
      consumption: Array.from({ length: months.length }, () => 0),
      monthOnMonth: Array.from({ length: months.length }, () => 0),
      yearOnYear: Array.from({ length: months.length }, () => 0),
    },
    year: referenceDate.getFullYear(),
  };
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

function getCurrentYearMonths(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();

  return Array.from({ length: currentMonth + 1 }).map(
    (_item, index) => new Date(year, index, 1),
  );
}

function toNumber(value: unknown) {
  const normalized = String(value ?? '')
    .replaceAll(',', '')
    .trim();
  const numberValue = Number(normalized);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundPercent(value: number) {
  return Number(value.toFixed(2));
}

function roundConsumption(value: number) {
  return Number(value.toFixed(2));
}

function calcPercentChange(current: number, previous: number) {
  if (previous === 0) {
    return 0;
  }

  return roundPercent(((current - previous) / previous) * 100);
}

function resolveParkIds(
  queryParkId: unknown,
  authorizedParkIds: number[],
): null | number[] {
  if (queryParkId === undefined || queryParkId === 'all') {
    return authorizedParkIds;
  }

  const parkId = Number(queryParkId);
  if (!Number.isFinite(parkId) || !authorizedParkIds.includes(parkId)) {
    return null;
  }

  return [parkId];
}

function getBillCreateTimeRange(months: Date[]) {
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];

  if (!firstMonth || !lastMonth) {
    throw new Error('月份范围不能为空');
  }

  const firstComparisonMonth = addMonths(firstMonth, -12);

  return {
    createTimeEnd: addMonths(lastMonth, 2),
    createTimeStart: addMonths(firstComparisonMonth, 1),
  };
}

function getDataMonth(createTime: Date | null) {
  if (!createTime) {
    return null;
  }

  // 总账单通常在次月创建，例如 2026-04 的账单记录 2026-03 的用量。
  return formatMonth(addMonths(createTime, -1));
}

function isTotalRow(item: WaterBillItem) {
  return String(item.meterName || '').includes('合计');
}

function sumBillUsage(items: WaterBillItem[]) {
  const totalRows = items.filter((item) => isTotalRow(item));
  const rows = totalRows.length > 0 ? totalRows : items;

  return rows
    .filter((item) => totalRows.length > 0 || !isTotalRow(item))
    .reduce((sum, item) => sum + toNumber(item.totalUsage), 0);
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const referenceDate = new Date();

  try {
    const authorizedParkIds =
      userinfo.parks?.map((park) => Number(park.parkId)).filter(Boolean) ?? [];

    if (authorizedParkIds.length === 0) {
      return useResponseSuccess(
        createEmptyStats(referenceDate, '当前用户没有可查看园区，暂无水耗数据'),
      );
    }

    const parkIds = resolveParkIds(query.parkId, authorizedParkIds);
    if (!parkIds) {
      return useResponseSuccess(
        createEmptyStats(referenceDate, '当前用户没有该园区权限，暂无水耗数据'),
      );
    }

    const months = getCurrentYearMonths(referenceDate);
    const monthLabels = months.map((month) => formatMonth(month));
    const monthLabelSet = new Set(monthLabels);
    const { createTimeEnd, createTimeStart } = getBillCreateTimeRange(months);
    const bills = await prismaClient.amountBill.findMany({
      select: {
        createTime: true,
        waterBills: {
          select: {
            meterName: true,
            totalUsage: true,
          },
        },
      },
      where: {
        createTime: {
          gte: createTimeStart,
          lt: createTimeEnd,
        },
        parkId: {
          in: parkIds,
        },
      },
    });
    const monthTotals = new Map<string, number>();
    let rangeBillCount = 0;

    for (const bill of bills) {
      if (bill.waterBills.length === 0) {
        continue;
      }

      const dataMonth = getDataMonth(bill.createTime);
      if (!dataMonth) {
        continue;
      }

      if (monthLabelSet.has(dataMonth)) {
        rangeBillCount++;
      }

      monthTotals.set(
        dataMonth,
        (monthTotals.get(dataMonth) || 0) + sumBillUsage(bill.waterBills),
      );
    }

    const consumption = monthLabels.map((month) =>
      roundConsumption(monthTotals.get(month) || 0),
    );
    const monthOnMonth = consumption.map((value, index) => {
      const previous =
        index === 0
          ? monthTotals.get(formatMonth(addMonths(months[0], -1))) || 0
          : consumption[index - 1] || 0;

      return calcPercentChange(value, previous);
    });
    const yearOnYear = consumption.map((value, index) => {
      const previous =
        monthTotals.get(formatMonth(addMonths(months[index], -12))) || 0;

      return calcPercentChange(value, previous);
    });
    const hasData = rangeBillCount > 0;

    return useResponseSuccess({
      hasData,
      message: hasData
        ? undefined
        : '当前年度未查询到账单水耗明细，暂无水耗数据',
      months: monthLabels,
      water: {
        consumption,
        monthOnMonth,
        yearOnYear,
      },
      year: referenceDate.getFullYear(),
    });
  } catch (error) {
    console.error('获取能源水耗数据失败:', error);
    return serverErrorResponse('获取能源水耗数据失败', event);
  }
});
