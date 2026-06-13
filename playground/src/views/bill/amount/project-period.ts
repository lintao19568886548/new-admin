type ProjectMonthReference = {
  end: number;
  key: number;
  start: number;
};

function normalizeProjectName(value: unknown) {
  return String(value || '')
    .replaceAll(/\s+/g, '')
    .trim();
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

function parseProjectMonthSortKeys(value: unknown) {
  return [
    ...new Set(parseProjectMonthReferences(value).map((item) => item.key)),
  ];
}

function parseProjectMonthReferences(value: unknown) {
  const text = normalizeProjectName(value);
  if (!text) {
    return [] as ProjectMonthReference[];
  }

  const references: ProjectMonthReference[] = [];
  const separatedPattern = /((?:19|20)\d{2})[年/.-](0?[1-9]|1[0-2])月?份?/g;
  let separatedMatch = separatedPattern.exec(text);
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
    separatedMatch = separatedPattern.exec(text);
  }

  const compactPattern = /((?:19|20)\d{2})(0[1-9]|1[0-2])/g;
  let compactMatch = compactPattern.exec(text);
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
    compactMatch = compactPattern.exec(text);
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
  const text = normalizeProjectName(value);
  const references = parseProjectMonthReferences(value);
  if (!text || references.length === 0) {
    return [] as number[];
  }

  const matchedKeys: number[] = [];

  for (let index = 0; index < references.length; index += 1) {
    const current = references[index];
    if (!current) {
      continue;
    }
    const next = references[index + 1];
    const segmentAfterMonth = text.slice(
      current.end,
      next?.start ?? text.length,
    );

    if (hasKeyword(segmentAfterMonth)) {
      matchedKeys.push(current.key);
    }
  }

  if (matchedKeys.length === 0) {
    const segments = text.split(/[、,，;；]/);
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
