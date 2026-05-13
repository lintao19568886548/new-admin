import { requestClient } from '#/api/request';

const API = {
  ATTENDANCE: '/hrm/attendance',
};

const ATTENDANCE_DEVICE_API = `${API.ATTENDANCE}/device`;

export type AttendanceLeaveScope = 'full' | 'none' | 'partial';
export type AttendanceDeviceAbnormalType =
  | 'device_changed'
  | 'device_credential_mismatch'
  | 'same_device_multi_account'
  | string;
export type AttendanceDeviceRecordStatus = 'abnormal' | 'normal';

export interface AttendanceListItem {
  attendanceId: number;
  date: string;
  deviceAbnormalTypes: AttendanceDeviceAbnormalType[];
  deviceStatus: AttendanceDeviceRecordStatus;
  id: number;
  leaveMinutes: number;
  leaveScope: AttendanceLeaveScope;
  punchIn: string;
  punchOut: string;
  status: null | number;
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
export type AttendanceDeviceStatus =
  | 'abnormal'
  | 'bind_required'
  | 'credential_required'
  | 'normal';

export interface AttendanceDeviceInfo {
  deviceBindToken?: null | string;
  deviceId: string;
  deviceLabel?: null | string;
  deviceModel?: null | string;
  deviceSystem?: null | string;
  platform?: null | string;
  userAgent?: null | string;
}

export interface AttendanceDeviceBinding extends AttendanceDeviceInfo {
  deviceCredentialFingerprint?: null | string;
  firstBindTime?: null | string;
  hasDeviceCredential: boolean;
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
  currentDeviceCredentialFingerprint?: null | string;
  device: AttendanceDeviceInfo;
  deviceBindToken?: string;
  duplicateUsers: AttendanceDeviceDuplicateUser[];
  message: string;
  status: AttendanceDeviceStatus;
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

export function getAttendanceList(params: any) {
  return requestClient.get<AttendanceListResult>(`${API.ATTENDANCE}/list`, {
    params,
  });
}

export function punchIn(data: {
  allowDeviceAbnormal?: boolean;
  bindCurrentDevice?: boolean;
  device: AttendanceDeviceInfo;
  latitude: number;
  longitude: number;
  punchTime: string;
  username: string;
}) {
  return requestClient.post(`${API.ATTENDANCE}/`, data);
}

export function punchOut(
  id: number,
  data: {
    allowDeviceAbnormal?: boolean;
    bindCurrentDevice?: boolean;
    device: AttendanceDeviceInfo;
    latitude: number;
    longitude: number;
    punchTime: string;
    username: string;
  },
) {
  return requestClient.put(`${API.ATTENDANCE}/${id}`, data);
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

export function getAttendanceConfig() {
  return requestClient.get<AttendanceConfig>(`${API.ATTENDANCE}/config`);
}

export function getOfficeLocations() {
  return requestClient.get<
    { lat: number; lng: number; name: string; radius: number }[]
  >(`${API.ATTENDANCE}/locations`);
}

export function getAttendanceDeviceStatus(data: {
  device: AttendanceDeviceInfo;
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
