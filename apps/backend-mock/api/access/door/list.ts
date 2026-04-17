import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;

    const accessibleParkIds = userinfo.parks.map((park) => park.parkId);
    const requestedParkRaw = query.parkId ?? query.currentPark;

    let parkIds = accessibleParkIds;
    if (requestedParkRaw !== undefined && requestedParkRaw !== '') {
      const requestedParkId = Number(requestedParkRaw);
      if (requestedParkId !== -1) {
        if (!accessibleParkIds.includes(requestedParkId)) {
          return useResponseError('没有查看权限');
        }
        parkIds = [requestedParkId];
      }
    }

    const where: Record<string, any> = {
      parkId: {
        in: parkIds,
      },
    };

    if (query.deviceCode) {
      where.deviceCode = {
        contains: String(query.deviceCode).trim(),
      };
    }

    if (query.deviceName) {
      where.deviceName = {
        contains: String(query.deviceName).trim(),
      };
    }

    if (query.location) {
      where.location = {
        contains: String(query.location).trim(),
      };
    }

    if (query.status !== undefined && query.status !== '') {
      where.status = Number(query.status);
    }

    const total = await prismaClient.accessDoor.count({ where });
    const devices = await prismaClient.accessDoor.findMany({
      include: {
        park: true,
      },
      orderBy: {
        deviceId: 'desc',
      },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      where,
    });

    const items = devices.map((device) => ({
      ...device,
      parkName: device.park?.parkName || '未知园区',
    }));

    return useResponseSuccess({
      currentPage,
      items,
      pageSize,
      total,
    });
  } catch (error) {
    console.error('获取门禁设备列表失败:', error);
    return serverErrorResponse('获取门禁设备列表失败', event);
  }
});
