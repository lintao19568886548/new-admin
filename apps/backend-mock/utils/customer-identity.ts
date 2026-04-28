import { pinyin } from 'pinyin-pro';

const CUSTOMER_ID_MAX_LENGTH = 50;
const CUSTOMER_ID_MIN_BASE_LENGTH = 3;

export interface TenantIdentityProfile {
  city: string;
  companyShortName: string;
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .replaceAll(/\s+/g, '');
}

function stripCitySuffix(value: string) {
  return value.replace(/(特别行政区|自治州|地区|[盟市县区省])$/u, '');
}

function pushAsciiSegment(segments: string[], value: string) {
  const normalized = value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');

  if (normalized) {
    segments.push(...normalized.split('_').filter(Boolean));
  }
}

export function toPinyinSlug(value: string) {
  const segments: string[] = [];
  let asciiBuffer = '';
  let hanBuffer = '';

  const flushAsciiBuffer = () => {
    if (!asciiBuffer) {
      return;
    }
    pushAsciiSegment(segments, asciiBuffer);
    asciiBuffer = '';
  };

  const flushHanBuffer = () => {
    if (!hanBuffer) {
      return;
    }
    const converted = pinyin(hanBuffer, {
      separator: '',
      toneType: 'none',
      type: 'string',
    }) as string;
    pushAsciiSegment(segments, converted);
    hanBuffer = '';
  };

  for (const char of value) {
    if (/\p{Script=Han}/u.test(char)) {
      flushAsciiBuffer();
      hanBuffer += char;
      continue;
    }

    flushHanBuffer();
    asciiBuffer += char;
  }

  flushAsciiBuffer();
  flushHanBuffer();

  return segments
    .join('_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '');
}

export function normalizeTenantIdentityProfile(input: {
  city?: unknown;
  companyShortName?: unknown;
}) {
  const city = normalizeText(input.city);
  const companyShortName = normalizeText(input.companyShortName);

  if (!city) {
    throw new Error('请填写专属空间所在城市');
  }

  if (!companyShortName) {
    throw new Error('请填写公司简称');
  }

  if (city.length > 30) {
    throw new Error('专属空间所在城市不能超过 30 个字符');
  }

  if (companyShortName.length > 50) {
    throw new Error('公司简称不能超过 50 个字符');
  }

  return {
    city,
    companyShortName,
  } satisfies TenantIdentityProfile;
}

export function buildTenantCustomerIdBase(profile: TenantIdentityProfile) {
  const citySlug = toPinyinSlug(stripCitySuffix(profile.city));
  const companySlug = toPinyinSlug(profile.companyShortName);
  const base = `${citySlug}_${companySlug}`
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '');

  if (base.length < CUSTOMER_ID_MIN_BASE_LENGTH) {
    throw new Error('城市或公司简称无法转换为有效的专属空间标识');
  }

  return base.slice(0, CUSTOMER_ID_MAX_LENGTH).replaceAll(/_+$/g, '');
}

export function buildTenantCustomerIdCandidate(base: string, ordinal: number) {
  const suffix = ordinal <= 1 ? '' : `_${ordinal}`;
  const maxBaseLength = CUSTOMER_ID_MAX_LENGTH - suffix.length;
  const truncatedBase = base.slice(0, maxBaseLength).replaceAll(/_+$/g, '');
  const candidate = `${truncatedBase}${suffix}`;

  if (!/^\w+$/.test(candidate)) {
    throw new Error(`专属空间标识不合法: ${candidate}`);
  }

  return candidate;
}
