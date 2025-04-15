import { requestClient } from '#/api/request';

// 获取报销列表
export async function getReimbursementList(params?: any) {
  return requestClient.get('/reimbursement/list', { params });
}

// 提交报销申请
export async function submitReimbursement(data: any) {
  return requestClient.post('/reimbursement', data);
}

// 获取报销详情
export async function getReimbursementDetail(id: number) {
  return requestClient.get(`/reimbursement/${id}`);
}

// 更新报销信息
export async function updateReimbursement(id: number, data: any) {
  return requestClient.put(`/reimbursement/${id}`, data);
}

// 删除报销信息
export async function deleteReimbursement(id: number) {
  return requestClient.delete(`/reimbursement/${id}`);
}
