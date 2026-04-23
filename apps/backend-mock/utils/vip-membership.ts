import type { PrismaClient } from '@prisma/.prisma/center-client/index.js';

import { Prisma } from '@prisma/.prisma/center-client/index.js';
import { systemDbClient } from '~/utils/db';

const VIP_MEMBERSHIP_ACTIVE_STATUS = 'active';
const VIP_MEMBERSHIP_ATTACH_TAG = 'vip-membership';
const VIP_MEMBERSHIP_DURATION_MONTHS = 1;
const PROVISIONING_BLOCKING_STATUSES = new Set([
  'failed_manual',
  'failed_retryable',
  'pending',
  'provisioning',
]);
export const VIP_MEMBERSHIP_AMOUNT_TOTAL = 98_000;

type VipMembershipDbClient = Prisma.TransactionClient | PrismaClient;

interface VipMembershipAttachPayload {
  centerUserId?: number;
  sourceCustomerId?: string;
  tag: 'vip';
  tenantUserId?: number;
}

export interface VipMembershipProfileState {
  isMember: boolean;
  isMembership: boolean;
  isTenantProvisioning: boolean;
  isVip: boolean;
  memberExpireAt?: string;
  memberStatus: 'active' | 'expired' | 'inactive';
  membershipExpireAt?: string;
  membershipStatus: 'active' | 'expired' | 'inactive';
  sourceCustomerId?: string;
  targetCustomerId?: string;
  tenantProvisioningMessage?: string;
  tenantProvisioningStatus:
    | 'active'
    | 'failed_manual'
    | 'failed_retryable'
    | 'none'
    | 'pending'
    | 'provisioning';
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
    | 'trade-not-success';
  vipExpireAt?: string;
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

function resolveCenterUserId(userInfo: Record<string, any>) {
  return (
    normalizePositiveInteger(userInfo.centerUserId) ||
    normalizePositiveInteger(userInfo.id)
  );
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

async function getVipMembershipByCenterUserId(
  centerUserId: number,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.vipMembership.findUnique({
    select: {
      expireAt: true,
      status: true,
    },
    where: {
      centerUserId,
    },
  });
}

async function getVipMembershipByCenterUserIdForUpdate(
  centerUserId: number,
  prisma: VipMembershipDbClient,
) {
  const rows = await prisma.$queryRaw<
    Array<{
      expireAt: Date;
      status: string;
    }>
  >(
    Prisma.sql`SELECT expire_at AS expireAt, status FROM vip_membership WHERE center_user_id = ${centerUserId} FOR UPDATE`,
  );

  return rows[0] || null;
}

async function lockCenterUserForVipMembership(
  centerUserId: number,
  prisma: VipMembershipDbClient,
) {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`SELECT id FROM \`user\` WHERE id = ${centerUserId} FOR UPDATE`,
  );

  if (rows.length === 0) {
    throw new Error('中心用户不存在，无法开通会员');
  }
}

async function getTenantProvisioningJobByCenterUserId(
  centerUserId: number,
  prisma: VipMembershipDbClient = systemDbClient,
) {
  return prisma.tenantProvisioningJob.findUnique({
    where: {
      centerUserId,
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

async function upsertVipMembershipPaymentSnapshot(
  params: {
    amountTotal: number;
    centerUserId: number;
    outTradeNo: string;
    paidAt?: Date | null;
    rawAttach?: null | string;
    sourceCustomerId: string;
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
      targetCustomerId: params.targetCustomerId || null,
      tradeState: params.tradeState,
      transactionId: params.transactionId || null,
      username: params.username || null,
    },
    update: {
      amountTotal: params.amountTotal,
      paidAt: params.paidAt || null,
      rawAttach: params.rawAttach || null,
      targetCustomerId: params.targetCustomerId || null,
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
      tradeState: 'NOTPAY',
      username: params.username || null,
    },
  });
}

async function ensureTenantProvisioningJob(
  params: {
    centerUserId: number;
    outTradeNo: string;
    sourceCustomerId: string;
    targetCustomerId?: null | string;
  },
  prisma: VipMembershipDbClient = systemDbClient,
) {
  if (params.sourceCustomerId !== 'public') {
    return null;
  }

  return prisma.tenantProvisioningJob.upsert({
    create: {
      centerUserId: params.centerUserId,
      lastPaymentOutTradeNo: params.outTradeNo,
      sourceCustomerId: params.sourceCustomerId,
      status: 'pending',
      targetCustomerId: params.targetCustomerId || null,
    },
    update: {
      lastPaymentOutTradeNo: params.outTradeNo,
    },
    where: {
      centerUserId: params.centerUserId,
    },
  });
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
  username?: string;
}) {
  await withVipMembershipDb(() =>
    createVipMembershipPaymentPendingSnapshot({
      amountTotal: params.amountTotal,
      centerUserId: params.centerUserId,
      outTradeNo: params.outTradeNo,
      rawAttach: params.rawAttach,
      sourceCustomerId: params.sourceCustomerId,
      username: params.username,
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
    getTenantProvisioningJobByCenterUserId(centerUserId, prisma),
  );
  const status =
    (job?.status as VipMembershipProfileState['tenantProvisioningStatus']) ||
    'none';

  return {
    isTenantProvisioning: ['pending', 'provisioning'].includes(status),
    sourceCustomerId: job?.sourceCustomerId || undefined,
    targetCustomerId: job?.targetCustomerId || undefined,
    tenantProvisioningMessage: resolveProvisioningMessage(status),
    tenantProvisioningStatus: status,
  };
}

export async function getVipMembershipProfileState(centerUserId: number) {
  const membership = await withVipMembershipDb(() =>
    getVipMembershipByCenterUserId(centerUserId),
  );
  const coreState = toVipMembershipCoreState(membership);
  const provisioningState =
    await getTenantProvisioningProfileState(centerUserId);

  return {
    ...coreState,
    ...provisioningState,
  } satisfies VipMembershipProfileState;
}

export async function appendVipMembershipInfo<T extends Record<string, any>>(
  userInfo: T,
): Promise<T & VipMembershipProfileState> {
  const centerUserId = resolveCenterUserId(userInfo);
  if (!centerUserId) {
    return userInfo as T & VipMembershipProfileState;
  }

  try {
    const membershipState = await getVipMembershipProfileState(centerUserId);
    return {
      ...userInfo,
      ...membershipState,
    };
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
            amountTotal: amountTotal || VIP_MEMBERSHIP_AMOUNT_TOTAL,
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

      if (resolvedAmountTotal !== VIP_MEMBERSHIP_AMOUNT_TOTAL) {
        return {
          alreadyApplied: false,
          applied: false,
          matched: true,
          outTradeNo,
          reason: 'amount-mismatch',
        };
      }

      if (payment.appliedAt) {
        const currentMembership = await getVipMembershipByCenterUserId(
          payment.centerUserId,
          tx,
        );
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
        const currentMembership = await getVipMembershipByCenterUserId(
          payment.centerUserId,
          tx,
        );
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

      await lockCenterUserForVipMembership(payment.centerUserId, tx);
      const currentMembership = await getVipMembershipByCenterUserIdForUpdate(
        payment.centerUserId,
        tx,
      );
      const membershipExpireAt = currentMembership?.expireAt || null;
      const now = new Date();
      const baseTime =
        membershipExpireAt && membershipExpireAt.getTime() > now.getTime()
          ? membershipExpireAt
          : resolvedPaidAt || now;
      const nextExpireAt = addMonths(baseTime, VIP_MEMBERSHIP_DURATION_MONTHS);

      await tx.vipMembership.upsert({
        create: {
          centerUserId: payment.centerUserId,
          expireAt: nextExpireAt,
          lastOutTradeNo: outTradeNo,
          lastTransactionId: resolvedTransactionId || null,
          status: VIP_MEMBERSHIP_ACTIVE_STATUS,
        },
        update: {
          expireAt: nextExpireAt,
          lastOutTradeNo: outTradeNo,
          lastTransactionId: resolvedTransactionId || null,
          status: VIP_MEMBERSHIP_ACTIVE_STATUS,
        },
        where: {
          centerUserId: payment.centerUserId,
        },
      });

      const provisioningJob = await ensureTenantProvisioningJob(
        {
          centerUserId: payment.centerUserId,
          outTradeNo,
          sourceCustomerId: payment.sourceCustomerId,
          targetCustomerId: payment.targetCustomerId,
        },
        tx,
      );

      return {
        alreadyApplied: false,
        applied: true,
        matched: true,
        outTradeNo,
        provisioningStatus:
          (provisioningJob?.status as
            | undefined
            | VipMembershipProfileState['tenantProvisioningStatus']) || 'none',
        vipExpireAt: nextExpireAt.toISOString(),
      };
    }),
  );
}
