import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type ContractTrend = {
  dates: string[];
  expiring: number[];
  newThisMonth: number[];
  normal: number[];
  retreated: number[];
};

function emptyStats() {
  return {
    summary: {
      expiring: 0,
      newThisMonth: 0,
      normal: 0,
      retreated: 0,
    },
    trend: {
      dates: [],
      expiring: [],
      newThisMonth: [],
      normal: [],
      retreated: [],
    } satisfies ContractTrend,
  };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const targetDate = next.getDate();

  next.setDate(1);
  next.setMonth(next.getMonth() + months);

  const lastDateOfTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(targetDate, lastDateOfTargetMonth));

  return next;
}

function formatMonth(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getCurrentYearMonths(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();

  return Array.from({ length: currentMonth + 1 }).map(
    (_item, index) => new Date(year, index, 1),
  );
}

function isActiveContract(
  referenceDate: Date,
  contractStart: Date | null,
  contractEnd: Date | null,
): boolean {
  const referenceDay = startOfDay(referenceDate);

  if (contractEnd && startOfDay(contractEnd) < referenceDay) {
    return false;
  }

  if (contractStart && startOfDay(contractStart) > referenceDay) {
    return false;
  }

  return true;
}

function isRetreatedContract(referenceDate: Date, contractEnd: Date | null) {
  if (!contractEnd) {
    return false;
  }

  const referenceDay = startOfDay(referenceDate);
  return startOfDay(contractEnd) < referenceDay;
}

function isNewContractInMonth(
  monthStart: Date,
  referenceDate: Date,
  contractStart: Date | null,
) {
  if (!contractStart) {
    return false;
  }

  const startDay = startOfDay(contractStart);

  return (
    startDay >= startOfDay(monthStart) && startDay <= startOfDay(referenceDate)
  );
}

function isExpiringContractInOneMonth(
  referenceDate: Date,
  contractStart: Date | null,
  contractEnd: Date | null,
) {
  if (
    !contractEnd ||
    !isActiveContract(referenceDate, contractStart, contractEnd)
  ) {
    return false;
  }

  const referenceDay = startOfDay(referenceDate);
  return startOfDay(contractEnd) <= addMonths(referenceDay, 1);
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

function calculateContractTotals(
  contracts: { contractEnd: Date | null; contractStart: Date | null }[],
  monthStart: Date,
  referenceDate: Date,
) {
  const totals = {
    expiring: 0,
    newThisMonth: 0,
    normal: 0,
    retreated: 0,
  };

  for (const contract of contracts) {
    if (
      isNewContractInMonth(monthStart, referenceDate, contract.contractStart)
    ) {
      totals.newThisMonth++;
    }

    if (
      isActiveContract(
        referenceDate,
        contract.contractStart,
        contract.contractEnd,
      )
    ) {
      totals.normal++;
      if (
        isExpiringContractInOneMonth(
          referenceDate,
          contract.contractStart,
          contract.contractEnd,
        )
      ) {
        totals.expiring++;
      }
    } else if (isRetreatedContract(referenceDate, contract.contractEnd)) {
      totals.retreated++;
    }
  }

  return totals;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const authorizedParkIds =
      userinfo.parks?.map((park) => Number(park.parkId)).filter(Boolean) ?? [];

    if (authorizedParkIds.length === 0) {
      return useResponseSuccess(emptyStats());
    }

    const query = getQuery(event);
    const parkIds = resolveParkIds(query.parkId, authorizedParkIds);
    if (!parkIds) {
      return useResponseSuccess(emptyStats());
    }

    const contracts = await prismaClient.rentalTenant.findMany({
      where: {
        isDeleted: false,
        parkId: {
          in: parkIds,
        },
      },
      select: {
        contractEnd: true,
        contractStart: true,
      },
    });

    const now = new Date();
    const trend: ContractTrend = {
      dates: [],
      expiring: [],
      newThisMonth: [],
      normal: [],
      retreated: [],
    };

    const currentYearMonths = getCurrentYearMonths(now);
    const currentMonth =
      currentYearMonths[currentYearMonths.length - 1] ||
      new Date(now.getFullYear(), now.getMonth(), 1);
    const summary = calculateContractTotals(contracts, currentMonth, now);

    for (const [index, monthStart] of currentYearMonths.entries()) {
      const referenceDate =
        index === currentYearMonths.length - 1 ? now : endOfMonth(monthStart);
      const totals = calculateContractTotals(
        contracts,
        monthStart,
        referenceDate,
      );

      trend.dates.push(formatMonth(monthStart));
      trend.expiring.push(totals.expiring);
      trend.newThisMonth.push(totals.newThisMonth);
      trend.normal.push(totals.normal);
      trend.retreated.push(totals.retreated);
    }

    return useResponseSuccess({
      summary,
      trend,
    });
  } catch (error) {
    console.error('获取合同统计数据失败:', error);
    return serverErrorResponse('获取合同统计数据失败', event);
  }
});
