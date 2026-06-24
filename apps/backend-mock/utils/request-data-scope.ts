import type { H3Event } from 'h3';
import type { UserInfoForToken } from '~/utils/user-service';

import { prismaClient } from '~/utils/db';

import {
  getCurrentParkIdFromEvent,
  resolveAuthorizedParkIdsForScope,
} from './current-park-scope.ts';

const GUANGDONG_CITY_KEYWORDS = [
  '广州',
  '深圳',
  '佛山',
  '东莞',
  '惠州',
  '中山',
  '珠海',
  '江门',
  '肇庆',
  '清远',
  '汕头',
  '汕尾',
  '揭阳',
  '潮州',
  '梅州',
  '河源',
  '韶关',
  '云浮',
  '阳江',
  '茂名',
  '湛江',
];

const COMMON_REGION_KEYWORDS = [
  '九江',
  '乐从',
  '坪山',
  '同兴',
  '同富',
  '桥头',
  '宏威',
  '龙岗',
  '宝安',
  '松岗',
  '南海',
  '顺德',
  '禅城',
  '三水',
  '高明',
  '黄埔',
  '番禺',
  '南沙',
  '白云',
  '增城',
  '花都',
  '从化',
  '天河',
  '东城',
  '南城',
  '万江',
  '厚街',
  '虎门',
  '长安',
  '常平',
  '塘厦',
  '清溪',
  '大朗',
  '凤岗',
  '寮步',
];

const GENERIC_SCOPE_WORDS = new Set([
  '全部',
  '全部园区',
  '公司',
  '园区',
  '总经理',
  '总部',
  '经理',
  '负责人',
]);

export interface TextualDataScopeFilter {
  cityKeywords: string[];
  regionKeywords: string[];
}

export interface ParkDataScope {
  empty: boolean;
  parkIds: number[];
  unrestricted: boolean;
}

export interface TextualDataScope {
  cityKeywords: string[];
  empty: boolean;
  parkIds: number[];
  regionKeywords: string[];
  textFilters: TextualDataScopeFilter[];
  unrestricted: boolean;
}

export type DataScopeWhereFragment = {
  clause: string;
  params: any[];
};

type UserInfoWithOptionalScope = UserInfoForToken & {
  effectiveUserId?: unknown;
  organizationName?: string;
  platformSuper?: boolean;
};

function uniqueValues(values: string[]) {
  return [
    ...new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  ];
}

function normalizeText(value: unknown) {
  return String(value || '')
    .trim()
    .replaceAll(/\s+/g, '')
    .replaceAll(/[()（）【】[\]{}]/g, '');
}

function stripCommonWords(value: string) {
  return value
    .replaceAll(/广东省?/g, '')
    .replaceAll(/[市区县镇村]/g, '')
    .replaceAll(
      /(产业园区|工业园区|科技园区|产业园|工业园|科技园|园区|街道|公司|大区|总部|总经理|负责人|经理)/g,
      '',
    );
}

function pushKeyword(target: string[], value: string) {
  const normalized = normalizeText(value);
  if (normalized.length < 2 || GENERIC_SCOPE_WORDS.has(normalized)) {
    return;
  }
  target.push(normalized);
}

function collectTextualKeywordsFromText(value: unknown) {
  const text = normalizeText(value);
  const cityKeywords: string[] = [];
  const regionKeywords: string[] = [];
  if (!text) {
    return { cityKeywords, regionKeywords };
  }

  for (const city of GUANGDONG_CITY_KEYWORDS) {
    if (text.includes(city)) {
      cityKeywords.push(city);
    }
  }
  for (const keyword of COMMON_REGION_KEYWORDS) {
    if (text.includes(keyword)) {
      regionKeywords.push(keyword);
    }
  }

  let withoutCity = text;
  for (const city of GUANGDONG_CITY_KEYWORDS) {
    withoutCity = withoutCity.replaceAll(city, '');
  }
  pushKeyword(regionKeywords, stripCommonWords(withoutCity));
  pushKeyword(regionKeywords, stripCommonWords(text));

  return {
    cityKeywords: uniqueValues(cityKeywords),
    regionKeywords: uniqueValues(regionKeywords),
  };
}

function mergeTextualFilters(
  filters: Array<{
    cityKeywords: string[];
    regionKeywords: string[];
  }>,
): TextualDataScopeFilter {
  return {
    cityKeywords: uniqueValues(
      filters.flatMap((filter) => filter.cityKeywords),
    ),
    regionKeywords: uniqueValues(
      filters.flatMap((filter) => filter.regionKeywords),
    ),
  };
}

function hasTextualFilterKeywords(filter: TextualDataScopeFilter) {
  return filter.cityKeywords.length > 0 || filter.regionKeywords.length > 0;
}

function isHeadquartersScope(userinfo: UserInfoForToken) {
  const scopedUserinfo = userinfo as UserInfoWithOptionalScope;
  return (
    scopedUserinfo.platformSuper === true && !scopedUserinfo.effectiveUserId
  );
}

export function resolveParkDataScopeForRequest(
  event: H3Event,
  userinfo: UserInfoForToken,
): ParkDataScope {
  if (isHeadquartersScope(userinfo)) {
    return {
      empty: false,
      parkIds: [],
      unrestricted: true,
    };
  }

  const authorizedParkIds = (userinfo.parks || [])
    .map((park) => Number(park.parkId))
    .filter((parkId) => Number.isInteger(parkId) && parkId > 0);
  const parkIds = resolveAuthorizedParkIdsForScope({
    authorizedParkIds,
    currentParkId: getCurrentParkIdFromEvent(event),
  });

  return {
    empty: parkIds.length === 0,
    parkIds,
    unrestricted: false,
  };
}

export function buildParkDataScopeWhereSql(
  dataScope: ParkDataScope | undefined,
  column = 'park_id',
  options: { includeNull?: boolean } = {},
): DataScopeWhereFragment | null {
  if (!dataScope || dataScope.unrestricted) {
    return null;
  }
  if (dataScope.empty) {
    return {
      clause: '1 = 0',
      params: [],
    };
  }

  const placeholders = dataScope.parkIds.map(() => '?').join(', ');
  const inClause = `${column} IN (${placeholders})`;
  return {
    clause: options.includeNull
      ? `(${column} IS NULL OR ${inClause})`
      : inClause,
    params: dataScope.parkIds,
  };
}

export async function resolveTextualDataScopeForRequest(
  event: H3Event,
  userinfo: UserInfoForToken,
): Promise<TextualDataScope> {
  const parkScope = resolveParkDataScopeForRequest(event, userinfo);
  if (parkScope.unrestricted) {
    return {
      cityKeywords: [],
      empty: false,
      parkIds: [],
      regionKeywords: [],
      textFilters: [],
      unrestricted: true,
    };
  }

  const parkIds = parkScope.parkIds;
  if (parkIds.length === 0) {
    return {
      cityKeywords: [],
      empty: true,
      parkIds: [],
      regionKeywords: [],
      textFilters: [],
      unrestricted: false,
    };
  }

  const parks = await prismaClient.park.findMany({
    orderBy: { parkId: 'asc' },
    select: {
      address: true,
      parkId: true,
      parkName: true,
    },
    where: {
      isDeleted: false,
      parkId: { in: parkIds },
    },
  });
  const cityKeywords: string[] = [];
  const regionKeywords: string[] = [];
  const textFilters: TextualDataScopeFilter[] = [];
  const scopedUserinfo = userinfo as UserInfoWithOptionalScope;
  const scopeName =
    event.context.organizationName || scopedUserinfo.organizationName;

  const scopeKeywords = collectTextualKeywordsFromText(scopeName);
  cityKeywords.push(...scopeKeywords.cityKeywords);
  regionKeywords.push(...scopeKeywords.regionKeywords);

  for (const park of parks) {
    const parkFilter = mergeTextualFilters([
      scopeKeywords,
      collectTextualKeywordsFromText(park.parkName),
      collectTextualKeywordsFromText(park.address),
    ]);
    if (hasTextualFilterKeywords(parkFilter)) {
      textFilters.push(parkFilter);
      cityKeywords.push(...parkFilter.cityKeywords);
      regionKeywords.push(...parkFilter.regionKeywords);
    }
  }

  return {
    cityKeywords: uniqueValues(cityKeywords),
    empty: parks.length === 0 || textFilters.length === 0,
    parkIds,
    regionKeywords: uniqueValues(regionKeywords),
    textFilters,
    unrestricted: false,
  };
}
