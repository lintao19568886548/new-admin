import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { getDevice, getHDMData } from '~/utils/thirdparty/hezhong';

const WATER_COM_TYPE = 'HS.BLHQW.DWWF8-NG811';
const DEFAULT_PROJ_CODE = '241';
const MONTH_COUNT = 12;

interface AuthorizedPark {
  parkId: number;
  parkName: string;
}

interface WaterDevice {
  address: string;
  comAddress: string;
  piplineName: string;
}

interface WaterReading {
  comAddress: string;
  dataValue: unknown;
  freezeTime: unknown;
}

function createEmptyStats(year: number, message?: string) {
  return {
    hasData: false,
    message,
    months: Array.from({ length: MONTH_COUNT }).map(
      (_item, index) => `${index + 1}月`,
    ),
    water: {
      consumption: Array.from({ length: MONTH_COUNT }, () => 0),
      monthOnMonth: Array.from({ length: MONTH_COUNT }, () => 0),
      yearOnYear: Array.from({ length: MONTH_COUNT }, () => 0),
    },
    year,
  };
}

function formatDateTime(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

function parseMonth(value: unknown): null | string {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatMonth(date);
}

function toNumber(value: unknown) {
  const normalized = String(value ?? '')
    .replaceAll(',', '')
    .trim();
  const numberValue = Number(normalized);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundPercent(value: number) {
  return Number(value.toFixed(2));
}

function roundConsumption(value: number) {
  return Number(value.toFixed(2));
}

function calcPercentChange(current: number, previous: number) {
  if (previous === 0) {
    return 0;
  }

  return roundPercent(((current - previous) / previous) * 100);
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .replaceAll(/\s+/g, '')
    .toLowerCase();
}

function normalizeDevices(res: any): WaterDevice[] {
  const list = res?.data?.records ?? res?.records ?? [];
  const records = Array.isArray(list) ? list : [list];

  return records
    .map((item: any) => ({
      address: String(item?.address ?? ''),
      comAddress: String(item?.comAddress ?? ''),
      piplineName: String(item?.piplineName ?? ''),
    }))
    .filter((item) => item.comAddress);
}

function normalizeReadings(res: any): WaterReading[] {
  const list =
    (res?.data?.records ??
      res?.records ??
      res?.data?.items ??
      res?.items ??
      []) ||
    [];
  const records = Array.isArray(list) ? list : [list];

  return records
    .map((item: any) => ({
      comAddress: String(item?.comAddress ?? ''),
      dataValue: item?.dataValue,
      freezeTime: item?.freezeTime,
    }))
    .filter((item) => item.comAddress);
}

function getTotal(res: any, fallback: number) {
  const total = Number(res?.data?.total ?? res?.total ?? fallback);

  return Number.isFinite(total) ? total : fallback;
}

function resolveParks(
  queryParkId: unknown,
  authorizedParks: AuthorizedPark[],
): AuthorizedPark[] | null {
  if (queryParkId === undefined || queryParkId === 'all') {
    return authorizedParks;
  }

  const parkId = Number(queryParkId);
  if (!Number.isFinite(parkId)) {
    return null;
  }

  const park = authorizedParks.find((item) => item.parkId === parkId);

  return park ? [park] : null;
}

function isDeviceInParks(device: WaterDevice, parks: AuthorizedPark[]) {
  const haystack = normalizeText(
    `${device.address} ${device.piplineName} ${device.comAddress}`,
  );

  return parks.some((park) => {
    const parkName = normalizeText(park.parkName);

    return parkName && haystack.includes(parkName);
  });
}

async function fetchAllWaterDevices(projCode: string) {
  const pageSize = 1000;
  const devices: WaterDevice[] = [];

  for (let page = 1; page <= 50; page++) {
    const res = await getDevice({
      comtype: WATER_COM_TYPE,
      page: String(page),
      pageSize: String(pageSize),
      projCode,
    });
    const pageDevices = normalizeDevices(res);
    devices.push(...pageDevices);

    const total = getTotal(res, devices.length);
    if (devices.length >= total || pageDevices.length === 0) {
      break;
    }
  }

  return devices;
}

async function fetchWaterReadings(params: {
  projCode: string;
  timeFrom: string;
  timeTo: string;
}) {
  const pageSize = 1000;
  const readings: WaterReading[] = [];

  for (let page = 1; page <= 100; page++) {
    const res = await getHDMData({
      comType: WATER_COM_TYPE,
      page: String(page),
      pageSize: String(pageSize),
      projCode: params.projCode,
      timeFrom: params.timeFrom,
      timeTo: params.timeTo,
      type: '3',
    });
    const pageReadings = normalizeReadings(res);
    readings.push(...pageReadings);

    const total = getTotal(res, readings.length);
    if (readings.length >= total || pageReadings.length === 0) {
      break;
    }
  }

  return readings;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const now = new Date();
  const year = Number(query.year || now.getFullYear());
  const normalizedYear = Number.isFinite(year) ? year : now.getFullYear();
  const projCode = String(query.projCode || DEFAULT_PROJ_CODE);

  try {
    const authorizedParks =
      userinfo.parks
        ?.map((park) => ({
          parkId: Number(park.parkId),
          parkName: String(park.parkName || ''),
        }))
        .filter((park) => Number.isFinite(park.parkId) && park.parkName) ?? [];

    if (authorizedParks.length === 0) {
      return useResponseSuccess(
        createEmptyStats(
          normalizedYear,
          '当前用户没有可查看园区，暂无水耗数据',
        ),
      );
    }

    const parks = resolveParks(query.parkId, authorizedParks);
    if (!parks) {
      return useResponseSuccess(
        createEmptyStats(
          normalizedYear,
          '当前用户没有该园区权限，暂无水耗数据',
        ),
      );
    }

    const devices = await fetchAllWaterDevices(projCode);
    const permittedDevices = devices.filter((device) =>
      isDeviceInParks(device, parks),
    );

    if (permittedDevices.length === 0) {
      return useResponseSuccess(
        createEmptyStats(
          normalizedYear,
          '当前权限范围内未匹配到水表设备，暂无水耗数据',
        ),
      );
    }

    const permittedAddressSet = new Set(
      permittedDevices.map((device) => device.comAddress),
    );
    const timeFrom = formatDateTime(new Date(normalizedYear - 1, 0, 1));
    const timeTo = formatDateTime(
      new Date(normalizedYear, MONTH_COUNT, 0, 23, 59, 59, 999),
    );
    const readings = await fetchWaterReadings({
      projCode,
      timeFrom,
      timeTo,
    });
    const monthTotals = new Map<string, number>();
    let currentYearRecordCount = 0;

    for (const reading of readings) {
      if (!permittedAddressSet.has(reading.comAddress)) {
        continue;
      }

      const month = parseMonth(reading.freezeTime);
      if (!month) {
        continue;
      }

      if (month.startsWith(`${normalizedYear}-`)) {
        currentYearRecordCount++;
      }

      monthTotals.set(
        month,
        (monthTotals.get(month) || 0) + toNumber(reading.dataValue),
      );
    }

    const consumption = Array.from({ length: MONTH_COUNT }).map(
      (_item, index) =>
        roundConsumption(
          monthTotals.get(
            `${normalizedYear}-${String(index + 1).padStart(2, '0')}`,
          ) || 0,
        ),
    );
    const monthOnMonth = consumption.map((value, index) => {
      const previous =
        index === 0
          ? monthTotals.get(`${normalizedYear - 1}-12`) || 0
          : consumption[index - 1] || 0;

      return calcPercentChange(value, previous);
    });
    const yearOnYear = consumption.map((value, index) => {
      const previous =
        monthTotals.get(
          `${normalizedYear - 1}-${String(index + 1).padStart(2, '0')}`,
        ) || 0;

      return calcPercentChange(value, previous);
    });
    const hasData = currentYearRecordCount > 0;

    return useResponseSuccess({
      hasData,
      message: hasData
        ? undefined
        : '当前年份未查询到水表抄录数据，暂无水耗数据',
      months: Array.from({ length: MONTH_COUNT }).map(
        (_item, index) => `${index + 1}月`,
      ),
      water: {
        consumption,
        monthOnMonth,
        yearOnYear,
      },
      year: normalizedYear,
    });
  } catch (error) {
    console.error('获取能源水耗数据失败:', error);
    return serverErrorResponse('获取能源水耗数据失败', event);
  }
});
