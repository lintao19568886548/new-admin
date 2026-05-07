import dayjs from 'dayjs';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

const EXPIRING_THRESHOLD_DAYS = 90;
const TREND_MONTH_COUNT = 12;

interface ContractTenantSnapshot {
  contractEnd: Date | null;
  contractStart: Date | null;
}

interface ContractStatusSummary {
  expiring: number;
  normal: number;
  retreated: number;
}

interface ContractTrendData {
  dates: string[];
  expiring: number[];
  normal: number[];
  retreated: number[];
}

function createEmptyTrendData(): ContractTrendData {
  const dates = Array.from({ length: TREND_MONTH_COUNT }, (_, index) =>
    dayjs()
      .subtract(TREND_MONTH_COUNT - index - 1, 'month')
      .format('YYYY-MM'),
  );

  return {
    dates,
    expiring: Array.from({ length: TREND_MONTH_COUNT }, () => 0),
    normal: Array.from({ length: TREND_MONTH_COUNT }, () => 0),
    retreated: Array.from({ length: TREND_MONTH_COUNT }, () => 0),
  };
}

function isContractActiveAt(
  tenant: ContractTenantSnapshot,
  referenceDate: dayjs.Dayjs,
) {
  const referenceStart = referenceDate.startOf('day');
  const referenceEnd = referenceDate.endOf('day');
  const startsBeforeReference =
    !tenant.contractStart || !dayjs(tenant.contractStart).isAfter(referenceEnd);
  const endsAfterReference =
    !tenant.contractEnd ||
    !dayjs(tenant.contractEnd).endOf('day').isBefore(referenceStart);

  return startsBeforeReference && endsAfterReference;
}

function isContractExpiringAt(
  tenant: ContractTenantSnapshot,
  referenceDate: dayjs.Dayjs,
) {
  if (!tenant.contractEnd || !isContractActiveAt(tenant, referenceDate)) {
    return false;
  }

  const contractEndDate = dayjs(tenant.contractEnd).endOf('day');
  const expiringLimit = referenceDate
    .endOf('day')
    .add(EXPIRING_THRESHOLD_DAYS, 'day');

  return !contractEndDate.isAfter(expiringLimit);
}

function isContractRetreatedAt(
  tenant: ContractTenantSnapshot,
  referenceDate: dayjs.Dayjs,
) {
  if (!tenant.contractEnd) {
    return false;
  }

  return dayjs(tenant.contractEnd)
    .endOf('day')
    .isBefore(referenceDate.startOf('day'));
}

function summarizeContracts(
  tenants: ContractTenantSnapshot[],
  referenceDate: dayjs.Dayjs,
): ContractStatusSummary {
  const summary: ContractStatusSummary = {
    expiring: 0,
    normal: 0,
    retreated: 0,
  };

  for (const tenant of tenants) {
    if (isContractRetreatedAt(tenant, referenceDate)) {
      summary.retreated += 1;
      continue;
    }

    if (!isContractActiveAt(tenant, referenceDate)) {
      continue;
    }

    if (isContractExpiringAt(tenant, referenceDate)) {
      summary.expiring += 1;
    } else {
      summary.normal += 1;
    }
  }

  return summary;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const selectedParkId = query.parkId ? Number(query.parkId) : undefined;
  const emptySummary = {
    expiring: 0,
    normal: 0,
    retreated: 0,
  };
  const emptyTrend = createEmptyTrendData();

  try {
    const parkIds = (userinfo.parks || []).map(
      (park: { parkId: number }) => park.parkId,
    );

    if (parkIds.length === 0) {
      return useResponseSuccess({
        summary: emptySummary,
        trend: emptyTrend,
      });
    }

    const targetParkIds =
      selectedParkId !== undefined && selectedParkId !== -1
        ? [selectedParkId]
        : parkIds;

    if (
      selectedParkId !== undefined &&
      selectedParkId !== -1 &&
      !parkIds.includes(selectedParkId)
    ) {
      return useResponseSuccess({
        summary: emptySummary,
        trend: emptyTrend,
      });
    }

    const tenants = await prismaClient.rentalTenant.findMany({
      select: {
        contractEnd: true,
        contractStart: true,
      },
      where: {
        isDeleted: false,
        parkId: {
          in: targetParkIds,
        },
        transactionType: true,
      },
    });

    const currentSummary = summarizeContracts(tenants, dayjs());
    const trend = createEmptyTrendData();

    trend.dates.forEach((dateLabel, index) => {
      const snapshot = summarizeContracts(
        tenants,
        dayjs(dateLabel).endOf('month'),
      );
      trend.normal[index] = snapshot.normal;
      trend.expiring[index] = snapshot.expiring;
      trend.retreated[index] = snapshot.retreated;
    });

    return useResponseSuccess({
      summary: currentSummary,
      trend,
    });
  } catch (error) {
    console.error('获取合同总览统计失败:', error);
    return useResponseSuccess({
      summary: emptySummary,
      trend: emptyTrend,
    });
  }
});
