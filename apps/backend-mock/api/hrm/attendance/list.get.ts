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
    const page = Number.parseInt(query.page as string) || 1;
    const pageSize = Number.parseInt(query.pageSize as string) || 10;
    const roleNames = userinfo.roles ?? [];
    const isSuper = roleNames.includes('Super');
    const requestedUsername =
      typeof query.username === 'string' ? query.username.trim() : '';

    const startDate = query.startDate
      ? dayjs(query.startDate as string)
          .startOf('day')
          .toDate()
      : undefined;
    const endDate = query.endDate
      ? dayjs(query.endDate as string)
          .endOf('day')
          .toDate()
      : undefined;

    const where: any = {};

    if (isSuper) {
      if (requestedUsername) {
        where.username = requestedUsername;
      }
    } else {
      where.userId = userinfo.id;
    }

    if (startDate && endDate) {
      where.punchIn = {
        gte: startDate,
        lte: endDate,
      };
    }

    const total = await prismaClient.attendance.count({ where });
    const records = await prismaClient.attendance.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        punchIn: 'desc',
      },
    });

    const rangeStart =
      records.length > 0
        ? dayjs(records[records.length - 1].punchIn)
            .startOf('day')
            .toDate()
        : startDate;
    const rangeEnd =
      records.length > 0
        ? dayjs(records[0].punchIn).endOf('day').toDate()
        : endDate;
    const leaveMap =
      rangeStart && rangeEnd
        ? await getApprovedLeaveRangesByUserIds(
            records.map((record) => record.userId).filter(Boolean),
            rangeStart,
            rangeEnd,
          )
        : new Map<number, { end: Date; start: Date }[]>();
    const deviceInfoMap = await getAttendanceDeviceRecordInfoMap(
      records.map((record) => record.attendanceId),
    );

    const formattedItems = await Promise.all(
      records.map(async (record) => {
        let workHours = 0;
        if (record.punchIn && record.punchOut) {
          const workDuration = dayjs(record.punchOut).diff(
            dayjs(record.punchIn),
            'hour',
            true,
          );
          workHours = Math.round(workDuration * 100) / 100;
        }

        const attendanceState = await resolveAttendanceState({
          punchIn: record.punchIn,
          punchOut: record.punchOut,
          leaveRanges: record.userId ? (leaveMap.get(record.userId) ?? []) : [],
          realName: record.userId ? undefined : record.username,
          userId: record.userId ?? userinfo.id,
          username: record.userId ? undefined : record.username,
        });

        return {
          attendanceId: record.attendanceId,
          id: record.attendanceId,
          key: record.attendanceId,
          date: dayjs(record.punchIn).format('YYYY-MM-DD'),
          deviceAbnormalTypes:
            deviceInfoMap.get(record.attendanceId)?.abnormalTypes ?? [],
          deviceStatus:
            deviceInfoMap.get(record.attendanceId)?.status ?? 'normal',
          leaveMinutes: attendanceState.leaveMinutes,
          leaveScope: attendanceState.leaveScope,
          punchIn: dayjs(record.punchIn).format('HH:mm:ss'),
          punchOut: record.punchOut
            ? dayjs(record.punchOut).format('HH:mm:ss')
            : '-',
          status: attendanceState.status,
          workHours,
        };
      }),
    );

    return useResponseSuccess({
      items: formattedItems,
      total,
    });
  } catch (error: any) {
    console.error('获取考勤列表失败:', error);
    return useResponseError(error.message || '获取失败');
  }
});
