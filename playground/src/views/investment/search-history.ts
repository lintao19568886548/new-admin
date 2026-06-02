import { computed, ref } from 'vue';

const STORAGE_PREFIX = 'investment-search-history:';
const DEFAULT_LIMIT = 12;

type SearchOption = {
  label?: string;
  value: string;
};

export const searchableDropdownProps = {
  filterOption: true,
  notFoundContent: '暂无搜索历史',
  optionFilterProp: 'value',
  showAction: ['focus', 'click'] as Array<'click' | 'focus'>,
  showArrow: true,
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function normalizeSearchText(value: unknown) {
  return String(value ?? '').trim();
}

function dedupeSearchValues(values: unknown[], limit = DEFAULT_LIMIT) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = normalizeSearchText(raw);
    if (!value) {
      continue;
    }

    const key = value.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function getDefaultSearchValues(key: string) {
  const normalizedKey = key.toLocaleLowerCase();

  if (normalizedKey.includes('publishedagelabel')) {
    return ['1 小时前', '3 小时前', '1 天前', '3 天前', '7 天前'];
  }

  if (normalizedKey.includes('city') || normalizedKey.includes('regioncity')) {
    return [
      '广州',
      '深圳',
      '东莞',
      '惠州',
      '佛山',
      '中山',
      '珠海',
      '江门',
      '肇庆',
      '清远',
    ];
  }

  if (
    normalizedKey.includes('sourcesite') ||
    normalizedKey.includes('sourcename')
  ) {
    return ['99cfw', 'cfzsw68.com', 'zhaoshang.net', 'fang.com', 'toodc.cn'];
  }

  if (normalizedKey.includes('industry')) {
    return [
      '电子信息',
      '装备制造',
      '新能源',
      '新材料',
      '食品饮料',
      '仓储物流',
      '生物医药',
    ];
  }

  if (normalizedKey.includes('address')) {
    return ['惠州仲恺', '东莞松山湖', '深圳龙岗', '佛山顺德'];
  }

  if (normalizedKey.includes('agentname')) {
    return ['张总', '李总', '王总', '刘总'];
  }

  if (normalizedKey.includes('tenantname')) {
    return ['电子厂', '五金厂', '物流仓库', '智能制造'];
  }

  return ['厂房', '仓库', '扩产', '搬迁', '租厂房', '工业园', '制造业'];
}

export function readSearchHistory(key: string, limit = DEFAULT_LIMIT) {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? dedupeSearchValues(parsed, limit) : [];
  } catch {
    return [];
  }
}

function writeSearchHistory(key: string, values: string[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(key), JSON.stringify(values));
  } catch {
    // Ignore storage quota or privacy mode failures; search itself still works.
  }
}

export function rememberSearchHistory(
  key: string,
  value: unknown,
  limit = DEFAULT_LIMIT,
) {
  const text = normalizeSearchText(value);
  if (!text) {
    return;
  }

  const nextValues = dedupeSearchValues(
    [text, ...readSearchHistory(key, limit)],
    limit,
  );
  writeSearchHistory(key, nextValues);
}

export function rememberSearchHistories(
  entries: Array<[key: string, value: unknown]>,
  limit = DEFAULT_LIMIT,
) {
  for (const [key, value] of entries) {
    rememberSearchHistory(key, value, limit);
  }
}

export function toSearchOptions(values?: unknown[], limit = DEFAULT_LIMIT) {
  return dedupeSearchValues(values || [], limit).map((value) => ({ value }));
}

export function mergeSearchOptions(
  historyValues: unknown[],
  serverValues?: unknown[],
  limit = DEFAULT_LIMIT,
) {
  return toSearchOptions(
    [...(historyValues || []), ...(serverValues || [])],
    limit,
  );
}

export function getSearchHistoryOptions(key: string, limit = DEFAULT_LIMIT) {
  return toSearchOptions(
    [...readSearchHistory(key, limit), ...getDefaultSearchValues(key)],
    limit,
  );
}

export function useSearchHistory(key: string, limit = DEFAULT_LIMIT) {
  const history = ref<string[]>(readSearchHistory(key, limit));

  function add(value: unknown) {
    const text = normalizeSearchText(value);
    if (!text) {
      return;
    }

    history.value = dedupeSearchValues([text, ...history.value], limit);
    writeSearchHistory(key, history.value);
  }

  function addMany(values: unknown[]) {
    const candidates = values
      .map((value) => normalizeSearchText(value))
      .filter(Boolean);
    if (candidates.length === 0) {
      return;
    }

    history.value = dedupeSearchValues(
      [...candidates, ...history.value],
      limit,
    );
    writeSearchHistory(key, history.value);
  }

  function clear() {
    history.value = [];
    writeSearchHistory(key, history.value);
  }

  function options(extraValues?: unknown[]) {
    return computed<SearchOption[]>(() =>
      mergeSearchOptions(
        history.value,
        [...(extraValues || []), ...getDefaultSearchValues(key)],
        limit,
      ),
    );
  }

  return {
    add,
    addMany,
    clear,
    history,
    options,
  };
}
