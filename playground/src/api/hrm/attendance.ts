import { requestClient } from '#/api/request';
import { notifyWorkbenchTodoChangedAfter } from '#/utils/workbench-todo-sync';

const API = {
  ATTENDANCE: '/hrm/attendance',
};

const ATTENDANCE_DEVICE_API = `${API.ATTENDANCE}/device`;

export type AttendanceLeaveScope = 'full' | 'none' | 'partial';
export type AttendanceDeviceAbnormalType =
  | 'device_changed'
  | 'same_device_multi_account'
  | string;
export type AttendanceDeviceRecordStatus = 'abnormal' | 'normal';

export interface AttendanceListItem {
  abnormalCount?: number;
  attendanceId: number;
  attendanceIds?: number[];
  attendanceUserKey?: string;
  date: string;
  deviceAbnormalTypes: AttendanceDeviceAbnormalType[];
  deviceStatus: AttendanceDeviceRecordStatus;
  earlyLeaveCount?: number;
  id: number;
  isGroup?: boolean;
  lateCount?: number;
  leaveMinutes: number;
  leaveScope: AttendanceLeaveScope;
  punchIn: string;
  punchOut: string;
  records?: AttendanceListItem[];
  status: null | number;
  username?: string;
  workHours: number;
}

export interface AttendanceListResult {
  items: AttendanceListItem[];
  total: number;
}

export interface TodayAttendanceRecord {
  attendanceId: null | number;
  deviceAbnormalTypes: AttendanceDeviceAbnormalType[];
  deviceStatus: AttendanceDeviceRecordStatus;
  latitude?: number;
  leaveMinutes: number;
  leaveScope: AttendanceLeaveScope;
  longitude?: number;
  punchIn: string;
  punchOut: null | string;
  status: null | number;
}

export interface MonthAttendanceStats {
  attendanceDays: number;
  earlyLeaveDays: number;
  lateDays: number;
  leaveDays: number;
  overtimeHours: number;
}

export interface AttendanceConfig {
  employeeId?: number;
  scheduledCheckIn: string;
  scheduledCheckOut: string;
  source: 'default' | 'employee';
  userId?: number;
}

export type AttendanceDeviceAction = 'punch_in' | 'punch_out';
export type AttendanceDeviceStatus = 'abnormal' | 'bind_required' | 'normal';

export interface AttendanceDeviceInfo {
  deviceId: string;
  deviceLabel?: null | string;
  deviceModel?: null | string;
  deviceSystem?: null | string;
  platform?: null | string;
  userAgent?: null | string;
}

export interface AttendanceDeviceBinding extends AttendanceDeviceInfo {
  firstBindTime?: null | string;
  id: number;
  userId: number;
}

export interface AttendanceDeviceDuplicateUser {
  realName?: null | string;
  userId: number;
  username?: null | string;
}

export interface AttendanceDeviceDecision {
  abnormalTypes: string[];
  binding: AttendanceDeviceBinding | null;
  confirmationKeys?: string[];
  confirmedToday?: boolean;
  device: AttendanceDeviceInfo;
  duplicateUsers: AttendanceDeviceDuplicateUser[];
  message: string;
  status: AttendanceDeviceStatus;
  unconfirmedAbnormalTypes?: string[];
}

export interface AttendanceDeviceAbnormalLog {
  abnormalType: string;
  abnormalTypes: AttendanceDeviceAbnormalType[];
  action: AttendanceDeviceAction;
  attendanceId: null | number;
  boundDeviceId: null | string;
  createTime: null | string;
  currentDeviceId: string;
  duplicateUserNames: null | string;
  id: number;
  punchTime: null | string;
}

export interface AttendanceDeviceAbnormalListResult {
  items: AttendanceDeviceAbnormalLog[];
  total: number;
}

export interface AttendanceLocationConfirmationStatus {
  confirmationKeys: string[];
  confirmedToday: boolean;
  distanceMeters: null | number;
  inRange: boolean;
  nearestLocationName: null | string;
  unconfirmedAbnormalTypes: string[];
}

export function getAttendanceList(params: any) {
  return requestClient.get<AttendanceListResult>(`${API.ATTENDANCE}/list`, {
    params,
  });
}

export function punchIn(data: {
  bindCurrentDevice?: boolean;
  confirmDeviceAbnormal?: boolean;
  confirmOutsideRange?: boolean;
  device: AttendanceDeviceInfo;
  latitude: number;
  longitude: number;
  punchTime: string;
}) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post(`${API.ATTENDANCE}/`, data),
    { reason: 'attendance-punched', source: 'attendance-api' },
  );
}

export function punchOut(
  id: number,
  data: {
    bindCurrentDevice?: boolean;
    confirmDeviceAbnormal?: boolean;
    confirmOutsideRange?: boolean;
    device: AttendanceDeviceInfo;
    latitude: number;
    longitude: number;
    punchTime: string;
  },
) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.put(`${API.ATTENDANCE}/${id}`, data),
    { reason: 'attendance-punched', source: 'attendance-api' },
  );
}

export function getTodayRecord(params: { username: string }) {
  return requestClient.get<null | TodayAttendanceRecord>(
    `${API.ATTENDANCE}/today`,
    { params },
  );
}

export function getMonthStats(params: { username: string }) {
  return requestClient.get<MonthAttendanceStats>(`${API.ATTENDANCE}/stats`, {
    params,
  });
}

export function confirmAttendanceAbnormal(attendanceId: number) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post<{
      abnormalTypes?: string[];
      attendanceId: number;
      handled: boolean;
      message?: string;
    }>(`${API.ATTENDANCE}/${attendanceId}/abnormal-confirmation`),
    { reason: 'attendance-abnormal-confirmed', source: 'attendance-api' },
  );
}

export function getAttendanceConfig() {
  return requestClient.get<AttendanceConfig>(`${API.ATTENDANCE}/config`);
}

export function getOfficeLocations() {
  return requestClient.get<
    { lat: number; lng: number; name: string; radius: number }[]
  >(`${API.ATTENDANCE}/locations`);
}

export function getAttendanceLocationConfirmationStatus(data: {
  latitude: number;
  longitude: number;
  punchTime: string;
}) {
  return requestClient.post<AttendanceLocationConfirmationStatus>(
    `${API.ATTENDANCE}/location-confirmation`,
    data,
  );
}

export function getAttendanceDeviceStatus(data: {
  device: AttendanceDeviceInfo;
  punchTime?: string;
}) {
  return requestClient.post<AttendanceDeviceDecision>(ATTENDANCE_DEVICE_API, {
    ...data,
    action: 'status',
  });
}

export function changeAttendanceDevice(data: {
  device: AttendanceDeviceInfo;
  smsCode: string;
}) {
  return requestClient.post<AttendanceDeviceDecision>(ATTENDANCE_DEVICE_API, {
    ...data,
    action: 'change',
  });
}

export function sendAttendanceDeviceChangeCode() {
  return requestClient.post<{
    expiresIn: number;
    phoneNumber: string;
  }>(ATTENDANCE_DEVICE_API, {
    action: 'send_change_code',
  });
}

export function getAttendanceDeviceAbnormalList(params?: {
  date?: string;
  limit?: number;
}) {
  return requestClient.get<AttendanceDeviceAbnormalListResult>(
    ATTENDANCE_DEVICE_API,
    { params },
  );
}
