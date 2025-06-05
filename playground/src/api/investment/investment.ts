import type { InvestmentAgent } from '#/views/investment/agent/data';

import { requestClient } from '#/api/request';

export async function getInvestmentList(params: any) {
  return requestClient.get('/investment/list', { params });
}

export async function getInvestmentDetail(billId: number) {
  return requestClient.get(`/investment/${billId}`);
}

export async function createInvestment(data: any) {
  return requestClient.post('/investment', data);
}

export async function updateInvestment(
  id: number | string,
  data: Partial<InvestmentAgent>,
) {
  return requestClient.put(`/investment/${id}`, data);
}

export async function deleteInvestment(billId: number) {
  return requestClient.delete(`/investment/${billId}`);
}
