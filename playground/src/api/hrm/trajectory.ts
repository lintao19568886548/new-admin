import { requestClient } from '#/api/request';

const API = {
  TRAJECTORY: '/hrm/trajectory',
};

export namespace TrajectoryApi {
  export type AttendanceDeviceAbnormalType =
    | 'device_changed'
    | 'device_credential_mismatch'
    | 'same_device_multi_account'
    | string;
  export type AttendanceDeviceRecordStatus = 'abnormal' | 'normal';

  export interface TrajectoryRecord {
    attendanceId: number;
    date: string;
    deviceAbnormalTypes: AttendanceDeviceAbnormalType[];
    deviceStatus: AttendanceDeviceRecordStatus;
    key: number;
    latitude: number | string;
    longitude: number | string;
    punchIn: string;
    punchOut: string;
    status: number;
    username: string;
    workHours: number;
  }

  export interface TrajectoryListParams {
    employeeName?: string;
    endDate?: string;
    page: number;
    pageSize: number;
    parkId?: number;
    startDate?: string;
  }

  export interface TrajectoryListResult {
    items: TrajectoryRecord[];
    total: number;
  }

  export interface TrajectoryExportParams {
    employeeName?: string;
    endDate?: string;
    parkId?: number;
    startDate?: string;
  }

  export type TrajectoryExportResult = Record<string, TrajectoryRecord[]>;
}

/**
 * 获取所有员工的考勤轨迹列表
 * @param params - 查询参数，包括分页和日期范围
 * @param params.employeeName - 员工姓名关键字
 * @param params.page - 页码
 * @param params.pageSize - 每页条数
 * @param params.parkId - 园区ID
 * @param params.startDate - 开始日期
 * @param params.endDate - 结束日期
 */
export function getTrajectoryList(params: {
  employeeName?: string;
  endDate?: string;
  page: number;
  pageSize: number;
  parkId?: number;
  startDate?: string;
}) {
  return requestClient.get<TrajectoryApi.TrajectoryListResult>(
    `${API.TRAJECTORY}/list`,
    { params },
  );
}

/**
 * 导出所有员工的考勤轨迹
 * @param params - 查询参数，包括日期范围
 * @param params.employeeName - 员工姓名关键字
 * @param params.parkId - 园区ID
 * @param params.startDate - 开始日期
 * @param params.endDate - 结束日期
 */
export function exportTrajectoryData(params: {
  employeeName?: string;
  endDate?: string;
  parkId?: number;
  startDate?: string;
}) {
  return requestClient.get<TrajectoryApi.TrajectoryExportResult>(
    `${API.TRAJECTORY}/export`,
    { params },
  );
}
