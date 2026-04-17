import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
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
    const body = await readBody<{
      deviceCode?: string;
      deviceName?: string;
      location?: string;
      parkId?: number;
      status?: number;
    }>(event);

    const deviceCode = String(body?.deviceCode ?? '')
      .trim()
      .toUpperCase();
    const deviceName = String(body?.deviceName ?? '').trim();
    const location = String(body?.location ?? '').trim();
    const parkId = Number(body?.parkId);
    const status = Number(body?.status);

    if (!deviceCode) {
      return badRequestResponse('设备编号不能为空', event);
    }
    if (!deviceName) {
      return badRequestResponse('门禁设备名称不能为空', event);
    }
    if (!location) {
      return badRequestResponse('所在地点不能为空', event);
    }
    if (!Number.isInteger(parkId) || parkId <= 0) {
      return badRequestResponse('园区ID错误', event);
    }
    if (![0, 1].includes(status)) {
      return badRequestResponse('status参数错误', event);
    }

    const accessibleParkIds = userinfo.parks.map((park) => park.parkId);
    if (!accessibleParkIds.includes(parkId)) {
      return useResponseError('没有操作权限');
    }

    const park = await prismaClient.park.findFirst({
      select: {
        parkId: true,
        parkName: true,
      },
      where: {
        isDeleted: false,
        parkId,
      },
    });
    if (!park) {
      return useResponseError('园区不存在');
    }

    const existingDevice = await prismaClient.accessDoor.findUnique({
      where: {
        deviceCode,
      },
    });
    if (existingDevice) {
      return useResponseError('设备编号已存在');
    }

    const createdDevice = await prismaClient.accessDoor.create({
      data: {
        deviceCode,
        deviceName,
        location,
        parkId: park.parkId,
        status,
      },
      include: {
        park: true,
      },
    });

    return useResponseSuccess(createdDevice);
  } catch (error) {
    console.error('创建门禁设备失败:', error);
    return serverErrorResponse('创建门禁设备失败', event);
  }
});
