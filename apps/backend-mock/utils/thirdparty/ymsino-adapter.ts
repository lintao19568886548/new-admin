import type {
  YmsinoDeviceInfo,
  YmsinoOnOffResponse,
  YmsinoRechargeResponse,
  YmsinoTranDayItem,
} from './ymsino';

import { ymsinoBaseURL, ymsinoDefaultPtId, ymsinoOrgId } from './ymsino';

export type YmsinoMeterKind = 'electric' | 'water';

const DEFAULT_KNOWN_WATER_FACTORY_NO = '00000260507851';

export interface YmsinoRuntimeConfig {
  baseURL: string;
  orgId: string;
  ptId: string;
}

export interface YmsinoDeviceBinding {
  buildingId?: string;
  buildingName?: string;
  deviceId: string;
  factoryNo: string;
  parkId: string;
  parkName: string;
  roomId: string;
  roomName: string;
  tenantId?: string;
  tenantName?: string;
}

export interface YmsinoDeviceRecord extends YmsinoDeviceBinding {
  comAddress: string;
  currentRatio: string;
  multiplier: number;
  piplineName: string;
  protocol: string;
  pt: string;
  ct: string;
  source: 'ymsino';
  status: 'reported-reading-only';
  tjType: string;
}

export interface YmsinoFrozenReading {
  comAddress: string;
  comtype: string;
  currentRatio: string;
  dataItemName: string;
  dataValue: string;
  dataValue1: string;
  dataValue2: string;
  dataValue3: string;
  dataValue4: string;
  deviceId: string;
  deviceStatus: 'reported-reading-only';
  factoryNo: string;
  freezeTime: string;
  multiplier: number;
  parkId: string;
  parkName: string;
  proCode: string;
  protocol: string;
  readAt: string;
  raw: YmsinoTranDayItem;
  roomId: string;
  roomName: string;
  source: 'ymsino';
  tenantId?: string;
  tenantName?: string;
  writeTime: string;
}

export type YmsinoCommandPhase =
  | 'accepted'
  | 'acknowledged'
  | 'executed'
  | 'failed'
  | 'timeout'
  | 'unsupported';

export interface YmsinoCommandResult<T = unknown> {
  action: string;
  commandSent: boolean;
  confirmationSource: 'none' | 'vendor-response';
  commandId: string;
  deviceAcknowledged: boolean;
  deviceId?: string;
  errorCode?: string;
  executed: boolean;
  failedReason?: string;
  factoryNo?: string;
  missingClosureFields: string[];
  phase: YmsinoCommandPhase;
  raw?: T;
  received: boolean;
  resultCallbackRequired: boolean;
  retryable: boolean;
  roomId?: string;
  sid?: string;
  timeoutMs: number;
}

export const YMSINO_DEFAULT_PT_ID = ymsinoDefaultPtId;

const ELECTRIC_TJ_TYPE = '0';
const WATER_TJ_TYPE = '1';

const DEFAULT_COMMAND_TIMEOUT_MS = Number(
  process.env.TP_YMSINO_COMMAND_TIMEOUT_MS || 30_000,
);

const YMSINO_READ_SUCCESS_CODES = parseSuccessCodes(
  process.env.TP_YMSINO_READ_SUCCESS_CODES || '0,1,200',
);
const YMSINO_COMMAND_SUCCESS_CODES = parseSuccessCodes(
  process.env.TP_YMSINO_COMMAND_SUCCESS_CODES || '1,200',
);

export function getYmsinoRuntimeConfig(): YmsinoRuntimeConfig {
  return {
    baseURL: ymsinoBaseURL,
    orgId: ymsinoOrgId,
    ptId: YMSINO_DEFAULT_PT_ID,
  };
}

export function getYmsinoTjType(kind: YmsinoMeterKind) {
  return kind === 'electric'
    ? process.env.TP_YMSINO_ELECTRIC_TJ_TYPE || ELECTRIC_TJ_TYPE
    : process.env.TP_YMSINO_WATER_TJ_TYPE || WATER_TJ_TYPE;
}

export function getYmsinoProtocol(kind: YmsinoMeterKind) {
  return kind === 'electric'
    ? process.env.TP_YMSINO_ELECTRIC_PROTOCOL || 'M-Bus'
    : process.env.TP_YMSINO_WATER_PROTOCOL || 'unconfirmed';
}

export function getYmsinoKnownWaterFactoryNos() {
  return parseYmsinoComAddresses(
    process.env.TP_YMSINO_KNOWN_WATER_FACTORY_NOS ||
      DEFAULT_KNOWN_WATER_FACTORY_NO,
  );
}

export function getYmsinoKnownElectricFactoryNos() {
  return parseYmsinoComAddresses(
    process.env.TP_YMSINO_KNOWN_ELECTRIC_FACTORY_NOS,
  );
}

export function getYmsinoComType(kind: YmsinoMeterKind) {
  return kind === 'electric'
    ? process.env.TP_YMSINO_ELECTRIC_COMTYPE || 'D.MBUS.ELECTRIC'
    : process.env.TP_YMSINO_WATER_COMTYPE || 'W.YMSINO.WATER';
}

export function parseYmsinoComAddresses(raw: unknown): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  return [
    ...new Set(
      values
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  ];
}

export function paginateYmsinoItems<T>(
  list: T[],
  page: number,
  pageSize: number,
) {
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;
  const total = list.length;
  const start = (currentPage - 1) * size;
  return {
    currentPage,
    items: list.slice(start, start + size),
    pageSize: size,
    total,
  };
}

export function validateYmsinoDeviceList(list: YmsinoDeviceInfo[]) {
  const errors: string[] = [];
  const factoryNos = new Map<string, number>();
  const deviceIds = new Map<string, number>();

  for (const item of list) {
    const factoryNo = normalizeText(item.FactoryNo);
    const deviceId = normalizeText(item.DeviceId);
    const roomId = normalizeText(item.RmId);

    if (factoryNo) {
      factoryNos.set(factoryNo, (factoryNos.get(factoryNo) || 0) + 1);
    } else {
      errors.push(
        `Room ${roomId || item.RmName || 'unknown'} missing FactoryNo`,
      );
    }

    if (deviceId) {
      deviceIds.set(deviceId, (deviceIds.get(deviceId) || 0) + 1);
    } else {
      errors.push(
        `Device ${factoryNo || roomId || 'unknown'} missing DeviceId`,
      );
    }

    if (!roomId) {
      errors.push(`Device ${factoryNo || deviceId || 'unknown'} missing RmId`);
    }
  }

  for (const [factoryNo, count] of factoryNos.entries()) {
    if (count > 1) {
      errors.push(`FactoryNo ${factoryNo} duplicated ${count} times`);
    }
  }
  for (const [deviceId, count] of deviceIds.entries()) {
    if (count > 1) {
      errors.push(`DeviceId ${deviceId} duplicated ${count} times`);
    }
  }

  return {
    errors,
    ok: errors.length === 0,
  };
}

export function normalizeYmsinoDevice(
  item: YmsinoDeviceInfo,
  kind: YmsinoMeterKind,
): YmsinoDeviceRecord {
  const config = getYmsinoRuntimeConfig();
  const pt = normalizeText(item.Pt);
  const ct = normalizeText(item.Ct);
  const factoryNo = normalizeText(item.FactoryNo);
  const roomId = normalizeText(item.RmId);
  const roomName = normalizeText(item.RmName) || roomId;
  return {
    comAddress: factoryNo,
    currentRatio: formatRatio(pt, ct),
    deviceId: normalizeText(item.DeviceId),
    factoryNo,
    multiplier: calculateMultiplier(pt, ct),
    parkId: config.ptId,
    parkName: config.ptId,
    piplineName: roomName,
    protocol: getYmsinoProtocol(kind),
    pt,
    ct,
    roomId,
    roomName,
    source: 'ymsino',
    status: 'reported-reading-only',
    tjType: normalizeText(item.TjType) || getYmsinoTjType(kind),
  };
}

export function filterYmsinoDevices(
  list: YmsinoDeviceInfo[],
  kind: YmsinoMeterKind,
  keyword?: string,
) {
  const normalizedKeyword = normalizeText(keyword).toLowerCase();
  return list
    .filter((item) => item && (item.FactoryNo || item.DeviceId || item.RmName))
    .map((item) => normalizeYmsinoDevice(item, kind))
    .filter((item) => {
      if (!normalizedKeyword) return true;
      return [
        item.factoryNo,
        item.deviceId,
        item.roomId,
        item.roomName,
        item.parkName,
        item.tenantName,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedKeyword),
        );
    });
}

export function findYmsinoDeviceByFactoryNo(
  list: YmsinoDeviceInfo[],
  kind: YmsinoMeterKind,
  factoryNo: string,
) {
  const normalizedFactoryNo = normalizeText(factoryNo);
  if (!normalizedFactoryNo) return null;

  const matched = list.find(
    (item) => normalizeText(item.FactoryNo) === normalizedFactoryNo,
  );
  return matched ? normalizeYmsinoDevice(matched, kind) : null;
}

export function normalizeYmsinoLookbackDays(value: unknown) {
  const parsed = Number(value || 7);
  if (!Number.isFinite(parsed) || parsed < 1) return 7;
  return Math.min(Math.trunc(parsed), 31);
}

export function buildYmsinoLookupDates(tyDate: string, lookbackDays: number) {
  const startTime = Date.parse(`${tyDate}T00:00:00`);
  const safeStartTime = Number.isNaN(startTime) ? Date.now() : startTime;
  return Array.from({ length: lookbackDays }, (_, index) => {
    const date = new Date(safeStartTime - index * 86_400_000);
    return date.toISOString().slice(0, 10);
  });
}

export function buildYmsinoDailyFreezeChecks(
  freezeResponses: Array<{ Date?: YmsinoTranDayItem[] }>,
  lookupDates: string[],
  kind: YmsinoMeterKind,
  factoryNo: string,
) {
  return freezeResponses.map((freezeResponse, index) => {
    const date = lookupDates[index] || '';
    const matchedReadings = filterYmsinoFrozenReadings(
      freezeResponse?.Date || [],
      kind,
      factoryNo ? [factoryNo] : [],
    );

    return {
      date,
      latestReading: matchedReadings[0] || null,
      readingCount: matchedReadings.length,
      status: matchedReadings.length > 0 ? 'found' : 'not-found',
    };
  });
}

export function flattenYmsinoDailyFreezeChecks(
  checks: ReturnType<typeof buildYmsinoDailyFreezeChecks>,
) {
  return checks.flatMap((item) =>
    item.latestReading ? [item.latestReading] : [],
  );
}

export function normalizeYmsinoFrozenReading(
  item: YmsinoTranDayItem,
  kind: YmsinoMeterKind,
): YmsinoFrozenReading {
  const device = normalizeYmsinoDevice(item, kind);
  return {
    comAddress: device.factoryNo,
    comtype: getYmsinoComType(kind),
    currentRatio: device.currentRatio,
    dataItemName:
      kind === 'electric' ? 'Forward active energy' : 'Cumulative flow',
    dataValue: normalizeText(item.ZTotal),
    dataValue1: normalizeText(item.ZTip),
    dataValue2: normalizeText(item.ZPeak),
    dataValue3: normalizeText(item.ZComm),
    dataValue4: normalizeText(item.ZVale),
    deviceId: device.deviceId,
    deviceStatus: 'reported-reading-only',
    factoryNo: device.factoryNo,
    freezeTime: normalizeText(item.TranDate),
    multiplier: device.multiplier,
    parkId: device.parkId,
    parkName: device.parkName,
    proCode: device.roomId,
    protocol: device.protocol,
    readAt: normalizeText(item.TranDate),
    raw: item,
    roomId: device.roomId,
    roomName: device.roomName,
    source: 'ymsino',
    tenantId: device.tenantId,
    tenantName: device.tenantName,
    writeTime: normalizeText(item.TranDate),
  };
}

export function filterYmsinoFrozenReadings(
  list: YmsinoTranDayItem[],
  kind: YmsinoMeterKind,
  comAddresses: string[],
) {
  const addressSet = new Set(comAddresses);
  const readings = list.map((item) => normalizeYmsinoFrozenReading(item, kind));
  if (addressSet.size === 0) return readings;
  return readings.filter((item) => addressSet.has(item.comAddress));
}

export function buildYmsinoDeviceTree(list: YmsinoDeviceRecord[]) {
  const root: Record<string, any> = {};

  for (const item of list) {
    const parkKey = item.parkId || 'unknown-park';
    const roomKey = item.roomId || 'unknown-room';
    const deviceKey = item.factoryNo || item.deviceId;
    if (!deviceKey) continue;

    if (!root[parkKey]) {
      root[parkKey] = {
        children: {},
        key: parkKey,
        title: item.parkName || parkKey,
      };
    }

    const parkNode = root[parkKey];
    if (!parkNode.children[roomKey]) {
      parkNode.children[roomKey] = {
        children: {},
        key: `${parkKey}/${roomKey}`,
        title: item.roomName || roomKey,
      };
    }

    parkNode.children[roomKey].children[deviceKey] = {
      dataRef: item,
      isLeaf: true,
      key: `${parkKey}/${roomKey}/${deviceKey}`,
      title: deviceKey,
    };
  }

  return objectTreeToArray(root);
}

export function normalizeYmsinoRechargeCommand(
  response: YmsinoRechargeResponse,
  action: 'deviceRecharge' | 'tenantRecharge',
  commandId?: string,
): YmsinoCommandResult<YmsinoRechargeResponse> {
  const ok = isYmsinoCommandAccepted(response);
  return {
    action,
    commandSent: true,
    commandId:
      normalizeText(response.Sid) ||
      normalizeText(commandId) ||
      makeFallbackCommandId(action),
    confirmationSource: 'vendor-response',
    deviceAcknowledged: false,
    deviceId: normalizeText(response.Dev),
    errorCode: ok ? undefined : normalizeText(response.Code),
    executed: false,
    failedReason: ok ? undefined : normalizeText(response.Msg),
    factoryNo: normalizeText(response.Dev),
    missingClosureFields: getMissingCommandClosureFields(),
    phase: ok ? 'acknowledged' : 'failed',
    raw: response,
    received: ok,
    resultCallbackRequired: true,
    retryable: !ok,
    sid: normalizeText(response.Sid),
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  };
}

export function normalizeYmsinoOnOffCommand(
  response: YmsinoOnOffResponse,
  action: 'switchOff' | 'switchOn',
  commandId?: string,
): YmsinoCommandResult<YmsinoOnOffResponse> {
  const ok =
    isYmsinoCommandAccepted(response) || normalizeText(response.State) === '1';
  return {
    action,
    commandSent: true,
    commandId: normalizeText(commandId) || makeFallbackCommandId(action),
    confirmationSource: 'vendor-response',
    deviceAcknowledged: false,
    deviceId: normalizeText(response.Dev),
    errorCode: ok ? undefined : normalizeText(response.Code),
    executed: false,
    failedReason: ok ? undefined : normalizeText(response.Msg),
    factoryNo: normalizeText(response.Dev),
    missingClosureFields: getMissingCommandClosureFields(),
    phase: ok ? 'acknowledged' : 'failed',
    raw: response,
    received: ok,
    resultCallbackRequired: true,
    retryable: !ok,
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  };
}

export function unsupportedYmsinoCommand(
  action: string,
  reason: string,
): YmsinoCommandResult {
  return {
    action,
    commandSent: false,
    commandId: makeFallbackCommandId(action),
    confirmationSource: 'none',
    deviceAcknowledged: false,
    executed: false,
    failedReason: reason,
    missingClosureFields: getMissingCommandClosureFields(),
    phase: 'unsupported',
    received: false,
    resultCallbackRequired: true,
    retryable: false,
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  };
}

export function notApplicableYmsinoCommand(
  action: string,
  reason: string,
): YmsinoCommandResult {
  return {
    action,
    commandSent: false,
    commandId: makeFallbackCommandId(action),
    confirmationSource: 'none',
    deviceAcknowledged: false,
    executed: false,
    failedReason: reason,
    missingClosureFields: [],
    phase: 'unsupported',
    received: false,
    resultCallbackRequired: false,
    retryable: false,
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  };
}

export function ensureYmsinoSuccess<
  T extends { Code?: number | string; Msg?: string },
>(response: T, message: string) {
  if (isYmsinoReadSuccess(response)) return;
  const code = response?.Code === undefined ? 'UNKNOWN' : String(response.Code);
  throw createYmsinoError(`${message}: ${response?.Msg || code}`, code);
}

export function createYmsinoError(message: string, code = 'YMSINO_ERROR') {
  return Object.assign(new Error(message), { code });
}

function objectTreeToArray(map: Record<string, any>): any[] {
  return Object.keys(map).map((key) => {
    const node = map[key];
    if (node.children) {
      return {
        children: objectTreeToArray(node.children),
        key: node.key,
        title: node.title,
      };
    }
    return node;
  });
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function formatRatio(pt: string, ct: string) {
  const parts = [];
  if (pt) parts.push(`Pt:${pt}`);
  if (ct) parts.push(`Ct:${ct}`);
  return parts.join(' ');
}

function calculateMultiplier(pt: string, ct: string) {
  const ptValue = Number(pt);
  const ctValue = Number(ct);
  if (Number.isFinite(ptValue) && Number.isFinite(ctValue)) {
    return ptValue * ctValue;
  }
  if (Number.isFinite(ptValue)) return ptValue;
  if (Number.isFinite(ctValue)) return ctValue;
  return 1;
}

function isYmsinoReadSuccess(response: { Code?: number | string }) {
  const code = response?.Code;
  const normalizedCode = normalizeText(code).toLowerCase();
  return (
    code === undefined ||
    YMSINO_READ_SUCCESS_CODES.has(String(code)) ||
    ['success', 'true'].includes(normalizedCode)
  );
}

function isYmsinoCommandAccepted(response: { Code?: number | string }) {
  const code = response?.Code;
  return code !== undefined && YMSINO_COMMAND_SUCCESS_CODES.has(String(code));
}

function makeFallbackCommandId(action: string) {
  return `${action}-${Date.now()}`;
}

function getMissingCommandClosureFields() {
  return [
    'device receipt acknowledgement',
    'device execution result',
    'final device state callback/query',
    'vendor timeout retry policy',
  ];
}

function parseSuccessCodes(value: string) {
  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}
