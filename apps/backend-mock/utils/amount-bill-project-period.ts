type AmountBillProjectSortRecord = {
  billId?: null | number;
  createTime?: Date | null;
  projectName?: null | string;
  receiptTime?: Date | null;
};

type ProjectMonthReference = {
  end: number;
  key: number;
  start: number;
};

function normalizeProjectName(value: unknown) {
  return String(value || '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function compactProjectName(value: unknown) {
  return normalizeProjectName(value).replaceAll(/\s+/g, '');
}

function normalizeProjectSearchText(value: unknown) {
  return compactProjectName(value)
    .toLowerCase()
    .replaceAll('月份', '月')
    .replaceAll('租金', '房租')
    .replaceAll('租赁费', '房租')
    .replaceAll('水电费', '水电')
    .replaceAll('水费', '水电')
    .replaceAll('电费', '水电');
}

function tokenizeProjectSearchKeyword(value: unknown) {
  const normalized = normalizeProjectSearchText(value);
  if (!normalized) {
    return [] as string[];
  }

  const tokens = new Set<string>();
  tokens.add(normalized);

  const splitTokens = normalized
    .split(/[、,，;；+\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  for (const token of splitTokens) {
    tokens.add(token);
  }

  const yearMonthMatches = normalized.match(
    /(?:19|20)\d{2}年(?:0?[1-9]|1[0-2])月|(?:19|20)\d{2}(?:0[1-9]|1[0-2])/g,
  );
  for (const token of yearMonthMatches || []) {
    tokens.add(
      token.includes('年')
        ? token
        : `${token.slice(0, 4)}年${Number(token.slice(4))}月`,
    );
  }

  const chineseMonthMatches = normalized.match(
    /(?:19|20)\d{2}年(?:0?[1-9]|1[0-2])月|(?:0?[1-9]|1[0-2])月/g,
  );
  for (const token of chineseMonthMatches || []) {
    tokens.add(token);
  }

  for (const aliasGroup of [
    ['房租', '租金', '租赁费'],
    ['水电', '水电费', '水费', '电费'],
  ]) {
    if (aliasGroup.some((alias) => normalized.includes(alias))) {
      for (const alias of aliasGroup) {
        tokens.add(normalizeProjectSearchText(alias));
      }
    }
  }

  return [...tokens].filter(Boolean);
}

function toMonthSortKey(year: number, month: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return year * 12 + month;
}

export function parseProjectMonthSortKey(value: unknown) {
  const matchedKeys = parseProjectMonthSortKeys(value);

  return matchedKeys.length > 0 ? matchedKeys[0] : null;
}

export function parseProjectMonthSortKeys(value: unknown) {
  const text = normalizeProjectName(value);
  if (!text) {
    return [] as number[];
  }

  return [
    ...new Set(parseProjectMonthReferences(value).map((item) => item.key)),
  ];
}

function parseProjectMonthReferences(value: unknown) {
  const compactText = compactProjectName(value);
  if (!compactText) {
    return [] as ProjectMonthReference[];
  }

  const references: ProjectMonthReference[] = [];
  const separatedPattern = /((?:19|20)\d{2})[年/.-](0?[1-9]|1[0-2])月?份?/g;
  let separatedMatch = separatedPattern.exec(compactText);
  while (separatedMatch) {
    const sortKey = toMonthSortKey(
      Number(separatedMatch[1]),
      Number(separatedMatch[2]),
    );
    if (sortKey !== null) {
      references.push({
        end: separatedMatch.index + separatedMatch[0].length,
        key: sortKey,
        start: separatedMatch.index,
      });
    }
    separatedMatch = separatedPattern.exec(compactText);
  }

  const compactPattern = /((?:19|20)\d{2})(0[1-9]|1[0-2])/g;
  let compactMatch = compactPattern.exec(compactText);
  while (compactMatch) {
    const sortKey = toMonthSortKey(
      Number(compactMatch[1]),
      Number(compactMatch[2]),
    );
    if (sortKey !== null) {
      const start = compactMatch.index;
      const end = compactMatch.index + compactMatch[0].length;
      const overlapsSeparatedReference = references.some(
        (item) => start < item.end && end > item.start,
      );

      if (!overlapsSeparatedReference) {
        references.push({
          end,
          key: sortKey,
          start,
        });
      }
    }
    compactMatch = compactPattern.exec(compactText);
  }

  return references.sort((a, b) => a.start - b.start);
}

function hasRentKeyword(value: string) {
  return /房租|租金|租赁费/.test(value);
}

function hasUtilityKeyword(value: string) {
  return /水费|电费|水[、,，]?电|用水|用电/.test(value);
}

function parseProjectKeywordMonthSortKeys(
  value: unknown,
  hasKeyword: (value: string) => boolean,
) {
  const compactText = compactProjectName(value);
  const references = parseProjectMonthReferences(value);
  if (!compactText || references.length === 0) {
    return [] as number[];
  }

  const matchedKeys: number[] = [];

  for (let index = 0; index < references.length; index += 1) {
    const current = references[index];
    if (!current) {
      continue;
    }
    const next = references[index + 1];
    const segmentAfterMonth = compactText.slice(
      current.end,
      next?.start ?? compactText.length,
    );

    if (hasKeyword(segmentAfterMonth)) {
      matchedKeys.push(current.key);
    }
  }

  if (matchedKeys.length === 0) {
    const segments = compactText.split(/[、,，;；]/);
    for (const segment of segments) {
      if (!hasKeyword(segment)) {
        continue;
      }

      const segmentMonthKeys = parseProjectMonthReferences(segment).map(
        (item) => item.key,
      );
      const segmentMonthKey = segmentMonthKeys[0];
      if (segmentMonthKeys.length === 1 && segmentMonthKey !== undefined) {
        matchedKeys.push(segmentMonthKey);
      }
    }
  }

  return [...new Set(matchedKeys)];
}

function parseProjectRentMonthSortKeys(value: unknown) {
  return parseProjectKeywordMonthSortKeys(value, hasRentKeyword);
}

function parseProjectUtilityMonthSortKeys(value: unknown) {
  return parseProjectKeywordMonthSortKeys(value, hasUtilityKeyword);
}

export function getSingleProjectMonthSortKey(value: unknown) {
  const matchedKeys = parseProjectMonthSortKeys(value);
  if (matchedKeys.length === 0) {
    return null;
  }

  const rentMonthKeys = parseProjectRentMonthSortKeys(value);
  if (rentMonthKeys.length === 1) {
    return rentMonthKeys[0];
  }

  const utilityMonthKeys = parseProjectUtilityMonthSortKeys(value);
  if (utilityMonthKeys.length === 1) {
    return utilityMonthKeys[0];
  }

  if (matchedKeys.length === 1) {
    return matchedKeys[0] ?? null;
  }

  return null;
}

export function getAmountBillProjectPeriodError(value: unknown) {
  const matchedKeys = parseProjectMonthSortKeys(value);
  if (matchedKeys.length === 0) {
    return '项目名称必须包含账期年月，如 2026年5月份房租水电';
  }

  const rentMonthKeys = parseProjectRentMonthSortKeys(value);
  const utilityMonthKeys = parseProjectUtilityMonthSortKeys(value);
  if (utilityMonthKeys.length > 1) {
    return '项目名称只能包含一个水电账期月份，请将不同水电月份分开制单';
  }

  if (rentMonthKeys.length > 1) {
    return '项目名称只能包含一个房租账期月份，请将不同房租月份分开制单';
  }

  if (
    matchedKeys.length > 1 &&
    utilityMonthKeys.length === 0 &&
    rentMonthKeys.length === 0
  ) {
    return '项目名称包含多个月份时，必须明确水电或房租月份，如 2026年6月份房租、2026年5月份水电';
  }

  return null;
}

function getDateMonthSortKey(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return toMonthSortKey(date.getFullYear(), date.getMonth() + 1);
}

function getTime(value: unknown) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function getAmountBillProjectSortKey(
  record: AmountBillProjectSortRecord,
) {
  return (
    getSingleProjectMonthSortKey(record.projectName) ??
    parseProjectMonthSortKey(record.projectName) ??
    getDateMonthSortKey(record.receiptTime) ??
    getDateMonthSortKey(record.createTime)
  );
}

export function compareAmountBillProjectDesc(
  a: AmountBillProjectSortRecord,
  b: AmountBillProjectSortRecord,
) {
  const aParsedProjectKeys = parseProjectMonthSortKeys(a.projectName);
  const bParsedProjectKeys = parseProjectMonthSortKeys(b.projectName);
  const aHasProjectMonth = aParsedProjectKeys.length > 0;
  const bHasProjectMonth = bParsedProjectKeys.length > 0;

  if (aHasProjectMonth !== bHasProjectMonth) {
    return aHasProjectMonth ? -1 : 1;
  }

  if (aHasProjectMonth && bHasProjectMonth) {
    const aPrimaryKey =
      getSingleProjectMonthSortKey(a.projectName) ?? aParsedProjectKeys[0] ?? 0;
    const bPrimaryKey =
      getSingleProjectMonthSortKey(b.projectName) ?? bParsedProjectKeys[0] ?? 0;
    if (aPrimaryKey !== bPrimaryKey) {
      return bPrimaryKey - aPrimaryKey;
    }

    const maxLength = Math.max(
      aParsedProjectKeys.length,
      bParsedProjectKeys.length,
    );
    const aSecondaryKeys = aParsedProjectKeys
      .slice(1)
      .sort((left, right) => right - left);
    const bSecondaryKeys = bParsedProjectKeys
      .slice(1)
      .sort((left, right) => right - left);

    for (let index = 0; index < maxLength - 1; index += 1) {
      const aKey = aSecondaryKeys[index] ?? 0;
      const bKey = bSecondaryKeys[index] ?? 0;
      if (aKey !== bKey) {
        return bKey - aKey;
      }
    }
  }

  if (!aHasProjectMonth && !bHasProjectMonth) {
    const aFallbackKey = getAmountBillProjectSortKey(a);
    const bFallbackKey = getAmountBillProjectSortKey(b);
    if (
      aFallbackKey !== null &&
      bFallbackKey !== null &&
      aFallbackKey !== bFallbackKey
    ) {
      return bFallbackKey - aFallbackKey;
    }
  }

  const receiptTimeDiff = getTime(b.receiptTime) - getTime(a.receiptTime);
  if (receiptTimeDiff !== 0) {
    return receiptTimeDiff;
  }

  const createTimeDiff = getTime(b.createTime) - getTime(a.createTime);
  if (createTimeDiff !== 0) {
    return createTimeDiff;
  }

  return Number(b.billId || 0) - Number(a.billId || 0);
}

export function normalizeAmountBillProjectName(value: unknown) {
  return normalizeProjectName(value);
}

export function isAmountBillProjectNameMatched(
  projectName: unknown,
  keyword: unknown,
) {
  const normalizedKeyword = normalizeProjectSearchText(keyword);
  if (!normalizedKeyword) {
    return true;
  }

  const normalizedProjectName = normalizeProjectSearchText(projectName);
  if (!normalizedProjectName) {
    return false;
  }

  if (normalizedProjectName.includes(normalizedKeyword)) {
    return true;
  }

  const tokens = tokenizeProjectSearchKeyword(keyword);
  return (
    tokens.length > 0 &&
    tokens.every((token) => normalizedProjectName.includes(token))
  );
}
