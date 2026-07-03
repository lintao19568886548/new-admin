const CODE_TTL_SECONDS = Number(process.env.LOGIN_SMS_CODE_TTL ?? 300);
const RESEND_INTERVAL_SECONDS = Number(
  process.env.LOGIN_SMS_RESEND_INTERVAL ?? 60,
);
const MAX_VERIFY_ATTEMPTS = Number(
  process.env.LOGIN_SMS_MAX_VERIFY_ATTEMPTS ?? 5,
);
const SEND_LOCK_SECONDS = Number(process.env.LOGIN_SMS_SEND_LOCK_SECONDS ?? 30);

interface SmsCodeEntry {
  attempts: number;
  code: string;
  expiresAt: number;
  sentAt: number;
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

export function ensureCanSendCode(phoneNumber: string) {
  cleanupExpiredEntries();

  const sendingExpiresAt = sendingStore.get(phoneNumber);
  if (sendingExpiresAt && sendingExpiresAt > Date.now()) {
    throw new SmsCodeError(
      '验证码正在发送中，请稍后再试',
      Math.ceil((sendingExpiresAt - Date.now()) / 1000),
    );
  }

  const entry = smsStore.get(phoneNumber);
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

export function reserveSmsCodeSend(phoneNumber: string) {
  ensureCanSendCode(phoneNumber);
  const lockSeconds =
    Number.isFinite(SEND_LOCK_SECONDS) && SEND_LOCK_SECONDS > 0
      ? SEND_LOCK_SECONDS
      : 30;
  sendingStore.set(phoneNumber, Date.now() + lockSeconds * 1000);
}

export function releaseSmsCodeSend(phoneNumber: string) {
  sendingStore.delete(phoneNumber);
}

export function saveSmsCode(phoneNumber: string, code: string) {
  const now = Date.now();
  releaseSmsCodeSend(phoneNumber);
  smsStore.set(phoneNumber, {
    attempts: 0,
    code,
    expiresAt: now + CODE_TTL_SECONDS * 1000,
    sentAt: now,
  });
}

export function verifySmsCode(phoneNumber: string, code: string) {
  cleanupExpiredEntries();

  const entry = smsStore.get(phoneNumber);
  if (!entry) {
    throw new SmsCodeError('验证码不存在或已失效');
  }

  const now = Date.now();
  if (entry.expiresAt <= now) {
    smsStore.delete(phoneNumber);
    throw new SmsCodeError('验证码已过期');
  }

  if (entry.code !== code) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
      smsStore.delete(phoneNumber);
    } else {
      smsStore.set(phoneNumber, entry);
    }
    throw new SmsCodeError('验证码不正确');
  }

  smsStore.delete(phoneNumber);
}

export function generateNumericCode(length: number = 6) {
  const digits = '0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += digits[Math.floor(Math.random() * digits.length)];
  }
  return result;
}
