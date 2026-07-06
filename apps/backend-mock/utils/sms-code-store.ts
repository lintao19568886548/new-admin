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

export interface SmsCodeLogContext {
  requestId?: string;
}

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
const LOG_MODULE = 'sms-code';

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

function shouldMaskCode() {
  return process.env.NODE_ENV === 'production';
}

function maskSmsCode(code: unknown) {
  if (code === null || code === undefined || code === '') {
    return '';
  }
  const text = String(code);
  return shouldMaskCode() ? '*'.repeat(Math.max(text.length, 4)) : text;
}

export function maskSmsCodeForLog(code: unknown) {
  return maskSmsCode(code);
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return {
    message: String(error),
    name: typeof error,
    stack: undefined,
  };
}

export function logSmsCodeDebug(
  eventName: string,
  payload: Record<string, unknown> = {},
  level: 'error' | 'info' | 'warn' = 'info',
) {
  const logPayload = {
    module: LOG_MODULE,
    time: new Date().toISOString(),
    event: eventName,
    ...payload,
  };
  const message = `[${LOG_MODULE}] ${JSON.stringify(logPayload)}`;
  if (level === 'error') {
    console.error(message);
    return;
  }
  if (level === 'warn') {
    console.warn(message);
    return;
  }
  console.info(message);
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
      const error = new SmsCodeError('验证码服务暂不可用，请稍后重试');
      logSmsCodeDebug(
        'redis_operation_error',
        {
          error: serializeError(error),
          operation: 'get_redis_client',
        },
        'error',
      );
      throw error;
    }
    return redis;
  } catch (error) {
    if (error instanceof SmsCodeError) {
      throw error;
    }
    logSmsCodeDebug(
      'redis_operation_error',
      {
        error: serializeError(error),
        operation: 'get_redis_client',
      },
      'error',
    );
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
  context: SmsCodeLogContext = {},
) {
  const redis = await getSmsCodeRedisClient();
  if (!redis) {
    return false;
  }

  const codeKey = buildRedisCodeKey(purpose, phoneNumber);
  let raw: null | string;
  try {
    raw = await redis.get(codeKey);
  } catch (error) {
    logSmsCodeDebug(
      'redis_operation_error',
      {
        error: serializeError(error),
        operation: 'get_existing_code_for_send_check',
        phoneNumber,
        purpose,
        redisKey: codeKey,
        requestId: context.requestId,
      },
      'error',
    );
    throw error;
  }
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
  context: SmsCodeLogContext = {},
) {
  const handledByRedis = await ensureCanSendCodeInRedis(
    purpose,
    phoneNumber,
    context,
  );
  if (!handledByRedis) {
    ensureCanSendCodeInMemory(purpose, phoneNumber);
  }
}

export async function reserveSmsCodeSend(
  purpose: SmsCodePurpose,
  phoneNumber: string,
  context: SmsCodeLogContext = {},
) {
  await ensureCanSendCode(purpose, phoneNumber, context);

  const lockSeconds = getPositiveSeconds(SEND_LOCK_SECONDS, 30);
  const redis = await getSmsCodeRedisClient();
  if (!redis) {
    const key = buildStoreKey(purpose, phoneNumber);
    sendingStore.set(key, Date.now() + lockSeconds * 1000);
    return;
  }

  const lockKey = buildRedisSendLockKey(purpose, phoneNumber);
  let locked: null | string = null;
  try {
    locked = await redis.set(lockKey, '1', {
      EX: lockSeconds,
      NX: true,
    });
  } catch (error) {
    logSmsCodeDebug(
      'redis_operation_error',
      {
        error: serializeError(error),
        operation: 'reserve_send_lock',
        phoneNumber,
        purpose,
        redisKey: lockKey,
        requestId: context.requestId,
      },
      'error',
    );
    throw error;
  }

  if (locked !== 'OK') {
    let ttl: number;
    try {
      ttl = await redis.ttl(lockKey);
    } catch (error) {
      logSmsCodeDebug(
        'redis_operation_error',
        {
          error: serializeError(error),
          operation: 'get_send_lock_ttl',
          phoneNumber,
          purpose,
          redisKey: lockKey,
          requestId: context.requestId,
        },
        'error',
      );
      throw error;
    }

    logSmsCodeDebug('send_lock_exists', {
      phoneNumber,
      purpose,
      redisKey: lockKey,
      requestId: context.requestId,
      ttl,
    });

    throw new SmsCodeError(
      '验证码正在发送中，请稍后再试',
      ttl > 0 ? ttl : lockSeconds,
    );
  }
}

export async function releaseSmsCodeSend(
  purpose: SmsCodePurpose,
  phoneNumber: string,
  context: SmsCodeLogContext = {},
) {
  try {
    const redis = await getSmsCodeRedisClient();
    if (redis) {
      const lockKey = buildRedisSendLockKey(purpose, phoneNumber);
      logSmsCodeDebug('delete_before', {
        deleteReason: '释放验证码发送锁',
        phoneNumber,
        purpose,
        redisKey: lockKey,
        requestId: context.requestId,
      });
      await redis.del(lockKey);
      return;
    }
  } catch (error) {
    logSmsCodeDebug(
      'redis_operation_error',
      {
        error: serializeError(error),
        operation: 'release_send_lock',
        phoneNumber,
        purpose,
        redisKey: buildRedisSendLockKey(purpose, phoneNumber),
        requestId: context.requestId,
      },
      'error',
    );
  }

  sendingStore.delete(buildStoreKey(purpose, phoneNumber));
}

export async function saveSmsCode(
  purpose: SmsCodePurpose,
  phoneNumber: string,
  code: string,
  context: SmsCodeLogContext = {},
) {
  const now = Date.now();
  const ttlSeconds = getPositiveSeconds(CODE_TTL_SECONDS, 300);
  const redis = await getSmsCodeRedisClient();
  if (redis) {
    const codeKey = buildRedisCodeKey(purpose, phoneNumber);
    const lockKey = buildRedisSendLockKey(purpose, phoneNumber);
    try {
      try {
        const existingRaw = await redis.get(codeKey);
        const existingEntry = readRedisEntry(existingRaw);
        if (existingEntry?.code) {
          logSmsCodeDebug('delete_before', {
            deleteReason: '重新发送验证码覆盖旧验证码',
            phoneNumber,
            purpose,
            redisKey: codeKey,
            redisCode: maskSmsCode(existingEntry.code),
            requestId: context.requestId,
          });
        }
      } catch (error) {
        logSmsCodeDebug(
          'redis_operation_error',
          {
            error: serializeError(error),
            operation: 'get_existing_code_before_save',
            phoneNumber,
            purpose,
            redisKey: codeKey,
            requestId: context.requestId,
          },
          'error',
        );
      }

      logSmsCodeDebug('redis_write_before', {
        code: maskSmsCode(code),
        phoneNumber,
        purpose,
        redisKey: codeKey,
        requestId: context.requestId,
        ttl: ttlSeconds,
      });
      logSmsCodeDebug('delete_before', {
        deleteReason: '验证码发送完成释放发送锁',
        phoneNumber,
        purpose,
        redisKey: lockKey,
        requestId: context.requestId,
      });

      await redis
        .multi()
        .del(lockKey)
        .setEx(
          codeKey,
          ttlSeconds,
          JSON.stringify({
            attempts: 0,
            code,
            sentAt: now,
          } satisfies RedisSmsCodeEntry),
        )
        .exec();

      let currentTtl: null | number = null;
      let ttlReadSuccess = true;
      try {
        currentTtl = await redis.ttl(codeKey);
      } catch (error) {
        ttlReadSuccess = false;
        logSmsCodeDebug(
          'redis_operation_error',
          {
            error: serializeError(error),
            operation: 'get_code_ttl_after_save',
            phoneNumber,
            purpose,
            redisKey: codeKey,
            requestId: context.requestId,
          },
          'error',
        );
      }
      logSmsCodeDebug('redis_write_after', {
        phoneNumber,
        purpose,
        redisKey: codeKey,
        requestId: context.requestId,
        success: true,
        ttl: currentTtl,
        ttlReadSuccess,
      });
    } catch (error) {
      logSmsCodeDebug(
        'redis_operation_error',
        {
          error: serializeError(error),
          operation: 'save_code',
          phoneNumber,
          purpose,
          redisKey: codeKey,
          requestId: context.requestId,
        },
        'error',
      );
      throw error;
    }
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
  context: SmsCodeLogContext = {},
) {
  const redis = await getSmsCodeRedisClient();
  if (redis) {
    const codeKey = buildRedisCodeKey(purpose, phoneNumber);
    try {
      let preReadSuccess = true;
      let raw: null | string = null;
      let ttl: null | number = null;
      try {
        [raw, ttl] = await Promise.all([
          redis.get(codeKey),
          redis.ttl(codeKey),
        ]);
      } catch (error) {
        preReadSuccess = false;
        logSmsCodeDebug(
          'redis_operation_error',
          {
            error: serializeError(error),
            operation: 'read_code_before_verify',
            phoneNumber,
            purpose,
            redisKey: codeKey,
            requestId: context.requestId,
          },
          'error',
        );
      }
      const entry = readRedisEntry(raw);
      const maxVerifyAttempts = getPositiveSeconds(MAX_VERIFY_ATTEMPTS, 5);
      const matched = entry?.code === code;
      logSmsCodeDebug('redis_verify_before', {
        inputCode: maskSmsCode(code),
        isMatched: matched,
        phoneNumber,
        purpose,
        preReadSuccess,
        redisCode: maskSmsCode(entry?.code),
        redisKey: codeKey,
        requestId: context.requestId,
        ttl,
      });
      if (matched) {
        logSmsCodeDebug('delete_before', {
          deleteReason: purpose === 'login' ? '登录成功' : '验证码校验成功',
          phoneNumber,
          purpose,
          redisKey: codeKey,
          requestId: context.requestId,
        });
      } else if (
        entry &&
        Number(entry.attempts || 0) + 1 >= maxVerifyAttempts
      ) {
        logSmsCodeDebug('delete_before', {
          deleteReason: '验证码错误次数达到上限',
          phoneNumber,
          purpose,
          redisKey: codeKey,
          requestId: context.requestId,
        });
      }

      const result = (await redis.eval(VERIFY_SMS_CODE_SCRIPT, {
        arguments: [code, String(maxVerifyAttempts)],
        keys: [codeKey],
      })) as string | string[];
      const status = Array.isArray(result) ? result[0] : result;
      logSmsCodeDebug('redis_verify_after', {
        inputCode: maskSmsCode(code),
        isMatched: status === 'ok',
        phoneNumber,
        purpose,
        redisKey: codeKey,
        requestId: context.requestId,
        verifyStatus: status,
      });
      if (status === 'ok') {
        return;
      }
      if (status === 'invalid') {
        throw new SmsCodeError('验证码不正确');
      }
      throw new SmsCodeError('验证码不存在或已失效');
    } catch (error) {
      if (error instanceof SmsCodeError) {
        throw error;
      }
      logSmsCodeDebug(
        'redis_operation_error',
        {
          error: serializeError(error),
          operation: 'verify_code',
          phoneNumber,
          purpose,
          redisKey: codeKey,
          requestId: context.requestId,
        },
        'error',
      );
      throw error;
    }
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
