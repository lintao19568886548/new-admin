import { requestClient } from '#/api/request';

export interface DashboardRevenueTrend {
  expense: number[];
  income: number[];
  months: string[];
  profit: number[];
}

export interface DashboardRevenueStats {
  periodLabel: string;
  summary: {
    expenseTotal: number;
    incomeTotal: number;
    profit: number;
  };
  trend: DashboardRevenueTrend;
}

export async function getDashboardRevenueStats(params?: {
  month?: string;
  parkId?: 'all' | number;
}) {
  return requestClient.get<DashboardRevenueStats>('/dashboard/revenue-stats', {
    params,
  });
}
