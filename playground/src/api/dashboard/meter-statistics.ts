import { requestClient } from '#/api/request';

export type DashboardMeterStatisticsDateType = 'day' | 'month';
export type DashboardMeterStatisticsType = 'electricity' | 'water';

export interface DashboardMeterStatisticsChartItem {
  name: string;
  value: number;
}

export interface DashboardMeterStatisticsStats {
  dateType: DashboardMeterStatisticsDateType;
  dayNight: DashboardMeterStatisticsChartItem[];
  hasData: boolean;
  message?: string;
  peakValley: DashboardMeterStatisticsChartItem[];
  selectedDate: string;
  statisticsType: DashboardMeterStatisticsType;
  summary: {
    deviceCount: number;
    recordCount: number;
    total: number;
  };
  waterTrend: {
    times: string[];
    values: number[];
  };
}

export async function getDashboardMeterStatistics(params?: {
  date?: string;
  dateType?: DashboardMeterStatisticsDateType;
  endDate?: string;
  parkId?: 'all' | number;
  startDate?: string;
  type?: DashboardMeterStatisticsType;
}) {
  return requestClient.get<DashboardMeterStatisticsStats>(
    '/dashboard/meter-statistics',
    {
      params,
    },
  );
}
