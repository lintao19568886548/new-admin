import { requestClient } from '#/api/request';

export interface FactoryMaint {
  createTime?: string;
  endTime?: string;
  factory: string;
  factoryMaintenanceId: number;
  maintenanceItem: string;
  maintenanceStatus: string;
  parkId?: number;
  personInCharge: string;
  remark?: string;
  startTime: string;
  updateTime?: string;
}

export async function getFactoryMaintList(params: any) {
  return requestClient.get('/maintenance/factoryMaint/list', { params });
}

export async function getFactoryMaintDetail(id: number) {
  return requestClient.get(`/maintenance/factoryMaint/${id}`);
}

export async function createFactoryMaint(data: any) {
  return requestClient.post('/maintenance/factoryMaint', data);
}

export async function updateFactoryMaint(id: number, data: any) {
  return requestClient.put(`/maintenance/factoryMaint/${id}`, data);
}

export async function deleteFactoryMaint(id: number) {
  return requestClient.delete(`/maintenance/factoryMaint/${id}`);
}
