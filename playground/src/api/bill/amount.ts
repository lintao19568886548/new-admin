import { requestClient } from '#/api/request';

export async function getAmountBillList(params: any) {
  return requestClient.get('/bill/amount/list', { params });
}

export async function getAmountBillDetail(billId: number) {
  return requestClient.get(`/bill/amount/${billId}`);
}

export async function createAmountBill(data: any) {
  return requestClient.post('/bill/amount', data);
}

export async function updateAmountBill(data: any) {
  return requestClient.put('/bill/amount', data);
}

export async function deleteAmountBill(billId: number) {
  return requestClient.delete(`/bill/amount/${billId}`);
}
