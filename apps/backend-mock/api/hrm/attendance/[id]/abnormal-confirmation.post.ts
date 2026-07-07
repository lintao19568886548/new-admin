import dayjs from 'dayjs';
import {
  AttendanceStatus,
  getApprovedLeaveRangesByUserIds,
  resolveAttendanceState,
} from '~/utils/attendance';
import { createAttendanceRecordAbnormalConfirmations } from '~/utils/attendance-abnormal-confirmation';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

function canViewTeamAttendance(userinfo: any) {
  const roleNames = userinfo?.roles ?? [];
  return roleNames.some((role: unknown) => {
    const roleName = String(role || '').toLowerCase();
    return (
      roleName.includes('super') ||
      roleName.includes('hr') ||
      roleName.includes('人事')
    );
  });
}

function isOwnAttendanceRecord(
  record: { userId: null | number; username: null | string },
  userinfo: any,
) {
  if (record.userId) {
    return record.userId === userinfo.id;
  }

  const recordUsername = String(record.username || '').trim();
  if (!recordUsername) {
    return false;
  }

  return [userinfo?.realName, userinfo?.username]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .includes(recordUsername);
}

function getAttendanceRecordAbnormalTypes(status: null | number) {
  const types: string[] = [];
  if (
    status === AttendanceStatus.Late ||
    status === AttendanceStatus.LateAndEarlyLeave
  ) {
    types.push('late');
  }
  if (
    status === AttendanceStatus.EarlyLeave ||
    status === AttendanceStatus.LateAndEarlyLeave
  ) {
    types.push('early_leave');
  }
  return types;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const attendanceId = Number(event.context.params?.id);
    if (!Number.isInteger(attendanceId) || attendanceId <= 0) {
      return useResponseError('考勤记录ID无效');
    }

    const record = await prismaClient.attendance.findUnique({
      select: {
        attendanceId: true,
        punchIn: true,
        punchOut: true,
        userId: true,
        username: true,
      },
      where: { attendanceId },
    });
    if (!record) {
      return useResponseError('考勤记录不存在');
    }

    if (
      !isOwnAttendanceRecord(record, userinfo) &&
      !canViewTeamAttendance(userinfo)
    ) {
      return useResponseError('没有处理该考勤记录的权限');
    }

    const rangeStart = dayjs(record.punchIn).startOf('day').toDate();
    const rangeEnd = dayjs(record.punchIn).endOf('day').toDate();
    const leaveMap = record.userId
      ? await getApprovedLeaveRangesByUserIds(
          [record.userId],
          rangeStart,
          rangeEnd,
        )
      : new Map<number, { end: Date; start: Date }[]>();
    const attendanceState = await resolveAttendanceState({
      leaveRanges: record.userId ? (leaveMap.get(record.userId) ?? []) : [],
      punchIn: record.punchIn,
      punchOut: record.punchOut,
      realName: record.userId ? undefined : record.username,
      userId: record.userId ?? userinfo.id,
      username: record.userId ? undefined : record.username,
    });
    const abnormalTypes = getAttendanceRecordAbnormalTypes(
      attendanceState.status,
    );
    if (abnormalTypes.length === 0) {
      return useResponseSuccess({
        attendanceId,
        handled: false,
        message: '该记录当前没有迟到或早退异常',
      });
    }

    await createAttendanceRecordAbnormalConfirmations({
      abnormalTypes,
      attendanceId,
      punchTime: record.punchIn,
      userId: record.userId ?? userinfo.id,
      username: record.username,
    });

    return useResponseSuccess({
      abnormalTypes,
      attendanceId,
      handled: true,
    });
  } catch (error: any) {
    console.error('确认考勤异常处理失败:', error);
    return useResponseError(error.message || '确认处理失败');
  }
});
