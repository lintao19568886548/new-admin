import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';

import type { OnboardingStatus } from '#/api/onboarding';

import { getOnboardingStatusApi } from '#/api/onboarding';

export const ONBOARDING_ENTRY_PATH = '/onboarding/park-setup';

const ONBOARDING_CACHE_TTL = 10_000;
const ONBOARDING_ALLOWED_PATHS = new Set([
  '/profile',
  '/profile/vip-membership',
  '/system/park',
  '/system/park/mobile',
  '/system/role',
  '/system/user',
  ONBOARDING_ENTRY_PATH,
]);

let cachedStatus: null | {
  expiresAt: number;
  key: string;
  value: OnboardingStatus;
} = null;

function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

function getUserCacheKey(userInfo: null | object) {
  const record = (userInfo || {}) as Record<string, unknown>;
  const customerId = String(
    record.customerId || record.customerType || 'unknown',
  );
  const userId = String(record.centerUserId || record.id || 'anonymous');
  return `${customerId}:${userId}`;
}

export function isOnboardingAllowedPath(path: string) {
  return ONBOARDING_ALLOWED_PATHS.has(normalizePath(path));
}

export function invalidateOnboardingStatusCache() {
  cachedStatus = null;
}

export async function fetchOnboardingStatus(
  userInfo: null | object,
  options: { force?: boolean } = {},
) {
  const key = getUserCacheKey(userInfo);
  const now = Date.now();
  if (
    !options.force &&
    cachedStatus &&
    cachedStatus.key === key &&
    cachedStatus.expiresAt > now
  ) {
    return cachedStatus.value;
  }

  const value = await getOnboardingStatusApi();
  cachedStatus = {
    expiresAt: now + ONBOARDING_CACHE_TTL,
    key,
    value,
  };
  return value;
}

export function buildOnboardingRedirect(
  status: OnboardingStatus,
  to: RouteLocationNormalized,
): null | RouteLocationRaw {
  if (!status.forceRequired || !status.nextStep) {
    return null;
  }

  if (isOnboardingAllowedPath(to.path)) {
    return null;
  }

  return {
    path: ONBOARDING_ENTRY_PATH,
    query: {
      redirect: encodeURIComponent(to.fullPath),
    },
    replace: true,
  };
}

export function resolveOnboardingStepPath(status: OnboardingStatus) {
  return status.nextStep?.path || '/home';
}
