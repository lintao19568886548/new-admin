import { requestClient } from '#/api/request';

export interface DashboardFactoryRentalStats {
  invalidTotalAreaCount: number;
  overusedCount: number;
  partialCount: number;
  rentalRate: string;
  rentedArea: string;
  rentedCount: number;
  totalArea: string;
  totalCount: number;
  vacantArea: string;
  vacantCount: number;
}

export async function getDashboardFactoryRentalStats(params?: {
  date?: string;
  endDate?: string;
  parkId?: 'all' | number;
  startDate?: string;
}) {
  return requestClient.get<DashboardFactoryRentalStats>(
    '/dashboard/factory-rental-stats',
    {
      params,
    },
  );
}
