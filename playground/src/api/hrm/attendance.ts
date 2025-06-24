import { requestClient } from '#/api/request';

const API = {
  ATTENDANCE: '/hrm/attendance',
};

export function getAttendanceList(params: any) {
  return requestClient.get(`${API.ATTENDANCE}/list`, { params });
}

export function punchIn(data: {
  latitude: number;
  longitude: number;
  punchTime: string;
}) {
  return requestClient.post(`${API.ATTENDANCE}/`, data);
}

export function punchOut(
  id: number,
  data: {
    latitude: number;
    longitude: number;
    punchTime: string;
  },
) {
  return requestClient.put(`${API.ATTENDANCE}/${id}`, data);
}

export function getTodayRecord() {
  return requestClient.get(`${API.ATTENDANCE}/today`);
}

export function getMonthStats() {
  return requestClient.get(`${API.ATTENDANCE}/stats`);
}
