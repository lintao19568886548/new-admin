import dayjs from 'dayjs';
import { readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

const AttendanceStatus = {
  Normal: 0,
  Late: 1,
  EarlyLeave: 2,
  LateAndEarlyLeave: 3,
  Absent: 4,
  Leave: 5,
} as const;

type AttendanceStatusValue =
  (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

const WORK_INTERVAL_HOURS = [
  { start: 9, end: 12 },
  { start: 14, end: 18 },
] as const;

type WorkInterval = {
  end: dayjs.Dayjs;
  start: dayjs.Dayjs;
};

type WorkSegment = {
  end: Date;
  start: Date;
};

function buildWorkIntervals(dayStart: dayjs.Dayjs): WorkInterval[] {
  return WORK_INTERVAL_HOURS.map(({ start, end }) => ({
    start: dayStart.hour(start),
    end: dayStart.hour(end),
  }));
}

function getWorkSegmentsBefore(
  moment: dayjs.Dayjs,
  intervals: WorkInterval[],
): WorkSegment[] {
  const segments: WorkSegment[] = [];
  for (const interval of intervals) {
    if (moment.isBefore(interval.start) || moment.isSame(interval.start)) {
      break;
    }
    const segmentEnd = moment.isBefore(interval.end) ? moment : interval.end;
    if (segmentEnd.isAfter(interval.start)) {
      segments.push({
        start: interval.start.toDate(),
        end: segmentEnd.toDate(),
      });
    }
    if (moment.isBefore(interval.end)) {
      break;
    }
  }
  return segments;
}

async function isIntervalCoveredByLeave(
  userId: null | number | undefined,
  intervalStart: Date,
  intervalEnd: Date,
) {
  if (!userId) {
    return false;
  }

  if (intervalEnd <= intervalStart) {
    return false;
  }

  const approvedLeave = await prismaClient.leaveApplication.findFirst({
    where: {
      userId,
      startDate: {
        lte: intervalStart,
      },
      endDate: {
        gte: intervalEnd,
      },
    },
  });

  return Boolean(approvedLeave);
}

async function areSegmentsCoveredByLeave(
  userId: null | number | undefined,
  segments: WorkSegment[],
) {
  if (segments.length === 0) {
    return true;
  }
  for (const segment of segments) {
    const covered = await isIntervalCoveredByLeave(
      userId,
      segment.start,
      segment.end,
    );
    if (!covered) {
      return false;
    }
  }
  return true;
}

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

    // 标准工作时段为 09:00-12:00 与 14:00-18:00
    const punchInMoment = dayjs(punchTime);
    const dayStart = punchInMoment.startOf('day');
    const workIntervals = buildWorkIntervals(dayStart);
    const firstInterval = workIntervals[0];
    if (!firstInterval) {
      return useResponseError('未配置有效的工作时间段');
    }
    const isAfterStandardStart = punchInMoment.isAfter(firstInterval.start);

    const leaveCoversWholeDay = await areSegmentsCoveredByLeave(
      userinfo.id,
      workIntervals.map((interval) => ({
        start: interval.start.toDate(),
        end: interval.end.toDate(),
      })),
    );

    let shouldMarkLate = false;
    if (!leaveCoversWholeDay && isAfterStandardStart) {
      const missedSegments = getWorkSegmentsBefore(
        punchInMoment,
        workIntervals,
      );
      const leaveCoversMissedSegments = await areSegmentsCoveredByLeave(
        userinfo.id,
        missedSegments,
      );
      shouldMarkLate = missedSegments.length > 0 && !leaveCoversMissedSegments;
    }

    let status: AttendanceStatusValue = AttendanceStatus.Normal;
    if (leaveCoversWholeDay) {
      status = AttendanceStatus.Leave;
    } else if (shouldMarkLate) {
      status = AttendanceStatus.Late;
    }

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
