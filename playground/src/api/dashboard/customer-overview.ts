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
  parkId?: 'all' | number;
}) {
  return requestClient.get<DashboardCustomerOverviewStats>(
    '/dashboard/customer-overview-stats',
    {
      params,
    },
  );
}
