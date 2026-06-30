import { prismaClient } from '~/utils/db';

export function getAuthorizedParkIds(userinfo: any) {
  return (userinfo?.parks || [])
    .map((park: any) => Number(park.parkId))
    .filter((parkId: number) => Number.isFinite(parkId));
}

export function getParkWhereFromQuery(
  userinfo: any,
  query: Record<string, any>,
) {
  const authorizedParkIds = getAuthorizedParkIds(userinfo);
  if (authorizedParkIds.length === 0) {
    return {
      denied: false,
      empty: true,
      parkIds: [],
    };
  }

  const currentPark = query.currentPark ?? query.parkId;
  if (
    currentPark !== undefined &&
    currentPark !== '' &&
    Number(currentPark) !== -1
  ) {
    const parkId = Number(currentPark);
    if (!authorizedParkIds.includes(parkId)) {
      return {
        denied: true,
        empty: false,
        parkIds: [],
      };
    }
    return {
      denied: false,
      empty: false,
      parkIds: [parkId],
    };
  }

  return {
    denied: false,
    empty: false,
    parkIds: authorizedParkIds,
  };
}

export function normalizeRepairOrderData(body: Record<string, any>) {
  const data = { ...body };

  for (const key of ['acceptTime', 'confirmTime', 'finishTime'] as const) {
    if (data[key]) {
      data[key] = new Date(data[key]);
    } else if (data[key] === '') {
      data[key] = null;
    }
  }

  for (const key of ['factoryId', 'parkId', 'tenantId'] as const) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      data[key] = Number(data[key]);
    } else if (key !== 'parkId') {
      data[key] = null;
    }
  }

  return data;
}

export async function createRepairOrderNo() {
  const now = new Date();
  const dateText = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const prefix = `RO${dateText}`;
  const count = await prismaClient.repairOrder.count({
    where: {
      orderNo: {
        startsWith: prefix,
      },
    },
  });

  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}
