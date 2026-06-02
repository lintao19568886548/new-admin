function parseJsonObject(value: unknown): null | Record<string, unknown> {
  if (!value) {
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function isEffectiveBatchPayload(
  payload: null | Record<string, unknown>,
) {
  const qualityResult = parseJsonObject(payload?.qualityResult);
  const status = String(
    qualityResult?.status || payload?.opportunityStatus || '',
  );
  return status === 'EFFECTIVE';
}

interface PublicOpportunityBatchTotalsItem {
  collectedEffectiveCount: number;
  discoveredUrlCount: number;
  effectiveCount: number;
  fetchedCount: number;
  fetchSuccessCount: number;
  skippedCount: number;
  status: 'FAILED' | 'SUCCESS';
  taskId?: null | number;
  upsertedCount: number;
  yieldedEffective: boolean;
  zeroOutput: boolean;
}

export function buildPublicOpportunityBatchTotals(
  items: PublicOpportunityBatchTotalsItem[],
) {
  const total = {
    collectedEffectiveCount: 0,
    discoveredUrlCount: 0,
    effectiveCount: 0,
    failedPlatformCount: 0,
    fetchedCount: 0,
    fetchSuccessCount: 0,
    hasEffectiveOutput: false,
    hasUsefulOutput: false,
    onlyZeroOutput: false,
    platformCount: items.length,
    productivePlatformCount: 0,
    skippedCount: 0,
    successPlatformCount: 0,
    taskCount: 0,
    upsertedCount: 0,
    zeroOutputPlatformCount: 0,
  };
  for (const item of items) {
    total.collectedEffectiveCount += item.collectedEffectiveCount;
    total.discoveredUrlCount += item.discoveredUrlCount;
    total.effectiveCount += item.effectiveCount;
    total.fetchedCount += item.fetchedCount;
    total.fetchSuccessCount += item.fetchSuccessCount;
    total.skippedCount += item.skippedCount;
    total.upsertedCount += item.upsertedCount;
    if (item.taskId) {
      total.taskCount += 1;
    }
    if (item.status === 'SUCCESS') {
      total.successPlatformCount += 1;
    } else {
      total.failedPlatformCount += 1;
    }
    if (item.yieldedEffective) {
      total.productivePlatformCount += 1;
    }
    if (item.zeroOutput) {
      total.zeroOutputPlatformCount += 1;
    }
  }
  total.hasEffectiveOutput = total.effectiveCount > 0;
  total.hasUsefulOutput =
    total.discoveredUrlCount > 0 ||
    total.fetchedCount > 0 ||
    total.fetchSuccessCount > 0 ||
    total.upsertedCount > 0 ||
    total.effectiveCount > 0;
  total.onlyZeroOutput =
    total.platformCount > 0 &&
    total.zeroOutputPlatformCount === total.platformCount;
  return total;
}
