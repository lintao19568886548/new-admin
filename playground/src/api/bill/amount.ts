import { requestClient } from '#/api/request';

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
  return requestClient.post('/bill/amount', data);
}

export async function updateAmountBill(id: number, data: any) {
  return requestClient.put(`/bill/amount/${id}`, data);
}

export async function deleteAmountBill(id: number) {
  return requestClient.delete(`/bill/amount/${id}`);
}

export async function deleteAllAmountBill() {
  return requestClient.delete('/bill/amount');
}

export async function previewAmountBillCollectionSms(data: any) {
  return requestClient.post('/bill/amount/collection-sms/preview', data);
}

export async function sendAmountBillCollectionSms(data: any) {
  return requestClient.post('/bill/amount/collection-sms/send', data);
}
