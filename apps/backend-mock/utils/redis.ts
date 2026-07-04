import type { RedisClientType } from 'redis';

import { createClient } from 'redis';

const DEFAULT_RETRY_COOLDOWN_MS = 30_000;

let clientPromise: null | Promise<null | RedisClientType> = null;
let nextRetryAt = 0;

export function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

function isRedisRequired() {
  const value = String(process.env.REDIS_REQUIRED || '')
    .trim()
    .toLowerCase();
  if (value) {
    return ['1', 'true', 'yes'].includes(value);
  }
  return process.env.NODE_ENV === 'production';
}

function getRetryCooldownMs() {
  const value = Number(process.env.REDIS_RETRY_COOLDOWN_MS);
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_RETRY_COOLDOWN_MS;
}

function maskRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return url.replaceAll(/:\/\/([^:/?#]+):([^@/?#]+)@/g, '://$1:***@');
  }
}

export async function getRedisClient(): Promise<null | RedisClientType> {
  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) {
    return null;
  }

  const required = isRedisRequired();
  if (!required && nextRetryAt > Date.now()) {
    return null;
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      let connected = false;
      const client: RedisClientType = createClient({
        socket: required ? undefined : { reconnectStrategy: false },
        url,
      });
      client.on('error', (error) => {
        if (!required && !connected) {
          return;
        }
        console.error('Redis client error:', error);
      });
      try {
        await client.connect();
      } catch (error) {
        clientPromise = null;
        if (!required) {
          nextRetryAt = Date.now() + getRetryCooldownMs();
          console.warn(
            `[backend-mock][redis] Redis unavailable at ${maskRedisUrl(url)}; using in-memory permission cache fallback`,
          );
          return null;
        }
        throw error;
      }
      connected = true;
      nextRetryAt = 0;
      return client;
    })();
  }

  return await clientPromise;
}
