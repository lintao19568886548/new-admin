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
    const id = Number.parseInt(event.context.params?.id || '', 10);
    if (!id) {
      return badRequestResponse('deviceId错误', event);
    }

    const currentDevice = await prismaClient.accessDoor.findUnique({
      where: {
        deviceId: id,
      },
    });
    if (!currentDevice) {
      return useResponseError('门禁设备不存在');
    }

    const accessibleParkIds = userinfo.parks.map((park) => park.parkId);
    if (!accessibleParkIds.includes(currentDevice.parkId)) {
      return useResponseError('没有操作权限');
    }

    const body = await readBody<{ status?: number }>(event);
    const status = Number(body?.status);
    if (![0, 1].includes(status)) {
      return badRequestResponse('status参数错误', event);
    }

    const updatedDevice = await prismaClient.accessDoor.update({
      data: {
        status,
      },
      include: {
        park: true,
      },
      where: {
        deviceId: id,
      },
    });

    return useResponseSuccess(updatedDevice);
  } catch (error) {
    console.error('更新门禁状态失败:', error);
    return serverErrorResponse('更新门禁状态失败', event);
  }
});
