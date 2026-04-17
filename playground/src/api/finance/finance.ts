import { requestClient } from '#/api/request';

export async function getFinanceList(params?: any) {
  return requestClient.get('/finance/list', { params });
}

export async function getFinanceDetail(id: number) {
  return requestClient.get(`/finance/${id}`);
}

export async function createFinance(data: any) {
  return requestClient.post('/finance', data);
}

export async function updateFinance(id: number, data: any) {
  return requestClient.put(`/finance/${id}`, data);
}

export async function deleteFinance(id: number) {
  return requestClient.delete(`/finance/${id}`);
}

export async function deleteAllFinance() {
  return requestClient.delete('/finance');
}
