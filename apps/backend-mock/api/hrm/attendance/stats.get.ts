import dayjs from 'dayjs';
import { getQuery } from 'h3';
import {
  AttendanceStatus,
  calculateApprovedLeaveDaysInRange,
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

// const STANDARD_WORK_HOURS = 8;

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

    const startOfMonth = dayjs().startOf('month').toDate();
    const endOfMonth = dayjs().endOf('month').toDate();

    let scopeWhere: { userId: number } | { username: string } = {
      userId: userinfo.id,
    };
    if (isSuper && requestedUsername) {
      scopeWhere = { username: requestedUsername };
    }

    const records = await prismaClient.attendance.findMany({
      where: {
        ...scopeWhere,
        punchIn: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const leaveWhere: Record<string, any> = {
      endDate: {
        gt: startOfMonth,
      },
      startDate: {
        lt: endOfMonth,
      },
      status: 1,
    };
    if (isSuper) {
      if (requestedUsername) {
        leaveWhere.user = requestedUsername;
      }
    } else {
      leaveWhere.userId = userinfo.id;
    }

    const approvedLeaves = await prismaClient.leaveApplication.findMany({
      where: leaveWhere,
      select: {
        endDate: true,
        startDate: true,
        userId: true,
      },
    });

    const leaveMap = await getApprovedLeaveRangesByUserIds(
      [
        ...records.map((record) => record.userId).filter(Boolean),
        ...approvedLeaves.map((leave) => leave.userId).filter(Boolean),
      ],
      startOfMonth,
      endOfMonth,
    );

    const stats = {
      attendanceDays: 0,
      lateDays: 0,
      earlyLeaveDays: 0,
      overtimeHours: 0,
      leaveDays: 0,
    };

    for (const record of records) {
      const attendanceState = await resolveAttendanceState({
        punchIn: record.punchIn,
        punchOut: record.punchOut,
        leaveRanges: record.userId ? (leaveMap.get(record.userId) ?? []) : [],
        realName: record.userId ? undefined : record.username,
        userId: record.userId ?? userinfo.id,
        username: record.userId ? undefined : record.username,
      });

      if (
        attendanceState.status === AttendanceStatus.Late ||
        attendanceState.status === AttendanceStatus.LateAndEarlyLeave
      ) {
        stats.lateDays++;
      }

      if (
        attendanceState.status === AttendanceStatus.EarlyLeave ||
        attendanceState.status === AttendanceStatus.LateAndEarlyLeave
      ) {
        stats.earlyLeaveDays++;
      }

      if (record.punchIn && record.punchOut) {
        stats.attendanceDays++;
        /* const workHours = dayjs(record.punchOut).diff(
          dayjs(record.punchIn),
          'hour',
          true,
        );
        if (workHours > STANDARD_WORK_HOURS) {
          stats.overtimeHours += workHours - STANDARD_WORK_HOURS;
        } */
      }
    }

    const approvedLeaveDays =
      [...leaveMap.values()].reduce((total, leaveRanges) => {
        return (
          total +
          calculateApprovedLeaveDaysInRange({
            leaveRanges,
            rangeEnd: endOfMonth,
            rangeStart: startOfMonth,
          })
        );
      }, 0) +
      approvedLeaves
        .filter((leave) => !leave.userId)
        .reduce((total, leave) => {
          return (
            total +
            calculateApprovedLeaveDaysInRange({
              leaveRanges: [
                {
                  start: leave.startDate,
                  end: leave.endDate,
                },
              ],
              rangeEnd: endOfMonth,
              rangeStart: startOfMonth,
            })
          );
        }, 0);

    stats.leaveDays = Number(approvedLeaveDays.toFixed(2));

    return useResponseSuccess(stats);
  } catch (error: any) {
    console.error('获取月度统计失败:', error);
    return useResponseError(error.message || '获取失败');
  }
});
