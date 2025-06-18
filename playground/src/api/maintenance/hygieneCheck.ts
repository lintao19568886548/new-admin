import { requestClient } from '#/api/request';

export interface HygieneCheck {
  checkDate: string;
  checker: string;
  checkItems: string;
  checkResult: string;
  createTime?: string;
  factory: string;
  hygieneCheckId: number;
  parkId?: number;
  remark?: string;
  updateTime?: string;
}

export async function getHygieneCheckList(params: any) {
  return requestClient.get('/maintenance/hygieneCheck/list', { params });
}

export async function getHygieneCheckDetail(id: number) {
  return requestClient.get(`/maintenance/hygieneCheck/${id}`);
}

export async function createHygieneCheck(data: any) {
  return requestClient.post('/maintenance/hygieneCheck', data);
}

export async function updateHygieneCheck(id: number, data: any) {
  return requestClient.put(`/maintenance/hygieneCheck/${id}`, data);
}

export async function deleteHygieneCheck(id: number) {
  return requestClient.delete(`/maintenance/hygieneCheck/${id}`);
}
