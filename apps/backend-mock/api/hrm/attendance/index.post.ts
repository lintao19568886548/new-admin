import dayjs from 'dayjs';
import { readBody } from 'h3';
import {
  getApprovedLeaveRangesByUserIds,
  resolveAttendanceState,
} from '~/utils/attendance';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  // 身份验证
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const { punchTime, longitude, latitude } = await readBody(event);
    console.log('punchTime', punchTime);
    console.log('longitude', longitude);
    console.log('latitude', latitude);

    if (!punchTime || longitude === undefined || latitude === undefined) {
      return useResponseError('缺少必要的参数');
    }

    // 检查当天是否已经有打卡记录
    const startOfToday = dayjs(punchTime).startOf('day').toDate();
    const endOfToday = dayjs(punchTime).endOf('day').toDate();
    const existingRecord = await prismaClient.attendance.findFirst({
      where: {
        userId: userinfo.id,
        punchIn: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    if (existingRecord) {
      return useResponseError('今天已经打过上班卡了');
    }

    const punchInMoment = dayjs(punchTime);
    const leaveMap = await getApprovedLeaveRangesByUserIds(
      [userinfo.id],
      punchInMoment.startOf('day').toDate(),
      punchInMoment.endOf('day').toDate(),
    );
    const { status } = await resolveAttendanceState({
      punchIn: new Date(punchTime),
      leaveRanges: leaveMap.get(userinfo.id) ?? [],
      phone: userinfo.phone,
      realName: userinfo.realName,
      userId: userinfo.id,
      username: userinfo.username,
    });

    const newAttendance = await prismaClient.attendance.create({
      data: {
        punchIn: new Date(punchTime),
        longitude,
        latitude,
        status,
        username: userinfo.realName,
        userId: userinfo.id,
      },
    });
    console.log('newAttendance', newAttendance);

    return useResponseSuccess(newAttendance, '打卡成功');
  } catch (error: any) {
    console.error('创建打卡记录失败:', error);
    return useResponseError(error.message || '创建失败');
  }
});
