import { readBody } from 'h3';
import { getLocationAbnormalConfirmationStatus } from '~/utils/attendance-abnormal-confirmation';
import { validateAttendanceLocation } from '~/utils/attendance-location';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
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
    const { latitude, longitude, punchTime } = await readBody(event);
    const locationValidation = validateAttendanceLocation({
      latitude,
      longitude,
    });

    if (!locationValidation.isValid) {
      return useResponseError('定位失败，请开启定位权限后重新打卡');
    }

    const confirmationStatus = await getLocationAbnormalConfirmationStatus({
      latitude,
      locationValidation,
      longitude,
      punchTime,
      userId: userinfo.id,
    });

    return useResponseSuccess({
      ...confirmationStatus,
      distanceMeters: locationValidation.distanceMeters,
      inRange: locationValidation.inRange,
      nearestLocationName: locationValidation.nearestLocation?.name ?? null,
    });
  } catch (error: any) {
    console.error('查询考勤地点异常确认状态失败:', error);
    return useResponseError(error.message || '查询地点异常确认状态失败');
  }
});
