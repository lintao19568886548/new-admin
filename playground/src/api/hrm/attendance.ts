import { requestClient } from '#/api/request';

const API = {
  ATTENDANCE: '/hrm/attendance',
};

export type AttendanceLeaveScope = 'full' | 'none' | 'partial';

export interface AttendanceListItem {
  attendanceId: number;
  date: string;
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

export function getAttendanceList(params: any) {
  return requestClient.get<AttendanceListResult>(`${API.ATTENDANCE}/list`, {
    params,
  });
}

export function punchIn(data: {
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

export function getOfficeLocations() {
  return requestClient.get<
    { lat: number; lng: number; name: string; radius: number }[]
  >(`${API.ATTENDANCE}/locations`);
}
