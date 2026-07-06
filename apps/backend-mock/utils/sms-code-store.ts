import { getRedisClient } from './redis';

const CODE_TTL_SECONDS = Number(process.env.LOGIN_SMS_CODE_TTL ?? 300);
const RESEND_INTERVAL_SECONDS = Number(
  process.env.LOGIN_SMS_RESEND_INTERVAL ?? 60,
);
const MAX_VERIFY_ATTEMPTS = Number(
  process.env.LOGIN_SMS_MAX_VERIFY_ATTEMPTS ?? 5,
);
const SEND_LOCK_SECONDS = Number(process.env.LOGIN_SMS_SEND_LOCK_SECONDS ?? 30);

export type SmsCodePurpose = 'attendanceDevice' | 'login' | 'pageAccess';

interface SmsCodeEntry {
  attempts: number;
  code: string;
  expiresAt: number;
  sentAt: number;
}

interface RedisSmsCodeEntry {
  attempts?: number;
  code?: string;
  sentAt?: number;
}

export class SmsCodeError extends Error {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'SmsCodeError';
    this.retryAfter = retryAfter;
  }
}

const smsStore = new Map<string, SmsCodeEntry>();
const sendingStore = new Map<string, number>();

const VERIFY_SMS_CODE_SCRIPT = `
local codeKey = KEYS[1]
local submittedCode = ARGV[1]
local maxAttempts = tonumber(ARGV[2])

local raw = redis.call('GET', codeKey)
if not raw then
  return { 'missing' }
end

local entry = cjson.decode(raw)
if not entry or not entry.code then
  redis.call('DEL', codeKey)
  return { 'missing' }
end

if tostring(entry.code) ~= submittedCode then
  local attempts = tonumber(entry.attempts or 0) + 1
  if attempts >= maxAttempts then
    redis.call('DEL', codeKey)
  else
    local ttl = redis.call('TTL', codeKey)
    entry.attempts = attempts
    if ttl > 0 then
      redis.call('SET', codeKey, cjson.encode(entry), 'EX', ttl)
    else
      redis.call('DEL', codeKey)
      return { 'missing' }
    end
  end
  return { 'invalid' }
end

redis.call('DEL', codeKey)
return { 'ok' }
`;

function getPositiveSeconds(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function isSmsCodeRedisRequired() {
  const value = String(
    process.env.SMS_CODE_REDIS_REQUIRED || process.env.REDIS_REQUIRED || '',
  )
    .trim()
    .toLowerCase();
  if (value) {
    return ['1', 'true', 'yes'].includes(value);
  }
  return process.env.NODE_ENV === 'production';
}

async function getSmsCodeRedisClient() {
  try {
    const redis = await getRedisClient();
    if (!redis && isSmsCodeRedisRequired()) {
      throw new SmsCodeError('验证码服务暂不可用，请稍后重试');
    }
    return redis;
  } catch (error) {
    if (error instanceof SmsCodeError) {
      throw error;
    }
    console.error('验证码 Redis 服务不可用:', error);
    throw new SmsCodeError('验证码服务暂不可用，请稍后重试');
  }
}

function buildStoreKey(purpose: SmsCodePurpose, phoneNumber: string) {
  return `${purpose}:${phoneNumber}`;
}

function buildRedisCodeKey(purpose: SmsCodePurpose, phoneNumber: string) {
  return `sms:code:${purpose}:${phoneNumber}`;
}

function buildRedisSendLockKey(purpose: SmsCodePurpose, phoneNumber: string) {
  return `sms:send-lock:${purpose}:${phoneNumber}`;
}

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of smsStore) {
    if (entry.expiresAt <= now) {
      smsStore.delete(key);
    }
  }
  for (const [key, expiresAt] of sendingStore) {
    if (expiresAt <= now) {
      sendingStore.delete(key);
    }
  }
}

function readRedisEntry(raw: null | string): null | RedisSmsCodeEntry {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as RedisSmsCodeEntry;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function ensureCanSendCodeInRedis(
  purpose: SmsCodePurpose,
  phoneNumber: string,
) {
  const redis = await getSmsCodeRedisClient();
  if (!redis) {
    return false;
  }

  const codeKey = buildRedisCodeKey(purpose, phoneNumber);
  const raw = await redis.get(codeKey);
  const entry = readRedisEntry(raw);
  if (!entry?.sentAt) {
    return true;
  }

  const elapsed = (Date.now() - Number(entry.sentAt)) / 1000;
  if (elapsed < RESEND_INTERVAL_SECONDS) {
    throw new SmsCodeError(
      '验证码发送过于频繁，请稍后再试',
      Math.ceil(RESEND_INTERVAL_SECONDS - elapsed),
    );
  }

  return true;
}

function ensureCanSendCodeInMemory(
  purpose: SmsCodePurpose,
  phoneNumber: string,
) {
  cleanupExpiredEntries();

  const key = buildStoreKey(purpose, phoneNumber);
  const sendingExpiresAt = sendingStore.get(key);
  if (sendingExpiresAt && sendingExpiresAt > Date.now()) {
    throw new SmsCodeError(
      '验证码正在发送中，请稍后再试',
      Math.ceil((sendingExpiresAt - Date.now()) / 1000),
    );
  }

  const entry = smsStore.get(key);
  if (!entry) {
    return;
  }

  const now = Date.now();
  const elapsed = (now - entry.sentAt) / 1000;
  if (elapsed < RESEND_INTERVAL_SECONDS) {
    throw new SmsCodeError(
      '验证码发送过于频繁，请稍后再试',
      Math.ceil(RESEND_INTERVAL_SECONDS - elapsed),
    );
  }
}

export async function ensureCanSendCode(
  purpose: SmsCodePurpose,
  phoneNumber: string,
) {
  const handledByRedis = await ensureCanSendCodeInRedis(purpose, phoneNumber);
  if (!handledByRedis) {
    ensureCanSendCodeInMemory(purpose, phoneNumber);
  }
}

export async function reserveSmsCodeSend(
  purpose: SmsCodePurpose,
  phoneNumber: string,
) {
  await ensureCanSendCode(purpose, phoneNumber);

  const lockSeconds = getPositiveSeconds(SEND_LOCK_SECONDS, 30);
  const redis = await getSmsCodeRedisClient();
  if (!redis) {
    const key = buildStoreKey(purpose, phoneNumber);
    sendingStore.set(key, Date.now() + lockSeconds * 1000);
    return;
  }

  const lockKey = buildRedisSendLockKey(purpose, phoneNumber);
  const locked = await redis.set(lockKey, '1', {
    EX: lockSeconds,
    NX: true,
  });
  if (locked !== 'OK') {
    const ttl = await redis.ttl(lockKey);
    throw new SmsCodeError(
      '验证码正在发送中，请稍后再试',
      ttl > 0 ? ttl : lockSeconds,
    );
  }
}

export async function releaseSmsCodeSend(
  purpose: SmsCodePurpose,
  phoneNumber: string,
) {
  try {
    const redis = await getSmsCodeRedisClient();
    if (redis) {
      await redis.del(buildRedisSendLockKey(purpose, phoneNumber));
      return;
    }
  } catch (error) {
    console.error('释放验证码发送锁失败:', error);
  }

  sendingStore.delete(buildStoreKey(purpose, phoneNumber));
}

export async function saveSmsCode(
  purpose: SmsCodePurpose,
  phoneNumber: string,
  code: string,
) {
  const now = Date.now();
  const ttlSeconds = getPositiveSeconds(CODE_TTL_SECONDS, 300);
  const redis = await getSmsCodeRedisClient();
  if (redis) {
    await redis
      .multi()
      .del(buildRedisSendLockKey(purpose, phoneNumber))
      .setEx(
        buildRedisCodeKey(purpose, phoneNumber),
        ttlSeconds,
        JSON.stringify({
          attempts: 0,
          code,
          sentAt: now,
        } satisfies RedisSmsCodeEntry),
      )
      .exec();
    return;
  }

  const key = buildStoreKey(purpose, phoneNumber);
  sendingStore.delete(key);
  smsStore.set(key, {
    attempts: 0,
    code,
    expiresAt: now + ttlSeconds * 1000,
    sentAt: now,
  });
}

export async function verifySmsCode(
  purpose: SmsCodePurpose,
  phoneNumber: string,
  code: string,
) {
  const redis = await getSmsCodeRedisClient();
  if (redis) {
    const result = (await redis.eval(VERIFY_SMS_CODE_SCRIPT, {
      arguments: [code, String(getPositiveSeconds(MAX_VERIFY_ATTEMPTS, 5))],
      keys: [buildRedisCodeKey(purpose, phoneNumber)],
    })) as string | string[];
    const status = Array.isArray(result) ? result[0] : result;
    if (status === 'ok') {
      return;
    }
    if (status === 'invalid') {
      throw new SmsCodeError('验证码不正确');
    }
    throw new SmsCodeError('验证码不存在或已失效');
  }

  cleanupExpiredEntries();

  const key = buildStoreKey(purpose, phoneNumber);
  const entry = smsStore.get(key);
  if (!entry) {
    throw new SmsCodeError('验证码不存在或已失效');
  }

  const now = Date.now();
  if (entry.expiresAt <= now) {
    smsStore.delete(key);
    throw new SmsCodeError('验证码已过期');
  }

  if (entry.code !== code) {
    entry.attempts += 1;
    if (entry.attempts >= getPositiveSeconds(MAX_VERIFY_ATTEMPTS, 5)) {
      smsStore.delete(key);
    } else {
      smsStore.set(key, entry);
    }
    throw new SmsCodeError('验证码不正确');
  }

  smsStore.delete(key);
}

export function generateNumericCode(length: number = 6) {
  const digits = '0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += digits[Math.floor(Math.random() * digits.length)];
  }
  return result;
}
