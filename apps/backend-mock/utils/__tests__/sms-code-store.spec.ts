import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRedisClient } from '../redis';
import {
  releaseSmsCodeSend,
  reserveSmsCodeSend,
  saveSmsCode,
  SmsCodeError,
  verifySmsCode,
} from '../sms-code-store';

vi.mock('../redis', () => ({
  getRedisClient: vi.fn(),
}));

type RedisRecord = {
  expiresAt?: number;
  value: string;
};

class RedisStub {
  del = vi.fn(async (...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        count += 1;
      }
    }
    return count;
  });

  private store = new Map<string, RedisRecord>();

  get = vi.fn(async (key: string) => {
    const record = this.store.get(key);
    if (!record) {
      return null;
    }
    if (record.expiresAt && record.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return record.value;
  });

  eval = vi.fn(
    async (
      _script: string,
      options: { arguments: string[]; keys: string[] },
    ) => {
      const [codeKey] = options.keys;
      const [submittedCode, maxAttemptsValue] = options.arguments;
      const raw = await this.get(codeKey);
      if (!raw) {
        return ['missing'];
      }

      const entry = JSON.parse(raw) as {
        attempts?: number;
        code?: string;
      };
      if (!entry.code) {
        await this.del(codeKey);
        return ['missing'];
      }

      if (String(entry.code) !== submittedCode) {
        const attempts = Number(entry.attempts || 0) + 1;
        const maxAttempts = Number(maxAttemptsValue);
        if (attempts >= maxAttempts) {
          await this.del(codeKey);
        } else {
          entry.attempts = attempts;
          const ttl = await this.ttl(codeKey);
          if (ttl > 0) {
            this.store.set(codeKey, {
              expiresAt: Date.now() + ttl * 1000,
              value: JSON.stringify(entry),
            });
          } else {
            await this.del(codeKey);
            return ['missing'];
          }
        }
        return ['invalid'];
      }

      await this.del(codeKey);
      return ['ok'];
    },
  );

  set = vi.fn(
    async (
      key: string,
      value: string,
      options?: {
        EX?: number;
        NX?: boolean;
      },
    ) => {
      const existing = await this.get(key);
      if (options?.NX && existing !== null) {
        return null;
      }
      this.store.set(key, {
        expiresAt: options?.EX ? Date.now() + options.EX * 1000 : undefined,
        value,
      });
      return 'OK';
    },
  );

  setEx = vi.fn(async (key: string, seconds: number, value: string) => {
    this.store.set(key, {
      expiresAt: Date.now() + seconds * 1000,
      value,
    });
    return 'OK';
  });

  ttl = vi.fn(async (key: string) => {
    const record = this.store.get(key);
    if (!record) {
      return -2;
    }
    if (!record.expiresAt) {
      return -1;
    }
    const ttl = Math.ceil((record.expiresAt - Date.now()) / 1000);
    if (ttl <= 0) {
      this.store.delete(key);
      return -2;
    }
    return ttl;
  });

  multi() {
    const commands: Array<() => Promise<unknown>> = [];
    return {
      del: (key: string) => {
        commands.push(() => this.del(key));
        return this.multiChain(commands);
      },
    };
  }

  private multiChain(commands: Array<() => Promise<unknown>>) {
    return {
      del: (key: string) => {
        commands.push(() => this.del(key));
        return this.multiChain(commands);
      },
      exec: async () => {
        const results = [];
        for (const command of commands) {
          results.push(await command());
        }
        return results;
      },
      setEx: (key: string, seconds: number, value: string) => {
        commands.push(() => this.setEx(key, seconds, value));
        return this.multiChain(commands);
      },
    };
  }
}

describe('sms code store', () => {
  let redis: RedisStub;

  beforeEach(() => {
    redis = new RedisStub();
    vi.mocked(getRedisClient).mockResolvedValue(redis as any);
  });

  it('keeps codes isolated by purpose for the same phone number', async () => {
    const phoneNumber = '15817511077';
    await saveSmsCode('login', phoneNumber, '123456');
    await saveSmsCode('pageAccess', phoneNumber, '654321');

    await verifySmsCode('login', phoneNumber, '123456');
    await verifySmsCode('pageAccess', phoneNumber, '654321');
  });

  it('consumes a code after successful verification', async () => {
    const phoneNumber = '15817511077';
    await saveSmsCode('login', phoneNumber, '123456');

    await verifySmsCode('login', phoneNumber, '123456');

    await expect(
      verifySmsCode('login', phoneNumber, '123456'),
    ).rejects.toMatchObject({
      message: '验证码不存在或已失效',
    });
  });

  it('uses redis send lock to reject concurrent sends', async () => {
    const phoneNumber = '15817511077';

    await reserveSmsCodeSend('login', phoneNumber);

    await expect(
      reserveSmsCodeSend('login', phoneNumber),
    ).rejects.toBeInstanceOf(SmsCodeError);
    await releaseSmsCodeSend('login', phoneNumber);
    await expect(
      reserveSmsCodeSend('login', phoneNumber),
    ).resolves.toBeUndefined();
  });
});
