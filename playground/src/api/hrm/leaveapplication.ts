import { requestClient } from '#/api/request';

export interface Park {
  parkId: number;
  parkName: string;
}

export interface LeaveApplication {
  auditUser?: string;
  createdAt?: string;
  endDate: string;
  id: number;
  park: string;
  parkId?: number;
  reason: string;
  reply?: string;
  startDate: string;
  status: number;
  updatedAt?: string;
  user: string;
  username: any;
}

export interface LeaveApplicationQuery {
  currentPage?: number;
  pageSize?: number;
}

export interface LeaveApplicationPageResult {
  items: LeaveApplication[];
  parks?: Park[];
  total: number;
}

/**
 * 获取园区列表
 */
export async function getParkList() {
  return requestClient.get<Park[]>('/hrm/leaveapplication/parks');
}

/**
 * 获取所有请假申请
 * @param params
 */
export async function getLeaveApplicationList(params?: LeaveApplicationQuery) {
  return requestClient.get<LeaveApplicationPageResult>(
    '/hrm/leaveapplication/list',
    {
      params,
    },
  );
}

/**
 * 创建新的请假申请
 * @param data
 */
export async function createLeaveApplication(
  data: Omit<LeaveApplication, 'createdAt' | 'id' | 'status' | 'updatedAt'>,
) {
  return requestClient.post<LeaveApplication>('/hrm/leaveapplication', data);
}

/**
 * 更新请假申请
 * @param id
 * @param data
 */
export async function updateLeaveApplication(
  id: number,
  data: Partial<Omit<LeaveApplication, 'createdAt' | 'id' | 'updatedAt'>>,
) {
  return requestClient.put<LeaveApplication>(
    `/hrm/leaveapplication/${id}`,
    data,
  );
}

/**
 * 删除请假申请
 * @param id
 */
export async function deleteLeaveApplication(id: number) {
  return requestClient.delete(`/hrm/leaveapplication/${id}`);
}
