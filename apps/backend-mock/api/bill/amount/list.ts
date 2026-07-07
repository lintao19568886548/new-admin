import {
  buildAmountBillListSummary,
  enrichAmountBillPaymentInfo,
  filterAmountBillsByCollectionStatus,
} from '~/utils/amount-bill-list-summary';
import {
  compareAmountBillProjectDesc,
  getAmountBillProjectSortKey,
  isAmountBillProjectNameMatched,
} from '~/utils/amount-bill-project-period';
import { prismaClient } from '~/utils/db';

function parseDateOnly(value: unknown) {
  const rawDate = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate);
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

function getMonthSortKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth() + 1;
}

function getProjectMonthRange(startValue: unknown, endValue: unknown) {
  const startDate = parseDateOnly(startValue);
  const endDate = parseDateOnly(endValue);
  if (!startDate || !endDate) {
    return null;
  }

  const startKey = getMonthSortKey(startDate);
  const endKey = getMonthSortKey(endDate);
  return {
    endKey: Math.max(startKey, endKey),
    startKey: Math.min(startKey, endKey),
  };
}

function isBillInProjectMonthRange(
  item: {
    createTime?: Date | null;
    projectName?: null | string;
    receiptTime?: Date | null;
  },
  range: null | {
    endKey: number;
    startKey: number;
  },
) {
  if (!range) {
    return true;
  }

  const monthKey = getAmountBillProjectSortKey(item);
  return (
    monthKey !== null && monthKey >= range.startKey && monthKey <= range.endKey
  );
}

function getRemainingAmount(item: { remainingAmount?: unknown }) {
  const amount = Number(item.remainingAmount ?? 0);
  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
}

function getCurrentProjectMonthKey() {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth() + 1;
}

function getCollectionProjectSortKey(item: {
  createTime?: Date | null;
  projectName?: null | string;
  receiptTime?: Date | null;
}) {
  return getAmountBillProjectSortKey(item);
}

function getAmountBillOverdueRisk(item: {
  createTime?: Date | null;
  projectName?: null | string;
  receiptTime?: Date | null;
}) {
  const projectKey = getCollectionProjectSortKey(item);
  return projectKey !== null && projectKey < getCurrentProjectMonthKey()
    ? 1
    : 0;
}

function compareAmountBillCollectionRisk(first: any, second: any) {
  const overdueDiff =
    getAmountBillOverdueRisk(second) - getAmountBillOverdueRisk(first);
  if (overdueDiff !== 0) {
    return overdueDiff;
  }

  const amountDiff = getRemainingAmount(second) - getRemainingAmount(first);
  if (amountDiff !== 0) {
    return amountDiff;
  }

  const firstProjectKey = getCollectionProjectSortKey(first);
  const secondProjectKey = getCollectionProjectSortKey(second);
  if (firstProjectKey !== null && secondProjectKey !== null) {
    const projectDiff = firstProjectKey - secondProjectKey;
    if (projectDiff !== 0) {
      return projectDiff;
    }
  }
  if (firstProjectKey === null && secondProjectKey !== null) {
    return 1;
  }
  if (firstProjectKey !== null && secondProjectKey === null) {
    return -1;
  }

  return compareAmountBillProjectDesc(first, second);
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const {
    projectName,
    tenantName,
    startTime,
    endTime,
    projectStartDate,
    projectEndDate,
    collectionStatus,
    currentPark,
    currentPage,
    pageSize,
  } = query;

  const where: any = {};
  const accessibleParkIds =
    userinfo.parks
      ?.map((park: { parkId: number }) => Number(park.parkId))
      .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0) ?? [];

  if (accessibleParkIds.length === 0) {
    return useResponseSuccess({
      items: [],
      summary: buildAmountBillListSummary([]),
      total: 0,
    });
  }

  if (currentPark) {
    const parkId = Number(currentPark);
    if (parkId !== -1 && Number.isInteger(parkId) && parkId > 0) {
      if (!accessibleParkIds.includes(parkId)) {
        return useResponseError('没有查看权限');
      }
      where.parkId = parkId;
    } else {
      where.parkId = {
        in: accessibleParkIds,
      };
    }
  } else {
    where.parkId = {
      in: accessibleParkIds,
    };
  }

  if (tenantName) {
    where.tenantName = {
      contains: tenantName,
    };
  }

  if (startTime && endTime) {
    where.receiptAmount = {
      gt: 0,
    };
    where.receiptTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;
  const projectMonthRange = getProjectMonthRange(
    projectStartDate,
    projectEndDate,
  );

  const candidates = await prismaClient.amountBill.findMany({
    where,
    select: {
      billId: true,
      createTime: true,
      invoiceTax: true,
      parkId: true,
      projectName: true,
      receiptAmount: true,
      receiptTime: true,
      tenantName: true,
      totalFee: true,
    },
  });

  const enrichedItems = candidates
    .filter((item) => Number(item.totalFee || 0) > 0)
    .filter((item) =>
      isAmountBillProjectNameMatched(item.projectName, projectName),
    )
    .filter((item) => isBillInProjectMonthRange(item, projectMonthRange))
    .map((item) => enrichAmountBillPaymentInfo(item));
  const filteredItems = filterAmountBillsByCollectionStatus(
    enrichedItems,
    collectionStatus as string | undefined,
  );
  const sortedItems = filteredItems.sort(
    collectionStatus === 'unreceived'
      ? compareAmountBillCollectionRisk
      : compareAmountBillProjectDesc,
  );
  const summary = buildAmountBillListSummary(sortedItems);
  const total = sortedItems.length;
  const paginatedIds = sortedItems
    .slice((page - 1) * size, page * size)
    .map((item) => item.billId);
  const detailItems =
    paginatedIds.length === 0
      ? []
      : await prismaClient.amountBill.findMany({
          include: {
            park: {
              select: {
                parkName: true,
              },
            },
            tenant: {
              select: {
                tenantName: true,
              },
            },
          },
          where: {
            billId: {
              in: paginatedIds,
            },
          },
        });
  const detailItemMap = new Map(detailItems.map((item) => [item.billId, item]));
  const items = paginatedIds.flatMap((billId) => {
    const item = detailItemMap.get(billId);
    if (!item) {
      return [];
    }

    return [
      enrichAmountBillPaymentInfo({
        ...item,
        parkName: item.park?.parkName,
        tenantName: item.tenant?.tenantName || item.tenantName,
      }),
    ];
  });

  return useResponseSuccess({
    items,
    summary,
    total,
  });
});
