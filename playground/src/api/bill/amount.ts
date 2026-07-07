import { requestClient } from '#/api/request';
import { notifyWorkbenchTodoChangedAfter } from '#/utils/workbench-todo-sync';

export async function getAmountBillList(params: any) {
  return requestClient.get('/bill/amount/list', { params });
}

export async function getAmountBillProjectOptions(params?: any) {
  return requestClient.get('/bill/amount/project-options', { params });
}

export async function getAmountBillDetail(id: number) {
  return requestClient.get(`/bill/amount/${id}`);
}

export async function getExportData(data: any) {
  return requestClient.post(`/bill/amount/export`, data);
}

export async function createAmountBill(data: any) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.post('/bill/amount', data),
    { reason: 'bill-saved', source: 'bill-amount-api' },
  );
}

export async function updateAmountBill(id: number, data: any) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.put(`/bill/amount/${id}`, data),
    { reason: 'bill-saved', source: 'bill-amount-api' },
  );
}

export async function deleteAmountBill(id: number) {
  return notifyWorkbenchTodoChangedAfter(
    requestClient.delete(`/bill/amount/${id}`),
    { reason: 'bill-deleted', source: 'bill-amount-api' },
  );
}

export async function deleteAllAmountBill() {
  return notifyWorkbenchTodoChangedAfter(requestClient.delete('/bill/amount'), {
    reason: 'bill-deleted',
    source: 'bill-amount-api',
  });
}

export async function previewAmountBillCollectionSms(data: any) {
  return requestClient.post('/bill/amount/collection-sms/preview', data);
}

export async function sendAmountBillCollectionSms(data: any) {
  return requestClient.post('/bill/amount/collection-sms/send', data);
}
