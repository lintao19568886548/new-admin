import { getAttendanceScheduleForUser } from '~/utils/attendance';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const schedule = await getAttendanceScheduleForUser({
      phone: userinfo.phone,
      realName: userinfo.realName,
      userId: userinfo.id,
      username: userinfo.username,
    });

    return useResponseSuccess(schedule);
  } catch (error) {
    console.error('获取考勤配置失败:', error);
    return serverErrorResponse('获取考勤配置失败', event);
  }
});
