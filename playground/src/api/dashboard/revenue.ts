import { requestClient } from '#/api/request';

export interface DashboardRevenueTrend {
  expense: number[];
  income: number[];
  months: string[];
  overpaid?: number[];
  profit: number[];
  receivable?: number[];
  received?: number[];
  remaining?: number[];
}

export interface DashboardRevenueStats {
  periodLabel: string;
  summary: {
    billCount?: number;
    expenseTotal: number;
    incomeTotal: number;
    overpaidTotal?: number;
    profit: number;
    receivableTotal?: number;
    receivedTotal?: number;
    remainingTotal?: number;
  };
  trend: DashboardRevenueTrend;
}

export async function getDashboardRevenueStats(params?: {
  date?: string;
  endDate?: string;
  month?: string;
  parkId?: 'all' | number;
  startDate?: string;
}) {
  return requestClient.get<DashboardRevenueStats>('/dashboard/revenue-stats', {
    params,
  });
}
