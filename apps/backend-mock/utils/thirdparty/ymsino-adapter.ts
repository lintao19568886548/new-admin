import type { YmsinoDeviceInfo, YmsinoTranDayItem } from './ymsino';

import { ymsinoBaseURL, ymsinoOrgId } from './ymsino';

type YmsinoMeterKind = 'electric' | 'water';
type YmsinoDeviceRecord = YmsinoDeviceInfo & { protocol?: string };

interface YmsinoDeviceTreeNode {
  children?: YmsinoDeviceTreeNode[];
  dataRef?: YmsinoDeviceInfo;
  isLeaf?: boolean;
  key: string;
  title: string;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeLowerText(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isYmsinoSuccessCode(code: unknown) {
  const value = normalizeLowerText(code);
  return !value || ['0', '200', 'success', 'true'].includes(value);
}

export function ensureYmsinoSuccess(result: any, message: string) {
  if (isYmsinoSuccessCode(result?.Code)) {
    return;
  }

  throw new Error(`${message}: ${result?.Msg || result?.Code || 'unknown'}`);
}

export function getYmsinoTjType(kind: YmsinoMeterKind) {
  return kind === 'water'
    ? process.env.TP_YMSINO_WATER_TJ_TYPE || '1'
    : process.env.TP_YMSINO_ELECTRIC_TJ_TYPE || '0';
}

export function getYmsinoRuntimeConfig() {
  return {
    baseURL: ymsinoBaseURL,
    orgId: ymsinoOrgId,
  };
}

function matchesYmsinoKind(item: { TjType?: string }, kind: YmsinoMeterKind) {
  const expected = getYmsinoTjType(kind);
  return !expected || normalizeText(item.TjType) === expected;
}

export function filterYmsinoDevices(
  items: YmsinoDeviceInfo[],
  kind: YmsinoMeterKind,
  keyword = '',
): YmsinoDeviceRecord[] {
  const normalizedKeyword = normalizeLowerText(keyword);

  return items.filter((item) => {
    if (!item || !matchesYmsinoKind(item, kind)) {
      return false;
    }
    if (!normalizedKeyword) {
      return true;
    }

    const haystack = normalizeLowerText(
      [
        item.RmId,
        item.RmName,
        item.DeviceId,
        item.FactoryNo,
        item.Pt,
        item.Ct,
      ].join(' '),
    );
    return haystack.includes(normalizedKeyword);
  });
}

function upsertTreeNode(
  nodes: Map<string, YmsinoDeviceTreeNode>,
  key: string,
  title: string,
) {
  const existing = nodes.get(key);
  if (existing) {
    return existing;
  }

  const node: YmsinoDeviceTreeNode = { children: [], key, title };
  nodes.set(key, node);
  return node;
}

export function buildYmsinoDeviceTree(items: YmsinoDeviceInfo[]) {
  const buildingMap = new Map<string, YmsinoDeviceTreeNode>();

  for (const item of items) {
    const buildingTitle =
      normalizeText(item.RmName) || normalizeText(item.RmId) || '未分组';
    const buildingKey = normalizeText(item.RmId) || buildingTitle;
    const buildingNode = upsertTreeNode(
      buildingMap,
      buildingKey,
      buildingTitle,
    );
    const deviceTitle =
      normalizeText(item.FactoryNo) ||
      normalizeText(item.DeviceId) ||
      normalizeText(item.RmName) ||
      '未知设备';
    const deviceKey = [
      buildingKey,
      normalizeText(item.DeviceId) || normalizeText(item.FactoryNo),
    ]
      .filter(Boolean)
      .join('/');

    buildingNode.children ||= [];
    if (!buildingNode.children.some((node) => node.key === deviceKey)) {
      buildingNode.children.push({
        dataRef: item,
        isLeaf: true,
        key: deviceKey,
        title: deviceTitle,
      });
    }
  }

  return [...buildingMap.values()];
}

export function validateYmsinoDeviceList(items: YmsinoDeviceInfo[]) {
  const errors: Array<{ index: number; message: string }> = [];

  items.forEach((item, index) => {
    for (const field of ['FactoryNo', 'DeviceId', 'RmId'] as const) {
      if (!normalizeText(item?.[field])) {
        errors.push({ index, message: `${field} is required` });
      }
    }
  });

  return {
    errors,
    ok: errors.length === 0,
  };
}

export function parseYmsinoComAddresses(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [
    ...new Set(values.map((item) => normalizeText(item)).filter(Boolean)),
  ];
}

export function filterYmsinoFrozenReadings(
  items: YmsinoTranDayItem[],
  kind: YmsinoMeterKind,
  comAddresses: string[] = [],
) {
  const addressSet = new Set(comAddresses);

  return items
    .filter((item) => {
      if (!item || !matchesYmsinoKind(item, kind)) {
        return false;
      }
      if (addressSet.size === 0) {
        return true;
      }
      return (
        addressSet.has(normalizeText(item.FactoryNo)) ||
        addressSet.has(normalizeText(item.DeviceId))
      );
    })
    .map((item) => ({
      ...item,
      comAddress: item.FactoryNo || item.DeviceId,
      currentRatio: item.Ct,
      dataValue: item.ZTotal,
      dataValue1: item.ZTip,
      dataValue2: item.ZPeak,
      dataValue3: item.ZComm,
      dataValue4: item.ZVale,
      freezeTime: item.TranDate,
      proCode: item.Pt,
    }));
}

export function paginateYmsinoItems<T>(
  items: T[],
  currentPage: number,
  pageSize: number,
) {
  const safePage = Math.max(1, Math.floor(Number(currentPage) || 1));
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 20));
  const start = (safePage - 1) * safePageSize;

  return {
    currentPage: safePage,
    items: items.slice(start, start + safePageSize),
    pageSize: safePageSize,
    total: items.length,
  };
}
