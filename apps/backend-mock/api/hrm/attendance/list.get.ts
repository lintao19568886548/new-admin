import dayjs from 'dayjs';
import { getQuery } from 'h3';
import {
  AttendanceStatus,
  getApprovedLeaveRangesByUserIds,
  resolveAttendanceState,
} from '~/utils/attendance';
import { getConfirmedAttendanceRecordAbnormalIdSet } from '~/utils/attendance-abnormal-confirmation';
import { getAttendanceDeviceRecordInfoMap } from '~/utils/attendance-device';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

function getAttendanceStatusRisk(status: number) {
  if (status === AttendanceStatus.LateAndEarlyLeave) {
    return 30;
  }
  if (status === AttendanceStatus.Late) {
    return 20;
  }
  if (status === AttendanceStatus.EarlyLeave) {
    return 10;
  }
  return 0;
}

function getAttendanceAbnormalCount(status: null | number) {
  return {
    earlyLeaveCount:
      status === AttendanceStatus.EarlyLeave ||
      status === AttendanceStatus.LateAndEarlyLeave
        ? 1
        : 0,
    lateCount:
      status === AttendanceStatus.Late ||
      status === AttendanceStatus.LateAndEarlyLeave
        ? 1
        : 0,
  };
}

function getAttendanceUserKey(item: {
  attendanceUserKey?: string;
  username?: null | string;
}) {
  return item.attendanceUserKey || String(item.username || '');
}

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
    const canViewTeamAttendance = roleNames.some((role: unknown) => {
      const roleName = String(role || '').toLowerCase();
      return (
        roleName.includes('super') ||
        roleName.includes('hr') ||
        roleName.includes('人事')
      );
    });
    const requestedUsername =
      typeof query.username === 'string' ? query.username.trim() : '';
    const abnormalOnly = String(query.attendanceStatus || '') === 'abnormal';
    const groupByUser = abnormalOnly && String(query.groupByUser || '') === '1';

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

    if (canViewTeamAttendance) {
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

    const total = abnormalOnly
      ? 0
      : await prismaClient.attendance.count({ where });
    const records = await prismaClient.attendance.findMany({
      where,
      ...(abnormalOnly
        ? {}
        : {
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
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

        const item = {
          attendanceId: record.attendanceId,
          attendanceUserKey: String(record.userId || record.username || ''),
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
          username: record.username,
          workHours,
        };
        return item;
      }),
    );
    const confirmedIdSet = abnormalOnly
      ? await getConfirmedAttendanceRecordAbnormalIdSet(
          formattedItems.map((item) => item.attendanceId),
        )
      : new Set<number>();
    const visibleItems = abnormalOnly
      ? formattedItems
          .filter((item) => !confirmedIdSet.has(item.attendanceId))
          .filter((item) => getAttendanceStatusRisk(item.status) > 0)
          .sort((first, second) => {
            const riskDiff =
              getAttendanceStatusRisk(second.status) -
              getAttendanceStatusRisk(first.status);
            if (riskDiff !== 0) {
              return riskDiff;
            }
            return dayjs(second.date).valueOf() - dayjs(first.date).valueOf();
          })
      : formattedItems;
    const abnormalSummaryMap = new Map<
      string,
      { abnormalCount: number; earlyLeaveCount: number; lateCount: number }
    >();
    if (abnormalOnly) {
      for (const item of visibleItems) {
        const key = getAttendanceUserKey(item);
        if (!key) {
          continue;
        }
        const counts = getAttendanceAbnormalCount(item.status);
        const current = abnormalSummaryMap.get(key) ?? {
          abnormalCount: 0,
          earlyLeaveCount: 0,
          lateCount: 0,
        };
        current.lateCount += counts.lateCount;
        current.earlyLeaveCount += counts.earlyLeaveCount;
        current.abnormalCount = current.lateCount + current.earlyLeaveCount;
        abnormalSummaryMap.set(key, current);
      }
    }

    function appendAbnormalSummary<
      T extends { attendanceUserKey?: string; username?: null | string },
    >(item: T) {
      const summary = abnormalSummaryMap.get(getAttendanceUserKey(item));
      return {
        ...item,
        abnormalCount: summary?.abnormalCount ?? 0,
        earlyLeaveCount: summary?.earlyLeaveCount ?? 0,
        lateCount: summary?.lateCount ?? 0,
      };
    }

    let responseTotal = abnormalOnly ? visibleItems.length : total;
    let items: any[] = abnormalOnly
      ? visibleItems
          .slice((page - 1) * pageSize, page * pageSize)
          .map((item) => appendAbnormalSummary(item))
      : visibleItems;

    if (groupByUser) {
      const grouped = new Map<
        string,
        {
          attendanceIds: number[];
          date: string;
          earlyLeaveCount: number;
          id: number;
          isGroup: true;
          lateCount: number;
          latestTime: number;
          records: any[];
          risk: number;
          status: null | number;
          username: string;
          workHours: number;
        }
      >();

      for (const item of visibleItems) {
        const key = getAttendanceUserKey(item);
        if (!key) {
          continue;
        }
        const counts = getAttendanceAbnormalCount(item.status);
        const current = grouped.get(key) ?? {
          attendanceIds: [],
          date: item.date,
          earlyLeaveCount: 0,
          id: item.attendanceId,
          isGroup: true as const,
          lateCount: 0,
          latestTime: dayjs(item.date).valueOf(),
          records: [],
          risk: 0,
          status: item.status,
          username: item.username || '未命名员工',
          workHours: 0,
        };
        const risk = getAttendanceStatusRisk(item.status);
        const itemTime = dayjs(item.date).valueOf();
        if (risk > current.risk || itemTime > current.latestTime) {
          current.date = item.date;
          current.id = item.attendanceId;
          current.latestTime = itemTime;
          current.risk = Math.max(current.risk, risk);
          current.status = item.status;
        }
        current.attendanceIds.push(item.attendanceId);
        current.lateCount += counts.lateCount;
        current.earlyLeaveCount += counts.earlyLeaveCount;
        current.records.push(appendAbnormalSummary(item));
        grouped.set(key, current);
      }

      const groupedItems = [...grouped.values()]
        .map((item) => ({
          ...item,
          abnormalCount: item.lateCount + item.earlyLeaveCount,
          records: item.records.sort(
            (first, second) =>
              dayjs(second.date).valueOf() - dayjs(first.date).valueOf(),
          ),
        }))
        .sort((first, second) => {
          const countDiff = second.abnormalCount - first.abnormalCount;
          if (countDiff !== 0) {
            return countDiff;
          }
          const riskDiff = second.risk - first.risk;
          if (riskDiff !== 0) {
            return riskDiff;
          }
          return second.latestTime - first.latestTime;
        });

      responseTotal = groupedItems.length;
      items = groupedItems.slice((page - 1) * pageSize, page * pageSize);
    }

    return useResponseSuccess({
      items,
      total: responseTotal,
    });
  } catch (error: any) {
    console.error('获取考勤列表失败:', error);
    return useResponseError(error.message || '获取失败');
  }
});
