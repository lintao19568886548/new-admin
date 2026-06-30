import { requestClient } from '#/api/request';

export interface RepairOrderListParams {
  assignee?: string;
  currentPage?: number;
  currentPark?: number;
  endTime?: string;
  factoryId?: number;
  orderNo?: string;
  pageSize?: number;
  parkId?: number;
  priority?: string;
  repairType?: string;
  startTime?: string;
  status?: string;
  tenantName?: string;
}

export interface RepairOrder {
  acceptTime?: null | string;
  assignee?: string;
  assigneePhone?: string;
  confirmTime?: null | string;
  createTime?: string;
  description: string;
  factory?: string;
  factoryId?: number;
  finishTime?: null | string;
  orderNo?: string;
  park?: string;
  parkId: number;
  priority: string;
  processRemark?: string;
  repairOrderId: number;
  repairType: string;
  source: string;
  status: string;
  tenantName?: string;
  tenantPhone?: string;
  updateTime?: string;
}

function filterParams(params?: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

export async function getRepairOrderList(params?: RepairOrderListParams) {
  return requestClient.get('/maintenance/repair-order/list', {
    params: filterParams(params),
  });
}

export async function getRepairOrderDetail(id: number) {
  return requestClient.get(`/maintenance/repair-order/${id}`);
}

export async function createRepairOrder(data: Record<string, any>) {
  return requestClient.post('/maintenance/repair-order', data);
}

export async function updateRepairOrder(id: number, data: Record<string, any>) {
  return requestClient.put(`/maintenance/repair-order/${id}`, data);
}

export async function deleteRepairOrder(id: number) {
  return requestClient.delete(`/maintenance/repair-order/${id}`);
}
