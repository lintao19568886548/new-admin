import { requestClient } from '#/api/request';
import { notifyWorkbenchTodoChangedAfter } from '#/utils/workbench-todo-sync';

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

export type RepairOrderWorkflowAction =
  | 'accept'
  | 'cancel'
  | 'finish'
  | 'return'
  | 'verify';

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
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post('/maintenance/repair-order', data),
    { reason: 'repair-order-saved', source: 'repair-order-api' },
  );
}

export async function updateRepairOrder(id: number, data: Record<string, any>) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.put(`/maintenance/repair-order/${id}`, data),
    { reason: 'repair-order-saved', source: 'repair-order-api' },
  );
}

export async function updateRepairOrderWorkflow(
  id: number,
  data: { action: RepairOrderWorkflowAction; remark?: string },
) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post(`/maintenance/repair-order/${id}/workflow`, data),
    { reason: 'repair-order-workflow', source: 'repair-order-api' },
  );
}

export async function deleteRepairOrder(id: number) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.delete(`/maintenance/repair-order/${id}`),
    { reason: 'repair-order-deleted', source: 'repair-order-api' },
  );
}
