import dayjs from 'dayjs';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { getDevice, getHDMData } from '~/utils/thirdparty/hezhong';

const DEFAULT_PROJ_CODE = '241';
const ELECTRICITY_COM_TYPE = 'D.ZDG.FIWBM-GD04';
const WATER_COM_TYPE = 'HS.BLHQW.DWWF8-NG811';

type MeterStatisticsDateType = 'day' | 'month';
type MeterStatisticsType = 'electricity' | 'water';

interface AuthorizedPark {
  parkId: number;
  parkName: string;
}

interface MeterDevice {
  address: string;
  comAddress: string;
  piplineName: string;
}

interface MeterReading {
  comAddress: string;
  dataValue: unknown;
  dataValue1: unknown;
  dataValue2: unknown;
  dataValue3: unknown;
  dataValue4: unknown;
  freezeTime: unknown;
}

function createEmptyStats(params: {
  dateType: MeterStatisticsDateType;
  message?: string;
  selectedDate: string;
  statisticsType: MeterStatisticsType;
}) {
  return {
    dateType: params.dateType,
    dayNight: [
      { name: '白天', value: 0 },
      { name: '夜晚', value: 0 },
    ],
    hasData: false,
    message: params.message,
    peakValley:
      params.statisticsType === 'electricity'
        ? [
            { name: '尖', value: 0 },
            { name: '峰', value: 0 },
            { name: '平', value: 0 },
            { name: '谷', value: 0 },
          ]
        : [],
    selectedDate: params.selectedDate,
    statisticsType: params.statisticsType,
    summary: {
      deviceCount: 0,
      recordCount: 0,
      total: 0,
    },
    waterTrend: {
      times: [],
      values: [],
    },
  };
}

function toNumber(value: unknown) {
  const normalized = String(value ?? '')
    .replaceAll(',', '')
    .trim();
  const numberValue = Number(normalized);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundValue(value: number) {
  return Number(value.toFixed(2));
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .replaceAll(/\s+/g, '')
    .toLowerCase();
}

function normalizeDevices(res: any): MeterDevice[] {
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

function normalizeReadings(res: any): MeterReading[] {
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
      dataValue1: item?.dataValue1,
      dataValue2: item?.dataValue2,
      dataValue3: item?.dataValue3,
      dataValue4: item?.dataValue4,
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

function isDeviceInParks(device: MeterDevice, parks: AuthorizedPark[]) {
  const haystack = normalizeText(
    `${device.address} ${device.piplineName} ${device.comAddress}`,
  );

  return parks.some((park) => {
    const parkName = normalizeText(park.parkName);

    return parkName && haystack.includes(parkName);
  });
}

function resolveStatisticsType(value: unknown): MeterStatisticsType {
  return value === 'water' ? 'water' : 'electricity';
}

function resolveDateType(value: unknown): MeterStatisticsDateType {
  return value === 'day' ? 'day' : 'month';
}

function resolveDateRange(value: unknown, dateType: MeterStatisticsDateType) {
  const now = dayjs();
  const rawDate = String(value || '');
  const parsedDate = rawDate ? dayjs(rawDate) : now;
  const safeDate = parsedDate.isValid() ? parsedDate : now;
  const start =
    dateType === 'day' ? safeDate.startOf('day') : safeDate.startOf('month');
  const end =
    dateType === 'day' ? safeDate.endOf('day') : safeDate.endOf('month');

  return {
    selectedDate: start.format(dateType === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'),
    timeFrom: start.format('YYYY-MM-DD HH:mm:ss'),
    timeTo: end.format('YYYY-MM-DD HH:mm:ss'),
  };
}

function isDaytimeReading(value: unknown) {
  const date = dayjs(String(value || ''));

  if (!date.isValid()) {
    return true;
  }

  const hour = date.hour();

  return hour >= 6 && hour < 18;
}

async function fetchAllDevices(params: { comType: string; projCode: string }) {
  const pageSize = 1000;
  const devices: MeterDevice[] = [];

  for (let page = 1; page <= 50; page++) {
    const res = await getDevice({
      comtype: params.comType,
      page: String(page),
      pageSize: String(pageSize),
      projCode: params.projCode,
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

async function fetchReadings(params: {
  comType: string;
  projCode: string;
  timeFrom: string;
  timeTo: string;
  type: string;
}) {
  const pageSize = 1000;
  const readings: MeterReading[] = [];

  for (let page = 1; page <= 100; page++) {
    const res = await getHDMData({
      comType: params.comType,
      page: String(page),
      pageSize: String(pageSize),
      projCode: params.projCode,
      timeFrom: params.timeFrom,
      timeTo: params.timeTo,
      type: params.type,
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

function filterPermittedReadings(
  readings: MeterReading[],
  permittedAddressSet: Set<string>,
) {
  return readings.filter((reading) =>
    permittedAddressSet.has(reading.comAddress),
  );
}

function filterReadingsByDateRange(
  readings: MeterReading[],
  dateRange: { timeFrom: string; timeTo: string },
) {
  const start = dayjs(dateRange.timeFrom);
  const end = dayjs(dateRange.timeTo);

  if (!start.isValid() || !end.isValid()) {
    return readings;
  }

  const startTime = start.valueOf();
  const endTime = end.valueOf();

  return readings.filter((reading) => {
    const freezeDate = dayjs(String(reading.freezeTime || ''));

    if (!freezeDate.isValid()) {
      return false;
    }

    const freezeTime = freezeDate.valueOf();

    return freezeTime >= startTime && freezeTime <= endTime;
  });
}

function buildPeakValleyData(readings: MeterReading[]) {
  const totals = {
    flat: 0,
    peak: 0,
    sharp: 0,
    valley: 0,
  };

  for (const reading of readings) {
    totals.sharp += toNumber(reading.dataValue1);
    totals.peak += toNumber(reading.dataValue2);
    totals.flat += toNumber(reading.dataValue3);
    totals.valley += toNumber(reading.dataValue4);
  }

  return [
    { name: '尖', value: roundValue(totals.sharp) },
    { name: '峰', value: roundValue(totals.peak) },
    { name: '平', value: roundValue(totals.flat) },
    { name: '谷', value: roundValue(totals.valley) },
  ];
}

function buildDayNightData(readings: MeterReading[]) {
  const totals = {
    day: 0,
    night: 0,
  };

  for (const reading of readings) {
    const value = toNumber(reading.dataValue);

    if (isDaytimeReading(reading.freezeTime)) {
      totals.day += value;
    } else {
      totals.night += value;
    }
  }

  return [
    { name: '白天', value: roundValue(totals.day) },
    { name: '夜晚', value: roundValue(totals.night) },
  ];
}

function sumChartData(data: { value: number }[]) {
  let total = 0;

  for (const item of data) {
    total += item.value;
  }

  return total;
}

function sumValues(data: number[]) {
  let total = 0;

  for (const item of data) {
    total += item;
  }

  return total;
}

function buildWaterTrendData(params: {
  dateType: MeterStatisticsDateType;
  readings: MeterReading[];
  selectedDate: string;
}) {
  if (params.dateType === 'month') {
    const monthDate = dayjs(`${params.selectedDate}-01`);
    const daysInMonth = monthDate.isValid() ? monthDate.daysInMonth() : 31;
    const totals = Array.from({ length: daysInMonth }, () => 0);

    for (const reading of params.readings) {
      const freezeDate = dayjs(String(reading.freezeTime || ''));

      if (!freezeDate.isValid()) {
        continue;
      }

      const dayIndex = freezeDate.date() - 1;

      if (dayIndex >= 0 && dayIndex < totals.length) {
        totals[dayIndex] += toNumber(reading.dataValue);
      }
    }

    return {
      times: Array.from({ length: daysInMonth }).map(
        (_item, index) => `${index + 1}日`,
      ),
      values: totals.map((item) => roundValue(item)),
    };
  }

  const hourTotals = Array.from({ length: 24 }, () => 0);

  for (const reading of params.readings) {
    const freezeDate = dayjs(String(reading.freezeTime || ''));

    if (!freezeDate.isValid()) {
      continue;
    }

    const hour = freezeDate.hour();

    if (hour >= 0 && hour < hourTotals.length) {
      hourTotals[hour] += toNumber(reading.dataValue);
    }
  }

  return {
    times: Array.from({ length: 24 }).map((_item, index) => `${index}时`),
    values: hourTotals.map((item) => roundValue(item)),
  };
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const statisticsType = resolveStatisticsType(query.type);
  const dateType = resolveDateType(query.dateType);
  const dateRange = resolveDateRange(query.date, dateType);
  const projCode = String(query.projCode || DEFAULT_PROJ_CODE);
  const comType =
    statisticsType === 'water' ? WATER_COM_TYPE : ELECTRICITY_COM_TYPE;

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
        createEmptyStats({
          dateType,
          message: '当前用户没有可查看园区，暂无表计统计数据',
          selectedDate: dateRange.selectedDate,
          statisticsType,
        }),
      );
    }

    const parks = resolveParks(query.parkId, authorizedParks);
    if (!parks) {
      return useResponseSuccess(
        createEmptyStats({
          dateType,
          message: '当前用户没有该园区权限，暂无表计统计数据',
          selectedDate: dateRange.selectedDate,
          statisticsType,
        }),
      );
    }

    const devices = await fetchAllDevices({ comType, projCode });
    const permittedDevices = devices.filter((device) =>
      isDeviceInParks(device, parks),
    );

    if (permittedDevices.length === 0) {
      return useResponseSuccess(
        createEmptyStats({
          dateType,
          message:
            statisticsType === 'water'
              ? '当前权限范围内未匹配到水表设备，暂无表计统计数据'
              : '当前权限范围内未匹配到电表设备，暂无表计统计数据',
          selectedDate: dateRange.selectedDate,
          statisticsType,
        }),
      );
    }

    const permittedAddressSet = new Set(
      permittedDevices.map((device) => device.comAddress),
    );
    const peakValleyType = dateType === 'month' ? '2' : '1';
    const waterTrendType = dateType === 'month' ? '2' : '1';
    let hourlyReadings: MeterReading[] = [];
    let peakValleyReadings: MeterReading[] = [];
    let waterTrendReadings: MeterReading[] = [];

    if (statisticsType === 'electricity') {
      if (dateType === 'day') {
        hourlyReadings = await fetchReadings({
          comType,
          projCode,
          timeFrom: dateRange.timeFrom,
          timeTo: dateRange.timeTo,
          type: '1',
        });
        peakValleyReadings = hourlyReadings;
      } else {
        [peakValleyReadings, hourlyReadings] = await Promise.all([
          fetchReadings({
            comType,
            projCode,
            timeFrom: dateRange.timeFrom,
            timeTo: dateRange.timeTo,
            type: peakValleyType,
          }),
          fetchReadings({
            comType,
            projCode,
            timeFrom: dateRange.timeFrom,
            timeTo: dateRange.timeTo,
            type: '1',
          }),
        ]);
      }
    } else {
      waterTrendReadings = await fetchReadings({
        comType,
        projCode,
        timeFrom: dateRange.timeFrom,
        timeTo: dateRange.timeTo,
        type: waterTrendType,
      });
    }

    const permittedPeakValleyReadings = filterPermittedReadings(
      filterReadingsByDateRange(peakValleyReadings, dateRange),
      permittedAddressSet,
    );
    const permittedHourlyReadings = filterPermittedReadings(
      filterReadingsByDateRange(hourlyReadings, dateRange),
      permittedAddressSet,
    );
    const permittedWaterTrendReadings = filterPermittedReadings(
      filterReadingsByDateRange(waterTrendReadings, dateRange),
      permittedAddressSet,
    );
    const peakValley =
      statisticsType === 'electricity'
        ? buildPeakValleyData(permittedPeakValleyReadings)
        : [];
    const dayNight =
      statisticsType === 'electricity'
        ? buildDayNightData(permittedHourlyReadings)
        : [];
    const waterTrend =
      statisticsType === 'water'
        ? buildWaterTrendData({
            dateType,
            readings: permittedWaterTrendReadings,
            selectedDate: dateRange.selectedDate,
          })
        : {
            times: [],
            values: [],
          };
    let recordCount = permittedWaterTrendReadings.length;
    if (statisticsType === 'electricity') {
      recordCount =
        dateType === 'day'
          ? permittedHourlyReadings.length
          : permittedPeakValleyReadings.length + permittedHourlyReadings.length;
    }
    const total =
      statisticsType === 'electricity'
        ? Math.max(sumChartData(peakValley), sumChartData(dayNight))
        : sumValues(waterTrend.values);
    const hasData = recordCount > 0;

    return useResponseSuccess({
      dateType,
      dayNight,
      hasData,
      message: hasData ? undefined : '当前时间范围未查询到抄表数据',
      peakValley,
      selectedDate: dateRange.selectedDate,
      statisticsType,
      summary: {
        deviceCount: permittedDevices.length,
        recordCount,
        total: roundValue(total),
      },
      waterTrend,
    });
  } catch (error) {
    console.error('获取表计数量统计数据失败:', error);
    return serverErrorResponse('获取表计数量统计数据失败', event);
  }
});
