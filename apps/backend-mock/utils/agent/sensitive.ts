const PHONE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const ID_CARD_PATTERN =
  /(?<![0-9A-Z])\d{6}(?:18|19|20)\d{9}[\dX](?![0-9A-Z])/gi;
const BANK_CARD_PATTERN = /(?<!\d)\d{13,19}(?!\d)/g;
const TOKEN_LIKE_PATTERN =
  /\b(?:access[_-]?token|refresh[_-]?token|api[_-]?key|secret|authorization|bearer)\s*[:=]\s*['"]?[^'"\s,;]+/gi;

function maskPhone(value: string) {
  return value.replaceAll(
    PHONE_PATTERN,
    (text) => `${text.slice(0, 3)}****${text.slice(-4)}`,
  );
}

function maskIdCard(value: string) {
  return value.replaceAll(
    ID_CARD_PATTERN,
    (text) => `${text.slice(0, 6)}********${text.slice(-4)}`,
  );
}

function maskBankCard(value: string) {
  return value.replaceAll(
    BANK_CARD_PATTERN,
    (text) => `${text.slice(0, 4)} **** **** ${text.slice(-4)}`,
  );
}

function maskTokenLike(value: string) {
  return value.replaceAll(TOKEN_LIKE_PATTERN, (text) => {
    const separatorIndex = Math.max(
      text.lastIndexOf(':'),
      text.lastIndexOf('='),
    );
    if (separatorIndex < 0) {
      return '[敏感信息已脱敏]';
    }
    return `${text.slice(0, separatorIndex + 1)} [敏感信息已脱敏]`;
  });
}

export function maskSensitiveText(value: unknown): string {
  return maskTokenLike(
    maskBankCard(maskIdCard(maskPhone(String(value ?? '')))),
  );
}

export function sanitizeForAgentLog<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return maskSensitiveText(value) as T;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForAgentLog(item)) as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = /token|secret|apiKey|api_key|authorization|password/i.test(
        key,
      )
        ? '[敏感信息已脱敏]'
        : sanitizeForAgentLog(item);
    }
    return result as T;
  }

  return value;
}
