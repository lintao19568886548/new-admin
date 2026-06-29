import {
  enrichAmountBillPaymentInfo,
  filterAmountBillsByCollectionStatus,
} from '~/utils/amount-bill-list-summary';
import {
  getAmountBillProjectSortKey,
  isAmountBillProjectNameMatched,
} from '~/utils/amount-bill-project-period';
import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

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

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const {
    collectionStatus,
    currentPark,
    projectEndDate,
    projectName,
    projectStartDate,
    tenantName,
  } = body || {};
  const parkIds = Array.isArray(body?.parkIds)
    ? body.parkIds
        .map(Number)
        .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0)
    : [];
  const currentParkId = Number(currentPark);
  const selectedParkIds = parkIds.length > 0 ? parkIds : [];
  if (
    selectedParkIds.length === 0 &&
    Number.isInteger(currentParkId) &&
    currentParkId > 0
  ) {
    selectedParkIds.push(currentParkId);
  }
  const projectMonthRange = getProjectMonthRange(
    projectStartDate,
    projectEndDate,
  );

  const parks = await prismaClient.park.findMany({
    where: {
      ...(selectedParkIds.length > 0
        ? { parkId: { in: selectedParkIds } }
        : {}),
      isDeleted: false,
    },
    select: {
      parkName: true,
      amountBills: {
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
      },
    },
  });

  const result = parks.map((park) => {
    const bills = filterAmountBillsByCollectionStatus(
      park.amountBills
        .filter((bill) => Number(bill.totalFee || 0) > 0)
        .filter((bill) =>
          isAmountBillProjectNameMatched(bill.projectName, projectName),
        )
        .filter((bill) =>
          tenantName
            ? String(bill.tenant?.tenantName || bill.tenantName || '').includes(
                String(tenantName),
              )
            : true,
        )
        .filter((bill) => isBillInProjectMonthRange(bill, projectMonthRange))
        .map((bill) =>
          enrichAmountBillPaymentInfo({
            ...bill,
            parkName: bill.park?.parkName || park.parkName,
            tenantName: bill.tenant?.tenantName || bill.tenantName || '',
          }),
        ),
      collectionStatus as string | undefined,
    );

    return {
      parkName: park.parkName,
      bills: bills.map((bill) => {
        return {
          tenantName: bill.tenantName || '',
          factoryRent: bill.factoryRent,
          waterFee: bill.waterFee,
          eleFee: bill.eleFee,
          serviceFee: bill.serviceFee,
          managementFee: bill.managementFee,
          invoiceTax: bill.invoiceTax,
          receiveFee: bill.receiveFee,
          garbageFee: bill.garbageFee,
          penaltyFee: bill.penaltyFee,
          totalFee: bill.totalFee,
        };
      }),
    };
  });
  return useResponseSuccess(result);
});
