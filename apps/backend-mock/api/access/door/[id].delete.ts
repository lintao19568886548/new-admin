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

  const id = Number.parseInt(event.context.params?.id || '', 10);
  if (!id) {
    return useResponseError('deviceId错误');
  }

  try {
    const currentDevice = await prismaClient.accessDoor.findUnique({
      where: {
        deviceId: id,
      },
    });

    if (!currentDevice) {
      return useResponseError('门禁设备不存在');
    }

    const accessibleParkIds = userinfo.parks.map((park) => park.parkId);
    if (
      currentDevice.parkId &&
      !accessibleParkIds.includes(currentDevice.parkId)
    ) {
      return useResponseError('没有操作权限');
    }

    await prismaClient.accessDoor.delete({
      where: {
        deviceId: id,
      },
    });

    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除门禁设备失败:', error);
    return serverErrorResponse('删除门禁设备失败', event);
  }
});
