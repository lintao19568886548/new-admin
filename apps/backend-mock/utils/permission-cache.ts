import type { UserInfoForToken } from './user-service';

import { getRedisClient } from './redis';

const memoryStore = new Map<string, { expiresAt: number; value: string }>();

function nowMs() {
  return Date.now();
}

function getTtlSeconds() {
  const value = Number(process.env.PERMISSION_CACHE_TTL_SECONDS || 86_400);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 86_400;
}

function versionKey(customerId: string) {
  return `permission:version:${customerId}`;
}

function cacheKey(params: {
  customerId: string;
  userId: number;
  version: number;
}) {
  return `permission:user:${params.customerId}:${params.userId}:v${params.version}`;
}

export async function getPermissionCacheVersion(
  customerId: string,
): Promise<number> {
  const redis = await getRedisClient();
  if (!redis) {
    const raw = memoryStore.get(versionKey(customerId));
    if (!raw) return 1;
    if (raw.expiresAt <= nowMs()) {
      memoryStore.delete(versionKey(customerId));
      return 1;
    }
    const parsed = Number(raw.value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  const raw = await redis.get(versionKey(customerId));
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function bumpPermissionCacheVersion(
  customerId: string,
): Promise<number> {
  const redis = await getRedisClient();
  if (!redis) {
    const next = (await getPermissionCacheVersion(customerId)) + 1;
    const expiresAt = nowMs() + getTtlSeconds() * 1000;
    memoryStore.set(versionKey(customerId), { expiresAt, value: String(next) });
    return next;
  }

  const value = await redis.incr(versionKey(customerId));
  return Number(value);
}

export async function setCachedUserInfo(params: {
  customerId: string;
  userId: number;
  value: UserInfoForToken;
}) {
  const version = await getPermissionCacheVersion(params.customerId);
  const key = cacheKey({ ...params, version });
  const ttlSeconds = getTtlSeconds();
  const payload = JSON.stringify(params.value);

  const redis = await getRedisClient();
  if (!redis) {
    memoryStore.set(key, {
      expiresAt: nowMs() + ttlSeconds * 1000,
      value: payload,
    });
    return;
  }

  await redis.setEx(key, ttlSeconds, payload);
}

export async function setCachedUserInfoBestEffort(params: {
  customerId: string;
  userId: number;
  value: UserInfoForToken;
}) {
  await setCachedUserInfo(params).catch(() => undefined);
}

export async function getCachedUserInfo(params: {
  customerId: string;
  userId: number;
}): Promise<null | UserInfoForToken> {
  const version = await getPermissionCacheVersion(params.customerId);
  const key = cacheKey({ ...params, version });

  const redis = await getRedisClient();
  if (!redis) {
    const record = memoryStore.get(key);
    if (!record) return null;
    if (record.expiresAt <= nowMs()) {
      memoryStore.delete(key);
      return null;
    }
    return JSON.parse(record.value) as UserInfoForToken;
  }

  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as UserInfoForToken;
}
