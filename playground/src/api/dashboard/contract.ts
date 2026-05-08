import { requestClient } from '#/api/request';

export interface DashboardContractTrend {
  dates: string[];
  expiring: number[];
  newThisMonth: number[];
  normal: number[];
  retreated: number[];
}

export interface DashboardContractStats {
  summary: {
    expiring: number;
    newThisMonth: number;
    normal: number;
    retreated: number;
  };
  trend: DashboardContractTrend;
}

export async function getDashboardContractStats(params?: {
  parkId?: 'all' | number;
}) {
  return requestClient.get<DashboardContractStats>(
    '/dashboard/contract-stats',
    {
      params,
    },
  );
}
