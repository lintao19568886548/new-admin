import dayjs from 'dayjs';
import { getQuery } from 'h3';
import {
  getApprovedLeaveRangesByUserIds,
  resolveAttendanceState,
} from '~/utils/attendance';
import { getAttendanceDeviceRecordInfoMap } from '~/utils/attendance-device';
import { prismaClient } from '~/utils/db';
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
    const query = getQuery(event);
    const roleNames = userinfo.roles ?? [];
    const isSuper = roleNames.includes('Super');
    const requestedUsername =
      typeof query.username === 'string' ? query.username.trim() : '';

    const startOfToday = dayjs().startOf('day').toDate();
    const endOfToday = dayjs().endOf('day').toDate();

    let scopeWhere: { userId: number } | { username: string } = {
      userId: userinfo.id,
    };
    if (isSuper && requestedUsername) {
      scopeWhere = { username: requestedUsername };
    }

    const todayRecord = await prismaClient.attendance.findFirst({
      where: {
        ...scopeWhere,
        punchIn: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      orderBy: {
        punchIn: 'desc',
      },
    });

    if (!todayRecord) {
      return useResponseSuccess(null);
    }

    const leaveMap = await getApprovedLeaveRangesByUserIds(
      todayRecord.userId ? [todayRecord.userId] : [],
      startOfToday,
      endOfToday,
    );
    const attendanceState = await resolveAttendanceState({
      punchIn: todayRecord.punchIn,
      punchOut: todayRecord.punchOut,
      leaveRanges: todayRecord.userId
        ? (leaveMap.get(todayRecord.userId) ?? [])
        : [],
      phone: todayRecord.userId === userinfo.id ? userinfo.phone : undefined,
      realName:
        todayRecord.userId === userinfo.id
          ? userinfo.realName
          : todayRecord.username,
      userId: todayRecord.userId ?? userinfo.id,
      username:
        todayRecord.userId === userinfo.id
          ? userinfo.username
          : todayRecord.username,
    });
    const deviceInfoMap = await getAttendanceDeviceRecordInfoMap([
      todayRecord.attendanceId,
    ]);
    const deviceInfo = deviceInfoMap.get(todayRecord.attendanceId);

    return useResponseSuccess({
      ...todayRecord,
      deviceAbnormalTypes: deviceInfo?.abnormalTypes ?? [],
      deviceStatus: deviceInfo?.status ?? 'normal',
      leaveMinutes: attendanceState.leaveMinutes,
      leaveScope: attendanceState.leaveScope,
      status: attendanceState.status,
    });
  } catch (error: any) {
    console.error('获取今日打卡记录失败:', error);
    return useResponseError(error.message || '获取失败');
  }
});
