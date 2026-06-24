import type { H3Event } from 'h3';
import type { UserInfoForToken } from '~/utils/user-service';

import dayjs from 'dayjs';
import {
  enrichAmountBillPaymentInfo,
  filterAmountBillsByCollectionStatus,
} from '~/utils/amount-bill-list-summary';
import { getSingleProjectMonthSortKey } from '~/utils/amount-bill-project-period';
import { prismaClient } from '~/utils/db';

import { resolveParkDataScopeForRequest } from './request-data-scope.ts';

export type AmountBillCollectionSmsType =
  | 'final_30'
  | 'overdue_10'
  | 'payment_reminder';

export interface AmountBillCollectionSmsFilters {
  collectionStatus?: string;
  currentPark?: number | string;
  parkId?: number | string;
  projectEndDate?: string;
  projectName?: string;
  projectStartDate?: string;
  tenantName?: string;
}

export interface AmountBillCollectionSmsOptions {
  billIds?: number[];
  collectionType: AmountBillCollectionSmsType;
  dueDate?: string;
  filters?: AmountBillCollectionSmsFilters;
  overdueDays?: number;
}

export interface AmountBillCollectionSmsCandidate {
  billId: number;
  canSend: boolean;
  collectionType: AmountBillCollectionSmsType;
  collectionStatus: string;
  collectionStatusLabel: string;
  lastSentAt?: string;
  message: string;
  parkId?: null | number;
  parkName?: string;
  phoneNumber?: string;
  projectName: string;
  reason?: string;
  receiptAmount: number;
  remainingAmount: number;
  sentCount?: number;
  smsCompanyName?: string;
  smsTemplateId?: string;
  smsTemplateParamSet: string[];
  tenantId?: null | number;
  tenantName: string;
  totalFee: number;
}

export interface AmountBillCollectionSmsSendResult {
  billId: number;
  error?: string;
  parkName?: string;
  phoneNumber?: string;
  projectName: string;
  providerResult?: unknown;
  smsCompanyName?: string;
  templateId?: string;
  success: boolean;
  tenantName: string;
}

export interface AmountBillCollectionSmsTemplateStatus {
  approved: boolean;
  refuseReason?: string;
  status: string;
  statusCode: string;
  statusLabel: string;
  templateId: string;
}

export interface AmountBillCollectionSmsTemplateCheckResult {
  missingEnvNames: string[];
  statuses: Record<string, AmountBillCollectionSmsTemplateStatus>;
  unapproved: Array<{
    collectionType: AmountBillCollectionSmsType;
    envName: string;
    smsCompanyName?: string;
    status: AmountBillCollectionSmsTemplateStatus;
  }>;
}

type SendTemplateSms = (payload: {
  phoneNumberSet: string[];
  templateId: string;
  templateParamSet: string[];
}) => Promise<unknown>;

const collectionSmsTypes: AmountBillCollectionSmsType[] = [
  'payment_reminder',
  'overdue_10',
  'final_30',
];

const collectionSmsTypeLabels: Record<AmountBillCollectionSmsType, string> = {
  final_30: '长期未结提醒',
  overdue_10: '逾期提醒',
  payment_reminder: '缴费提醒',
};

type CollectionSmsTemplateIdMap = Record<
  string,
  Partial<Record<AmountBillCollectionSmsType, string>>
>;

const collectionSmsEnterpriseCompanyNames = new Set([
  '东莞市亿胜物业管理有限公司',
  '东莞市十一兄弟实业投资有限公司',
  '东莞市启程物业管理有限公司',
  '佛山市十一智创物业管理有限公司',
  '佛山市十一智慧家具有限公司',
  '广州市十一兄弟产业投资有限公司',
  '深圳市十一兄弟产业服务有限公司',
]);

const collectionSmsPersonalAccountNames = new Set(['喻必胜', '肖德利']);

const collectionSmsParkCompanyNameMap = new Map([
  ['东莞光泰园区', '东莞市亿胜物业管理有限公司'],
  ['东莞同兴园区', '东莞市十一兄弟实业投资有限公司'],
  ['东莞同富园区', '东莞市启程物业管理有限公司'],
  ['佛山乐从园区', '佛山市十一智创物业管理有限公司'],
  ['佛山九江园区', '佛山市十一智慧家具有限公司'],
  ['广州园区（西州一）', '广州市十一兄弟产业投资有限公司'],
  ['广州荔新', '广州市十一兄弟产业投资有限公司'],
  ['广州西州二园区', '广州市十一兄弟产业投资有限公司'],
  ['深圳坪山23园区', '深圳市十一兄弟产业服务有限公司'],
]);

function normalizeCollectionSmsText(value: unknown) {
  return String(value || '').trim();
}

function getAmountBillCollectionSmsTemplateStatusKey(params: {
  collectionType: AmountBillCollectionSmsType;
  smsCompanyName?: string;
  templateId: string;
}) {
  return [
    normalizeCollectionSmsText(params.smsCompanyName) || 'unknown-company',
    params.collectionType,
    params.templateId,
  ].join(':');
}

export function getAmountBillCollectionSmsTemplateEnvName(
  collectionType: AmountBillCollectionSmsType,
  smsCompanyName?: string,
) {
  const companyName =
    normalizeCollectionSmsText(smsCompanyName) || '<短信企业主体>';
  return `SMS_COLLECTION_TEMPLATE_ID_MAP.${companyName}.${collectionType}`;
}

function normalizeTemplateIdMapEntry(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entry = value as Record<string, unknown>;
  const normalized: Partial<Record<AmountBillCollectionSmsType, string>> = {};
  for (const collectionType of collectionSmsTypes) {
    const templateId = normalizeCollectionSmsText(entry[collectionType]);
    if (templateId) {
      normalized[collectionType] = templateId;
    }
  }
  return normalized;
}

export function getAmountBillCollectionSmsTemplateIdMap(
  env: NodeJS.ProcessEnv = process.env,
): CollectionSmsTemplateIdMap {
  const raw = normalizeCollectionSmsText(env.SMS_COLLECTION_TEMPLATE_ID_MAP);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const map: CollectionSmsTemplateIdMap = {};
    for (const [companyName, config] of Object.entries(parsed)) {
      const normalizedCompanyName = normalizeCollectionSmsText(companyName);
      if (!normalizedCompanyName) {
        continue;
      }

      const entry = normalizeTemplateIdMapEntry(config);
      if (Object.keys(entry).length > 0) {
        map[normalizedCompanyName] = entry;
      }
    }
    return map;
  } catch (error) {
    console.warn(
      '[amount-bill-collection-sms] invalid SMS_COLLECTION_TEMPLATE_ID_MAP:',
      error,
    );
    return {};
  }
}

export function resolveAmountBillCollectionSmsTemplateId(params: {
  collectionType: AmountBillCollectionSmsType;
  env?: NodeJS.ProcessEnv;
  smsCompanyName?: string;
}) {
  const smsCompanyName = normalizeCollectionSmsText(params.smsCompanyName);
  if (!smsCompanyName) {
    return '';
  }

  const templateIdMap = getAmountBillCollectionSmsTemplateIdMap(params.env);
  return normalizeCollectionSmsText(
    templateIdMap[smsCompanyName]?.[params.collectionType],
  );
}

function parseBankAccountName(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeCollectionSmsText((value as Record<string, unknown>).name);
  }

  const raw = normalizeCollectionSmsText(value);
  if (!raw) {
    return '';
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeCollectionSmsText(parsed?.name);
  } catch {
    return raw;
  }
}

function getCollectionSmsCompanyNameByPark(parkName: unknown) {
  return (
    collectionSmsParkCompanyNameMap.get(normalizeCollectionSmsText(parkName)) ||
    ''
  );
}

function resolveCollectionSmsCompanyName(params: {
  parkName?: unknown;
  publicBankAccount?: unknown;
  templateIdMap: CollectionSmsTemplateIdMap;
}) {
  const publicAccountName = parseBankAccountName(params.publicBankAccount);
  if (
    publicAccountName &&
    (collectionSmsEnterpriseCompanyNames.has(publicAccountName) ||
      Boolean(params.templateIdMap[publicAccountName]))
  ) {
    return publicAccountName;
  }

  if (
    publicAccountName &&
    !collectionSmsPersonalAccountNames.has(publicAccountName)
  ) {
    return '';
  }

  const parkCompanyName = getCollectionSmsCompanyNameByPark(params.parkName);
  if (parkCompanyName) {
    return parkCompanyName;
  }

  return '';
}

function resolveCollectionSmsTemplateSelection(params: {
  collectionType: AmountBillCollectionSmsType;
  parkName?: unknown;
  publicBankAccount?: unknown;
  templateIdMap?: CollectionSmsTemplateIdMap;
}) {
  const templateIdMap =
    params.templateIdMap || getAmountBillCollectionSmsTemplateIdMap();
  const smsCompanyName = resolveCollectionSmsCompanyName({
    parkName: params.parkName,
    publicBankAccount: params.publicBankAccount,
    templateIdMap,
  });
  if (!smsCompanyName) {
    return {
      reason: '未匹配到短信企业主体',
      smsCompanyName: '',
      smsTemplateId: '',
    };
  }

  const smsTemplateId = normalizeCollectionSmsText(
    templateIdMap[smsCompanyName]?.[params.collectionType],
  );
  if (!smsTemplateId) {
    return {
      reason: `${smsCompanyName}的${collectionSmsTypeLabels[params.collectionType]}模板未配置`,
      smsCompanyName,
      smsTemplateId: '',
    };
  }

  return {
    reason: '',
    smsCompanyName,
    smsTemplateId,
  };
}

type CollectionSmsLogSummary = {
  lastSentAt?: string;
  sentCount: number;
};

function toAmountNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toPositiveInteger(value: unknown) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0
    ? Math.floor(normalized)
    : null;
}

function normalizeBillIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .map((item) => toPositiveInteger(item))
        .filter((item): item is number => item !== null),
    ),
  ];
}

function normalizeCollectionStatus(value: unknown) {
  const status = String(value || '').trim();
  return status || 'unreceived';
}

function normalizeCollectionType(value: unknown): AmountBillCollectionSmsType {
  const collectionType = String(value || '').trim();
  if (
    collectionType === 'final_30' ||
    collectionType === 'overdue_10' ||
    collectionType === 'payment_reminder'
  ) {
    return collectionType;
  }
  return 'payment_reminder';
}

function normalizeDateText(value: unknown) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const parsed = dayjs(text);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

function getDefaultDueDate() {
  return dayjs().date(5).format('YYYY-MM-DD');
}

function normalizeOverdueDays(
  collectionType: AmountBillCollectionSmsType,
  value: unknown,
) {
  const overdueDays = Number(value);
  if (Number.isFinite(overdueDays) && overdueDays > 0) {
    return Math.floor(overdueDays);
  }
  return collectionType === 'final_30' ? 30 : 10;
}

function normalizePhoneNumber(value: unknown) {
  return String(value || '').replaceAll(/\D/g, '');
}

function isValidSmsPhoneNumber(value: unknown) {
  return /^1\d{10}$/.test(normalizePhoneNumber(value));
}

function formatMoney(value: unknown) {
  return `${toAmountNumber(value).toFixed(2)}`;
}

function getProjectMonthRange(startValue: unknown, endValue: unknown) {
  const startDate = dayjs(String(startValue || '').trim());
  const endDate = dayjs(String(endValue || '').trim());
  if (!startDate.isValid() || !endDate.isValid()) {
    return null;
  }

  const startKey = startDate.year() * 12 + startDate.month() + 1;
  const endKey = endDate.year() * 12 + endDate.month() + 1;
  return {
    endKey: Math.max(startKey, endKey),
    startKey: Math.min(startKey, endKey),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '短信发送失败';
}

async function getAmountBillCollectionSmsLogSummaries(
  billIds: number[],
  collectionType: AmountBillCollectionSmsType,
) {
  const summaries = new Map<number, CollectionSmsLogSummary>();
  if (billIds.length === 0) {
    return summaries;
  }

  try {
    const placeholders = billIds.map(() => '?').join(',');
    const rows = (await prismaClient.$queryRawUnsafe(
      `
        SELECT
          bill_id AS billId,
          COUNT(*) AS sentCount,
          MAX(sent_at) AS lastSentAt
        FROM amount_bill_collection_sms_log
        WHERE success = 1
          AND collection_type = ?
          AND bill_id IN (${placeholders})
        GROUP BY bill_id
      `,
      collectionType,
      ...billIds,
    )) as Array<{
      billId: bigint | number | string;
      lastSentAt?: Date | string;
      sentCount: bigint | number | string;
    }>;

    for (const item of rows) {
      const lastSentAt = item.lastSentAt
        ? new Date(item.lastSentAt).toISOString()
        : undefined;
      summaries.set(Number(item.billId), {
        lastSentAt,
        sentCount: Number(item.sentCount || 0),
      });
    }
  } catch (error) {
    console.warn(
      '[amount-bill-collection-sms] read sms log failed, continue without send history:',
      error,
    );
  }

  return summaries;
}

export async function recordAmountBillCollectionSmsSendResults(params: {
  items: AmountBillCollectionSmsCandidate[];
  results: AmountBillCollectionSmsSendResult[];
}) {
  const itemMap = new Map(params.items.map((item) => [item.billId, item]));
  const successfulResults = params.results.filter((result) => result.success);
  for (const result of successfulResults) {
    const item = itemMap.get(result.billId);
    if (!item) {
      continue;
    }

    try {
      await prismaClient.$executeRawUnsafe(
        `
          INSERT INTO amount_bill_collection_sms_log (
            bill_id,
            collection_type,
            template_id,
            phone_number,
            tenant_name,
            project_name,
            remaining_amount,
            success,
            error,
            provider_result,
            sent_at,
            create_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), NOW(3), NOW(3))
        `,
        item.billId,
        item.collectionType,
        result.templateId || null,
        result.phoneNumber || item.phoneNumber || null,
        result.tenantName || item.tenantName || null,
        result.projectName || item.projectName || null,
        item.remainingAmount,
        result.success ? 1 : 0,
        result.error || null,
        JSON.stringify(result.providerResult ?? null),
      );
    } catch (error) {
      console.warn(
        `[amount-bill-collection-sms] write sms log failed billId=${item.billId}, continue:`,
        error,
      );
    }
  }
}

function isProjectMonthInRange(
  projectName: unknown,
  range: null | { endKey: number; startKey: number },
) {
  if (!range) {
    return true;
  }
  const monthKey = getSingleProjectMonthSortKey(projectName);
  return (
    monthKey !== null && monthKey >= range.startKey && monthKey <= range.endKey
  );
}

function getCandidateSentRank(item: AmountBillCollectionSmsCandidate) {
  return Number(item.sentCount || 0) > 0 ? 1 : 0;
}

function getCandidateLastSentTime(item: AmountBillCollectionSmsCandidate) {
  if (!item.lastSentAt) {
    return 0;
  }
  const time = new Date(item.lastSentAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortAmountBillCollectionSmsCandidates(
  items: AmountBillCollectionSmsCandidate[],
) {
  return [...items].sort((left, right) => {
    const sentRankDiff =
      getCandidateSentRank(left) - getCandidateSentRank(right);
    if (sentRankDiff !== 0) {
      return sentRankDiff;
    }

    const sendableDiff = Number(right.canSend) - Number(left.canSend);
    if (sendableDiff !== 0) {
      return sendableDiff;
    }

    const sentTimeDiff =
      getCandidateLastSentTime(right) - getCandidateLastSentTime(left);
    if (sentTimeDiff !== 0) {
      return sentTimeDiff;
    }

    return Number(right.billId) - Number(left.billId);
  });
}

function resolveBillPeriod(projectName: unknown) {
  const projectText = String(projectName || '').trim();
  const match = /(\d{4})[-年/._]?\s*(\d{1,2})/.exec(projectText);
  if (match) {
    return `${match[1]}年${Number(match[2])}月`;
  }
  return projectText || '本期';
}

export function buildAmountBillCollectionSmsTemplateParamSet(params: {
  collectionType: AmountBillCollectionSmsType;
  dueDate?: string;
  overdueDays?: number;
  projectName: string;
  remainingAmount: number;
  tenantName: string;
}) {
  const billPeriod = resolveBillPeriod(params.projectName);
  const remainingAmount = formatMoney(params.remainingAmount);
  const overdueDays = normalizeOverdueDays(
    params.collectionType,
    params.overdueDays,
  );
  const dueDate = normalizeDateText(params.dueDate) || getDefaultDueDate();
  let deadlineOrOverdueDays = `${overdueDays}天`;
  if (params.collectionType === 'payment_reminder') {
    deadlineOrOverdueDays = dueDate;
  }

  return [
    params.tenantName || '贵司',
    billPeriod,
    remainingAmount,
    deadlineOrOverdueDays,
  ];
}

export function buildAmountBillCollectionSmsMessage(params: {
  collectionType: AmountBillCollectionSmsType;
  dueDate?: string;
  overdueDays?: number;
  projectName: string;
  remainingAmount: number;
  tenantName: string;
}) {
  const tenantName = params.tenantName || '贵司';
  const billPeriod = resolveBillPeriod(params.projectName);
  const remainingAmount = formatMoney(params.remainingAmount);
  const overdueDays = normalizeOverdueDays(
    params.collectionType,
    params.overdueDays,
  );
  const dueDate = normalizeDateText(params.dueDate) || getDefaultDueDate();

  if (params.collectionType === 'final_30') {
    return `租赁费用提醒：${tenantName}您好，您${billPeriod}租赁费用已超过约定缴费时间${overdueDays}天，待结金额${remainingAmount}元。请及时联系园区财务核对并完成缴费。如已处理请忽略。`;
  }

  if (params.collectionType === 'overdue_10') {
    return `租赁费用提醒：${tenantName}您好，您${billPeriod}租赁费用已超过约定缴费时间${overdueDays}天，待结金额${remainingAmount}元，请尽快完成核对和缴费。如已处理请忽略。`;
  }

  return `租赁费用提醒：${tenantName}您好，您${billPeriod}租赁费用未结清，待结金额${remainingAmount}元，请于${dueDate}前完成核对和缴费。如已处理请忽略。`;
}

function buildCandidateReason(item: {
  phoneNumber?: null | string;
  remainingAmount: number;
  tenantId?: null | number;
}) {
  if (item.remainingAmount <= 0) {
    return '账单已结清';
  }
  if (!item.tenantId) {
    return '账单未关联租户';
  }
  if (!item.phoneNumber) {
    return '租户手机号为空';
  }
  if (!isValidSmsPhoneNumber(item.phoneNumber)) {
    return '租户手机号格式不正确';
  }
  return '';
}

function buildAmountBillCollectionSmsCandidate(params: {
  bill: Record<string, any>;
  collectionType: AmountBillCollectionSmsType;
  dueDate?: string;
  logSummaries: Map<number, CollectionSmsLogSummary>;
  overdueDays?: number;
  templateIdMap: CollectionSmsTemplateIdMap;
}): AmountBillCollectionSmsCandidate {
  const bill = params.bill;
  const billId = Number(bill.billId);
  const remainingAmount = roundAmount(toAmountNumber(bill.remainingAmount));
  const receiptAmount = roundAmount(toAmountNumber(bill.receiptAmount));
  const totalFee = roundAmount(toAmountNumber(bill.totalFee));
  const phoneNumber = normalizePhoneNumber(bill.phoneNumber);
  const tenantName = String(bill.tenantName || '').trim();
  const parkName = String(bill.parkName || '');
  const candidateReason = buildCandidateReason({
    phoneNumber,
    remainingAmount,
    tenantId: bill.tenantId,
  });
  const templateSelection = resolveCollectionSmsTemplateSelection({
    collectionType: params.collectionType,
    parkName,
    publicBankAccount: bill.publicBankAccount,
    templateIdMap: params.templateIdMap,
  });
  const reason = candidateReason || templateSelection.reason;

  return {
    billId,
    canSend: !reason,
    collectionType: params.collectionType,
    collectionStatus: String(bill.collectionStatus || ''),
    collectionStatusLabel: String(bill.collectionStatusLabel || ''),
    lastSentAt: params.logSummaries.get(billId)?.lastSentAt,
    message: buildAmountBillCollectionSmsMessage({
      collectionType: params.collectionType,
      dueDate: params.dueDate,
      overdueDays: params.overdueDays,
      projectName: String(bill.projectName || ''),
      remainingAmount,
      tenantName,
    }),
    parkId: bill.parkId ? Number(bill.parkId) : null,
    parkName,
    phoneNumber,
    projectName: String(bill.projectName || ''),
    reason: reason || undefined,
    receiptAmount,
    remainingAmount,
    sentCount: params.logSummaries.get(billId)?.sentCount || 0,
    smsCompanyName: templateSelection.smsCompanyName || undefined,
    smsTemplateId: templateSelection.smsTemplateId || undefined,
    smsTemplateParamSet: buildAmountBillCollectionSmsTemplateParamSet({
      collectionType: params.collectionType,
      dueDate: params.dueDate,
      overdueDays: params.overdueDays,
      projectName: String(bill.projectName || ''),
      remainingAmount,
      tenantName,
    }),
    tenantId: bill.tenantId ? Number(bill.tenantId) : null,
    tenantName,
    totalFee,
  };
}

function applyParkDataScope(
  event: H3Event,
  userinfo: UserInfoForToken,
  where: Record<string, any>,
  filters?: AmountBillCollectionSmsFilters,
) {
  const dataScope = resolveParkDataScopeForRequest(event, userinfo);
  const requestedParkId = toPositiveInteger(
    filters?.parkId ?? filters?.currentPark,
  );

  if (dataScope.empty) {
    return false;
  }

  if (dataScope.unrestricted) {
    if (requestedParkId) {
      where.parkId = requestedParkId;
    }
    return true;
  }

  const allowedParkIds = dataScope.parkIds;
  if (requestedParkId) {
    if (!allowedParkIds.includes(requestedParkId)) {
      return false;
    }
    where.parkId = requestedParkId;
    return true;
  }

  where.parkId = { in: allowedParkIds };
  return true;
}

export function normalizeAmountBillCollectionSmsOptions(
  options: Partial<AmountBillCollectionSmsOptions>,
): AmountBillCollectionSmsOptions {
  const collectionType = normalizeCollectionType(options.collectionType);
  return {
    billIds: normalizeBillIds(options.billIds),
    collectionType,
    dueDate: normalizeDateText(options.dueDate),
    filters: options.filters || {},
    overdueDays: normalizeOverdueDays(collectionType, options.overdueDays),
  };
}

export async function listAmountBillCollectionSmsCandidates(params: {
  event: H3Event;
  options: AmountBillCollectionSmsOptions;
  userinfo: UserInfoForToken;
}) {
  const filters = params.options.filters || {};
  const where: Record<string, any> = {};
  const billIds = normalizeBillIds(params.options.billIds);
  if (billIds.length > 0) {
    where.billId = { in: billIds };
  }
  if (filters.projectName) {
    where.projectName = { contains: String(filters.projectName) };
  }
  if (filters.tenantName) {
    where.tenantName = { contains: String(filters.tenantName) };
  }

  if (!applyParkDataScope(params.event, params.userinfo, where, filters)) {
    return [];
  }

  const projectMonthRange = getProjectMonthRange(
    filters.projectStartDate,
    filters.projectEndDate,
  );
  const bills = await prismaClient.amountBill.findMany({
    include: {
      park: {
        select: {
          parkName: true,
        },
      },
      tenant: {
        select: {
          phoneNumber: true,
          tenantName: true,
        },
      },
    },
    orderBy: [{ createTime: 'desc' }, { billId: 'desc' }],
    where,
  });

  const enrichedBills = bills
    .filter((bill) =>
      isProjectMonthInRange(bill.projectName, projectMonthRange),
    )
    .map((bill) =>
      enrichAmountBillPaymentInfo({
        ...bill,
        parkName: bill.park?.parkName || '',
        phoneNumber: bill.tenant?.phoneNumber || '',
        tenantName: bill.tenant?.tenantName || bill.tenantName || '',
      }),
    );
  const filteredBills = filterAmountBillsByCollectionStatus(
    enrichedBills,
    normalizeCollectionStatus(filters.collectionStatus),
  );
  const logSummaries = await getAmountBillCollectionSmsLogSummaries(
    filteredBills.map((bill) => Number(bill.billId)),
    params.options.collectionType,
  );
  const templateIdMap = getAmountBillCollectionSmsTemplateIdMap();

  const items = filteredBills
    .map((bill) =>
      buildAmountBillCollectionSmsCandidate({
        bill,
        collectionType: params.options.collectionType,
        dueDate: params.options.dueDate,
        logSummaries,
        overdueDays: params.options.overdueDays,
        templateIdMap,
      }),
    )
    .filter((item) => item.remainingAmount > 0);
  return sortAmountBillCollectionSmsCandidates(items);
}

export async function listAmountBillCollectionSmsCandidatesForAutomation(
  options: AmountBillCollectionSmsOptions,
) {
  const filters = options.filters || {};
  const where: Record<string, any> = {};
  if (filters.projectName) {
    where.projectName = { contains: String(filters.projectName) };
  }
  if (filters.tenantName) {
    where.tenantName = { contains: String(filters.tenantName) };
  }

  const requestedParkId = toPositiveInteger(
    filters.parkId ?? filters.currentPark,
  );
  if (requestedParkId) {
    where.parkId = requestedParkId;
  }

  const projectMonthRange = getProjectMonthRange(
    filters.projectStartDate,
    filters.projectEndDate,
  );
  const bills = await prismaClient.amountBill.findMany({
    include: {
      park: {
        select: {
          parkName: true,
        },
      },
      tenant: {
        select: {
          phoneNumber: true,
          tenantName: true,
        },
      },
    },
    orderBy: [{ createTime: 'desc' }, { billId: 'desc' }],
    where,
  });

  const enrichedBills = bills
    .filter((bill) =>
      isProjectMonthInRange(bill.projectName, projectMonthRange),
    )
    .map((bill) =>
      enrichAmountBillPaymentInfo({
        ...bill,
        parkName: bill.park?.parkName || '',
        phoneNumber: bill.tenant?.phoneNumber || '',
        tenantName: bill.tenant?.tenantName || bill.tenantName || '',
      }),
    );
  const filteredBills = filterAmountBillsByCollectionStatus(
    enrichedBills,
    normalizeCollectionStatus(filters.collectionStatus),
  );
  const logSummaries = await getAmountBillCollectionSmsLogSummaries(
    filteredBills.map((bill) => Number(bill.billId)),
    options.collectionType,
  );
  const templateIdMap = getAmountBillCollectionSmsTemplateIdMap();

  const items = filteredBills
    .map((bill) =>
      buildAmountBillCollectionSmsCandidate({
        bill,
        collectionType: options.collectionType,
        dueDate: options.dueDate,
        logSummaries,
        overdueDays: options.overdueDays,
        templateIdMap,
      }),
    )
    .filter((item) => item.remainingAmount > 0);
  return sortAmountBillCollectionSmsCandidates(items);
}

export async function sendAmountBillCollectionSmsItems(params: {
  items: AmountBillCollectionSmsCandidate[];
  sendTemplateSms: SendTemplateSms;
}) {
  const results: AmountBillCollectionSmsSendResult[] = [];
  for (const item of params.items) {
    if (!item.canSend || !item.phoneNumber) {
      results.push({
        billId: item.billId,
        error: item.reason || '账单不可发送催收短信',
        parkName: item.parkName,
        phoneNumber: item.phoneNumber,
        projectName: item.projectName,
        smsCompanyName: item.smsCompanyName,
        success: false,
        tenantName: item.tenantName,
      });
      continue;
    }

    const templateId = normalizeCollectionSmsText(item.smsTemplateId);
    if (!templateId) {
      results.push({
        billId: item.billId,
        error:
          item.reason ||
          `催收短信模板未配置：${getAmountBillCollectionSmsTemplateEnvName(item.collectionType, item.smsCompanyName)}`,
        parkName: item.parkName,
        phoneNumber: item.phoneNumber,
        projectName: item.projectName,
        smsCompanyName: item.smsCompanyName,
        success: false,
        tenantName: item.tenantName,
      });
      continue;
    }

    try {
      const providerResult = await params.sendTemplateSms({
        phoneNumberSet: [item.phoneNumber],
        templateId,
        templateParamSet: item.smsTemplateParamSet,
      });
      results.push({
        billId: item.billId,
        parkName: item.parkName,
        phoneNumber: item.phoneNumber,
        projectName: item.projectName,
        providerResult,
        smsCompanyName: item.smsCompanyName,
        templateId,
        success: true,
        tenantName: item.tenantName,
      });
    } catch (error) {
      results.push({
        billId: item.billId,
        error: getErrorMessage(error),
        parkName: item.parkName,
        phoneNumber: item.phoneNumber,
        projectName: item.projectName,
        smsCompanyName: item.smsCompanyName,
        templateId,
        success: false,
        tenantName: item.tenantName,
      });
    }
  }

  return results;
}

export async function checkAmountBillCollectionSmsTemplateStatuses(params: {
  getTemplateStatus: (
    templateId: string,
  ) => Promise<AmountBillCollectionSmsTemplateStatus>;
  items: AmountBillCollectionSmsCandidate[];
}) {
  const result: AmountBillCollectionSmsTemplateCheckResult = {
    missingEnvNames: [],
    statuses: {},
    unapproved: [],
  };
  const missingEnvNames = new Set<string>();
  const templateItems = new Map<
    string,
    {
      collectionType: AmountBillCollectionSmsType;
      envName: string;
      smsCompanyName?: string;
      templateId: string;
    }
  >();

  for (const item of params.items) {
    if (!item.canSend || !item.phoneNumber) {
      continue;
    }
    const templateId = normalizeCollectionSmsText(item.smsTemplateId);
    const envName = getAmountBillCollectionSmsTemplateEnvName(
      item.collectionType,
      item.smsCompanyName,
    );
    if (!templateId) {
      missingEnvNames.add(envName);
      continue;
    }
    const statusKey = getAmountBillCollectionSmsTemplateStatusKey({
      collectionType: item.collectionType,
      smsCompanyName: item.smsCompanyName,
      templateId,
    });
    if (!templateItems.has(statusKey)) {
      templateItems.set(statusKey, {
        collectionType: item.collectionType,
        envName,
        smsCompanyName: item.smsCompanyName,
        templateId,
      });
    }
  }

  result.missingEnvNames = [...missingEnvNames];

  for (const [statusKey, item] of templateItems) {
    const status = await params.getTemplateStatus(item.templateId);
    result.statuses[statusKey] = status;
    if (!status.approved) {
      result.unapproved.push({
        collectionType: item.collectionType,
        envName: item.envName,
        smsCompanyName: item.smsCompanyName,
        status,
      });
    }
  }

  return result;
}

export function buildAmountBillCollectionSmsSummary(
  items: AmountBillCollectionSmsCandidate[],
) {
  return {
    candidateCount: items.length,
    sendableCount: items.filter((item) => item.canSend).length,
    totalRemainingAmount: roundAmount(
      items.reduce((sum, item) => sum + item.remainingAmount, 0),
    ),
  };
}
