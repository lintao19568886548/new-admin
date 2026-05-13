import dayjs from 'dayjs';
import { readBody } from 'h3';
import {
  getApprovedLeaveRangesByUserIds,
  resolveAttendanceState,
} from '~/utils/attendance';
import {
  AttendanceDeviceError,
  prepareAttendanceDeviceForPunch,
  recordAttendanceDeviceAbnormal,
} from '~/utils/attendance-device';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return useResponseError('未登录或登录已过期', { statusCode: 401 });
  }

  const id = Number.parseInt(event.context.params.id);
  if (!id || Number.isNaN(id)) {
    return useResponseError('无效的ID');
  }

  try {
    const {
      punchTime,
      longitude,
      latitude,
      device,
      bindCurrentDevice,
      allowDeviceAbnormal,
    } = await readBody(event);

    const existingAttendance = await prismaClient.attendance.findUnique({
      where: { attendanceId: id },
    });

    if (!existingAttendance) {
      return useResponseError('找不到该打卡记录');
    }

    const roleNames = userinfo.roles ?? [];
    const isSuper = roleNames.includes('Super');
    if (!isSuper && existingAttendance.userId !== userinfo.id) {
      return useResponseError('没有权限修改他人考勤记录', { statusCode: 403 });
    }

    const deviceDecision = await prepareAttendanceDeviceForPunch({
      allowDeviceAbnormal,
      bindCurrentDevice,
      deviceInput: device,
      user: userinfo,
    });

    const punchOutMoment = dayjs(punchTime);
    const leaveMap = await getApprovedLeaveRangesByUserIds(
      existingAttendance.userId ? [existingAttendance.userId] : [],
      punchOutMoment.startOf('day').toDate(),
      punchOutMoment.endOf('day').toDate(),
    );
    const attendanceUser = existingAttendance.userId
      ? await prismaClient.user.findUnique({
          where: {
            id: existingAttendance.userId,
          },
          select: {
            phone: true,
            realName: true,
            username: true,
          },
        })
      : null;
    let fallbackRealName: string | undefined;
    let fallbackUsername: string | undefined;

    if (existingAttendance.userId) {
      if (existingAttendance.userId === userinfo.id) {
        fallbackRealName = userinfo.realName;
        fallbackUsername = userinfo.username;
      }
    } else {
      fallbackRealName = existingAttendance.username;
      fallbackUsername = existingAttendance.username;
    }
    const { status } = await resolveAttendanceState({
      punchIn: existingAttendance.punchIn,
      punchOut: new Date(punchTime),
      leaveRanges: existingAttendance.userId
        ? (leaveMap.get(existingAttendance.userId) ?? [])
        : [],
      phone:
        attendanceUser?.phone ||
        (existingAttendance.userId === userinfo.id
          ? userinfo.phone
          : undefined),
      realName: attendanceUser?.realName || fallbackRealName,
      userId: existingAttendance.userId ?? userinfo.id,
      username: attendanceUser?.username || fallbackUsername,
    });

    const updatedAttendance = await prismaClient.attendance.update({
      where: { attendanceId: id },
      data: {
        punchOut: new Date(punchTime),
        latitude,
        longitude,
        status,
      },
    });

    await recordAttendanceDeviceAbnormal({
      action: 'punch_out',
      attendanceId: updatedAttendance.attendanceId,
      decision: deviceDecision,
      punchTime: new Date(punchTime),
      user: userinfo,
    });

    return useResponseSuccess(
      {
        ...updatedAttendance,
        deviceBindToken: deviceDecision.deviceBindToken,
      },
      '更新成功',
    );
  } catch (error: any) {
    if (error instanceof AttendanceDeviceError) {
      return useResponseError(error.message, {
        deviceStatus: error.deviceStatus,
        errorCode: error.errorCode,
      });
    }
    console.error('更新打卡记录失败:', error);
    return useResponseError(error.message || '更新失败');
  }
});
