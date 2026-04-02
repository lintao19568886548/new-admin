import { requestClient } from '#/api/request';

export interface Park {
  parkId: number;
  parkName: string;
}

export const DEFAULT_LEAVE_TYPE = '事假';

export const LEAVE_TYPE_OPTIONS = [
  { label: '事假', value: '事假' },
  { label: '年假', value: '年假' },
  { label: '病假', value: '病假' },
] as const;

export type LeaveType = (typeof LEAVE_TYPE_OPTIONS)[number]['value'];

export function getLeaveTypeText(leaveType?: string) {
  return leaveType || DEFAULT_LEAVE_TYPE;
}

export interface LeaveApplication {
  auditUser?: string;
  createdAt?: string;
  endDate: string;
  id: number;
  leaveType?: string;
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
  leaveType?: string;
  pageSize?: number;
  parkId?: number | string;
  user?: string;
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
export async function createLeaveApplication(data: any) {
  return requestClient.post('/hrm/leaveapplication', data);
}

/**
 * 更新请假申请
 * @param id
 * @param data
 */
export async function updateLeaveApplication(id: number, data: any) {
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
