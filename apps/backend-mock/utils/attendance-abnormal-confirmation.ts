import type { AttendanceDeviceDecision } from '~/utils/attendance-device';
import type { AttendanceLocationValidation } from '~/utils/attendance-location';

import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/.prisma/client/index.js';
import dayjs from 'dayjs';
import { validateAttendanceLocation } from '~/utils/attendance-location';
import { prismaClient } from '~/utils/db';

type AttendanceAbnormalCategory = 'attendance_record' | 'device' | 'location';

interface AttendanceAbnormalConfirmationItem {
  abnormalCategory: AttendanceAbnormalCategory;
  abnormalType: string;
  boundDeviceId?: null | string;
  currentDeviceId?: null | string;
  distanceMeters?: null | number;
  fingerprint: string;
  latitude?: null | number;
  longitude?: null | number;
  nearestLocationName?: null | string;
}

export interface AttendanceAbnormalConfirmationStatus {
  confirmedToday: boolean;
  confirmationKeys: string[];
  unconfirmedAbnormalTypes: string[];
}

const schemaReadyDatabases = new Set<string>();
const LOCATION_GRID_DEGREES = 0.003;
const CONFIRMATION_KEY_SEPARATOR = '\u001F';

async function ensureAttendanceAbnormalConfirmationSchema() {
  const databaseRows = await prismaClient.$queryRaw<
    Array<{ databaseName: null | string }>
  >(Prisma.sql`
    SELECT DATABASE() AS databaseName
  `);
  const databaseName = databaseRows[0]?.databaseName || 'default';
  if (schemaReadyDatabases.has(databaseName)) {
    return;
  }

  await prismaClient.$executeRaw(Prisma.sql`
    CREATE TABLE IF NOT EXISTS attendance_abnormal_confirmation (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      confirmation_date DATE NOT NULL,
      abnormal_category VARCHAR(30) NOT NULL,
      abnormal_type VARCHAR(80) NOT NULL,
      fingerprint VARCHAR(128) NOT NULL,
      action_scope VARCHAR(30) NOT NULL DEFAULT 'day',
      confirmed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      expire_at DATETIME(3) NOT NULL,
      attendance_id INT NULL,
      current_device_id VARCHAR(128) NULL,
      bound_device_id VARCHAR(128) NULL,
      latitude DECIMAL(18,15) NULL,
      longitude DECIMAL(18,15) NULL,
      nearest_location_name VARCHAR(191) NULL,
      distance_meters DECIMAL(12,3) NULL,
      create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_attendance_abnormal_confirmation (
        user_id,
        confirmation_date,
        abnormal_category,
        abnormal_type,
        fingerprint
      ),
      KEY idx_attendance_abnormal_confirmation_user_date (
        user_id,
        confirmation_date
      ),
      KEY idx_attendance_abnormal_confirmation_expire (expire_at),
      KEY idx_attendance_abnormal_confirmation_attendance (attendance_id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  schemaReadyDatabases.add(databaseName);
}

function normalizePunchDay(value?: Date | string) {
  const base = value ? dayjs(value) : dayjs();
  const normalized = base.isValid() ? base : dayjs();
  return {
    confirmationDate: normalized.format('YYYY-MM-DD'),
    expireAt: normalized.endOf('day').toDate(),
  };
}

function normalizeFingerprint(
  parts: Array<null | number | string | undefined>,
) {
  const raw = parts.map((part) => String(part ?? '')).join('|');
  return createHash('sha256').update(raw).digest('hex');
}

function getLocationGridValue(value: number) {
  return Math.round(value / LOCATION_GRID_DEGREES);
}

function normalizeDeviceAbnormalTypes(abnormalTypes: string[]) {
  return [
    ...new Set(
      abnormalTypes
        .map((abnormalType) => String(abnormalType || '').trim())
        .filter(Boolean),
    ),
  ];
}

function buildDeviceAbnormalConfirmationItems(params: {
  abnormalTypes?: string[];
  decision: AttendanceDeviceDecision;
}): AttendanceAbnormalConfirmationItem[] {
  const allowedTypes =
    params.abnormalTypes === undefined
      ? null
      : new Set(normalizeDeviceAbnormalTypes(params.abnormalTypes));

  return normalizeDeviceAbnormalTypes(params.decision.abnormalTypes)
    .filter((abnormalType) => !allowedTypes || allowedTypes.has(abnormalType))
    .map((abnormalType) => {
      const boundDeviceId = params.decision.binding?.deviceId ?? null;
      const currentDeviceId = params.decision.device.deviceId;
      return {
        abnormalCategory: 'device',
        abnormalType,
        boundDeviceId,
        currentDeviceId,
        fingerprint: normalizeFingerprint([
          'device',
          abnormalType,
          boundDeviceId,
          currentDeviceId,
        ]),
      };
    });
}

function buildAttendanceRecordAbnormalConfirmationItems(params: {
  abnormalTypes: string[];
  attendanceId: number;
  username?: null | string;
}): AttendanceAbnormalConfirmationItem[] {
  return normalizeDeviceAbnormalTypes(params.abnormalTypes).map(
    (abnormalType) => ({
      abnormalCategory: 'attendance_record',
      abnormalType,
      fingerprint: normalizeFingerprint([
        'attendance_record',
        params.attendanceId,
        abnormalType,
        params.username,
      ]),
    }),
  );
}

function buildLocationAbnormalConfirmationItem(params: {
  latitude: unknown;
  locationValidation?: AttendanceLocationValidation;
  longitude: unknown;
}): AttendanceAbnormalConfirmationItem | null {
  const locationValidation =
    params.locationValidation ??
    validateAttendanceLocation({
      latitude: params.latitude,
      longitude: params.longitude,
    });

  if (!locationValidation.isValid || locationValidation.inRange) {
    return null;
  }

  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);
  const nearestLocationName = locationValidation.nearestLocation?.name ?? null;
  const gridLat = getLocationGridValue(latitude);
  const gridLng = getLocationGridValue(longitude);

  return {
    abnormalCategory: 'location',
    abnormalType: 'outside_range',
    distanceMeters: locationValidation.distanceMeters,
    fingerprint: normalizeFingerprint([
      'location',
      'outside_range',
      nearestLocationName,
      gridLat,
      gridLng,
    ]),
    latitude,
    longitude,
    nearestLocationName,
  };
}

function getConfirmationLookupKey(item: {
  abnormalCategory: AttendanceAbnormalCategory;
  abnormalType: string;
  fingerprint: string;
}) {
  return [item.abnormalCategory, item.abnormalType, item.fingerprint].join(
    CONFIRMATION_KEY_SEPARATOR,
  );
}

async function getAttendanceAbnormalConfirmationStatus(params: {
  items: AttendanceAbnormalConfirmationItem[];
  punchTime?: Date | string;
  userId: number;
}): Promise<AttendanceAbnormalConfirmationStatus> {
  if (params.items.length === 0) {
    return {
      confirmationKeys: [],
      confirmedToday: false,
      unconfirmedAbnormalTypes: [],
    };
  }

  await ensureAttendanceAbnormalConfirmationSchema();

  const { confirmationDate } = normalizePunchDay(params.punchTime);
  const confirmationKeys = params.items.map((item) => item.fingerprint);
  const rows = await prismaClient.$queryRaw<
    Array<{
      abnormalCategory: AttendanceAbnormalCategory;
      abnormalType: string;
      fingerprint: string;
    }>
  >(Prisma.sql`
    SELECT
      abnormal_category AS abnormalCategory,
      abnormal_type AS abnormalType,
      fingerprint
    FROM attendance_abnormal_confirmation
    WHERE user_id = ${params.userId}
      AND confirmation_date = ${confirmationDate}
      AND fingerprint IN (${Prisma.join(confirmationKeys)})
  `);
  const confirmedKeySet = new Set(
    rows.map((row) => getConfirmationLookupKey(row)),
  );

  const unconfirmedAbnormalTypes = params.items
    .filter((item) => !confirmedKeySet.has(getConfirmationLookupKey(item)))
    .map((item) => item.abnormalType);

  return {
    confirmationKeys,
    confirmedToday:
      params.items.length > 0 && unconfirmedAbnormalTypes.length === 0,
    unconfirmedAbnormalTypes,
  };
}

async function createAttendanceAbnormalConfirmation(params: {
  attendanceId?: null | number;
  item: AttendanceAbnormalConfirmationItem;
  punchTime: Date | string;
  userId: number;
}) {
  await ensureAttendanceAbnormalConfirmationSchema();

  const { confirmationDate, expireAt } = normalizePunchDay(params.punchTime);
  await prismaClient.$executeRaw(Prisma.sql`
    INSERT INTO attendance_abnormal_confirmation (
      user_id,
      confirmation_date,
      abnormal_category,
      abnormal_type,
      fingerprint,
      action_scope,
      confirmed_at,
      expire_at,
      attendance_id,
      current_device_id,
      bound_device_id,
      latitude,
      longitude,
      nearest_location_name,
      distance_meters,
      create_time,
      update_time
    ) VALUES (
      ${params.userId},
      ${confirmationDate},
      ${params.item.abnormalCategory},
      ${params.item.abnormalType},
      ${params.item.fingerprint},
      'day',
      NOW(3),
      ${expireAt},
      ${params.attendanceId ?? null},
      ${params.item.currentDeviceId ?? null},
      ${params.item.boundDeviceId ?? null},
      ${params.item.latitude ?? null},
      ${params.item.longitude ?? null},
      ${params.item.nearestLocationName ?? null},
      ${params.item.distanceMeters ?? null},
      NOW(3),
      NOW(3)
    )
    ON DUPLICATE KEY UPDATE
      confirmed_at = VALUES(confirmed_at),
      expire_at = VALUES(expire_at),
      attendance_id = COALESCE(VALUES(attendance_id), attendance_id),
      current_device_id = VALUES(current_device_id),
      bound_device_id = VALUES(bound_device_id),
      latitude = VALUES(latitude),
      longitude = VALUES(longitude),
      nearest_location_name = VALUES(nearest_location_name),
      distance_meters = VALUES(distance_meters),
      update_time = NOW(3)
  `);
}

export async function getDeviceAbnormalConfirmationStatus(params: {
  decision: AttendanceDeviceDecision;
  punchTime?: Date | string;
  userId: number;
}) {
  return getAttendanceAbnormalConfirmationStatus({
    items: buildDeviceAbnormalConfirmationItems({
      decision: params.decision,
    }),
    punchTime: params.punchTime,
    userId: params.userId,
  });
}

export async function createDeviceAbnormalConfirmations(params: {
  abnormalTypes?: string[];
  attendanceId?: null | number;
  decision: AttendanceDeviceDecision;
  punchTime: Date | string;
  userId: number;
}) {
  const items = buildDeviceAbnormalConfirmationItems({
    abnormalTypes: params.abnormalTypes,
    decision: params.decision,
  });
  for (const item of items) {
    await createAttendanceAbnormalConfirmation({
      attendanceId: params.attendanceId,
      item,
      punchTime: params.punchTime,
      userId: params.userId,
    });
  }
}

export async function createAttendanceRecordAbnormalConfirmations(params: {
  abnormalTypes: string[];
  attendanceId: number;
  punchTime: Date | string;
  userId: number;
  username?: null | string;
}) {
  const items = buildAttendanceRecordAbnormalConfirmationItems({
    abnormalTypes: params.abnormalTypes,
    attendanceId: params.attendanceId,
    username: params.username,
  });
  for (const item of items) {
    await createAttendanceAbnormalConfirmation({
      attendanceId: params.attendanceId,
      item,
      punchTime: params.punchTime,
      userId: params.userId,
    });
  }
}

export async function getConfirmedAttendanceRecordAbnormalIdSet(
  attendanceIds: number[],
) {
  const ids = [
    ...new Set(
      attendanceIds
        .map(Number)
        .filter((attendanceId) => Number.isInteger(attendanceId)),
    ),
  ];
  if (ids.length === 0) {
    return new Set<number>();
  }

  await ensureAttendanceAbnormalConfirmationSchema();
  const rows = await prismaClient.$queryRaw<Array<{ attendanceId: number }>>(
    Prisma.sql`
      SELECT DISTINCT attendance_id AS attendanceId
      FROM attendance_abnormal_confirmation
      WHERE abnormal_category = 'attendance_record'
        AND attendance_id IN (${Prisma.join(ids)})
        AND expire_at >= NOW(3)
    `,
  );

  return new Set(rows.map(({ attendanceId }) => Number(attendanceId)));
}

export function hasUnconfirmedDeviceAbnormalConfirmation(
  status: AttendanceAbnormalConfirmationStatus | null | undefined,
) {
  return Boolean(status && status.unconfirmedAbnormalTypes.length > 0);
}

export async function getLocationAbnormalConfirmationStatus(params: {
  latitude: unknown;
  locationValidation?: AttendanceLocationValidation;
  longitude: unknown;
  punchTime?: Date | string;
  userId: number;
}) {
  const item = buildLocationAbnormalConfirmationItem(params);
  if (!item) {
    return {
      confirmationKeys: [],
      confirmedToday: false,
      item: null,
      unconfirmedAbnormalTypes: [],
    };
  }

  return {
    ...(await getAttendanceAbnormalConfirmationStatus({
      items: [item],
      punchTime: params.punchTime,
      userId: params.userId,
    })),
    item,
  };
}

export async function createLocationAbnormalConfirmation(params: {
  attendanceId?: null | number;
  latitude: unknown;
  locationValidation?: AttendanceLocationValidation;
  longitude: unknown;
  punchTime: Date | string;
  userId: number;
}) {
  const item = buildLocationAbnormalConfirmationItem(params);
  if (!item) {
    return;
  }

  await createAttendanceAbnormalConfirmation({
    attendanceId: params.attendanceId,
    item,
    punchTime: params.punchTime,
    userId: params.userId,
  });
}
