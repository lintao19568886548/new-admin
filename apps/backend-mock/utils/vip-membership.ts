import type { PrismaClient } from '@prisma/.prisma/center-client/index.js';
import type { VipMembershipTestPaymentContext } from '~/utils/vip-membership-test-payment';

import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/.prisma/center-client/index.js';
import {
  buildTenantCustomerIdBase,
  buildTenantCustomerIdCandidate,
  normalizeTenantIdentityProfile,
} from '~/utils/customer-identity';
import { systemDbClient } from '~/utils/db';
import {
  isVipMembershipTestPayment,
  resolveVipMembershipTestPaymentAmountTotal,
} from '~/utils/vip-membership-test-payment';
import {
  createWechatPayRefund,
  queryWechatPayOrder,
  queryWechatPayRefund,
} from '~/utils/wechat-pay';

const VIP_MEMBERSHIP_ACTIVE_STATUS = 'active';
const VIP_MEMBERSHIP_ATTACH_TAG = 'vip-membership';
const VIP_MEMBERSHIP_DURATION_MONTHS = 1;
const VIP_TRIAL_DURATION_MONTHS = 1;
const PROVISIONING_BLOCKING_STATUSES = new Set([
  'failed_manual',
  'failed_retryable',
  'pending',
  'provisioning',
]);
const TENANT_PROVISIONING_MANUAL_FAILURE_MESSAGE =
  '专属空间开通失败，请联系客服处理后再重新开通';
const TENANT_PROVISIONING_PAYMENT_BLOCKED_STATUS_MESSAGES: Record<
  string,
  string
> = {
  failed_manual: TENANT_PROVISIONING_MANUAL_FAILURE_MESSAGE,
  failed_retryable: '专属空间开通失败，系统正在自动重试，请勿重复支付',
  pending: '专属空间等待开通中，请勿重复支付',
  provisioning: '专属空间正在开通中，请勿重复支付',
};
export const VIP_MEMBERSHIP_AMOUNT_TOTAL = 98_000;

const VIP_MEMBERSHIP_REFUND_RECONCILE_LIMIT = 20;
const VIP_MEMBERSHIP_REFUND_RECHECK_DELAY_MS = 60_000;
const VIP_MEMBERSHIP_MANUAL_REFUND_RECHECK_DELAY_MS = 12 * 60 * 60 * 1000;
const VIP_MEMBERSHIP_ENTITLEMENT_ACTIVE_STATUS = 'active';
const VIP_MEMBERSHIP_ENTITLEMENT_REFUNDED_STATUS = 'refunded';
const VIP_MEMBERSHIP_REFUND_BUSINESS_TIME_ZONE = 'Asia/Shanghai';
const VIP_MEMBERSHIP_REFUND_IGNORED_NO_ENTITLEMENT_STATUS =
  'IGNORED_NO_ENTITLEMENT';
const VIP_MEMBERSHIP_REFUND_MANUAL_REVIEW_STATUS = 'MANUAL_REVIEW';
const VIP_MEMBERSHIP_REFUND_REUSABLE_STATUSES = [
  'ABNORMAL',
  'CLOSED',
  'CREATE_FAILED',
  'CREATE_PENDING',
  'PENDING',
  'PROCESSING',
  'SUCCESS',
];

type VipMembershipDbClient = Prisma.TransactionClient | PrismaClient;

interface VipMembershipAttachPayload {
  centerUserId?: number;
  sourceCustomerId?: string;
  tag: 'vip';
  tenantUserId?: number;
}

export interface VipTenantIdentityInput {
  city?: unknown;
  companyShortName?: unknown;
}

interface TenantProvisioningDraft {
  companyShortName: string;
  city: string;
}

interface TenantProvisioningTargetIdentity extends TenantProvisioningDraft {
  customerId: string;
}

export interface VipMembershipProfileState {
  accessRestricted: boolean;
  accessScopeStatus:
    | 'default_exempt'
    | 'member_active'
    | 'restricted'
    | 'trial_active';
  customerCity?: string;
  customerCompanyShortName?: string;
  customerName?: string;
  isMember: boolean;
  isMembership: boolean;
  isTrialActive: boolean;
  isTenantProvisioning: boolean;
  isVip: boolean;
  memberExpireAt?: string;
  memberStatus: 'active' | 'expired' | 'inactive';
  membershipGateReason: 'membership_expired' | 'none' | 'trial_expired';
  membershipExpireAt?: string;
  membershipStatus: 'active' | 'expired' | 'inactive';
  sourceCustomerId?: string;
  targetCity?: string;
  targetCompanyShortName?: string;
  targetCustomerId?: string;
  tenantProvisioningMessage?: string;
  tenantProvisioningStatus:
    | 'active'
    | 'failed_manual'
    | 'failed_retryable'
    | 'none'
    | 'pending'
    | 'provisioning';
  trialExpireAt?: string;
  trialStartAt?: string;
  trialStatus: 'active' | 'expired' | 'inactive';
  vipExpireAt?: string;
  vipStatus: 'active' | 'expired' | 'inactive';
}

export interface VipMembershipWechatOrderInput {
  amount?: unknown;
  attach?: unknown;
  outTradeNo?: unknown;
  successTime?: unknown;
  tradeState?: unknown;
  transactionId?: unknown;
}

export interface VipMembershipWechatOrderResult {
  alreadyApplied: boolean;
  applied: boolean;
  matched: boolean;
  outTradeNo: string;
  provisioningStatus?: VipMembershipProfileState['tenantProvisioningStatus'];
  reason?:
    | 'amount-mismatch'
    | 'missing-center-user'
    | 'missing-out-trade-no'
    | 'missing-user-context'
    | 'not-vip-membership'
    | 'stale-payment'
    | 'trade-not-success';
  vipExpireAt?: string;
}

export interface VipMembershipRefundResult {
  amountTotal: number;
  customerId: string;
  outRefundNo: string;
  outTradeNo: string;
  refundAmount: number;
  refundId?: string;
  status: string;
}

export interface VipMembershipRefundOrder {
  amountTotal: number;
  entitlement?: {
    durationMonths: number;
    endAt: string;
    startAt: string;
    status: string;
  };
  latestRefund?: {
    outRefundNo: string;
    refundAmount: number;
    status: string;
    successAt?: string;
  };
  outTradeNo: string;
  paidAt?: string;
  refundable: boolean;
  refundDisabledReason?: string;
  targetCustomerId?: string;
  tradeState: string;
  transactionId?: string;
}

interface VipMembershipRefundRecord {
  amountTotal: number;
  customerId: string;
  outRefundNo: string;
  outTradeNo: string;
  refundAmount: number;
  refundId?: null | string;
  reason?: null | string;
  status: string;
  transactionId?: null | string;
}

interface VipMembershipEntitlementRecord {
  amountTotal: number;
  centerUserId: number;
  customerId: string;
  durationMonths: number;
  endAt: Date;
  id: number;
  outTradeNo: string;
  startAt: Date;
  status: string;
  transactionId?: null | string;
}

function addMonths(source: Date, months: number) {
  const date = new Date(source);
  date.setMonth(date.getMonth() + months);
  return date;
}

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }
  return value.trim();
}

function parseDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBusinessDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: VIP_MEMBERSHIP_REFUND_BUSINESS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isRefundableFutureEntitlementStart(startAt: Date, now = new Date()) {
  return getBusinessDateKey(startAt) > getBusinessDateKey(now);
}

function parseVipMembershipAttach(
  value: unknown,
): null | VipMembershipAttachPayload {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  if (normalized === VIP_MEMBERSHIP_ATTACH_TAG) {
    return {
      tag: 'vip',
    };
  }

  try {
    const payload = JSON.parse(normalized) as Record<string, unknown>;
    const tag = normalizeString(payload.t || payload.tag || payload.type);
    if (!['vip', VIP_MEMBERSHIP_ATTACH_TAG].includes(tag)) {
      return null;
    }

    const centerUserId =
      normalizePositiveInteger(payload.cu) ||
      normalizePositiveInteger(payload.centerUserId) ||
      undefined;
    const tenantUserId =
      normalizePositiveInteger(payload.u) ||
      normalizePositiveInteger(payload.userId) ||
      undefined;
    const sourceCustomerId =
      normalizeString(
        payload.c || payload.customerId || payload.sourceCustomerId,
      ) || undefined;

    return {
      centerUserId,
      sourceCustomerId,
      tag: 'vip',
      tenantUserId,
    };
  } catch {
    return null;
  }
}

function resolveOrderAmountTotal(amount: unknown) {
  if (!amount || typeof amount !== 'object') {
    return null;
  }

  const payload = amount as Record<string, unknown>;
  return normalizePositiveInteger(payload.total);
}

export function resolveVipMembershipAmountTotal(
  context?: VipMembershipTestPaymentContext,
) {
  const testAmountTotal = resolveVipMembershipTestPaymentAmountTotal(context);
  if (testAmountTotal) {
    return testAmountTotal;
  }

  return VIP_MEMBERSHIP_AMOUNT_TOTAL;
}

export { isVipMembershipTestPayment };

async function revokeVipMembershipForRefundWithClient(
  inputOutTradeNo: string,
  prisma: VipMembershipDbClient,
  inputOutRefundNo?: string,
) {
  const outTradeNo = normalizeString(inputOutTradeNo);
  if (!outTradeNo) {
    return;
  }

  const payment = await getVipMembershipPaymentByOutTradeNo(outTradeNo, prisma);
  if (!payment) {
    return;
  }

  const membershipCustomerId = normalizeString(
    payment.targetCustomerId || payment.sourceCustomerId,
  );
  if (!membershipCustomerId) {
    return;
  }

  await lockCustomerForVipMembership(membershipCustomerId, prisma);
  const entitlement = await prisma.vipMembershipEntitlement.findUnique({
    where: { outTradeNo },
  });
  if (!entitlement || entitlement.customerId !== membershipCustomerId) {
    throw new Error('会员退款缺少对应权益流水，请先人工核对订单数据');
  }

  await prisma.vipMembershipPayment.update({
    data: {
      tradeState: 'REFUND',
    },
    where: { outTradeNo },
  });

  await prisma.vipMembershipEntitlement.update({
    data: {
      refundedAt: new Date(),
      refundedOutRefundNo: normalizeString(inputOutRefundNo) || null,
      status: VIP_MEMBERSHIP_ENTITLEMENT_REFUNDED_STATUS,
    },
    where: { outTradeNo },
  });
  await syncVipMembershipSummaryFromEntitlementsWithClient(
    membershipCustomerId,
    prisma,
  );
}

async function upsertManualReconciledVipMembershipRefundWithClient(
  params: {
    channel?: string;
    customerId: string;
    payment: {
      amountTotal: number;
      centerUserId: number;
      outTradeNo: string;
      transactionId?: null | string;
    };
    providerRaw: unknown;
    status: string;
    successAt?: Date | null;
  },
  prisma: VipMembershipDbClient,
) {
  const outRefundNo = buildManualRefundOutRefundNo(params.payment.outTradeNo);
  const existingRefund = await prisma.vipMembershipRefund.findFirst({
    where: { outTradeNo: params.payment.outTradeNo },
  });
  const providerRaw = JSON.stringify(params.providerRaw);
  const refundAmount = Number(params.payment.amountTotal || 0);
  const successAt =
    params.successAt === undefined ? new Date() : params.successAt;

  return existingRefund
    ? prisma.vipMembershipRefund.update({
        data: {
          channel:
            existingRefund.channel || params.channel || 'manual_reconcile',
          lastCheckedAt: new Date(),
          nextCheckAt: null,
          providerRaw,
          refundAmount: existingRefund.refundAmount || refundAmount,
          status: params.status,
          successAt,
        },
        where: { outRefundNo: existingRefund.outRefundNo },
      })
    : prisma.vipMembershipRefund.create({
        data: {
          amountTotal: refundAmount,
          centerUserId: params.payment.centerUserId,
          channel: params.channel || 'manual_reconcile',
          customerId: params.customerId,
          lastCheckedAt: new Date(),
          nextCheckAt: null,
          outRefundNo,
          outTradeNo: params.payment.outTradeNo,
          providerRaw,
          refundAmount,
          status: params.status,
          successAt,
          transactionId: params.payment.transactionId,
        },
      });
}

async function applyVipMembershipRefundWithClient(
  params: {
    notifyEventId?: string;
    outRefundNo: string;
    providerRaw?: unknown;
    refundId?: string;
    status: string;
    successTime?: string;
  },
  prisma: VipMembershipDbClient,
) {
  const outRefundNo = normalizeString(params.outRefundNo);
  if (!outRefundNo) {
    return null;
  }

  const existingRefund = await getVipMembershipRefundByOutRefundNo(
    outRefundNo,
    prisma,
  );
  if (!existingRefund) {
    return null;
  }

  const status = normalizeWechatRefundStatus(params.status);
  const successAt = isWechatRefundSuccess(status)
    ? parseDateValue(params.successTime) || new Date()
    : null;

  const refund = await prisma.vipMembershipRefund.update({
    data: {
      lastCheckedAt: new Date(),
      nextCheckAt: isWechatRefundTerminal(status)
        ? null
        : getRefundRecheckDate(),
      notifyEventId:
        normalizeString(params.notifyEventId) || existingRefund.notifyEventId,
      providerRaw:
        params.providerRaw === undefined
          ? existingRefund.providerRaw
          : JSON.stringify(params.providerRaw),
      refundId: normalizeString(params.refundId) || existingRefund.refundId,
      status,
      successAt,
    },
    where: { outRefundNo },
  });

  if (isWechatRefundSuccess(status)) {
    await revokeVipMembershipForRefundWithClient(
      refund.outTradeNo,
      prisma,
      refund.outRefundNo,
    );
  }

  return refund;
}

function resolveCenterUserId(userInfo: Record<string, any>) {
  return (
    normalizePositiveInteger(userInfo.centerUserId) ||
    normalizePositiveInteger(userInfo.id)
  );
}

function resolveCustomerId(userInfo: Record<string, any>) {
  return normalizeString(userInfo.customerId || userInfo.customerType);
}

async function getCustomerProfileByCustomerId(
  customerId: string,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  const normalizedCustomerId = normalizeString(customerId);
  if (!normalizedCustomerId) {
    return null;
  }

  const customer = await prisma.customer.findUnique({
    where: { customerId: normalizedCustomerId },
    select: {
      city: true,
      companyShortName: true,
      name: true,
    },
  });
  if (!customer) {
    return null;
  }

  return {
    customerCity: normalizeString(customer.city) || undefined,
    customerCompanyShortName:
      normalizeString(customer.companyShortName) || undefined,
    customerName: normalizeString(customer.name) || undefined,
  };
}

function toVipMembershipCoreState(
  membership: null | {
    expireAt: Date;
    status: string;
  },
) {
  const expireAt = parseDateValue(membership?.expireAt);
  const now = Date.now();
  const hasValidExpireAt = Boolean(expireAt && expireAt.getTime() > now);
  const isVip =
    Boolean(membership) &&
    normalizeString(membership?.status) === VIP_MEMBERSHIP_ACTIVE_STATUS &&
    hasValidExpireAt;

  let vipStatus: VipMembershipProfileState['vipStatus'] = 'inactive';
  if (membership) {
    if (isVip) {
      vipStatus = 'active';
    } else if (expireAt) {
      vipStatus = 'expired';
    }
  }

  const vipExpireAt = expireAt?.toISOString();

  return {
    isMember: isVip,
    isMembership: isVip,
    isVip,
    memberExpireAt: vipExpireAt,
    memberStatus: vipStatus,
    membershipExpireAt: vipExpireAt,
    membershipStatus: vipStatus,
    vipExpireAt,
    vipStatus,
  };
}

function toTrialState(trialStartTime: Date | null | undefined) {
  const trialStartAt = parseDateValue(trialStartTime);
  if (!trialStartAt) {
    return {
      isTrialActive: false,
      trialExpireAt: undefined,
      trialStartAt: undefined,
      trialStatus: 'inactive' as const,
    };
  }

  const trialExpireAt = addMonths(trialStartAt, VIP_TRIAL_DURATION_MONTHS);
  const isTrialActive = trialExpireAt.getTime() > Date.now();

  return {
    isTrialActive,
    trialExpireAt: trialExpireAt.toISOString(),
    trialStartAt: trialStartAt.toISOString(),
    trialStatus: isTrialActive ? ('active' as const) : ('expired' as const),
  };
}

function toVipMembershipAccessState(
  coreState: ReturnType<typeof toVipMembershipCoreState>,
  trialState: ReturnType<typeof toTrialState>,
) {
  if (coreState.isVip) {
    return {
      accessRestricted: false,
      accessScopeStatus: 'member_active' as const,
      membershipGateReason: 'none' as const,
    };
  }

  if (trialState.isTrialActive) {
    return {
      accessRestricted: false,
      accessScopeStatus: 'trial_active' as const,
      membershipGateReason: 'none' as const,
    };
  }

  return {
    accessRestricted: true,
    accessScopeStatus: 'restricted' as const,
    membershipGateReason:
      coreState.vipStatus === 'expired'
        ? ('membership_expired' as const)
        : ('trial_expired' as const),
  };
}

function resolveProvisioningMessage(
  status: VipMembershipProfileState['tenantProvisioningStatus'],
) {
  if (status === 'pending') {
    return '专属空间等待开通';
  }
  if (status === 'provisioning') {
    return '专属空间正在开通中';
  }
  if (status === 'active') {
    return '专属空间已开通';
  }
  if (status === 'failed_retryable') {
    return '专属空间开通失败，系统将自动重试';
  }
  if (status === 'failed_manual') {
    return '专属空间开通失败，需要人工处理';
  }
  return undefined;
}

function throwVipMembershipDbError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  ) {
    throw new Error(
      '中心库 VIP 会员表未同步，请先执行 pnpm -F @vben/backend-mock prisma:push:center。',
    );
  }

  throw error instanceof Error ? error : new Error(String(error));
}

async function withVipMembershipDb<T>(task: () => Promise<T>) {
  try {
    return await task();
  } catch (error) {
    throwVipMembershipDbError(error);
  }
}

async function getVipMembershipByCustomerId(
  customerId: string,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.vipMembership.findUnique({
    select: {
      expireAt: true,
      lastOutTradeNo: true,
      status: true,
    },
    where: {
      customerId,
    },
  });
}

async function getVipMembershipByCustomerIdForUpdate(
  customerId: string,
  prisma: VipMembershipDbClient,
) {
  const rows = await prisma.$queryRaw<
    Array<{
      expireAt: Date;
      status: string;
    }>
  >(
    Prisma.sql`SELECT expire_at AS expireAt, status FROM vip_membership WHERE customer_id = ${customerId} FOR UPDATE`,
  );

  return rows[0] || null;
}

async function lockCustomerForVipMembership(
  customerId: string,
  prisma: VipMembershipDbClient,
) {
  await prisma.$queryRaw<Array<{ customerId: string }>>(
    Prisma.sql`SELECT customer_id AS customerId FROM customer WHERE customer_id = ${customerId} FOR UPDATE`,
  );
}

async function getTenantProvisioningJobByInitiatorCenterUserId(
  initiatorCenterUserId: number,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.tenantProvisioningJob.findFirst({
    orderBy: {
      id: 'desc',
    },
    where: {
      initiatorCenterUserId,
    },
  });
}

async function getCenterUserMembershipTrialProfile(
  centerUserId: number,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.user.findUnique({
    select: {
      createTime: true,
      customerType: true,
      membershipTrialStartAt: true,
    },
    where: {
      id: centerUserId,
    },
  });
}

async function getVipMembershipPaymentByOutTradeNo(
  outTradeNo: string,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.vipMembershipPayment.findUnique({
    where: {
      outTradeNo,
    },
  });
}

async function getVipMembershipRefundByOutRefundNo(
  outRefundNo: string,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.vipMembershipRefund.findUnique({
    where: {
      outRefundNo,
    },
  });
}

async function getLatestActiveVipMembershipEntitlement(
  customerId: string,
  prisma: VipMembershipDbClient,
) {
  return prisma.vipMembershipEntitlement.findFirst({
    orderBy: [{ endAt: 'desc' }, { id: 'desc' }],
    where: {
      customerId,
      status: VIP_MEMBERSHIP_ENTITLEMENT_ACTIVE_STATUS,
    },
  });
}

async function getActiveVipMembershipEntitlementStack(
  customerId: string,
  prisma: VipMembershipDbClient,
) {
  return prisma.vipMembershipEntitlement.findMany({
    orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
    where: {
      customerId,
      status: VIP_MEMBERSHIP_ENTITLEMENT_ACTIVE_STATUS,
    },
  });
}

async function syncVipMembershipSummaryFromEntitlementsWithClient(
  customerId: string,
  prisma: VipMembershipDbClient,
) {
  const latestEntitlement = await getLatestActiveVipMembershipEntitlement(
    customerId,
    prisma,
  );
  const now = new Date();

  if (!latestEntitlement) {
    return prisma.vipMembership.upsert({
      create: {
        customerId,
        expireAt: now,
        lastOutTradeNo: null,
        lastPayerCenterUserId: null,
        lastTransactionId: null,
        status: 'inactive',
      },
      update: {
        expireAt: now,
        lastOutTradeNo: null,
        lastPayerCenterUserId: null,
        lastTransactionId: null,
        status: 'inactive',
      },
      where: { customerId },
    });
  }

  const status =
    latestEntitlement.endAt.getTime() > now.getTime()
      ? VIP_MEMBERSHIP_ACTIVE_STATUS
      : 'inactive';

  return prisma.vipMembership.upsert({
    create: {
      customerId,
      expireAt: latestEntitlement.endAt,
      lastOutTradeNo: latestEntitlement.outTradeNo,
      lastPayerCenterUserId: latestEntitlement.centerUserId,
      lastTransactionId: latestEntitlement.transactionId || null,
      status,
    },
    update: {
      expireAt: latestEntitlement.endAt,
      lastOutTradeNo: latestEntitlement.outTradeNo,
      lastPayerCenterUserId: latestEntitlement.centerUserId,
      lastTransactionId: latestEntitlement.transactionId || null,
      status,
    },
    where: { customerId },
  });
}

async function getStaleTenantProvisioningPaymentState(
  params: {
    centerUserId: number;
    outTradeNo: string;
    sourceCustomerId: string;
  },
  prisma: VipMembershipDbClient,
) {
  if (params.sourceCustomerId !== 'public') {
    return null;
  }

  const job = await getTenantProvisioningJobByInitiatorCenterUserId(
    params.centerUserId,
    prisma,
  );
  const latestOutTradeNo = normalizeString(job?.lastPaymentOutTradeNo);
  if (!latestOutTradeNo || latestOutTradeNo === params.outTradeNo) {
    return null;
  }

  const provisioningStatus =
    job?.status === 'reserved' ? 'none' : job?.status || 'none';

  return {
    provisioningStatus:
      provisioningStatus as VipMembershipProfileState['tenantProvisioningStatus'],
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function getRefundRecheckDate() {
  return new Date(Date.now() + VIP_MEMBERSHIP_REFUND_RECHECK_DELAY_MS);
}

function getManualRefundRecheckDate() {
  return new Date(Date.now() + VIP_MEMBERSHIP_MANUAL_REFUND_RECHECK_DELAY_MS);
}

function getWechatPayRefundNotifyUrl() {
  const configured = normalizeString(process.env.WECHAT_PAY_REFUND_NOTIFY_URL);
  if (configured) {
    return configured;
  }

  const payNotifyUrl = normalizeString(process.env.WECHAT_PAY_NOTIFY_URL);
  if (!payNotifyUrl) {
    return undefined;
  }

  return payNotifyUrl.replace(/\/notify(?:\.post)?$/i, '/refund-notify');
}

function buildManualRefundOutRefundNo(outTradeNo: string) {
  return `manual_${outTradeNo}`.slice(0, 64);
}

function buildSystemRefundOutRefundNo(outTradeNo: string) {
  const normalizedOutTradeNo = normalizeString(outTradeNo);
  const suffix = createHash('sha256')
    .update(normalizedOutTradeNo)
    .digest('hex')
    .slice(0, 12);
  return `vip_refund_${normalizedOutTradeNo}_${suffix}`.slice(0, 64);
}

function normalizeWechatRefundStatus(value: unknown) {
  const status = normalizeString(value).toUpperCase();
  return status || 'UNKNOWN';
}

function isWechatRefundSuccess(status: unknown) {
  return normalizeWechatRefundStatus(status) === 'SUCCESS';
}

function isWechatRefundTerminal(status: unknown) {
  return ['ABNORMAL', 'CLOSED', 'SUCCESS'].includes(
    normalizeWechatRefundStatus(status),
  );
}

function isRefundOrderActionRetryable(status: unknown) {
  return normalizeWechatRefundStatus(status) === 'CREATE_FAILED';
}

function resolveRefundOrderDisabledReason(status: unknown) {
  const normalizedStatus = normalizeWechatRefundStatus(status);
  if (normalizedStatus === 'SUCCESS') {
    return '该订单已退款成功';
  }
  if (normalizedStatus === 'CREATE_FAILED') {
    return undefined;
  }
  if (['CREATE_PENDING', 'PENDING', 'PROCESSING'].includes(normalizedStatus)) {
    return `退款处理中，当前状态：${normalizedStatus}`;
  }
  if (['ABNORMAL', 'CLOSED'].includes(normalizedStatus)) {
    return `退款未成功，当前状态：${normalizedStatus}，请先人工核对`;
  }
  return `已有退款记录，当前状态：${normalizedStatus}`;
}

function toVipMembershipRefundResult(
  refund: VipMembershipRefundRecord,
): VipMembershipRefundResult {
  return {
    amountTotal: refund.amountTotal,
    customerId: refund.customerId,
    outRefundNo: refund.outRefundNo,
    outTradeNo: refund.outTradeNo,
    refundAmount: refund.refundAmount,
    refundId: refund.refundId || undefined,
    status: refund.status,
  };
}

function assertVipMembershipRefundStackSelection(params: {
  entitlements: VipMembershipEntitlementRecord[];
  now?: Date;
  outTradeNos: string[];
}) {
  const requestedOutTradeNos = params.outTradeNos.map((outTradeNo) =>
    normalizeString(outTradeNo),
  );
  const requestedSet = new Set(requestedOutTradeNos);
  if (requestedSet.size !== requestedOutTradeNos.length) {
    throw new Error('批量退款订单号不能重复');
  }

  const stackPrefix = params.entitlements.slice(0, requestedOutTradeNos.length);
  const stackPrefixSet = new Set(
    stackPrefix.map((entitlement) => entitlement.outTradeNo),
  );
  const isNewestPrefix =
    stackPrefix.length === requestedOutTradeNos.length &&
    requestedOutTradeNos.every((outTradeNo) => stackPrefixSet.has(outTradeNo));

  if (!isNewestPrefix) {
    throw new Error('会员退款只能按权益生效顺序从新往旧退，不能跳过更新的订单');
  }

  const now = params.now || new Date();
  const invalidEntitlement = stackPrefix.find(
    (entitlement) =>
      !isRefundableFutureEntitlementStart(entitlement.startAt, now),
  );
  if (invalidEntitlement) {
    throw new Error('仅支持退款权益开始日期在今天之后的会员订单');
  }

  return stackPrefix;
}

async function assertVipMembershipRefundableEntitlementsWithClient(
  params: {
    customerId: string;
    outTradeNos: string[];
  },
  prisma: VipMembershipDbClient,
) {
  const entitlements = await getActiveVipMembershipEntitlementStack(
    params.customerId,
    prisma,
  );
  const requestedSet = new Set(params.outTradeNos);
  const missingOutTradeNo = params.outTradeNos.find(
    (outTradeNo) =>
      !entitlements.some(
        (entitlement) => entitlement.outTradeNo === outTradeNo,
      ),
  );
  if (missingOutTradeNo) {
    throw new Error('会员订单没有可退款的有效权益流水');
  }

  return assertVipMembershipRefundStackSelection({
    entitlements,
    outTradeNos: [...requestedSet],
  });
}

function resolveVipMembershipRefundableOutTradeNos(
  entitlements: VipMembershipEntitlementRecord[],
) {
  const refundable = new Set<string>();
  for (const entitlement of entitlements) {
    if (!isRefundableFutureEntitlementStart(entitlement.startAt)) {
      break;
    }
    refundable.add(entitlement.outTradeNo);
  }
  return refundable;
}

async function resolveWechatRefundStatusForLocalRefund(
  refund: VipMembershipRefundRecord,
  reason?: string,
) {
  const status = normalizeWechatRefundStatus(refund.status);
  if (status === 'PENDING' || status === 'PROCESSING') {
    return queryWechatPayRefund(refund.outRefundNo);
  }

  try {
    return await queryWechatPayRefund(refund.outRefundNo);
  } catch (queryError) {
    try {
      return await createWechatPayRefund({
        amount: {
          refund: refund.refundAmount,
          total: refund.amountTotal,
        },
        outRefundNo: refund.outRefundNo,
        outTradeNo: refund.outTradeNo,
        reason: normalizeString(reason) || refund.reason || '会员退款',
        notifyUrl: getWechatPayRefundNotifyUrl(),
        transactionId: refund.transactionId || undefined,
      });
    } catch (createError) {
      try {
        return await queryWechatPayRefund(refund.outRefundNo);
      } catch {
        throw createError instanceof Error ? createError : queryError;
      }
    }
  }
}

async function submitVipMembershipRefundRecord(
  pendingRefund: VipMembershipRefundRecord,
  reason?: string,
  options?: {
    throwOnCreateFailure?: boolean;
  },
) {
  if (isWechatRefundTerminal(pendingRefund.status)) {
    return toVipMembershipRefundResult(pendingRefund);
  }

  let refundStatus;
  let createRefundError: unknown;
  try {
    refundStatus = await resolveWechatRefundStatusForLocalRefund(
      pendingRefund,
      reason,
    );
  } catch (error) {
    createRefundError = error;
  }

  if (!refundStatus) {
    const pendingRefundStatus = normalizeWechatRefundStatus(
      pendingRefund.status,
    );
    const shouldMarkCreateFailed = ['CREATE_FAILED', 'CREATE_PENDING'].includes(
      pendingRefundStatus,
    );
    const failedRefund = await withVipMembershipDb(() =>
      systemDbClient.vipMembershipRefund.update({
        data: {
          lastCheckedAt: new Date(),
          nextCheckAt: getRefundRecheckDate(),
          providerRaw: JSON.stringify({
            error:
              createRefundError instanceof Error
                ? createRefundError.message
                : String(createRefundError || 'unknown'),
          }),
          status: shouldMarkCreateFailed
            ? 'CREATE_FAILED'
            : pendingRefundStatus,
        },
        where: { outRefundNo: pendingRefund.outRefundNo },
      }),
    );
    if (options?.throwOnCreateFailure ?? true) {
      throw new Error('微信退款创建失败，已记录为可重试状态');
    }

    return toVipMembershipRefundResult(failedRefund);
  }

  const refund = await withVipMembershipDb(() =>
    systemDbClient.$transaction((tx) =>
      applyVipMembershipRefundWithClient(
        {
          outRefundNo: refundStatus.outRefundNo,
          providerRaw: refundStatus,
          refundId: refundStatus.refundId,
          status: refundStatus.status,
          successTime: refundStatus.successTime,
        },
        tx,
      ),
    ),
  );

  return toVipMembershipRefundResult(refund || pendingRefund);
}

async function resolveVipMembershipRefundStackOrderWithClient(
  params: {
    allowCrossCustomerRefund?: boolean;
    outTradeNos: string[];
    requesterCustomerId?: unknown;
  },
  prisma: VipMembershipDbClient,
) {
  const payments = await prisma.vipMembershipPayment.findMany({
    where: {
      outTradeNo: { in: params.outTradeNos },
    },
  });
  const paymentMap = new Map(
    payments.map((payment) => [payment.outTradeNo, payment]),
  );
  const missingOutTradeNo = params.outTradeNos.find(
    (outTradeNo) => !paymentMap.has(outTradeNo),
  );
  if (missingOutTradeNo) {
    throw new Error('会员支付订单不存在');
  }

  const membershipCustomerIds = new Set(
    payments.map((payment) =>
      normalizeString(payment.targetCustomerId || payment.sourceCustomerId),
    ),
  );
  if (membershipCustomerIds.size !== 1) {
    throw new Error('批量退款只支持同一租户的会员订单');
  }
  const [membershipCustomerId] = [...membershipCustomerIds];
  if (!membershipCustomerId) {
    throw new Error('会员订单缺少租户归属，无法退款');
  }

  const requesterCustomerId = normalizeString(params.requesterCustomerId);
  if (
    !params.allowCrossCustomerRefund &&
    requesterCustomerId &&
    requesterCustomerId !== membershipCustomerId
  ) {
    throw new Error('无权退款其他租户的会员订单');
  }

  await lockCustomerForVipMembership(membershipCustomerId, prisma);
  const entitlements =
    await assertVipMembershipRefundableEntitlementsWithClient(
      {
        customerId: membershipCustomerId,
        outTradeNos: params.outTradeNos,
      },
      prisma,
    );

  return entitlements.map((entitlement) => entitlement.outTradeNo);
}

async function createVipMembershipRefundRecord(params: {
  allowCrossCustomerRefund?: boolean;
  outTradeNo: string;
  reason?: string;
  requesterCustomerId?: unknown;
}) {
  const outTradeNo = normalizeString(params.outTradeNo);
  if (!outTradeNo) {
    throw new Error('缺少会员支付订单号');
  }

  return withVipMembershipDb(() =>
    systemDbClient.$transaction(async (tx) => {
      const payment = await getVipMembershipPaymentByOutTradeNo(outTradeNo, tx);
      if (!payment) {
        throw new Error('会员支付订单不存在');
      }

      const membershipCustomerId = normalizeString(
        payment.targetCustomerId || payment.sourceCustomerId,
      );
      if (!membershipCustomerId) {
        throw new Error('会员订单缺少租户归属，无法退款');
      }

      const requesterCustomerId = normalizeString(params.requesterCustomerId);
      if (
        !params.allowCrossCustomerRefund &&
        requesterCustomerId &&
        requesterCustomerId !== membershipCustomerId
      ) {
        throw new Error('无权退款其他租户的会员订单');
      }

      await lockCustomerForVipMembership(membershipCustomerId, tx);
      const existingRefund = await tx.vipMembershipRefund.findFirst({
        where: {
          outTradeNo,
          status: {
            in: VIP_MEMBERSHIP_REFUND_REUSABLE_STATUSES,
          },
        },
      });

      if (
        existingRefund &&
        normalizeWechatRefundStatus(existingRefund.status) !== 'CREATE_FAILED'
      ) {
        return existingRefund;
      }

      if (normalizeString(payment.tradeState) !== 'SUCCESS') {
        throw new Error('仅已支付成功的会员订单可以退款');
      }
      if (!payment.transactionId) {
        throw new Error('会员订单缺少微信支付交易号，无法退款');
      }

      await assertVipMembershipRefundableEntitlementsWithClient(
        {
          customerId: membershipCustomerId,
          outTradeNos: [outTradeNo],
        },
        tx,
      );

      if (existingRefund) {
        return tx.vipMembershipRefund.update({
          data: {
            lastCheckedAt: new Date(),
            nextCheckAt: getRefundRecheckDate(),
            reason: normalizeString(params.reason) || existingRefund.reason,
            status: 'CREATE_PENDING',
          },
          where: { outRefundNo: existingRefund.outRefundNo },
        });
      }

      const outRefundNo = buildSystemRefundOutRefundNo(outTradeNo);

      return tx.vipMembershipRefund.create({
        data: {
          amountTotal: Number(payment.amountTotal || 0),
          centerUserId: payment.centerUserId,
          customerId: membershipCustomerId,
          nextCheckAt: getRefundRecheckDate(),
          outRefundNo,
          outTradeNo,
          reason: normalizeString(params.reason) || null,
          refundAmount: Number(payment.amountTotal || 0),
          status: 'CREATE_PENDING',
          transactionId: payment.transactionId,
        },
      });
    }),
  );
}

async function isTenantCustomerIdTaken(
  params: {
    customerId: string;
  },
  prisma: VipMembershipDbClient,
) {
  const [customerById, customerByCode, job] = await Promise.all([
    prisma.customer.findUnique({
      select: { customerId: true },
      where: { customerId: params.customerId },
    }),
    prisma.customer.findFirst({
      select: { customerId: true },
      where: { code: params.customerId },
    }),
    prisma.tenantProvisioningJob.findFirst({
      select: { id: true },
      where: {
        targetCustomerId: params.customerId,
      },
    }),
  ]);

  return Boolean(customerById || customerByCode || job);
}

async function buildTenantProvisioningTargetIdentity(
  params: {
    targetCity?: null | string;
    targetCompanyShortName?: null | string;
  },
  prisma: VipMembershipDbClient,
): Promise<TenantProvisioningTargetIdentity> {
  const profile = normalizeTenantIdentityProfile({
    city: params.targetCity,
    companyShortName: params.targetCompanyShortName,
  });
  const baseCustomerId = buildTenantCustomerIdBase(profile);

  for (let ordinal = 1; ordinal <= 100; ordinal += 1) {
    const customerId = buildTenantCustomerIdCandidate(baseCustomerId, ordinal);
    const customerIdTaken = await isTenantCustomerIdTaken(
      {
        customerId,
      },
      prisma,
    );
    if (customerIdTaken) {
      continue;
    }

    return {
      city: profile.city,
      companyShortName: profile.companyShortName,
      customerId,
    };
  }

  throw new Error('无法生成不冲突的专属空间标识，请调整城市或公司简称');
}

function hasTenantIdentityInput(input: undefined | VipTenantIdentityInput) {
  return (
    Boolean(normalizeString(input?.city)) ||
    Boolean(normalizeString(input?.companyShortName))
  );
}

function toTenantProvisioningDraft(input: {
  targetCity?: null | string;
  targetCompanyShortName?: null | string;
}): null | TenantProvisioningDraft {
  const city = normalizeString(input.targetCity);
  const companyShortName = normalizeString(input.targetCompanyShortName);
  if (!city || !companyShortName) {
    return null;
  }

  return {
    city,
    companyShortName,
  };
}

export function getTenantProvisioningPaymentBlockedMessage(status: unknown) {
  return (
    TENANT_PROVISIONING_PAYMENT_BLOCKED_STATUS_MESSAGES[
      normalizeString(status)
    ] || ''
  );
}

function assertTenantProvisioningJobAcceptsNewPayment(
  job: null | { status?: string },
) {
  const message = getTenantProvisioningPaymentBlockedMessage(job?.status);
  if (message) {
    throw new Error(message);
  }
}

async function saveTenantProvisioningDraft(
  params: {
    initiatorCenterUserId: number;
    outTradeNo: string;
    sourceCustomerId: string;
    tenantIdentity?: VipTenantIdentityInput;
  },
  prisma: VipMembershipDbClient,
): Promise<null | TenantProvisioningDraft> {
  if (params.sourceCustomerId !== 'public') {
    return null;
  }

  const existingJob = await getTenantProvisioningJobByInitiatorCenterUserId(
    params.initiatorCenterUserId,
    prisma,
  );
  const existingDraft = existingJob
    ? toTenantProvisioningDraft(existingJob)
    : null;
  assertTenantProvisioningJobAcceptsNewPayment(existingJob);
  const profile = hasTenantIdentityInput(params.tenantIdentity)
    ? normalizeTenantIdentityProfile(params.tenantIdentity || {})
    : existingDraft ||
      normalizeTenantIdentityProfile(params.tenantIdentity || {});

  if (existingJob?.status && existingJob.status !== 'reserved') {
    await prisma.tenantProvisioningJob.update({
      data: {
        lastPaymentOutTradeNo: params.outTradeNo,
        ...(existingDraft
          ? {}
          : {
              targetCity: profile.city,
              targetCompanyShortName: profile.companyShortName,
            }),
      },
      where: { id: existingJob.id },
    });
    return existingDraft || profile;
  }

  const data = {
    lastPaymentOutTradeNo: params.outTradeNo,
    sourceCustomerId: params.sourceCustomerId,
    status: 'reserved',
    targetCity: profile.city,
    targetCompanyShortName: profile.companyShortName,
    targetCustomerId: null,
  };

  await (existingJob
    ? prisma.tenantProvisioningJob.update({
        data,
        where: { id: existingJob.id },
      })
    : prisma.tenantProvisioningJob.create({
        data: {
          ...data,
          initiatorCenterUserId: params.initiatorCenterUserId,
        },
      }));

  return profile;
}

async function upsertVipMembershipPaymentSnapshot(
  params: {
    amountTotal: number;
    centerUserId: number;
    outTradeNo: string;
    paidAt?: Date | null;
    rawAttach?: null | string;
    sourceCustomerId: string;
    targetCity?: null | string;
    targetCompanyShortName?: null | string;
    targetCustomerId?: null | string;
    tradeState: string;
    transactionId?: null | string;
    username?: null | string;
  },
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.vipMembershipPayment.upsert({
    create: {
      amountTotal: params.amountTotal,
      centerUserId: params.centerUserId,
      outTradeNo: params.outTradeNo,
      paidAt: params.paidAt || null,
      rawAttach: params.rawAttach || null,
      sourceCustomerId: params.sourceCustomerId,
      targetCity: params.targetCity || null,
      targetCompanyShortName: params.targetCompanyShortName || null,
      targetCustomerId: params.targetCustomerId || null,
      tradeState: params.tradeState,
      transactionId: params.transactionId || null,
      username: params.username || null,
    },
    update: {
      amountTotal: params.amountTotal,
      paidAt: params.paidAt || null,
      rawAttach: params.rawAttach || null,
      ...(params.targetCity === undefined
        ? {}
        : { targetCity: params.targetCity || null }),
      ...(params.targetCompanyShortName === undefined
        ? {}
        : { targetCompanyShortName: params.targetCompanyShortName || null }),
      ...(params.targetCustomerId === undefined
        ? {}
        : { targetCustomerId: params.targetCustomerId || null }),
      tradeState: params.tradeState,
      transactionId: params.transactionId || null,
      username: params.username || null,
    },
    where: {
      outTradeNo: params.outTradeNo,
    },
  });
}

async function createVipMembershipPaymentPendingSnapshot(
  params: {
    amountTotal: number;
    centerUserId: number;
    outTradeNo: string;
    rawAttach: string;
    sourceCustomerId: string;
    targetCity?: null | string;
    targetCompanyShortName?: null | string;
    targetCustomerId?: null | string;
    username?: string;
  },
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.vipMembershipPayment.create({
    data: {
      amountTotal: params.amountTotal,
      centerUserId: params.centerUserId,
      outTradeNo: params.outTradeNo,
      rawAttach: params.rawAttach,
      sourceCustomerId: params.sourceCustomerId,
      targetCity: params.targetCity || null,
      targetCompanyShortName: params.targetCompanyShortName || null,
      targetCustomerId: params.targetCustomerId || null,
      tradeState: 'NOTPAY',
      username: params.username || null,
    },
  });
}

async function ensureTenantProvisioningJob(
  params: {
    initiatorCenterUserId: number;
    outTradeNo: string;
    sourceCustomerId: string;
    targetCity?: null | string;
    targetCompanyShortName?: null | string;
  },
  prisma: VipMembershipDbClient = systemDbClient,
) {
  if (params.sourceCustomerId !== 'public') {
    return null;
  }

  const existingJob = await getTenantProvisioningJobByInitiatorCenterUserId(
    params.initiatorCenterUserId,
    prisma,
  );
  assertTenantProvisioningJobAcceptsNewPayment(existingJob);
  if (existingJob?.targetCustomerId && existingJob.status !== 'reserved') {
    return prisma.tenantProvisioningJob.update({
      data: {
        lastPaymentOutTradeNo: params.outTradeNo,
      },
      where: {
        id: existingJob.id,
      },
    });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const targetIdentity = await buildTenantProvisioningTargetIdentity(
      {
        targetCity: params.targetCity || existingJob?.targetCity || null,
        targetCompanyShortName:
          params.targetCompanyShortName ||
          existingJob?.targetCompanyShortName ||
          null,
      },
      prisma,
    );
    const pendingData = {
      errorMessage: null,
      heartbeatAt: null,
      lastPaymentOutTradeNo: params.outTradeNo,
      lockedAt: null,
      lockOwner: null,
      retryCount: 0,
      sourceCustomerId: params.sourceCustomerId,
      startedAt: null,
      status: 'pending',
      step: null,
      targetCity: targetIdentity.city,
      targetCompanyShortName: targetIdentity.companyShortName,
      targetCustomerId: targetIdentity.customerId,
    };

    try {
      if (!existingJob) {
        return await prisma.tenantProvisioningJob.create({
          data: {
            ...pendingData,
            initiatorCenterUserId: params.initiatorCenterUserId,
          },
        });
      }

      return await prisma.tenantProvisioningJob.update({
        data: pendingData,
        where: { id: existingJob.id },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('专属空间标识冲突，请稍后重试');
}

export function buildVipMembershipAttach(input: {
  centerUserId?: unknown;
  customerId?: unknown;
  userId?: unknown;
}) {
  const centerUserId = normalizePositiveInteger(input.centerUserId);
  const tenantUserId = normalizePositiveInteger(input.userId);
  const sourceCustomerId = normalizeString(input.customerId);

  if (!centerUserId || !tenantUserId || !sourceCustomerId) {
    throw new Error('缺少会员订单归属信息，无法创建微信支付 attach');
  }

  const attach = JSON.stringify({
    c: sourceCustomerId,
    cu: centerUserId,
    t: 'vip',
    u: tenantUserId,
  });

  if (Buffer.byteLength(attach, 'utf8') > 128) {
    throw new Error('会员订单微信 attach 超过 128 字节限制');
  }

  return attach;
}

export function extractVipMembershipCustomerId(attach: unknown) {
  return parseVipMembershipAttach(attach)?.sourceCustomerId;
}

export function isVipMembershipAttach(value: unknown) {
  return Boolean(parseVipMembershipAttach(value));
}

export async function recordVipMembershipPaymentPending(params: {
  amountTotal: number;
  centerUserId: number;
  outTradeNo: string;
  rawAttach: string;
  sourceCustomerId: string;
  tenantIdentity?: VipTenantIdentityInput;
  username?: string;
}) {
  return withVipMembershipDb(() =>
    systemDbClient.$transaction(async (tx) => {
      const targetDraft = await saveTenantProvisioningDraft(
        {
          initiatorCenterUserId: params.centerUserId,
          outTradeNo: params.outTradeNo,
          sourceCustomerId: params.sourceCustomerId,
          tenantIdentity: params.tenantIdentity,
        },
        tx,
      );

      await createVipMembershipPaymentPendingSnapshot(
        {
          amountTotal: params.amountTotal,
          centerUserId: params.centerUserId,
          outTradeNo: params.outTradeNo,
          rawAttach: params.rawAttach,
          sourceCustomerId: params.sourceCustomerId,
          targetCity: targetDraft?.city,
          targetCompanyShortName: targetDraft?.companyShortName,
          targetCustomerId: null,
          username: params.username,
        },
        tx,
      );

      return targetDraft;
    }),
  );
}

export async function getVipMembershipPaymentOwner(
  outTradeNo: string,
): Promise<null | { centerUserId: number; sourceCustomerId: string }> {
  const payment = await withVipMembershipDb(() =>
    getVipMembershipPaymentByOutTradeNo(outTradeNo),
  );
  return payment
    ? {
        centerUserId: Number(payment.centerUserId),
        sourceCustomerId: payment.sourceCustomerId,
      }
    : null;
}

export async function getTenantProvisioningProfileState(
  centerUserId: number,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  const job = await withVipMembershipDb(() =>
    getTenantProvisioningJobByInitiatorCenterUserId(centerUserId, prisma),
  );
  const rawStatus = job?.status || 'none';
  const status = (
    rawStatus === 'reserved' ? 'none' : rawStatus
  ) as VipMembershipProfileState['tenantProvisioningStatus'];
  const exposeProvisioningJob = rawStatus !== 'reserved';

  return {
    isTenantProvisioning: ['pending', 'provisioning'].includes(status),
    sourceCustomerId: exposeProvisioningJob
      ? job?.sourceCustomerId || undefined
      : undefined,
    targetCity: job?.targetCity || undefined,
    targetCompanyShortName: job?.targetCompanyShortName || undefined,
    targetCustomerId: exposeProvisioningJob
      ? job?.targetCustomerId || undefined
      : undefined,
    tenantProvisioningMessage: resolveProvisioningMessage(status),
    tenantProvisioningStatus: status,
  };
}

export async function getVipMembershipProfileState(input: {
  centerUserId: number;
  customerId: string;
}) {
  const membershipState = await getVipMembershipAccessState(input);
  const provisioningState = await getTenantProvisioningProfileState(
    input.centerUserId,
  );

  return {
    ...membershipState,
    ...provisioningState,
  } satisfies VipMembershipProfileState;
}

export async function getVipMembershipAccessState(input: {
  centerUserCreateTime?: Date | null;
  centerUserId?: unknown;
  centerUserTrialStartAt?: Date | null;
  customerId?: unknown;
  prisma?: VipMembershipDbClient;
}) {
  const prisma = input.prisma ?? systemDbClient;
  const centerUserId = normalizePositiveInteger(input.centerUserId);
  const providedCreateTime = input.centerUserCreateTime;
  const providedTrialStartAt = input.centerUserTrialStartAt;
  const inputCustomerId = normalizeString(input.customerId);
  const centerUser =
    providedCreateTime === undefined ||
    providedTrialStartAt === undefined ||
    !inputCustomerId
      ? await withVipMembershipDb(() =>
          centerUserId
            ? getCenterUserMembershipTrialProfile(centerUserId, prisma)
            : Promise.resolve(null),
        )
      : {
          createTime: providedCreateTime,
          customerType: inputCustomerId,
          membershipTrialStartAt: providedTrialStartAt,
        };
  const customerId =
    inputCustomerId || normalizeString(centerUser?.customerType);
  const membership = customerId
    ? await withVipMembershipDb(() =>
        getVipMembershipByCustomerId(customerId, prisma),
      )
    : null;

  const coreState = toVipMembershipCoreState(membership);
  const trialState =
    customerId === 'public'
      ? toTrialState(
          centerUser?.membershipTrialStartAt || centerUser?.createTime,
        )
      : toTrialState(null);
  const accessState = toVipMembershipAccessState(coreState, trialState);

  return {
    ...coreState,
    ...trialState,
    ...accessState,
  };
}

export async function appendVipMembershipInfo<T extends Record<string, any>>(
  userInfo: T,
): Promise<T & VipMembershipProfileState> {
  const centerUserId = resolveCenterUserId(userInfo);
  if (!centerUserId) {
    return userInfo as T & VipMembershipProfileState;
  }

  try {
    const defaultCustomerId = String(
      process.env.DEFAULT_CUSTOMER_ID || 'default',
    );
    const currentCustomerId = resolveCustomerId(userInfo);
    const [membershipState, customerProfile] = await Promise.all([
      getVipMembershipProfileState({
        centerUserId,
        customerId: currentCustomerId,
      }),
      getCustomerProfileByCustomerId(currentCustomerId),
    ]);
    const resolvedMembershipState =
      currentCustomerId === defaultCustomerId
        ? {
            ...membershipState,
            accessRestricted: false,
            accessScopeStatus: 'default_exempt' as const,
            membershipGateReason: 'none' as const,
          }
        : membershipState;
    const resolvedUserInfo = {
      ...userInfo,
      ...resolvedMembershipState,
    };
    return customerProfile
      ? { ...resolvedUserInfo, ...customerProfile }
      : resolvedUserInfo;
  } catch (error) {
    console.warn('补充会员信息失败，已忽略:', error);
    return userInfo as T & VipMembershipProfileState;
  }
}

export async function shouldBlockTenantWriteForProvisioning(input: {
  centerUserId?: unknown;
  customerId?: unknown;
}) {
  const customerId = normalizeString(input.customerId);
  if (customerId !== 'public') {
    return false;
  }

  const centerUserId = normalizePositiveInteger(input.centerUserId);
  if (!centerUserId) {
    return false;
  }

  const provisioningState =
    await getTenantProvisioningProfileState(centerUserId);
  return PROVISIONING_BLOCKING_STATUSES.has(
    provisioningState.tenantProvisioningStatus,
  );
}

export async function handleVipMembershipWechatOrder(
  input: VipMembershipWechatOrderInput,
): Promise<VipMembershipWechatOrderResult> {
  const outTradeNo = normalizeString(input.outTradeNo);
  if (!outTradeNo) {
    return {
      alreadyApplied: false,
      applied: false,
      matched: false,
      outTradeNo: '',
      reason: 'missing-out-trade-no',
    };
  }

  const attachPayload = parseVipMembershipAttach(input.attach);
  const matchedByAttach = Boolean(attachPayload);
  const amountTotal = resolveOrderAmountTotal(input.amount);
  const inputTradeState = normalizeString(input.tradeState) || undefined;
  const transactionId = normalizeString(input.transactionId) || undefined;
  const paidAt = parseDateValue(input.successTime);
  const rawAttach = normalizeString(input.attach) || null;

  return withVipMembershipDb(() =>
    systemDbClient.$transaction(async (tx) => {
      if (attachPayload?.centerUserId && attachPayload.sourceCustomerId) {
        await upsertVipMembershipPaymentSnapshot(
          {
            amountTotal:
              amountTotal ||
              resolveVipMembershipAmountTotal({
                centerUserId: attachPayload.centerUserId,
                sourceCustomerId: attachPayload.sourceCustomerId,
                tenantUserId: attachPayload.tenantUserId,
              }),
            centerUserId: attachPayload.centerUserId,
            outTradeNo,
            paidAt,
            rawAttach,
            sourceCustomerId: attachPayload.sourceCustomerId,
            tradeState: inputTradeState || 'NOTPAY',
            transactionId,
          },
          tx,
        );
      }

      const payment = await getVipMembershipPaymentByOutTradeNo(outTradeNo, tx);
      if (!payment) {
        return {
          alreadyApplied: false,
          applied: false,
          matched: matchedByAttach,
          outTradeNo,
          reason: matchedByAttach
            ? 'missing-user-context'
            : 'not-vip-membership',
        };
      }

      const amountContext = {
        centerUserId: payment.centerUserId || attachPayload?.centerUserId,
        sourceCustomerId:
          payment.sourceCustomerId || attachPayload?.sourceCustomerId,
        tenantUserId: attachPayload?.tenantUserId,
      };
      const resolvedAmountTotal =
        amountTotal || Number(payment.amountTotal || 0);
      const resolvedTradeState =
        inputTradeState || normalizeString(payment.tradeState) || 'NOTPAY';
      const resolvedTransactionId =
        transactionId || normalizeString(payment.transactionId) || undefined;
      const resolvedPaidAt = paidAt || payment.paidAt || null;
      const resolvedRawAttach = rawAttach || payment.rawAttach || null;

      await tx.vipMembershipPayment.update({
        data: {
          amountTotal: resolvedAmountTotal,
          paidAt: resolvedPaidAt,
          rawAttach: resolvedRawAttach,
          tradeState: resolvedTradeState,
          transactionId: resolvedTransactionId || null,
        },
        where: {
          outTradeNo,
        },
      });

      if (resolvedTradeState !== 'SUCCESS') {
        return {
          alreadyApplied: false,
          applied: false,
          matched: true,
          outTradeNo,
          reason: 'trade-not-success',
        };
      }

      const expectedAmountTotal =
        resolveVipMembershipAmountTotal(amountContext);
      if (resolvedAmountTotal !== expectedAmountTotal) {
        return {
          alreadyApplied: false,
          applied: false,
          matched: true,
          outTradeNo,
          reason: 'amount-mismatch',
        };
      }

      if (
        payment.sourceCustomerId === 'public' &&
        (!normalizeString(payment.targetCity) ||
          !normalizeString(payment.targetCompanyShortName))
      ) {
        return {
          alreadyApplied: false,
          applied: false,
          matched: true,
          outTradeNo,
          reason: 'missing-user-context',
        };
      }

      const staleProvisioningPayment =
        await getStaleTenantProvisioningPaymentState(
          {
            centerUserId: payment.centerUserId,
            outTradeNo,
            sourceCustomerId: payment.sourceCustomerId,
          },
          tx,
        );
      if (staleProvisioningPayment) {
        return {
          alreadyApplied: false,
          applied: false,
          matched: true,
          outTradeNo,
          provisioningStatus: staleProvisioningPayment.provisioningStatus,
          reason: 'stale-payment',
        };
      }

      if (payment.appliedAt) {
        const membershipCustomerId = normalizeString(
          payment.targetCustomerId || payment.sourceCustomerId,
        );
        const currentMembership = membershipCustomerId
          ? await getVipMembershipByCustomerId(membershipCustomerId, tx)
          : null;
        const provisioningState = await getTenantProvisioningProfileState(
          payment.centerUserId,
          tx,
        );
        return {
          alreadyApplied: true,
          applied: false,
          matched: true,
          outTradeNo,
          provisioningStatus: provisioningState.tenantProvisioningStatus,
          vipExpireAt: currentMembership?.expireAt?.toISOString(),
        };
      }

      const claimResult = await tx.vipMembershipPayment.updateMany({
        data: {
          appliedAt: new Date(),
        },
        where: {
          appliedAt: null,
          outTradeNo,
        },
      });

      if (claimResult.count === 0) {
        const membershipCustomerId = normalizeString(
          payment.targetCustomerId || payment.sourceCustomerId,
        );
        const currentMembership = membershipCustomerId
          ? await getVipMembershipByCustomerId(membershipCustomerId, tx)
          : null;
        const provisioningState = await getTenantProvisioningProfileState(
          payment.centerUserId,
          tx,
        );
        return {
          alreadyApplied: true,
          applied: false,
          matched: true,
          outTradeNo,
          provisioningStatus: provisioningState.tenantProvisioningStatus,
          vipExpireAt: currentMembership?.expireAt?.toISOString(),
        };
      }

      const provisioningJob = await ensureTenantProvisioningJob(
        {
          initiatorCenterUserId: payment.centerUserId,
          outTradeNo,
          sourceCustomerId: payment.sourceCustomerId,
          targetCity: payment.targetCity,
          targetCompanyShortName: payment.targetCompanyShortName,
        },
        tx,
      );
      const membershipCustomerId = normalizeString(
        provisioningJob?.targetCustomerId ||
          payment.targetCustomerId ||
          payment.sourceCustomerId,
      );
      if (!membershipCustomerId || membershipCustomerId === 'public') {
        return {
          alreadyApplied: false,
          applied: false,
          matched: true,
          outTradeNo,
          reason: 'missing-user-context',
        };
      }

      await lockCustomerForVipMembership(membershipCustomerId, tx);
      await getVipMembershipByCustomerIdForUpdate(membershipCustomerId, tx);
      const latestEntitlement = await getLatestActiveVipMembershipEntitlement(
        membershipCustomerId,
        tx,
      );
      const membershipExpireAt = latestEntitlement?.endAt || null;
      const now = new Date();
      const baseTime =
        membershipExpireAt && membershipExpireAt.getTime() > now.getTime()
          ? membershipExpireAt
          : resolvedPaidAt || now;
      const nextExpireAt = addMonths(baseTime, VIP_MEMBERSHIP_DURATION_MONTHS);

      const entitlement = await tx.vipMembershipEntitlement.create({
        data: {
          amountTotal: Number(payment.amountTotal || resolvedAmountTotal || 0),
          centerUserId: payment.centerUserId,
          customerId: membershipCustomerId,
          durationMonths: VIP_MEMBERSHIP_DURATION_MONTHS,
          endAt: nextExpireAt,
          outTradeNo,
          startAt: baseTime,
          transactionId: resolvedTransactionId || null,
        },
      });
      const currentMembership =
        await syncVipMembershipSummaryFromEntitlementsWithClient(
          membershipCustomerId,
          tx,
        );

      if (provisioningJob?.targetCustomerId && !payment.targetCustomerId) {
        await tx.vipMembershipPayment.update({
          data: {
            targetCity: provisioningJob.targetCity,
            targetCompanyShortName: provisioningJob.targetCompanyShortName,
            targetCustomerId: provisioningJob.targetCustomerId,
          },
          where: { outTradeNo },
        });
      }

      return {
        alreadyApplied: false,
        applied: true,
        matched: true,
        outTradeNo,
        provisioningStatus:
          (provisioningJob?.status as
            | undefined
            | VipMembershipProfileState['tenantProvisioningStatus']) || 'none',
        vipExpireAt:
          currentMembership.expireAt?.toISOString() ||
          entitlement.endAt.toISOString(),
      };
    }),
  );
}

export async function createVipMembershipRefund(params: {
  allowCrossCustomerRefund?: boolean;
  outTradeNo: string;
  reason?: string;
  requesterCustomerId?: unknown;
}) {
  const outTradeNo = normalizeString(params.outTradeNo);
  if (!outTradeNo) {
    throw new Error('缺少会员支付订单号');
  }

  const pendingRefund = await createVipMembershipRefundRecord(params);
  return submitVipMembershipRefundRecord(pendingRefund, params.reason);
}

export async function listVipMembershipRefundOrders(params: {
  allowCrossCustomerRead?: boolean;
  customerId?: unknown;
}) {
  const customerId = normalizeString(params.customerId);
  if (!customerId) {
    throw new Error('缺少租户信息，无法读取会员订单');
  }
  if (
    !params.allowCrossCustomerRead &&
    ['default', 'public'].includes(customerId)
  ) {
    return { items: [] };
  }

  return withVipMembershipDb(async () => {
    const [payments, entitlements, refunds] = await Promise.all([
      systemDbClient.vipMembershipPayment.findMany({
        orderBy: [{ paidAt: 'desc' }, { createTime: 'desc' }],
        where: {
          OR: [
            { targetCustomerId: customerId },
            { sourceCustomerId: customerId },
          ],
        },
      }),
      systemDbClient.vipMembershipEntitlement.findMany({
        orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
        where: {
          customerId,
        },
      }),
      systemDbClient.vipMembershipRefund.findMany({
        orderBy: [{ createTime: 'desc' }, { id: 'desc' }],
        where: {
          customerId,
        },
      }),
    ]);

    const entitlementMap = new Map(
      entitlements.map((entitlement) => [entitlement.outTradeNo, entitlement]),
    );
    const latestRefundMap = new Map<string, (typeof refunds)[number]>();
    for (const refund of refunds) {
      if (!latestRefundMap.has(refund.outTradeNo)) {
        latestRefundMap.set(refund.outTradeNo, refund);
      }
    }
    const activeStack = entitlements.filter(
      (entitlement) =>
        entitlement.status === VIP_MEMBERSHIP_ENTITLEMENT_ACTIVE_STATUS,
    );
    const refundableOutTradeNos =
      resolveVipMembershipRefundableOutTradeNos(activeStack);

    const items: VipMembershipRefundOrder[] = payments.map((payment) => {
      const entitlement = entitlementMap.get(payment.outTradeNo);
      const latestRefund = latestRefundMap.get(payment.outTradeNo);
      const tradeState = normalizeString(payment.tradeState) || 'UNKNOWN';
      const latestRefundStatus = latestRefund?.status;
      const refundActionAllowed =
        !latestRefund || isRefundOrderActionRetryable(latestRefundStatus);
      const refundable =
        tradeState === 'SUCCESS' &&
        Boolean(entitlement) &&
        refundActionAllowed &&
        refundableOutTradeNos.has(payment.outTradeNo);
      let refundDisabledReason: string | undefined;
      if (!refundable) {
        if (latestRefund && !refundActionAllowed) {
          refundDisabledReason =
            resolveRefundOrderDisabledReason(latestRefundStatus);
        } else if (tradeState !== 'SUCCESS') {
          refundDisabledReason = '仅支付成功的订单可以退款';
        } else if (!entitlement) {
          refundDisabledReason = '该订单缺少权益流水';
        } else if (
          entitlement.status !== VIP_MEMBERSHIP_ENTITLEMENT_ACTIVE_STATUS
        ) {
          refundDisabledReason = '该订单权益已失效';
        } else if (isRefundableFutureEntitlementStart(entitlement.startAt)) {
          refundDisabledReason = '需先退款更新的会员订单';
        } else {
          refundDisabledReason = '权益已开始，不能退款';
        }
      }

      return {
        amountTotal: Number(payment.amountTotal || 0),
        entitlement: entitlement
          ? {
              durationMonths: entitlement.durationMonths,
              endAt: entitlement.endAt.toISOString(),
              startAt: entitlement.startAt.toISOString(),
              status: entitlement.status,
            }
          : undefined,
        latestRefund: latestRefund
          ? {
              outRefundNo: latestRefund.outRefundNo,
              refundAmount: latestRefund.refundAmount,
              status: latestRefund.status,
              successAt: latestRefund.successAt?.toISOString(),
            }
          : undefined,
        outTradeNo: payment.outTradeNo,
        paidAt: payment.paidAt?.toISOString(),
        refundable,
        refundDisabledReason,
        targetCustomerId:
          normalizeString(
            payment.targetCustomerId || payment.sourceCustomerId,
          ) || undefined,
        tradeState,
        transactionId: payment.transactionId || undefined,
      };
    });

    return { items };
  });
}

export async function createVipMembershipRefundBatch(params: {
  allowCrossCustomerRefund?: boolean;
  outTradeNos: string[];
  reason?: string;
  requesterCustomerId?: unknown;
}) {
  const outTradeNos = params.outTradeNos
    .map((outTradeNo) => normalizeString(outTradeNo))
    .filter(Boolean);
  if (outTradeNos.length === 0) {
    throw new Error('缺少会员支付订单号');
  }
  if (new Set(outTradeNos).size !== outTradeNos.length) {
    throw new Error('批量退款订单号不能重复');
  }

  const stackOrderedOutTradeNos = await withVipMembershipDb(() =>
    systemDbClient.$transaction((tx) =>
      resolveVipMembershipRefundStackOrderWithClient(
        {
          allowCrossCustomerRefund: params.allowCrossCustomerRefund,
          outTradeNos,
          requesterCustomerId: params.requesterCustomerId,
        },
        tx,
      ),
    ),
  );

  const results: VipMembershipRefundResult[] = [];
  for (const outTradeNo of stackOrderedOutTradeNos) {
    const pendingRefund = await createVipMembershipRefundRecord({
      ...params,
      outTradeNo,
    });
    const result = await submitVipMembershipRefundRecord(
      pendingRefund,
      params.reason,
      {
        throwOnCreateFailure: false,
      },
    );
    results.push(result);
    if (normalizeWechatRefundStatus(result.status) !== 'SUCCESS') {
      break;
    }
  }
  return results;
}

export async function handleVipMembershipWechatRefundNotification(params: {
  eventId?: string;
  resource: Record<string, any>;
}) {
  const resource = params.resource;
  const outRefundNo = normalizeString(resource.out_refund_no);
  if (!outRefundNo) {
    return null;
  }

  return withVipMembershipDb(() =>
    systemDbClient.$transaction((tx) =>
      applyVipMembershipRefundWithClient(
        {
          notifyEventId: params.eventId,
          outRefundNo,
          providerRaw: resource,
          refundId: resource.refund_id,
          status: resource.refund_status || resource.status,
          successTime: resource.success_time,
        },
        tx,
      ),
    ),
  );
}

export async function reconcileVipMembershipRefundsOnce(
  limit = VIP_MEMBERSHIP_REFUND_RECONCILE_LIMIT,
) {
  const dueRefunds = await withVipMembershipDb(() =>
    systemDbClient.vipMembershipRefund.findMany({
      orderBy: [{ nextCheckAt: 'asc' }, { createTime: 'asc' }],
      take: Math.max(1, Math.floor(limit)),
      where: {
        nextCheckAt: {
          lte: new Date(),
        },
        status: {
          notIn: ['ABNORMAL', 'CLOSED', 'SUCCESS'],
        },
      },
    }),
  );

  let processed = 0;
  for (const refund of dueRefunds) {
    try {
      const refundStatus = await resolveWechatRefundStatusForLocalRefund(
        refund,
        refund.reason || undefined,
      );
      await withVipMembershipDb(() =>
        systemDbClient.$transaction((tx) =>
          applyVipMembershipRefundWithClient(
            {
              outRefundNo: refundStatus.outRefundNo,
              providerRaw: refundStatus,
              refundId: refundStatus.refundId,
              status: refundStatus.status,
              successTime: refundStatus.successTime,
            },
            tx,
          ),
        ),
      );
      processed += 1;
    } catch (error) {
      console.warn('会员退款对账失败:', {
        error: error instanceof Error ? error.message : String(error),
        outRefundNo: refund.outRefundNo,
      });
      await withVipMembershipDb(() =>
        systemDbClient.vipMembershipRefund.update({
          data: {
            lastCheckedAt: new Date(),
            nextCheckAt: getRefundRecheckDate(),
          },
          where: { outRefundNo: refund.outRefundNo },
        }),
      );
    }
  }

  return processed;
}

export async function reconcileVipMembershipManualRefundsOnce(
  limit = VIP_MEMBERSHIP_REFUND_RECONCILE_LIMIT,
) {
  const now = new Date();
  const payments = await withVipMembershipDb(() =>
    systemDbClient.vipMembershipPayment.findMany({
      orderBy: [{ refundCheckedAt: 'asc' }, { updateTime: 'desc' }],
      take: Math.max(1, Math.floor(limit)),
      where: {
        OR: [{ refundCheckedAt: null }, { refundCheckedAt: { lte: now } }],
        tradeState: 'SUCCESS',
      },
    }),
  );

  let processed = 0;
  for (const payment of payments) {
    try {
      const orderStatus = await queryWechatPayOrder(payment.outTradeNo);
      if (normalizeString(orderStatus.tradeState) !== 'REFUND') {
        await withVipMembershipDb(() =>
          systemDbClient.vipMembershipPayment.update({
            data: {
              refundCheckedAt: getManualRefundRecheckDate(),
            },
            where: { outTradeNo: payment.outTradeNo },
          }),
        );
        continue;
      }

      const membershipCustomerId = normalizeString(
        payment.targetCustomerId || payment.sourceCustomerId,
      );
      if (!membershipCustomerId) {
        await withVipMembershipDb(() =>
          systemDbClient.vipMembershipPayment.update({
            data: {
              refundCheckedAt: getManualRefundRecheckDate(),
            },
            where: { outTradeNo: payment.outTradeNo },
          }),
        );
        continue;
      }

      await withVipMembershipDb(() =>
        systemDbClient.$transaction(async (tx) => {
          const entitlement = await tx.vipMembershipEntitlement.findUnique({
            where: { outTradeNo: payment.outTradeNo },
          });
          if (!entitlement) {
            await upsertManualReconciledVipMembershipRefundWithClient(
              {
                channel: 'manual_reconcile_ignored',
                customerId: membershipCustomerId,
                payment,
                providerRaw: orderStatus,
                status: VIP_MEMBERSHIP_REFUND_IGNORED_NO_ENTITLEMENT_STATUS,
              },
              tx,
            );
            await tx.vipMembershipPayment.update({
              data: {
                refundCheckedAt: getManualRefundRecheckDate(),
                tradeState: 'REFUND',
              },
              where: { outTradeNo: payment.outTradeNo },
            });
            return;
          }

          if (entitlement.customerId !== membershipCustomerId) {
            await upsertManualReconciledVipMembershipRefundWithClient(
              {
                channel: 'manual_reconcile_review',
                customerId: membershipCustomerId,
                payment,
                providerRaw: orderStatus,
                status: VIP_MEMBERSHIP_REFUND_MANUAL_REVIEW_STATUS,
                successAt: null,
              },
              tx,
            );
            await tx.vipMembershipPayment.update({
              data: {
                refundCheckedAt: getManualRefundRecheckDate(),
                tradeState: 'REFUND',
              },
              where: { outTradeNo: payment.outTradeNo },
            });
            return;
          }

          await upsertManualReconciledVipMembershipRefundWithClient(
            {
              customerId: membershipCustomerId,
              payment,
              providerRaw: orderStatus,
              status: 'SUCCESS',
            },
            tx,
          );
          await tx.vipMembershipPayment.update({
            data: {
              refundCheckedAt: getManualRefundRecheckDate(),
            },
            where: { outTradeNo: payment.outTradeNo },
          });
          await revokeVipMembershipForRefundWithClient(payment.outTradeNo, tx);
        }),
      );
      processed += 1;
    } catch (error) {
      console.warn('会员手工退款对账失败:', {
        error: error instanceof Error ? error.message : String(error),
        outTradeNo: payment.outTradeNo,
      });
      await withVipMembershipDb(() =>
        systemDbClient.vipMembershipPayment.update({
          data: {
            refundCheckedAt: getRefundRecheckDate(),
          },
          where: { outTradeNo: payment.outTradeNo },
        }),
      );
    }
  }

  return processed;
}
