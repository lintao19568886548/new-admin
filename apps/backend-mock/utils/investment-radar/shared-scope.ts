import { prismaScopeStorage } from '~/utils/db';

export type RadarSharedScope = {
  customerId: string;
  dbName?: null | string;
};

function normalizeEnvValue(value: string | undefined) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function resolveRadarSharedScope(): RadarSharedScope {
  const configuredCustomerId = normalizeEnvValue(
    process.env.INVESTMENT_RADAR_CUSTOMER_ID,
  );
  const defaultCustomerId = normalizeEnvValue(process.env.DEFAULT_CUSTOMER_ID);

  return {
    customerId: configuredCustomerId || defaultCustomerId || 'default',
    dbName: normalizeEnvValue(process.env.INVESTMENT_RADAR_DB_NAME),
  };
}

export function runWithRadarSharedScope<T>(runner: () => Promise<T>) {
  return prismaScopeStorage.run(resolveRadarSharedScope(), runner);
}
