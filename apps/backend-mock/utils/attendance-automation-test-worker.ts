import {
  getApprovedLeaveRangesByUserIds,
  resolveAttendanceState,
} from '~/utils/attendance';
import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';

const WORKER_NAME = 'attendance-automation-test';
const DEFAULT_INTERVAL_MS = 60 * 1000;
const DEFAULT_CHECK_IN_START = '08:20:00';
const DEFAULT_CHECK_IN_END = '08:30:00';
const DEFAULT_CHECK_OUT_START = '18:00:00';
const DEFAULT_CHECK_OUT_END = '18:10:00';
const DEFAULT_WORKDAYS = [0, 1, 2, 3, 4, 5, 6];
const BEIJING_TIME_ZONE = 'Asia/Shanghai';
const BEIJING_UTC_OFFSET_HOURS = 8;

type CustomerScope = {
  customerId: string;
  dbName?: null | string;
};

type TimeOfDay = {
  hour: number;
  minute: number;
  second: number;
};

type TimeWindow = {
  end: TimeOfDay;
  start: TimeOfDay;
};

type BeijingDayContext = {
  day: number;
  dayEnd: Date;
  dayKey: string;
  dayStart: Date;
  month: number;
  weekday: number;
  year: number;
};

type AutomationWorkerConfig = {
  allowNonTestUsers: boolean;
  checkInWindow: TimeWindow;
  checkOutWindow: TimeWindow;
  intervalMs: number;
  latitude: string;
  longitude: string;
  randomSalt: string;
  targetCustomerIds: string[];
  targetUserIds: number[];
  targetUsernames: string[];
  targetWeekdays: number[];
};

type AutomationUser = {
  customerType: null | string;
  id: number;
  phone: null | string;
  realName: string;
  username: string;
};

type AttendanceRecordSnapshot = {
  attendanceId: number;
  punchIn: Date;
  punchOut: Date | null;
  userId: null | number;
  username: string;
};

type AutomationAction = 'punch_in' | 'punch_out';

const globalForAttendanceAutomation = globalThis as typeof globalThis & {
  __attendanceAutomationTestWorker?: {
    intervalId: ReturnType<typeof setInterval>;
    loggedKeys: Set<string>;
    running: boolean;
  };
};

const beijingDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: BEIJING_TIME_ZONE,
  year: 'numeric',
});

function normalizeBooleanEnv(name: string, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }

  return String(raw).trim().toLowerCase() === 'true';
}

function normalizeStringListEnv(name: string) {
  return String(process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizePositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function normalizeUserIdsEnv(name: string) {
  return [
    ...new Set(
      normalizeStringListEnv(name)
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

function normalizeWeekdaysEnv(name: string, fallback: number[]) {
  const rawValues = normalizeStringListEnv(name);
  if (rawValues.length === 0) {
    return fallback;
  }

  const weekdays = [
    ...new Set(
      rawValues
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
    ),
  ];

  return weekdays.length > 0 ? weekdays : fallback;
}

function normalizeCoordinateEnv(name: string, min: number, max: number) {
  const raw = String(process.env[name] || '').trim();
  const value = Number(raw);

  if (!raw || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return raw;
}

function parseTimeOfDay(value: string): null | TimeOfDay {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return {
    hour,
    minute,
    second,
  };
}

function timeOfDayToSeconds(value: TimeOfDay) {
  return value.hour * 60 * 60 + value.minute * 60 + value.second;
}

function parseTimeWindow(
  startEnvName: string,
  endEnvName: string,
  fallbackStart: string,
  fallbackEnd: string,
) {
  const start = parseTimeOfDay(process.env[startEnvName] || fallbackStart);
  const end = parseTimeOfDay(process.env[endEnvName] || fallbackEnd);

  if (!start || !end || timeOfDayToSeconds(end) < timeOfDayToSeconds(start)) {
    return null;
  }

  return {
    end,
    start,
  };
}

function getWorkerConfig(): AutomationWorkerConfig | null {
  if (
    process.env.NODE_ENV === 'production' &&
    !normalizeBooleanEnv('ATTENDANCE_AUTOMATION_TEST_ALLOW_PRODUCTION')
  ) {
    console.info(
      `[${WORKER_NAME}] disabled: production requires ATTENDANCE_AUTOMATION_TEST_ALLOW_PRODUCTION=true`,
    );
    return null;
  }

  if (!normalizeBooleanEnv('ATTENDANCE_AUTOMATION_TEST_ENABLED')) {
    return null;
  }

  const targetUsernames = normalizeStringListEnv(
    'ATTENDANCE_AUTOMATION_TEST_USERNAMES',
  );
  const targetUserIds = normalizeUserIdsEnv(
    'ATTENDANCE_AUTOMATION_TEST_USER_IDS',
  );
  if (targetUsernames.length === 0 && targetUserIds.length === 0) {
    console.info(
      `[${WORKER_NAME}] disabled: configure ATTENDANCE_AUTOMATION_TEST_USERNAMES or ATTENDANCE_AUTOMATION_TEST_USER_IDS`,
    );
    return null;
  }

  const longitude = normalizeCoordinateEnv(
    'ATTENDANCE_AUTOMATION_TEST_LONGITUDE',
    -180,
    180,
  );
  const latitude = normalizeCoordinateEnv(
    'ATTENDANCE_AUTOMATION_TEST_LATITUDE',
    -90,
    90,
  );
  if (!longitude || !latitude) {
    console.info(
      `[${WORKER_NAME}] disabled: configure valid ATTENDANCE_AUTOMATION_TEST_LONGITUDE and ATTENDANCE_AUTOMATION_TEST_LATITUDE`,
    );
    return null;
  }

  const checkInWindow = parseTimeWindow(
    'ATTENDANCE_AUTOMATION_TEST_CHECK_IN_START',
    'ATTENDANCE_AUTOMATION_TEST_CHECK_IN_END',
    DEFAULT_CHECK_IN_START,
    DEFAULT_CHECK_IN_END,
  );
  const checkOutWindow = parseTimeWindow(
    'ATTENDANCE_AUTOMATION_TEST_CHECK_OUT_START',
    'ATTENDANCE_AUTOMATION_TEST_CHECK_OUT_END',
    DEFAULT_CHECK_OUT_START,
    DEFAULT_CHECK_OUT_END,
  );
  if (!checkInWindow || !checkOutWindow) {
    console.info(`[${WORKER_NAME}] disabled: invalid time window config`);
    return null;
  }

  return {
    allowNonTestUsers: normalizeBooleanEnv(
      'ATTENDANCE_AUTOMATION_TEST_ALLOW_NON_TEST_USERS',
    ),
    checkInWindow,
    checkOutWindow,
    intervalMs: normalizePositiveIntegerEnv(
      'ATTENDANCE_AUTOMATION_TEST_WORKER_INTERVAL_MS',
      DEFAULT_INTERVAL_MS,
    ),
    latitude,
    longitude,
    randomSalt:
      process.env.ATTENDANCE_AUTOMATION_TEST_RANDOM_SALT || WORKER_NAME,
    targetCustomerIds: normalizeStringListEnv(
      'ATTENDANCE_AUTOMATION_TEST_CUSTOMER_IDS',
    ),
    targetUserIds,
    targetUsernames,
    targetWeekdays: normalizeWeekdaysEnv(
      'ATTENDANCE_AUTOMATION_TEST_WORKDAYS',
      DEFAULT_WORKDAYS,
    ),
  };
}

function logOnce(key: string, message: string) {
  const state = globalForAttendanceAutomation.__attendanceAutomationTestWorker;
  if (!state || state.loggedKeys.has(key)) {
    return;
  }

  state.loggedKeys.add(key);
  console.info(message);
}

function getBeijingDateParts(date: Date) {
  const parts: Record<string, number> = {};
  for (const part of beijingDateFormatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value);
    }
  }

  return {
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    month: parts.month,
    second: parts.second,
    year: parts.year,
  };
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function beijingLocalToDate(
  dayContext: Pick<BeijingDayContext, 'day' | 'month' | 'year'>,
  time: TimeOfDay,
) {
  return new Date(
    Date.UTC(
      dayContext.year,
      dayContext.month - 1,
      dayContext.day,
      time.hour - BEIJING_UTC_OFFSET_HOURS,
      time.minute,
      time.second,
      0,
    ),
  );
}

function getBeijingDayContext(now: Date): BeijingDayContext {
  const parts = getBeijingDateParts(now);
  const dayStart = beijingLocalToDate(parts, {
    hour: 0,
    minute: 0,
    second: 0,
  });
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    day: parts.day,
    dayEnd,
    dayKey: `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`,
    dayStart,
    month: parts.month,
    weekday: new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day),
    ).getUTCDay(),
    year: parts.year,
  };
}

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function pickDueTime(params: {
  action: AutomationAction;
  config: AutomationWorkerConfig;
  customerScope: CustomerScope;
  dayContext: BeijingDayContext;
  user: AutomationUser;
  window: TimeWindow;
}) {
  const start = beijingLocalToDate(params.dayContext, params.window.start);
  const end = beijingLocalToDate(params.dayContext, params.window.end);
  const spanSeconds = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 1000),
  );
  const seed = [
    params.config.randomSalt,
    params.customerScope.customerId,
    params.customerScope.dbName || '',
    params.user.id,
    params.dayContext.dayKey,
    params.action,
  ].join(':');
  const offsetSeconds = stableHash(seed) % (spanSeconds + 1);

  const dueTime = new Date(start.getTime() + offsetSeconds * 1000);
  if (dueTime.getUTCSeconds() !== 0) {
    return dueTime;
  }

  const oneSecondLater = new Date(dueTime.getTime() + 1000);
  if (oneSecondLater.getTime() <= end.getTime()) {
    return oneSecondLater;
  }

  const oneSecondEarlier = new Date(dueTime.getTime() - 1000);
  if (oneSecondEarlier.getTime() >= start.getTime()) {
    return oneSecondEarlier;
  }

  return dueTime;
}

function normalizeSearchText(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isTestAutomationUser(user: AutomationUser) {
  const text = [user.username, user.realName, user.customerType, user.phone]
    .map((value) => normalizeSearchText(value))
    .join(' ');

  return (
    /\b(?:auto|demo|mock|qa|sandbox|test)\b/.test(text) ||
    text.includes('\u6D4B\u8BD5') ||
    text.includes('\u81EA\u52A8\u5316') ||
    text.includes('\u6A21\u62DF')
  );
}

async function listActiveCustomerScopes(config: AutomationWorkerConfig) {
  const where =
    config.targetCustomerIds.length > 0
      ? {
          customerId: {
            in: config.targetCustomerIds,
          },
          status: {
            not: 0,
          },
        }
      : {
          status: {
            not: 0,
          },
        };

  const customers = await systemDbClient.customer.findMany({
    select: {
      customerId: true,
      dbName: true,
    },
    where,
  });

  return customers.map((customer) => ({
    customerId: customer.customerId,
    dbName: customer.dbName ? String(customer.dbName) : null,
  }));
}

async function listConfiguredUsers(config: AutomationWorkerConfig) {
  const orConditions: Array<Record<string, unknown>> = [];
  if (config.targetUsernames.length > 0) {
    orConditions.push({
      username: {
        in: config.targetUsernames,
      },
    });
  }
  if (config.targetUserIds.length > 0) {
    orConditions.push({
      id: {
        in: config.targetUserIds,
      },
    });
  }

  if (orConditions.length === 0) {
    return [] as AutomationUser[];
  }

  return prismaClient.user.findMany({
    select: {
      customerType: true,
      id: true,
      phone: true,
      realName: true,
      username: true,
    },
    where: {
      OR: orConditions,
      status: 1,
    },
  });
}

async function findTodayAttendance(
  userId: number,
  dayContext: BeijingDayContext,
) {
  return prismaClient.attendance.findFirst({
    orderBy: {
      punchIn: 'desc',
    },
    where: {
      punchIn: {
        gte: dayContext.dayStart,
        lte: dayContext.dayEnd,
      },
      userId,
    },
  });
}

async function resolveStatusForRecord(params: {
  dayContext: BeijingDayContext;
  punchIn: Date;
  punchOut?: Date | null;
  user: AutomationUser;
}) {
  const leaveMap = await getApprovedLeaveRangesByUserIds(
    [params.user.id],
    params.dayContext.dayStart,
    params.dayContext.dayEnd,
  );

  const { status } = await resolveAttendanceState({
    leaveRanges: leaveMap.get(params.user.id) ?? [],
    phone: params.user.phone,
    punchIn: params.punchIn,
    punchOut: params.punchOut,
    realName: params.user.realName,
    userId: params.user.id,
    username: params.user.username,
  });

  return status;
}

async function ensurePunchIn(params: {
  config: AutomationWorkerConfig;
  customerScope: CustomerScope;
  dayContext: BeijingDayContext;
  dueTime: Date;
  now: Date;
  user: AutomationUser;
}) {
  const existing = await findTodayAttendance(params.user.id, params.dayContext);
  if (existing || params.now.getTime() < params.dueTime.getTime()) {
    return existing as AttendanceRecordSnapshot | null;
  }

  const status = await resolveStatusForRecord({
    dayContext: params.dayContext,
    punchIn: params.dueTime,
    user: params.user,
  });

  const created = await prismaClient.attendance.create({
    data: {
      latitude: Number(params.config.latitude),
      longitude: Number(params.config.longitude),
      punchIn: params.dueTime,
      status,
      userId: params.user.id,
      username: params.user.realName || params.user.username,
    },
  });

  console.info(
    `[${WORKER_NAME}] created punch_in customerId=${params.customerScope.customerId} userId=${params.user.id} username=${params.user.username} punchTime=${params.dueTime.toISOString()}`,
  );

  return created;
}

async function ensurePunchOut(params: {
  attendance: AttendanceRecordSnapshot | null;
  config: AutomationWorkerConfig;
  customerScope: CustomerScope;
  dayContext: BeijingDayContext;
  dueTime: Date;
  now: Date;
  user: AutomationUser;
}) {
  if (
    !params.attendance ||
    params.attendance.punchOut ||
    params.now.getTime() < params.dueTime.getTime()
  ) {
    return;
  }

  const status = await resolveStatusForRecord({
    dayContext: params.dayContext,
    punchIn: params.attendance.punchIn,
    punchOut: params.dueTime,
    user: params.user,
  });

  await prismaClient.attendance.update({
    data: {
      latitude: Number(params.config.latitude),
      longitude: Number(params.config.longitude),
      punchOut: params.dueTime,
      status,
    },
    where: {
      attendanceId: params.attendance.attendanceId,
    },
  });

  console.info(
    `[${WORKER_NAME}] updated punch_out customerId=${params.customerScope.customerId} userId=${params.user.id} username=${params.user.username} punchTime=${params.dueTime.toISOString()}`,
  );
}

async function runScopeTick(params: {
  config: AutomationWorkerConfig;
  customerScope: CustomerScope;
  dayContext: BeijingDayContext;
  now: Date;
}) {
  if (!params.config.targetWeekdays.includes(params.dayContext.weekday)) {
    logOnce(
      `${params.customerScope.customerId}:${params.dayContext.dayKey}:weekday-skipped`,
      `[${WORKER_NAME}] skipped customerId=${params.customerScope.customerId} day=${params.dayContext.dayKey}: weekday ${params.dayContext.weekday} is not configured`,
    );
    return;
  }

  const users = await listConfiguredUsers(params.config);

  for (const user of users) {
    if (!params.config.allowNonTestUsers && !isTestAutomationUser(user)) {
      logOnce(
        `${params.customerScope.customerId}:${user.id}:not-test-user`,
        `[${WORKER_NAME}] skipped userId=${user.id} username=${user.username}: user must be a test/mock/auto account`,
      );
      continue;
    }

    const punchInDueTime = pickDueTime({
      action: 'punch_in',
      config: params.config,
      customerScope: params.customerScope,
      dayContext: params.dayContext,
      user,
      window: params.config.checkInWindow,
    });
    const punchOutDueTime = pickDueTime({
      action: 'punch_out',
      config: params.config,
      customerScope: params.customerScope,
      dayContext: params.dayContext,
      user,
      window: params.config.checkOutWindow,
    });

    const attendance = await ensurePunchIn({
      config: params.config,
      customerScope: params.customerScope,
      dayContext: params.dayContext,
      dueTime: punchInDueTime,
      now: params.now,
      user,
    });

    await ensurePunchOut({
      attendance,
      config: params.config,
      customerScope: params.customerScope,
      dayContext: params.dayContext,
      dueTime: punchOutDueTime,
      now: params.now,
      user,
    });
  }
}

async function runAttendanceAutomationTestTick(config: AutomationWorkerConfig) {
  const state = globalForAttendanceAutomation.__attendanceAutomationTestWorker;
  if (!state || state.running) {
    return;
  }

  state.running = true;
  try {
    const now = new Date();
    const dayContext = getBeijingDayContext(now);
    const customerScopes = await listActiveCustomerScopes(config);

    for (const customerScope of customerScopes) {
      try {
        await prismaScopeStorage.run(customerScope, async () =>
          runScopeTick({
            config,
            customerScope,
            dayContext,
            now,
          }),
        );
      } catch (error) {
        console.error(
          `[${WORKER_NAME}] tick failed customerId=${customerScope.customerId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error(`[${WORKER_NAME}] tick failed:`, error);
  } finally {
    state.running = false;
  }
}

export function startAttendanceAutomationTestWorker() {
  const config = getWorkerConfig();
  if (!config) {
    console.info(`[${WORKER_NAME}] worker disabled`);
    return;
  }

  if (globalForAttendanceAutomation.__attendanceAutomationTestWorker) {
    return;
  }

  const state = {
    intervalId: setInterval(() => {
      void runAttendanceAutomationTestTick(config);
    }, config.intervalMs),
    loggedKeys: new Set<string>(),
    running: false,
  };

  state.intervalId.unref?.();
  globalForAttendanceAutomation.__attendanceAutomationTestWorker = state;

  console.info(
    `[${WORKER_NAME}] worker started intervalMs=${config.intervalMs}`,
  );
  setTimeout(() => {
    void runAttendanceAutomationTestTick(config);
  }, 1000).unref?.();
}
