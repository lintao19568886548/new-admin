import dayjs from 'dayjs';
import { readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

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

function getWorkSegmentsAfter(
  moment: dayjs.Dayjs,
  intervals: WorkInterval[],
): WorkSegment[] {
  const segments: WorkSegment[] = [];
  for (const interval of intervals) {
    if (moment.isAfter(interval.end) || moment.isSame(interval.end)) {
      continue;
    }
    const segmentStart = moment.isAfter(interval.start)
      ? moment
      : interval.start;
    if (interval.end.isAfter(segmentStart)) {
      segments.push({
        start: segmentStart.toDate(),
        end: interval.end.toDate(),
      });
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
  const id = Number.parseInt(event.context.params.id);
  if (!id || Number.isNaN(id)) {
    return useResponseError('无效的ID');
  }

  try {
    const { punchTime, longitude, latitude } = await readBody(event);

    const existingAttendance = await prismaClient.attendance.findUnique({
      where: { attendanceId: id },
    });

    if (!existingAttendance) {
      return useResponseError('找不到该打卡记录');
    }

    // 更新状态：如果在工作时间段内提前离开，需要额外判断
    const punchOutMoment = dayjs(punchTime);
    const dayStart = punchOutMoment.startOf('day');
    const workIntervals = buildWorkIntervals(dayStart);
    const lastInterval = workIntervals[workIntervals.length - 1];
    if (!lastInterval) {
      return useResponseError('未配置有效的工作时间段');
    }
    const isEarlyLeave = punchOutMoment.isBefore(lastInterval.end);

    const leaveCoversWholeDay = await areSegmentsCoveredByLeave(
      existingAttendance.userId,
      workIntervals.map((interval) => ({
        start: interval.start.toDate(),
        end: interval.end.toDate(),
      })),
    );

    const remainingSegments = isEarlyLeave
      ? getWorkSegmentsAfter(punchOutMoment, workIntervals)
      : [];
    const leaveCoversRemainingSegments = await areSegmentsCoveredByLeave(
      existingAttendance.userId,
      remainingSegments,
    );

    const existingStatus = existingAttendance.status;
    let finalStatus: AttendanceStatusValue =
      existingStatus === null || existingStatus === undefined
        ? AttendanceStatus.Normal
        : (existingStatus as AttendanceStatusValue);

    if (leaveCoversWholeDay) {
      finalStatus = AttendanceStatus.Leave;
    } else if (
      isEarlyLeave &&
      remainingSegments.length > 0 &&
      !leaveCoversRemainingSegments
    ) {
      finalStatus =
        finalStatus === AttendanceStatus.Late
          ? AttendanceStatus.LateAndEarlyLeave
          : AttendanceStatus.EarlyLeave;
    }

    const updatedAttendance = await prismaClient.attendance.update({
      where: { attendanceId: id },
      data: {
        punchOut: new Date(punchTime),
        latitude,
        longitude,
        status: finalStatus,
      },
    });

    return useResponseSuccess(updatedAttendance, '更新成功');
  } catch (error: any) {
    console.error('更新打卡记录失败:', error);
    return useResponseError(error.message || '更新失败');
  }
});
