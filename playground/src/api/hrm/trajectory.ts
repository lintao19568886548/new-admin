import { requestClient } from '#/api/request';

const API = {
  TRAJECTORY: '/hrm/trajectory',
};

/**
 * 获取所有员工的考勤轨迹列表
 * @param params - 查询参数，包括分页和日期范围
 * @param params.page - 页码
 * @param params.pageSize - 每页条数
 * @param params.startDate - 开始日期
 * @param params.endDate - 结束日期
 */
export function getTrajectoryList(params: {
  endDate?: string;
  page: number;
  pageSize: number;
  startDate?: string;
}) {
  return requestClient.get<any>(`${API.TRAJECTORY}/list`, { params });
}

/**
 * 导出所有员工的考勤轨迹
 * @param params - 查询参数，包括日期范围
 * @param params.startDate - 开始日期
 * @param params.endDate - 结束日期
 */
export function exportTrajectoryData(params: {
  endDate?: string;
  startDate?: string;
}) {
  return requestClient.get<any>(`${API.TRAJECTORY}/export`, { params });
}
