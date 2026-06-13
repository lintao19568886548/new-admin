import { requestClient } from '#/api/request';

export interface DashboardChartItem {
  name: string;
  value: number;
}

export interface DashboardCustomerOverviewStats {
  intentLevels: DashboardChartItem[];
  negotiationProgress: DashboardChartItem[];
  summary: {
    currentMonthNewCustomers: number;
    negotiatingCustomers: number;
    receivedCustomers: number;
    totalCustomers: number;
  };
}

export async function getDashboardCustomerOverviewStats(params?: {
  date?: string;
  endDate?: string;
  parkId?: 'all' | number;
  startDate?: string;
}) {
  return requestClient.get<DashboardCustomerOverviewStats>(
    '/dashboard/customer-overview-stats',
    {
      params,
    },
  );
}
