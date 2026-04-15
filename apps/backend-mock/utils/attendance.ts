import dayjs from 'dayjs';
import { prismaClient } from '~/utils/db';
import { resolveUserPhoneNumber } from '~/utils/user-service';

function getEmployeeModel() {
  return prismaClient.employee as any;
}

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

export interface AttendanceScheduleConfig {
  employeeId?: number;
  scheduledCheckIn: string;
  scheduledCheckOut: string;
  source: 'default' | 'employee';
  userId?: number;
}

type TimeRange = {
  end: Date;
  start: Date;
};

type AttendanceScheduleIdentity = {
  phone?: null | string;
  realName?: null | string;
  userId?: null | number;
  username?: null | string;
};

type EmployeeScheduleRecord = {
  checkIn: Date | null;
  checkOut: Date | null;
  employeeId: number;
  name: string;
  phone: null | string;
  userId: null | number;
};

const APPROVED_LEAVE_STATUS = 1;
const DEFAULT_SCHEDULE: Pick<
  AttendanceScheduleConfig,
  'scheduledCheckIn' | 'scheduledCheckOut' | 'source'
> = {
  scheduledCheckIn: '09:00:00',
  scheduledCheckOut: '18:00:00',
  source: 'default',
};

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

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function normalizeScheduleTime(value: Date | null | string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return null;
  }

  return parsed.format('HH:mm:ss');
}

function buildScheduleConfig(
  employee?: EmployeeScheduleRecord,
): AttendanceScheduleConfig {
  return {
    employeeId: employee?.employeeId,
    scheduledCheckIn:
      normalizeScheduleTime(employee?.checkIn) ??
      DEFAULT_SCHEDULE.scheduledCheckIn,
    scheduledCheckOut:
      normalizeScheduleTime(employee?.checkOut) ??
      DEFAULT_SCHEDULE.scheduledCheckOut,
    source: employee ? 'employee' : DEFAULT_SCHEDULE.source,
  };
}

function parseScheduleBoundary(dayStart: dayjs.Dayjs, timeText: string) {
  const [hourText = '0', minuteText = '0', secondText = '0'] =
    timeText.split(':');
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  const second = Number.parseInt(secondText, 10);

  if (
    [hour, minute, second].some((value) => Number.isNaN(value)) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return dayStart
    .hour(hour)
    .minute(minute)
    .second(second)
    .millisecond(0)
    .toDate();
}

function resolveScheduleRange(
  dayStart: dayjs.Dayjs,
  schedule: AttendanceScheduleConfig,
) {
  const defaultStart = parseScheduleBoundary(
    dayStart,
    DEFAULT_SCHEDULE.scheduledCheckIn,
  );
  const defaultEnd = parseScheduleBoundary(
    dayStart,
    DEFAULT_SCHEDULE.scheduledCheckOut,
  );

  if (!defaultStart || !defaultEnd) {
    throw new Error('默认考勤时间配置无效');
  }

  const start =
    parseScheduleBoundary(dayStart, schedule.scheduledCheckIn) ?? defaultStart;
  const end =
    parseScheduleBoundary(dayStart, schedule.scheduledCheckOut) ?? defaultEnd;

  if (end.getTime() <= start.getTime()) {
    return {
      end: defaultEnd,
      start: defaultStart,
    };
  }

  return { end, start };
}

export async function getAttendanceScheduleMapForUsers(
  users: AttendanceScheduleIdentity[],
) {
  const identities = new Map<number, AttendanceScheduleIdentity>();

  for (const user of users) {
    const userId = Number(user.userId);
    if (!userId || Number.isNaN(userId)) {
      continue;
    }

    const previous = identities.get(userId) ?? {};
    identities.set(userId, {
      phone: previous.phone ?? user.phone,
      realName: previous.realName ?? user.realName,
      userId,
      username: previous.username ?? user.username,
    });
  }

  const userIds = [...identities.keys()];
  if (userIds.length === 0) {
    return new Map<number, AttendanceScheduleConfig>();
  }

  const userRecords = await prismaClient.user.findMany({
    select: {
      id: true,
      phone: true,
      realName: true,
      username: true,
    },
    where: {
      id: {
        in: userIds,
      },
    },
  });

  for (const userRecord of userRecords) {
    const current = identities.get(userRecord.id) ?? { userId: userRecord.id };
    identities.set(userRecord.id, {
      phone: current.phone ?? userRecord.phone,
      realName: current.realName ?? userRecord.realName,
      userId: userRecord.id,
      username: current.username ?? userRecord.username,
    });
  }

  const phoneCandidates = [...identities.values()]
    .map((user) =>
      resolveUserPhoneNumber({
        phone: user.phone,
        username: user.username,
      }),
    )
    .filter(Boolean);
  const realNames = [...identities.values()]
    .map((user) => normalizeText(user.realName))
    .filter(Boolean);

  let employees: EmployeeScheduleRecord[] = [];
  if (phoneCandidates.length > 0 || realNames.length > 0) {
    const employeeModel = getEmployeeModel();
    const orConditions: Array<Record<string, any>> = [];

    if (phoneCandidates.length > 0) {
      orConditions.push({
        phone: {
          in: [...new Set(phoneCandidates)],
        },
      });
    }

    if (realNames.length > 0) {
      orConditions.push({
        name: {
          in: [...new Set(realNames)],
        },
      });
    }

    employees = await employeeModel.findMany({
      orderBy: {
        createTime: 'desc',
      },
      select: {
        checkIn: true,
        checkOut: true,
        employeeId: true,
        name: true,
        phone: true,
        userId: true,
      },
      where: {
        isDeleted: false,
        OR: orConditions,
      },
    });
  }

  const employeeByPhone = new Map<string, EmployeeScheduleRecord>();
  const employeeByName = new Map<string, EmployeeScheduleRecord>();
  const employeeByUserId = new Map<number, EmployeeScheduleRecord>();

  for (const employee of employees) {
    const boundUserId = Number(employee.userId);
    if (Number.isFinite(boundUserId) && boundUserId > 0) {
      if (!employeeByUserId.has(boundUserId)) {
        employeeByUserId.set(boundUserId, employee);
      }
      continue;
    }

    const employeePhone = normalizeText(employee.phone);
    if (employeePhone && !employeeByPhone.has(employeePhone)) {
      employeeByPhone.set(employeePhone, employee);
    }

    const employeeName = normalizeText(employee.name);
    if (employeeName && !employeeByName.has(employeeName)) {
      employeeByName.set(employeeName, employee);
    }
  }

  const scheduleMap = new Map<number, AttendanceScheduleConfig>();

  for (const [userId, user] of identities.entries()) {
    const resolvedPhone = resolveUserPhoneNumber({
      phone: user.phone,
      username: user.username,
    });
    const resolvedName = normalizeText(user.realName);
    const matchedEmployee =
      employeeByUserId.get(userId) ??
      (resolvedPhone ? employeeByPhone.get(resolvedPhone) : undefined) ??
      (resolvedName ? employeeByName.get(resolvedName) : undefined);

    scheduleMap.set(userId, {
      ...buildScheduleConfig(matchedEmployee),
      userId,
    });
  }

  return scheduleMap;
}

export async function getAttendanceScheduleForUser(
  user: AttendanceScheduleIdentity & { userId: number },
) {
  const scheduleMap = await getAttendanceScheduleMapForUsers([user]);
  return (
    scheduleMap.get(user.userId) ?? {
      ...DEFAULT_SCHEDULE,
      userId: user.userId,
    }
  );
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

export function resolveAttendanceStateWithSchedule(params: {
  leaveRanges?: TimeRange[];
  punchIn: Date;
  punchOut?: Date | null;
  schedule: AttendanceScheduleConfig;
}) {
  const punchInMoment = dayjs(params.punchIn);
  const normalizedLeaveRanges = normalizeRanges(params.leaveRanges ?? []);
  const { leaveMinutes, leaveScope } = getDailyLeaveSummary(
    punchInMoment.startOf('day'),
    normalizedLeaveRanges,
  );
  const scheduleRange = resolveScheduleRange(
    punchInMoment.startOf('day'),
    params.schedule,
  );
  const requiredSegments = subtractRange(scheduleRange, normalizedLeaveRanges);

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
    schedule: params.schedule,
    status,
  };
}

export async function resolveAttendanceState(params: {
  leaveRanges?: TimeRange[];
  phone?: null | string;
  punchIn: Date;
  punchOut?: Date | null;
  realName?: null | string;
  userId: number;
  username?: null | string;
}) {
  const schedule = await getAttendanceScheduleForUser({
    phone: params.phone,
    realName: params.realName,
    userId: params.userId,
    username: params.username,
  });

  return resolveAttendanceStateWithSchedule({
    leaveRanges: params.leaveRanges,
    punchIn: params.punchIn,
    punchOut: params.punchOut,
    schedule,
  });
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
