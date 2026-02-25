import { requestClient } from '#/api/request';

export interface ReimbursementAnalysisQuery {
  endDate?: string;
  parkId?: number;
  startDate?: string;
  status?: number;
}

export interface ReimbursementParkStat {
  count: number;
  park: string;
  parkId: number;
  ratio?: number;
  totalAmount: number;
}

export interface ReimbursementTrendStat {
  count: number;
  date: string;
  totalAmount: number;
}

export interface ReimbursementAnalysisResponse {
  parkStats: ReimbursementParkStat[];
  summary: {
    averageAmount: number;
    count: number;
    parkCount: number;
    totalAmount: number;
  };
  topParks: ReimbursementParkStat[];
  trend: ReimbursementTrendStat[];
}

// 创建报销申请
export async function createReimbursement(data: any) {
  return requestClient.post('/reimbursement', data);
}

// 获取报销列表
export async function getReimbursementList(params?: any) {
  try {
    // console.log('API请求开始: getReimbursementList', params);
    const response = await requestClient.get('/reimbursement/list', { params });
    // console.log('API请求成功: getReimbursementList', response);
    return response;
  } catch (error) {
    console.error('API请求失败: getReimbursementList', error);
    throw error; // 重新抛出错误，让调用者处理
  }
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

export async function getPendingReimbursementCount() {
  return requestClient.get<{ count: number }>('/reimbursement/pending-count');
}

export async function getReimbursementAnalysis(
  params?: ReimbursementAnalysisQuery,
) {
  return requestClient.get<ReimbursementAnalysisResponse>(
    '/reimbursement/analysis',
    {
      params,
    },
  );
}
