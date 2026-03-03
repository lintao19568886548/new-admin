import type { RedisClientType } from 'redis';

import { createClient } from 'redis';

let clientPromise: null | Promise<RedisClientType> = null;

export function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

export async function getRedisClient(): Promise<null | RedisClientType> {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const client: RedisClientType = createClient({ url });
      client.on('error', (error) => {
        console.error('Redis client error:', error);
      });
      await client.connect();
      return client;
    })();
  }

  return await clientPromise;
}
