import type { RadarSharedScope } from './shared-scope';

import { resolveRadarSharedScope } from './shared-scope';

function normalizeEnvValue(value: string | undefined) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function resolvePublicCrawlScope(): RadarSharedScope {
  const sharedScope = resolveRadarSharedScope();

  return {
    customerId:
      normalizeEnvValue(
        process.env.INVESTMENT_RADAR_PUBLIC_CRAWL_CUSTOMER_ID,
      ) || sharedScope.customerId,
    dbName:
      normalizeEnvValue(process.env.INVESTMENT_RADAR_PUBLIC_CRAWL_DB_NAME) ??
      sharedScope.dbName ??
      null,
  };
}
