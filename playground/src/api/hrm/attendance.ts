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
  return requestClient.get(`${API.ATTENDANCE}/today`, { params });
}

export function getMonthStats(params: { username: string }) {
  return requestClient.get(`${API.ATTENDANCE}/stats`, { params });
}
