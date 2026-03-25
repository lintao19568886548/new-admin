import dayjs from 'dayjs';
import { prismaClient } from '~/utils/db';

export const AttendanceStatus = {
  Normal: 0,
  Late: 1,
  EarlyLeave: 2,
  LateAndEarlyLeave: 3,
  Absent: 4,
  Leave: 5,
} as const;

export const LeaveScope = {
  None: 'none',
  Partial: 'partial',
  Full: 'full',
} as const;

export type AttendanceStatusValue =
  (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export type LeaveScopeValue = (typeof LeaveScope)[keyof typeof LeaveScope];

type TimeRange = {
  end: Date;
  start: Date;
};

const APPROVED_LEAVE_STATUS = 1;

const WORK_INTERVAL_HOURS = [
  { start: 9, end: 12 },
  { start: 14, end: 18 },
] as const;

export const STANDARD_WORK_MINUTES = WORK_INTERVAL_HOURS.reduce(
  (total, interval) => total + (interval.end - interval.start) * 60,
  0,
);

export function buildWorkIntervals(dayStart: dayjs.Dayjs): TimeRange[] {
  return WORK_INTERVAL_HOURS.map(({ start, end }) => ({
    start: dayStart.hour(start).minute(0).second(0).millisecond(0).toDate(),
    end: dayStart.hour(end).minute(0).second(0).millisecond(0).toDate(),
  }));
}

function isValidRange(range: TimeRange) {
  return range.end.getTime() > range.start.getTime();
}

function normalizeRanges(ranges: TimeRange[]): TimeRange[] {
  const validRanges = ranges
    .filter((range) => isValidRange(range))
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  const merged: TimeRange[] = [];
  for (const range of validRanges) {
    const last = merged.at(-1);
    if (!last || range.start.getTime() > last.end.getTime()) {
      merged.push({
        start: new Date(range.start),
        end: new Date(range.end),
      });
      continue;
    }

    if (range.end.getTime() > last.end.getTime()) {
      last.end = new Date(range.end);
    }
  }

  return merged;
}

function intersectRange(left: TimeRange, right: TimeRange): null | TimeRange {
  const start = new Date(Math.max(left.start.getTime(), right.start.getTime()));
  const end = new Date(Math.min(left.end.getTime(), right.end.getTime()));
  if (end.getTime() <= start.getTime()) {
    return null;
  }
  return { start, end };
}

function subtractRange(source: TimeRange, cuts: TimeRange[]): TimeRange[] {
  let segments: TimeRange[] = [source];

  for (const cut of cuts) {
    const nextSegments: TimeRange[] = [];
    for (const segment of segments) {
      if (
        cut.end.getTime() <= segment.start.getTime() ||
        cut.start.getTime() >= segment.end.getTime()
      ) {
        nextSegments.push(segment);
        continue;
      }

      if (cut.start.getTime() > segment.start.getTime()) {
        nextSegments.push({
          start: segment.start,
          end: new Date(cut.start),
        });
      }

      if (cut.end.getTime() < segment.end.getTime()) {
        nextSegments.push({
          start: new Date(cut.end),
          end: segment.end,
        });
      }
    }
    segments = nextSegments;
  }

  return segments.filter((range) => isValidRange(range));
}

function sumRangeMinutes(ranges: TimeRange[]) {
  return ranges.reduce((total, range) => {
    return total + (range.end.getTime() - range.start.getTime()) / 60_000;
  }, 0);
}

export async function getApprovedLeaveRangesByUserIds(
  userIds: number[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const leaveMap = new Map<number, TimeRange[]>();

  if (uniqueUserIds.length === 0) {
    return leaveMap;
  }

  const leaveApplications = await prismaClient.leaveApplication.findMany({
    where: {
      endDate: {
        gt: rangeStart,
      },
      startDate: {
        lt: rangeEnd,
      },
      status: APPROVED_LEAVE_STATUS,
      userId: {
        in: uniqueUserIds,
      },
    },
    select: {
      endDate: true,
      startDate: true,
      userId: true,
    },
  });

  for (const leaveApplication of leaveApplications) {
    if (!leaveApplication.userId) {
      continue;
    }

    const currentRanges = leaveMap.get(leaveApplication.userId) ?? [];
    currentRanges.push({
      start: leaveApplication.startDate,
      end: leaveApplication.endDate,
    });
    leaveMap.set(leaveApplication.userId, currentRanges);
  }

  for (const [userId, ranges] of leaveMap.entries()) {
    leaveMap.set(userId, normalizeRanges(ranges));
  }

  return leaveMap;
}

export function getDailyLeaveSummary(
  dayStart: dayjs.Dayjs,
  leaveRanges: TimeRange[],
) {
  const workIntervals = buildWorkIntervals(dayStart);
  const normalizedLeaveRanges = normalizeRanges(leaveRanges);
  const requiredSegments = workIntervals.flatMap((workInterval) => {
    return subtractRange(workInterval, normalizedLeaveRanges);
  });

  const totalWorkMinutes = sumRangeMinutes(workIntervals);
  const requiredWorkMinutes = sumRangeMinutes(requiredSegments);
  const leaveMinutes = Math.max(0, totalWorkMinutes - requiredWorkMinutes);

  let leaveScope: LeaveScopeValue = LeaveScope.None;
  if (leaveMinutes > 0) {
    leaveScope =
      requiredWorkMinutes === 0 ? LeaveScope.Full : LeaveScope.Partial;
  }

  return {
    leaveMinutes: Math.round(leaveMinutes),
    leaveScope,
    requiredSegments,
    workIntervals,
  };
}

export function resolveAttendanceState(params: {
  leaveRanges?: TimeRange[];
  punchIn: Date;
  punchOut?: Date | null;
}) {
  const punchInMoment = dayjs(params.punchIn);
  const { leaveMinutes, leaveScope, requiredSegments } = getDailyLeaveSummary(
    punchInMoment.startOf('day'),
    params.leaveRanges ?? [],
  );

  let status: AttendanceStatusValue = AttendanceStatus.Normal;

  const firstRequiredSegment = requiredSegments[0];
  if (
    firstRequiredSegment &&
    punchInMoment.isAfter(firstRequiredSegment.start)
  ) {
    status = AttendanceStatus.Late;
  }

  const lastRequiredSegment = requiredSegments.at(-1);
  if (
    params.punchOut &&
    lastRequiredSegment &&
    dayjs(params.punchOut).isBefore(lastRequiredSegment.end)
  ) {
    status =
      status === AttendanceStatus.Late
        ? AttendanceStatus.LateAndEarlyLeave
        : AttendanceStatus.EarlyLeave;
  }

  return {
    leaveMinutes,
    leaveScope,
    status,
  };
}

export function calculateApprovedLeaveMinutesInRange(params: {
  leaveRanges: TimeRange[];
  rangeEnd: Date;
  rangeStart: Date;
}) {
  if (params.rangeEnd.getTime() <= params.rangeStart.getTime()) {
    return 0;
  }

  const normalizedLeaveRanges = normalizeRanges(params.leaveRanges);
  let totalLeaveMinutes = 0;

  for (
    let cursor = dayjs(params.rangeStart).startOf('day');
    cursor.isBefore(params.rangeEnd) || cursor.isSame(params.rangeEnd, 'day');
    cursor = cursor.add(1, 'day')
  ) {
    const queryRange: TimeRange = {
      start: params.rangeStart,
      end: params.rangeEnd,
    };
    const workIntervals = buildWorkIntervals(cursor).flatMap((workInterval) => {
      const clippedWorkInterval = intersectRange(workInterval, queryRange);
      return clippedWorkInterval ? [clippedWorkInterval] : [];
    });

    if (workIntervals.length === 0) {
      continue;
    }

    const requiredSegments = workIntervals.flatMap((workInterval) => {
      return subtractRange(workInterval, normalizedLeaveRanges);
    });

    totalLeaveMinutes +=
      sumRangeMinutes(workIntervals) - sumRangeMinutes(requiredSegments);
  }

  return Math.round(totalLeaveMinutes);
}

export function calculateApprovedLeaveDaysInRange(params: {
  leaveRanges: TimeRange[];
  rangeEnd: Date;
  rangeStart: Date;
}) {
  if (params.rangeEnd.getTime() <= params.rangeStart.getTime()) {
    return 0;
  }

  const normalizedLeaveRanges = normalizeRanges(params.leaveRanges);
  let totalLeaveDays = 0;

  for (
    let cursor = dayjs(params.rangeStart).startOf('day');
    cursor.isBefore(params.rangeEnd) || cursor.isSame(params.rangeEnd, 'day');
    cursor = cursor.add(1, 'day')
  ) {
    const queryRange: TimeRange = {
      start: params.rangeStart,
      end: params.rangeEnd,
    };
    const workIntervals = buildWorkIntervals(cursor).flatMap((workInterval) => {
      const clippedWorkInterval = intersectRange(workInterval, queryRange);
      return clippedWorkInterval ? [clippedWorkInterval] : [];
    });

    for (const workInterval of workIntervals) {
      const hasApprovedLeave = normalizedLeaveRanges.some((leaveRange) => {
        return Boolean(intersectRange(workInterval, leaveRange));
      });

      if (hasApprovedLeave) {
        totalLeaveDays += 0.5;
      }
    }
  }

  return Number(totalLeaveDays.toFixed(2));
}
