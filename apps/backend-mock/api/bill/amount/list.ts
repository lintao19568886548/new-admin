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

function compareAmountBillCollectionRisk(first: any, second: any) {
  const amountDiff = getRemainingAmount(second) - getRemainingAmount(first);
  if (amountDiff !== 0) {
    return amountDiff;
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

  if (currentPark) {
    const parkId = Number(currentPark);
    if (parkId !== -1 && Number.isInteger(parkId) && parkId > 0) {
      where.parkId = parkId;
    }
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

  const result = await prismaClient.amountBill.findMany({
    where,
    include: {
      tenant: {
        select: {
          tenantName: true,
        },
      },
      park: {
        select: {
          parkName: true,
        },
      },
    },
  });

  const enrichedItems = result
    .filter((item) => Number(item.totalFee || 0) > 0)
    .filter((item) =>
      isAmountBillProjectNameMatched(item.projectName, projectName),
    )
    .filter((item) => isBillInProjectMonthRange(item, projectMonthRange))
    .map((item) =>
      enrichAmountBillPaymentInfo({
        ...item,
        tenantName: item.tenant?.tenantName || item.tenantName,
        parkName: item.park?.parkName,
      }),
    );
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
  const items = sortedItems.slice((page - 1) * size, page * size);

  return useResponseSuccess({
    items,
    summary,
    total,
  });
});
