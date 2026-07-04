import dayjs from 'dayjs';
import { prismaClient } from '~/utils/db';
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
const THIRD_PARTY_UNAVAILABLE_MESSAGE =
  '表计平台响应超时，已返回本地可用统计数据';

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

interface AmountBillEleItemCell {
  originalText?: unknown;
  value?: unknown;
}

interface AmountBillEleItemRow {
  meterName?: unknown;
  monthlyUsage?: unknown;
  totalUsage?: unknown;
  [key: string]: unknown;
}

interface AmountBillWaterItemRecord {
  createTime: Date | null;
  waterItem: null | string;
}

interface MeterFetchResult<T> {
  items: T[];
  unavailable: boolean;
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
      { name: '普通表', value: 0 },
      { name: '时段表', value: 0 },
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

function resolveDateRangeFromQuery(input: {
  date?: unknown;
  dateType: MeterStatisticsDateType;
  endDate?: unknown;
  startDate?: unknown;
}) {
  const start = dayjs(String(input.startDate || ''));
  const end = dayjs(String(input.endDate || ''));

  if (start.isValid() && end.isValid()) {
    const safeStart = start.isAfter(end) ? end : start;
    const safeEnd = start.isAfter(end) ? start : end;
    const timeFrom =
      input.dateType === 'day'
        ? safeStart.startOf('day')
        : safeStart.startOf('month');
    const timeTo =
      input.dateType === 'day' ? safeEnd.endOf('day') : safeEnd.endOf('month');
    const selectedDate =
      input.dateType === 'day'
        ? `${safeStart.format('YYYY-MM-DD')}~${safeEnd.format('YYYY-MM-DD')}`
        : `${timeFrom.format('YYYY-MM')}~${timeTo.format('YYYY-MM')}`;

    return {
      selectedDate,
      timeFrom: timeFrom.format('YYYY-MM-DD HH:mm:ss'),
      timeTo: timeTo.format('YYYY-MM-DD HH:mm:ss'),
    };
  }

  return resolveDateRange(input.date, input.dateType);
}

function getBillDataMonth(createTime: Date | null) {
  if (!createTime) {
    return null;
  }

  return dayjs(createTime).subtract(1, 'month').format('YYYY-MM');
}

function resolveAmountBillCreateTimeRange(selectedMonth: string) {
  const parsedMonth = dayjs(`${selectedMonth}-01`);
  const safeMonth = parsedMonth.isValid()
    ? parsedMonth
    : dayjs().startOf('month');
  const createTimeStart = safeMonth.add(1, 'month').startOf('month');
  const createTimeEnd = createTimeStart.add(1, 'month');

  return {
    createTimeEnd: createTimeEnd.toDate(),
    createTimeStart: createTimeStart.toDate(),
  };
}

function resolveAmountBillCreateTimeRangeForMonths(months: string[]) {
  const sortedMonths = [...months].sort();
  const firstMonth = sortedMonths[0];
  const lastMonth = sortedMonths.at(-1);

  if (!firstMonth || !lastMonth) {
    return resolveAmountBillCreateTimeRange(dayjs().format('YYYY-MM'));
  }

  const startMonth = dayjs(`${firstMonth}-01`);
  const endMonth = dayjs(`${lastMonth}-01`);

  return {
    createTimeEnd: endMonth.add(2, 'month').startOf('month').toDate(),
    createTimeStart: startMonth.add(1, 'month').startOf('month').toDate(),
  };
}

function resolveDateRangeMonths(dateRange: {
  timeFrom: string;
  timeTo: string;
}) {
  const start = dayjs(dateRange.timeFrom).startOf('month');
  const end = dayjs(dateRange.timeTo).startOf('month');

  if (!start.isValid() || !end.isValid()) {
    return [dayjs().format('YYYY-MM')];
  }

  const months: string[] = [];
  let current = start;
  while (current.isBefore(end) || current.isSame(end, 'month')) {
    months.push(current.format('YYYY-MM'));
    current = current.add(1, 'month');
  }

  return months;
}

function getEleItemCellValue(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const cell = value as AmountBillEleItemCell;

  if (cell.value !== undefined) {
    return cell.value;
  }

  return cell.originalText;
}

function parseAmountBillEleItems(value: unknown): AmountBillEleItemRow[] {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is AmountBillEleItemRow =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item),
        )
      : [];
  } catch {
    return [];
  }
}

type PeakValleyCategory = 'flat' | 'peak' | 'sharp' | 'valley';

function resolvePeakValleyCategory(
  meterName: unknown,
): null | PeakValleyCategory {
  const normalized = normalizeText(getEleItemCellValue(meterName));

  if (!normalized || normalized.includes('合计')) {
    return null;
  }

  if (normalized === '尖' || normalized.startsWith('尖')) {
    return 'sharp';
  }

  if (normalized === '峰' || normalized.startsWith('峰')) {
    return 'peak';
  }

  if (normalized === '平' || normalized.startsWith('平')) {
    return 'flat';
  }

  if (normalized === '谷' || normalized.startsWith('谷')) {
    return 'valley';
  }

  return null;
}

function resolveAmountBillItemUsage(item: AmountBillEleItemRow) {
  const totalUsage = toNumber(getEleItemCellValue(item.totalUsage));

  if (totalUsage !== 0) {
    return totalUsage;
  }

  return toNumber(getEleItemCellValue(item.monthlyUsage));
}

function isEmptyOrTotalAmountBillMeterName(meterName: unknown) {
  const normalized = normalizeText(getEleItemCellValue(meterName));

  return !normalized || normalized.includes('合计');
}

function buildMeterCategoryDataFromAmountBills(
  bills: Array<{ createTime: Date | null; eleItem: null | string }>,
  selectedMonths: Set<string>,
) {
  let ordinary = 0;
  let timeOfUse = 0;
  let recordCount = 0;

  for (const bill of bills) {
    const dataMonth = getBillDataMonth(bill.createTime);
    if (!dataMonth || !selectedMonths.has(dataMonth)) {
      continue;
    }

    const items = parseAmountBillEleItems(bill.eleItem);

    for (const item of items) {
      if (isEmptyOrTotalAmountBillMeterName(item.meterName)) {
        continue;
      }

      const usage = resolveAmountBillItemUsage(item);

      if (resolvePeakValleyCategory(item.meterName)) {
        timeOfUse += usage;
      } else {
        ordinary += usage;
      }
      recordCount++;
    }
  }

  return {
    dayNight: [
      { name: '普通表', value: roundValue(ordinary) },
      { name: '时段表', value: roundValue(timeOfUse) },
    ],
    recordCount,
  };
}

function buildPeakValleyDataFromAmountBills(
  bills: Array<{ createTime: Date | null; eleItem: null | string }>,
  selectedMonths: Set<string>,
) {
  const totals = {
    flat: 0,
    peak: 0,
    sharp: 0,
    valley: 0,
  };
  let recordCount = 0;

  for (const bill of bills) {
    const dataMonth = getBillDataMonth(bill.createTime);
    if (!dataMonth || !selectedMonths.has(dataMonth)) {
      continue;
    }

    const items = parseAmountBillEleItems(bill.eleItem);

    for (const item of items) {
      const category = resolvePeakValleyCategory(item.meterName);

      if (!category) {
        continue;
      }

      totals[category] += resolveAmountBillItemUsage(item);
      recordCount++;
    }
  }

  return {
    peakValley: [
      { name: '尖', value: roundValue(totals.sharp) },
      { name: '峰', value: roundValue(totals.peak) },
      { name: '平', value: roundValue(totals.flat) },
      { name: '谷', value: roundValue(totals.valley) },
    ],
    recordCount,
  };
}

function buildWaterTrendDataFromAmountBills(
  bills: AmountBillWaterItemRecord[],
  selectedMonths: string[],
) {
  const selectedMonthSet = new Set(selectedMonths);
  const totals = new Map(selectedMonths.map((month) => [month, 0]));
  let recordCount = 0;

  for (const bill of bills) {
    const dataMonth = getBillDataMonth(bill.createTime);
    if (!dataMonth || !selectedMonthSet.has(dataMonth)) {
      continue;
    }

    const items = parseAmountBillEleItems(bill.waterItem);

    for (const item of items) {
      if (isEmptyOrTotalAmountBillMeterName(item.meterName)) {
        continue;
      }

      totals.set(
        dataMonth,
        (totals.get(dataMonth) || 0) + resolveAmountBillItemUsage(item),
      );
      recordCount++;
    }
  }

  return {
    recordCount,
    waterTrend: {
      times: selectedMonths,
      values: selectedMonths.map((month) => roundValue(totals.get(month) || 0)),
    },
  };
}

function isRecoverableThirdPartyError(error: unknown) {
  const err = error as {
    code?: string;
    isAxiosError?: boolean;
    message?: string;
    response?: { status?: number };
  };
  const code = String(err?.code || '');
  const status = Number(err?.response?.status);

  return (
    err?.isAxiosError === true &&
    ([
      'EAI_AGAIN',
      'ECONNABORTED',
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
    ].includes(code) ||
      (Number.isFinite(status) && status >= 500) ||
      String(err.message || '')
        .toLowerCase()
        .includes('timeout'))
  );
}

function getThirdPartyErrorSummary(error: unknown) {
  const err = error as {
    code?: string;
    config?: {
      baseURL?: string;
      method?: string;
      params?: unknown;
      url?: string;
    };
    message?: string;
    response?: { status?: number };
  };

  return {
    baseURL: err?.config?.baseURL,
    code: err?.code,
    message: err?.message,
    method: err?.config?.method,
    params: err?.config?.params,
    status: err?.response?.status,
    url: err?.config?.url,
  };
}

async function fetchAllDevices(params: {
  comType: string;
  projCode: string;
}): Promise<MeterFetchResult<MeterDevice>> {
  const pageSize = 1000;
  const devices: MeterDevice[] = [];
  let unavailable = false;

  for (let page = 1; page <= 50; page++) {
    let res: any;
    try {
      res = await getDevice({
        comtype: params.comType,
        page: String(page),
        pageSize: String(pageSize),
        projCode: params.projCode,
      });
    } catch (error) {
      if (!isRecoverableThirdPartyError(error)) {
        throw error;
      }
      unavailable = true;
      console.warn(
        '[dashboard/meter-statistics] getDevice unavailable:',
        getThirdPartyErrorSummary(error),
      );
      break;
    }
    const pageDevices = normalizeDevices(res);
    devices.push(...pageDevices);

    const total = getTotal(res, devices.length);
    if (devices.length >= total || pageDevices.length === 0) {
      break;
    }
  }

  return { items: devices, unavailable };
}

async function fetchReadings(params: {
  comType: string;
  projCode: string;
  timeFrom: string;
  timeTo: string;
  type: string;
}): Promise<MeterFetchResult<MeterReading>> {
  const pageSize = 1000;
  const readings: MeterReading[] = [];
  let unavailable = false;

  for (let page = 1; page <= 100; page++) {
    let res: any;
    try {
      res = await getHDMData({
        comType: params.comType,
        page: String(page),
        pageSize: String(pageSize),
        projCode: params.projCode,
        timeFrom: params.timeFrom,
        timeTo: params.timeTo,
        type: params.type,
      });
    } catch (error) {
      if (!isRecoverableThirdPartyError(error)) {
        throw error;
      }
      unavailable = true;
      console.warn(
        '[dashboard/meter-statistics] getHDMData unavailable:',
        getThirdPartyErrorSummary(error),
      );
      break;
    }
    const pageReadings = normalizeReadings(res);
    readings.push(...pageReadings);

    const total = getTotal(res, readings.length);
    if (readings.length >= total || pageReadings.length === 0) {
      break;
    }
  }

  return { items: readings, unavailable };
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

function getPeakValleyReadingUsage(reading: MeterReading) {
  const peakValleyTotal =
    toNumber(reading.dataValue1) +
    toNumber(reading.dataValue2) +
    toNumber(reading.dataValue3) +
    toNumber(reading.dataValue4);
  const totalUsage = toNumber(reading.dataValue);

  if (totalUsage === 0) {
    return peakValleyTotal;
  }

  return totalUsage;
}

function isTimeOfUseReading(reading: MeterReading) {
  return (
    toNumber(reading.dataValue1) !== 0 ||
    toNumber(reading.dataValue2) !== 0 ||
    toNumber(reading.dataValue3) !== 0 ||
    toNumber(reading.dataValue4) !== 0
  );
}

function buildMeterCategoryData(readings: MeterReading[]) {
  const totals = {
    ordinary: 0,
    timeOfUse: 0,
  };
  let recordCount = 0;

  for (const reading of readings) {
    if (isTimeOfUseReading(reading)) {
      totals.timeOfUse += getPeakValleyReadingUsage(reading);
    } else {
      totals.ordinary += toNumber(reading.dataValue);
    }
    recordCount++;
  }

  return {
    dayNight: [
      { name: '普通表', value: roundValue(totals.ordinary) },
      { name: '时段表', value: roundValue(totals.timeOfUse) },
    ],
    recordCount,
  };
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
  const dateRange = resolveDateRangeFromQuery({
    date: query.date,
    dateType,
    endDate: query.endDate,
    startDate: query.startDate,
  });
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

    let peakValleyFromAmountBills = [
      { name: '尖', value: 0 },
      { name: '峰', value: 0 },
      { name: '平', value: 0 },
      { name: '谷', value: 0 },
    ];
    let meterCategoryFromAmountBills = [
      { name: '普通表', value: 0 },
      { name: '时段表', value: 0 },
    ];
    let meterCategoryAmountBillRecordCount = 0;
    let waterTrendFromAmountBills = {
      times: [] as string[],
      values: [] as number[],
    };
    let waterAmountBillRecordCount = 0;
    const selectedMonths = resolveDateRangeMonths(dateRange);
    const selectedMonthSet = new Set(selectedMonths);

    if (statisticsType === 'electricity' && dateType === 'month') {
      const { createTimeEnd, createTimeStart } =
        resolveAmountBillCreateTimeRangeForMonths(selectedMonths);
      const amountBills = await prismaClient.amountBill.findMany({
        select: {
          createTime: true,
          eleItem: true,
        },
        where: {
          createTime: {
            gte: createTimeStart,
            lt: createTimeEnd,
          },
          eleItem: {
            not: null,
          },
          parkId: {
            in: parks.map((park) => park.parkId),
          },
        },
      });
      const peakValleyStats = buildPeakValleyDataFromAmountBills(
        amountBills,
        selectedMonthSet,
      );
      const meterCategoryStats = buildMeterCategoryDataFromAmountBills(
        amountBills,
        selectedMonthSet,
      );

      peakValleyFromAmountBills = peakValleyStats.peakValley;
      meterCategoryFromAmountBills = meterCategoryStats.dayNight;
      meterCategoryAmountBillRecordCount = meterCategoryStats.recordCount;
    }

    if (statisticsType === 'water' && dateType === 'month') {
      const { createTimeEnd, createTimeStart } =
        resolveAmountBillCreateTimeRangeForMonths(selectedMonths);
      const amountBills = await prismaClient.amountBill.findMany({
        select: {
          createTime: true,
          waterItem: true,
        },
        where: {
          createTime: {
            gte: createTimeStart,
            lt: createTimeEnd,
          },
          parkId: {
            in: parks.map((park) => park.parkId),
          },
          waterItem: {
            not: null,
          },
        },
      });
      const waterStats = buildWaterTrendDataFromAmountBills(
        amountBills,
        selectedMonths,
      );

      waterTrendFromAmountBills = waterStats.waterTrend;
      waterAmountBillRecordCount = waterStats.recordCount;
    }

    let thirdPartyUnavailable = false;
    const deviceResult = await fetchAllDevices({ comType, projCode });
    thirdPartyUnavailable ||= deviceResult.unavailable;
    const devices = deviceResult.items;
    const permittedDevices = devices.filter((device) =>
      isDeviceInParks(device, parks),
    );

    if (
      permittedDevices.length === 0 &&
      !(
        (statisticsType === 'electricity' && dateType === 'month') ||
        (statisticsType === 'water' && dateType === 'month')
      )
    ) {
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
    const waterTrendType = dateType === 'month' ? '2' : '1';
    let hourlyReadings: MeterReading[] = [];
    let peakValleyReadings: MeterReading[] = [];
    let waterTrendReadings: MeterReading[] = [];

    if (statisticsType === 'electricity') {
      if (permittedDevices.length === 0) {
        peakValleyReadings = [];
        hourlyReadings = [];
      } else if (dateType === 'day') {
        const readingResult = await fetchReadings({
          comType,
          projCode,
          timeFrom: dateRange.timeFrom,
          timeTo: dateRange.timeTo,
          type: '1',
        });
        thirdPartyUnavailable ||= readingResult.unavailable;
        hourlyReadings = readingResult.items;
        peakValleyReadings = hourlyReadings;
      } else {
        const readingResult = await fetchReadings({
          comType,
          projCode,
          timeFrom: dateRange.timeFrom,
          timeTo: dateRange.timeTo,
          type: '1',
        });
        thirdPartyUnavailable ||= readingResult.unavailable;
        hourlyReadings = readingResult.items;
      }
    } else if (dateType === 'day' && permittedDevices.length > 0) {
      const readingResult = await fetchReadings({
        comType,
        projCode,
        timeFrom: dateRange.timeFrom,
        timeTo: dateRange.timeTo,
        type: waterTrendType,
      });
      thirdPartyUnavailable ||= readingResult.unavailable;
      waterTrendReadings = readingResult.items;
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
    let peakValley: Array<{ name: string; value: number }> = [];

    if (statisticsType === 'electricity') {
      peakValley =
        dateType === 'month'
          ? peakValleyFromAmountBills
          : buildPeakValleyData(permittedPeakValleyReadings);
    }
    let meterCategoryStats: {
      dayNight: Array<{ name: string; value: number }>;
      recordCount: number;
    } = {
      dayNight: [],
      recordCount: 0,
    };

    if (statisticsType === 'electricity') {
      meterCategoryStats =
        dateType === 'month'
          ? {
              dayNight: meterCategoryFromAmountBills,
              recordCount: meterCategoryAmountBillRecordCount,
            }
          : buildMeterCategoryData(permittedHourlyReadings);
    }
    const dayNight = meterCategoryStats.dayNight;
    let waterTrend = {
      times: [] as string[],
      values: [] as number[],
    };

    if (statisticsType === 'water') {
      waterTrend =
        dateType === 'month'
          ? waterTrendFromAmountBills
          : buildWaterTrendData({
              dateType,
              readings: permittedWaterTrendReadings,
              selectedDate: dateRange.selectedDate,
            });
    }

    let recordCount = 0;

    if (statisticsType === 'water') {
      recordCount =
        dateType === 'month'
          ? waterAmountBillRecordCount
          : permittedWaterTrendReadings.length;
    }
    if (statisticsType === 'electricity') {
      recordCount = meterCategoryStats.recordCount;
    }
    const total =
      statisticsType === 'electricity'
        ? sumChartData(dayNight)
        : sumValues(waterTrend.values);
    const hasData = recordCount > 0;
    let message: string | undefined;
    if (thirdPartyUnavailable) {
      message = THIRD_PARTY_UNAVAILABLE_MESSAGE;
    } else if (!hasData) {
      message = '当前时间范围未查询到统计数据';
    }

    return useResponseSuccess({
      dateType,
      dayNight,
      hasData,
      message,
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
