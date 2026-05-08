import { requestClient } from '#/api/request';

export interface DashboardEnergyElectricityStats {
  electricity: {
    consumption: number[];
    monthOnMonth: number[];
    yearOnYear: number[];
  };
  hasData: boolean;
  message?: string;
  months: string[];
  year: number;
}

export interface DashboardEnergyWaterStats {
  hasData: boolean;
  message?: string;
  months: string[];
  water: {
    consumption: number[];
    monthOnMonth: number[];
    yearOnYear: number[];
  };
  year: number;
}

export async function getDashboardEnergyElectricityConsumption(params?: {
  parkId?: 'all' | number;
  year?: number;
}) {
  return requestClient.get<DashboardEnergyElectricityStats>(
    '/dashboard/energy-electricity-consumption',
    {
      params,
    },
  );
}

export async function getDashboardEnergyWaterConsumption(params?: {
  parkId?: 'all' | number;
  year?: number;
}) {
  return requestClient.get<DashboardEnergyWaterStats>(
    '/dashboard/energy-water-consumption',
    {
      params,
    },
  );
}
