import { requestClient } from '#/api/request';

export async function getAmountBillList(params: any) {
  return requestClient.get('/bill/amount/list', { params });
}

export async function getAmountBillDetail(id: number) {
  return requestClient.get(`/bill/amount/${id}`);
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
