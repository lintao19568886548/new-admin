import { Prisma } from '@prisma/.prisma/client/index.js';
import { prismaClient } from '~/utils/db';

export type AttendanceDeviceAction = 'punch_in' | 'punch_out';
export type AttendanceDeviceAbnormalType =
  | 'device_changed'
  | 'same_device_multi_account'
  | string;
export type AttendanceDeviceRecordStatus = 'abnormal' | 'normal';
export type AttendanceDeviceStatus = 'abnormal' | 'bind_required' | 'normal';

const schemaReadyDatabases = new Set<string>();

export interface AttendanceDeviceInput {
  deviceId?: unknown;
  deviceLabel?: unknown;
  deviceModel?: unknown;
  deviceSystem?: unknown;
  platform?: unknown;
  userAgent?: unknown;
}

interface AttendanceUserSnapshot {
  id: number;
  realName?: null | string;
  username?: null | string;
}

interface BindingRow {
  deviceId: string;
  deviceModel: null | string;
  deviceSystem: null | string;
  firstBindTime: Date | null | string;
  id: bigint | number;
  userId: number;
}

interface DeviceAbnormalLogRow {
  abnormalType: string;
  action: string;
  attendanceId: null | number;
  boundDeviceId: null | string;
  createTime: Date | null | string;
  currentDeviceId: string;
  duplicateUserNames: null | string;
  id: bigint | number;
  punchTime: Date | null | string;
}

export interface AttendanceDeviceRecordInfo {
  abnormalTypes: AttendanceDeviceAbnormalType[];
  status: AttendanceDeviceRecordStatus;
}

export interface AttendanceDevicePublicInfo {
  deviceId: string;
  deviceLabel: null | string;
  deviceModel: null | string;
  deviceSystem: null | string;
}

export type NormalizedAttendanceDevice = AttendanceDevicePublicInfo;

export interface SerializedAttendanceDeviceBinding extends AttendanceDevicePublicInfo {
  firstBindTime: null | string;
  id: number;
  userId: number;
}

interface ActiveAttendanceDeviceBinding extends AttendanceDevicePublicInfo {
  firstBindTime: null | string;
  id: number;
  userId: number;
}

export interface AttendanceDeviceDuplicateUser {
  realName: null | string;
  userId: number;
  username: null | string;
}

export interface AttendanceDeviceDecision {
  abnormalTypes: string[];
  binding: null | SerializedAttendanceDeviceBinding;
  compatibilityMode?: 'legacy_app';
  device: AttendanceDevicePublicInfo;
  duplicateUsers: AttendanceDeviceDuplicateUser[];
  message: string;
  status: AttendanceDeviceStatus;
}

interface SerializedDeviceAbnormalLog {
  abnormalType: string;
  abnormalTypes: AttendanceDeviceAbnormalType[];
  action: string;
  attendanceId: null | number;
  boundDeviceId: null | string;
  createTime: null | string;
  currentDeviceId: string;
  duplicateUserNames: null | string;
  id: number;
  punchTime: null | string;
}

export class AttendanceDeviceError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly deviceStatus: AttendanceDeviceDecision,
  ) {
    super(message);
    this.name = 'AttendanceDeviceError';
  }
}

async function ensureAttendanceDeviceSchema() {
  const databaseRows = await prismaClient.$queryRaw<
    Array<{ databaseName: null | string }>
  >(Prisma.sql`
    SELECT DATABASE() AS databaseName
  `);
  const databaseName = databaseRows[0]?.databaseName || 'default';
  if (schemaReadyDatabases.has(databaseName)) {
    return;
  }

  const abnormalTypeRows = await prismaClient.$queryRaw<
    Array<{
      characterMaximumLength: null | number;
      columnComment: null | string;
    }>
  >(Prisma.sql`
    SELECT
      CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength,
      COLUMN_COMMENT AS columnComment
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'attendance_device_abnormal_log'
      AND COLUMN_NAME = 'abnormal_type'
    LIMIT 1
  `);
  const abnormalTypeLength = abnormalTypeRows[0]?.characterMaximumLength ?? 191;
  const abnormalTypeComment = abnormalTypeRows[0]?.columnComment ?? '';
  const abnormalTypeTargetComment =
    '异常类型：device_changed更换设备，same_device_multi_account同设备多账号，多个类型用逗号分隔';
  if (
    abnormalTypeLength < 191 ||
    abnormalTypeComment !== abnormalTypeTargetComment
  ) {
    await prismaClient.$executeRaw(Prisma.sql`
      ALTER TABLE attendance_device_abnormal_log
      MODIFY COLUMN abnormal_type varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '异常类型：device_changed更换设备，same_device_multi_account同设备多账号，多个类型用逗号分隔'
    `);
  }

  schemaReadyDatabases.add(databaseName);
}

function normalizeString(value: unknown, maxLength: number) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function hasDeviceIdentity(input: AttendanceDeviceInput | null | undefined) {
  return Boolean(normalizeString(input?.deviceId, 128));
}

function buildLegacyAppDeviceDecision(): AttendanceDeviceDecision {
  return {
    abnormalTypes: [],
    binding: null,
    compatibilityMode: 'legacy_app',
    device: {
      deviceId: 'legacy-app-compatible',
      deviceLabel: '旧版本App兼容模式',
      deviceModel: '旧版本App',
      deviceSystem: null,
    },
    duplicateUsers: [],
    message: '旧版本App未上报设备标识，已按兼容模式允许打卡',
    status: 'normal',
  };
}

function serializeDate(value: Date | null | string) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toPublicDevice(
  device: AttendanceDevicePublicInfo,
): AttendanceDevicePublicInfo {
  return {
    deviceId: device.deviceId,
    deviceLabel: device.deviceLabel,
    deviceModel: device.deviceModel,
    deviceSystem: device.deviceSystem,
  };
}

function serializeBinding(row: BindingRow): ActiveAttendanceDeviceBinding {
  const device = {
    deviceId: row.deviceId,
    deviceLabel: null,
    deviceModel: row.deviceModel,
    deviceSystem: row.deviceSystem,
  };
  return {
    ...device,
    deviceLabel: buildDeviceLabel(device),
    firstBindTime: serializeDate(row.firstBindTime),
    id: Number(row.id),
    userId: Number(row.userId),
  };
}

function toPublicBinding(
  binding: ActiveAttendanceDeviceBinding | null,
): null | SerializedAttendanceDeviceBinding {
  if (!binding) {
    return null;
  }

  return {
    deviceId: binding.deviceId,
    deviceLabel: binding.deviceLabel,
    deviceModel: binding.deviceModel,
    deviceSystem: binding.deviceSystem,
    firstBindTime: binding.firstBindTime,
    id: binding.id,
    userId: binding.userId,
  };
}

function buildDeviceLabel(device: AttendanceDevicePublicInfo) {
  return (
    device.deviceLabel ||
    [device.deviceModel, device.deviceSystem].filter(Boolean).join(' / ') ||
    device.deviceId
  );
}

function normalizeAbnormalTypes(
  abnormalTypes: Array<null | string | undefined>,
) {
  const normalized: AttendanceDeviceAbnormalType[] = [];
  for (const abnormalType of abnormalTypes) {
    const parts = String(abnormalType ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (!normalized.includes(part)) {
        normalized.push(part);
      }
    }
  }
  return normalized;
}

function serializeAbnormalTypes(
  abnormalTypes: Array<null | string | undefined>,
) {
  return normalizeAbnormalTypes(abnormalTypes).join(',');
}

export function normalizeAttendanceDevice(
  input: AttendanceDeviceInput,
): NormalizedAttendanceDevice {
  const deviceId = normalizeString(input?.deviceId, 128);
  if (!deviceId) {
    throw new Error('未获取到当前设备标识，请刷新页面后重试');
  }

  const platform = normalizeString(input.platform, 40);
  const userAgent = normalizeString(input.userAgent, 500);
  const deviceSystem =
    normalizeString(input.deviceSystem, 120) ||
    [platform, userAgent].filter(Boolean).join(' / ').slice(0, 120) ||
    null;

  return {
    deviceId,
    deviceLabel: normalizeString(input.deviceLabel, 191),
    deviceModel: normalizeString(input.deviceModel, 191),
    deviceSystem,
  };
}

async function getActiveBinding(userId: number) {
  await ensureAttendanceDeviceSchema();

  const rows = await prismaClient.$queryRaw<BindingRow[]>(Prisma.sql`
    SELECT
      id,
      user_id AS userId,
      device_id AS deviceId,
      device_model AS deviceModel,
      device_system AS deviceSystem,
      first_bind_time AS firstBindTime
    FROM attendance_device_binding
    WHERE user_id = ${userId}
    ORDER BY id DESC
    LIMIT 1
  `);

  return rows[0] ? serializeBinding(rows[0]) : null;
}

async function getDuplicateDeviceUsers(
  deviceId: string,
  currentUserId: number,
) {
  const rows = await prismaClient.$queryRaw<
    Array<{
      realName: null | string;
      userId: number;
      username: null | string;
    }>
  >(Prisma.sql`
    SELECT
      b.user_id AS userId,
      u.username,
      u.real_name AS realName
    FROM attendance_device_binding b
    LEFT JOIN user u ON u.id = b.user_id
    WHERE b.device_id = ${deviceId}
      AND b.user_id <> ${currentUserId}
    ORDER BY b.id DESC
    LIMIT 20
  `);

  return rows.map((row) => ({
    realName: row.realName,
    userId: Number(row.userId),
    username: row.username,
  }));
}

function buildDeviceDecisionMessage(params: {
  abnormalTypes: string[];
  binding: null | SerializedAttendanceDeviceBinding;
  duplicateUsers: AttendanceDeviceDuplicateUser[];
  status: AttendanceDeviceStatus;
}) {
  if (params.status === 'bind_required') {
    if (params.duplicateUsers.length > 0) {
      return '当前账号尚未绑定打卡设备，且当前设备已被其他账号绑定，是否绑定当前设备并继续打卡？';
    }
    return '当前账号尚未绑定打卡设备，是否绑定当前设备并继续打卡？';
  }

  if (params.status === 'abnormal') {
    const messages: string[] = [];
    if (params.abnormalTypes.includes('same_device_multi_account')) {
      messages.push(
        '同设备多账号：当前设备已被其他账号绑定或使用，存在代打卡风险',
      );
    }
    if (params.abnormalTypes.includes('device_changed')) {
      messages.push(
        '更换设备打卡：当前设备与账号已绑定设备不一致，如确需换机请发起考勤设备更换',
      );
    }
    const prefix =
      params.abnormalTypes.length > 1 ? '检测到多项设备异常：\n' : '';
    return `${prefix}${messages.join('\n')}\n是否继续打卡？`;
  }

  return '当前设备校验通过';
}

export async function getAttendanceDeviceStatus(params: {
  deviceInput: AttendanceDeviceInput;
  user: AttendanceUserSnapshot;
}): Promise<AttendanceDeviceDecision> {
  if (!hasDeviceIdentity(params.deviceInput)) {
    return buildLegacyAppDeviceDecision();
  }

  const device = normalizeAttendanceDevice(params.deviceInput);
  const [binding, duplicateUsers] = await Promise.all([
    getActiveBinding(params.user.id),
    getDuplicateDeviceUsers(device.deviceId, params.user.id),
  ]);

  const abnormalTypes: string[] = [];
  const isDeviceChanged = Boolean(
    binding && binding.deviceId !== device.deviceId,
  );
  if (isDeviceChanged) {
    abnormalTypes.push('device_changed');
  }
  if (duplicateUsers.length > 0) {
    abnormalTypes.push('same_device_multi_account');
  }

  let status: AttendanceDeviceStatus = 'bind_required';
  if (binding) {
    status = abnormalTypes.length > 0 ? 'abnormal' : 'normal';
  }
  const publicBinding = toPublicBinding(binding);

  return {
    abnormalTypes,
    binding: publicBinding,
    device: toPublicDevice(device),
    duplicateUsers,
    message: buildDeviceDecisionMessage({
      abnormalTypes,
      binding: publicBinding,
      duplicateUsers,
      status,
    }),
    status,
  };
}

async function createDeviceBinding(params: {
  device: AttendanceDevicePublicInfo;
  user: AttendanceUserSnapshot;
}) {
  await ensureAttendanceDeviceSchema();

  await prismaClient.$executeRaw(Prisma.sql`
    INSERT INTO attendance_device_binding (
      user_id,
      device_id,
      device_model,
      device_system,
      first_bind_time
    ) VALUES (
      ${params.user.id},
      ${params.device.deviceId},
      ${params.device.deviceModel},
      ${params.device.deviceSystem},
      NOW(3)
    )
  `);
}

async function bindAttendanceDevice(params: {
  binding:
    | ActiveAttendanceDeviceBinding
    | null
    | SerializedAttendanceDeviceBinding;
  device: AttendanceDevicePublicInfo;
  user: AttendanceUserSnapshot;
}) {
  await ensureAttendanceDeviceSchema();

  await (params.binding
    ? prismaClient.$executeRaw(Prisma.sql`
      UPDATE attendance_device_binding
      SET
        device_id = ${params.device.deviceId},
        device_model = ${params.device.deviceModel},
        device_system = ${params.device.deviceSystem},
        first_bind_time = NOW(3)
      WHERE user_id = ${params.user.id}
      `)
    : createDeviceBinding({
        device: params.device,
        user: params.user,
      }));

  return {
    binding: toPublicBinding(await getActiveBinding(params.user.id)),
  };
}

async function updateDeviceSeen(
  bindingId: number,
  device: AttendanceDevicePublicInfo,
) {
  await prismaClient.$executeRaw(Prisma.sql`
    UPDATE attendance_device_binding
    SET
      device_model = COALESCE(${device.deviceModel}, device_model),
      device_system = COALESCE(${device.deviceSystem}, device_system)
    WHERE id = ${bindingId}
  `);
}

export async function prepareAttendanceDeviceForPunch(params: {
  allowDeviceAbnormal?: boolean;
  bindCurrentDevice?: boolean;
  deviceInput: AttendanceDeviceInput;
  preparedDecision?: AttendanceDeviceDecision;
  user: AttendanceUserSnapshot;
}) {
  if (!hasDeviceIdentity(params.deviceInput)) {
    return buildLegacyAppDeviceDecision();
  }

  const decision =
    params.preparedDecision ??
    (await getAttendanceDeviceStatus({
      deviceInput: params.deviceInput,
      user: params.user,
    }));

  if (decision.status === 'bind_required') {
    if (!params.bindCurrentDevice) {
      throw new AttendanceDeviceError(
        decision.message,
        'DEVICE_BIND_REQUIRED',
        decision,
      );
    }
    const { binding } = await bindAttendanceDevice({
      binding: decision.binding,
      device: decision.device,
      user: params.user,
    });
    return {
      ...decision,
      binding,
    };
  }

  if (decision.status === 'abnormal') {
    if (!params.allowDeviceAbnormal) {
      throw new AttendanceDeviceError(
        decision.message,
        'DEVICE_ABNORMAL',
        decision,
      );
    }
    return decision;
  }

  if (decision.binding) {
    await updateDeviceSeen(decision.binding.id, decision.device);
  }
  return decision;
}

export async function replaceAttendanceDeviceBinding(params: {
  deviceInput: AttendanceDeviceInput;
  user: AttendanceUserSnapshot;
}) {
  const device = normalizeAttendanceDevice(params.deviceInput);
  const binding = await getActiveBinding(params.user.id);

  await bindAttendanceDevice({
    binding,
    device,
    user: params.user,
  });
  const decision = await getAttendanceDeviceStatus({
    deviceInput: device,
    user: params.user,
  });

  return decision;
}

export async function recordAttendanceDeviceAbnormal(params: {
  action: AttendanceDeviceAction;
  attendanceId?: null | number;
  decision: AttendanceDeviceDecision;
  punchTime: Date;
  user: AttendanceUserSnapshot;
}) {
  if (params.decision.abnormalTypes.length === 0) {
    return;
  }

  const binding = params.decision.binding;
  const device = params.decision.device;
  const duplicateUserIds = params.decision.duplicateUsers
    .map((item) => item.userId)
    .join(',');
  const duplicateUserNames = params.decision.duplicateUsers
    .map((item) => item.realName || item.username || item.userId)
    .join(',');
  const abnormalType = serializeAbnormalTypes(params.decision.abnormalTypes);

  await prismaClient.$executeRaw(Prisma.sql`
    INSERT INTO attendance_device_abnormal_log (
      user_id,
      attendance_id,
      action,
      abnormal_type,
      bound_device_id,
      current_device_id,
      duplicate_user_ids,
      duplicate_user_names,
      punch_time,
      create_time
    ) VALUES (
      ${params.user.id},
      ${params.attendanceId ?? null},
      ${params.action},
      ${abnormalType},
      ${binding?.deviceId ?? null},
      ${device.deviceId},
      ${duplicateUserIds || null},
      ${duplicateUserNames || null},
      ${params.punchTime},
      NOW(3)
    )
  `);
}

function getDeviceAbnormalLogGroupKey(row: DeviceAbnormalLogRow) {
  if (row.attendanceId) {
    return `attendance:${row.attendanceId}:${row.action}`;
  }

  const punchTime = serializeDate(row.punchTime)?.slice(0, 19) ?? '';
  return [
    'fallback',
    row.action,
    row.boundDeviceId ?? '',
    row.currentDeviceId,
    punchTime,
  ].join(':');
}

export async function listAttendanceDeviceAbnormalLogs(
  userId: number,
  options: {
    endTime?: Date;
    limit?: number;
    startTime?: Date;
  } = {},
) {
  const limit = options.limit ?? 20;
  const normalizedLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const timeFilter =
    options.startTime && options.endTime
      ? Prisma.sql`AND COALESCE(punch_time, create_time) BETWEEN ${options.startTime} AND ${options.endTime}`
      : Prisma.empty;
  const rows = await prismaClient.$queryRaw<DeviceAbnormalLogRow[]>(Prisma.sql`
    SELECT
      id,
      attendance_id AS attendanceId,
      action,
      abnormal_type AS abnormalType,
      bound_device_id AS boundDeviceId,
      current_device_id AS currentDeviceId,
      duplicate_user_names AS duplicateUserNames,
      punch_time AS punchTime,
      create_time AS createTime
    FROM attendance_device_abnormal_log
    WHERE user_id = ${userId}
      ${timeFilter}
    ORDER BY id DESC
    LIMIT ${normalizedLimit}
  `);

  const mergedLogs: SerializedDeviceAbnormalLog[] = [];
  const mergedLogMap = new Map<string, SerializedDeviceAbnormalLog>();

  for (const row of rows) {
    const groupKey = getDeviceAbnormalLogGroupKey(row);
    const abnormalTypes = normalizeAbnormalTypes([row.abnormalType]);
    const existingLog = mergedLogMap.get(groupKey);
    if (existingLog) {
      existingLog.abnormalTypes = normalizeAbnormalTypes([
        ...existingLog.abnormalTypes,
        ...abnormalTypes,
      ]);
      existingLog.abnormalType = serializeAbnormalTypes(
        existingLog.abnormalTypes,
      );
      existingLog.duplicateUserNames ||= row.duplicateUserNames;
      continue;
    }

    const log = {
      abnormalType: serializeAbnormalTypes(abnormalTypes),
      abnormalTypes,
      action: row.action,
      attendanceId: row.attendanceId,
      boundDeviceId: row.boundDeviceId,
      createTime: serializeDate(row.createTime),
      currentDeviceId: row.currentDeviceId,
      duplicateUserNames: row.duplicateUserNames,
      id: Number(row.id),
      punchTime: serializeDate(row.punchTime),
    };
    mergedLogMap.set(groupKey, log);
    mergedLogs.push(log);
  }

  return mergedLogs.slice(0, normalizedLimit);
}

export async function getAttendanceDeviceRecordInfoMap(
  attendanceIds: Array<null | number | undefined>,
) {
  const normalizedIds = [
    ...new Set(
      attendanceIds
        .map(Number)
        .filter(
          (attendanceId) => Number.isInteger(attendanceId) && attendanceId > 0,
        ),
    ),
  ];
  const infoMap = new Map<number, AttendanceDeviceRecordInfo>(
    normalizedIds.map((attendanceId) => [
      attendanceId,
      {
        abnormalTypes: [],
        status: 'normal',
      },
    ]),
  );

  if (normalizedIds.length === 0) {
    return infoMap;
  }

  const rows = await prismaClient.$queryRaw<
    Array<{
      abnormalType: AttendanceDeviceAbnormalType;
      attendanceId: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      attendance_id AS attendanceId,
      abnormal_type AS abnormalType
    FROM attendance_device_abnormal_log
    WHERE attendance_id IN (${Prisma.join(normalizedIds)})
    ORDER BY id ASC
  `);

  for (const row of rows) {
    const attendanceId = Number(row.attendanceId);
    const info = infoMap.get(attendanceId);
    if (!info) {
      continue;
    }
    info.status = 'abnormal';
    for (const abnormalType of normalizeAbnormalTypes([row.abnormalType])) {
      if (!info.abnormalTypes.includes(abnormalType)) {
        info.abnormalTypes.push(abnormalType);
      }
    }
  }

  return infoMap;
}
