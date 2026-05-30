import type { UserInfoForToken } from '~/utils/user-service';

import { systemDbClient } from '~/utils/db';

type OrganizationProvisioningRequeueJob = {
  completedAt: Date | null;
  createTime: Date | null;
  errorMessage: null | string;
  heartbeatAt: Date | null;
  id: number;
  initiatorCenterUserId: number;
  lastPaymentOutTradeNo: null | string;
  lockedAt: Date | null;
  lockOwner: null | string;
  retryCount: number;
  sourceCustomerId: string;
  sourceOrgId: null | number;
  startedAt: Date | null;
  status: string;
  step: null | string;
  targetCity: null | string;
  targetCompanyShortName: null | string;
  targetCustomerId: null | string;
  targetDbName: null | string;
  updateTime: Date | null;
};

export class OrganizationProvisioningRequeueError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'OrganizationProvisioningRequeueError';
  }
}

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function normalizeLimit(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  const limit = Number(raw || 50);
  if (!Number.isFinite(limit)) {
    return 50;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeJob(job: OrganizationProvisioningRequeueJob) {
  return {
    completedAt: serializeDate(job.completedAt),
    createTime: serializeDate(job.createTime),
    errorMessage: job.errorMessage,
    heartbeatAt: serializeDate(job.heartbeatAt),
    id: job.id,
    initiatorCenterUserId: job.initiatorCenterUserId,
    lastPaymentOutTradeNo: job.lastPaymentOutTradeNo,
    lockedAt: serializeDate(job.lockedAt),
    lockOwner: job.lockOwner,
    retryCount: job.retryCount,
    sourceOrgId: job.sourceOrgId,
    sourceCustomerId: job.sourceCustomerId,
    startedAt: serializeDate(job.startedAt),
    status: job.status,
    step: job.step,
    targetCity: job.targetCity,
    targetCompanyShortName: job.targetCompanyShortName,
    targetCustomerId: job.targetCustomerId,
    targetDbName: job.targetDbName,
    updateTime: serializeDate(job.updateTime),
  };
}

function buildRequeueConfirmation(job: {
  id: number;
  targetCustomerId: null | string;
}) {
  return `requeue_failed_manual:${job.id}:${job.targetCustomerId || 'missing_target'}`;
}

export function canManageOrganizationProvisioningAdmin(
  userinfo: UserInfoForToken,
) {
  const defaultCustomerId = String(
    process.env.DEFAULT_CUSTOMER_ID || 'default',
  );
  return (
    userinfo.customerId === defaultCustomerId &&
    Array.isArray(userinfo.roles) &&
    userinfo.roles.includes('Super')
  );
}

export async function listFailedManualOrganizationProvisioningJobs(
  input: {
    limit?: unknown;
  } = {},
) {
  const limit = normalizeLimit(input.limit);
  const jobs = await systemDbClient.tenantProvisioningJob.findMany({
    orderBy: [{ updateTime: 'desc' }, { id: 'desc' }],
    take: limit,
    where: {
      status: 'failed_manual',
    },
  });
  const sourceOrgIds = [
    ...new Set(
      jobs
        .map((job) => normalizePositiveInteger(job.sourceOrgId))
        .filter(Boolean),
    ),
  ];
  const initiatorCenterUserIds = [
    ...new Set(jobs.map((job) => Number(job.initiatorCenterUserId))),
  ].filter((id) => Number.isInteger(id) && id > 0);
  const outTradeNos = [
    ...new Set(jobs.map((job) => normalizeString(job.lastPaymentOutTradeNo))),
  ].filter(Boolean);

  const [organizations, initiators, payments] = await Promise.all([
    sourceOrgIds.length > 0
      ? systemDbClient.organization.findMany({
          select: {
            id: true,
            name: true,
            sourceCustomerId: true,
            status: true,
          },
          where: { id: { in: sourceOrgIds } },
        })
      : [],
    initiatorCenterUserIds.length > 0
      ? systemDbClient.user.findMany({
          select: {
            customerType: true,
            id: true,
            realName: true,
            status: true,
            username: true,
          },
          where: { id: { in: initiatorCenterUserIds } },
        })
      : [],
    outTradeNos.length > 0
      ? systemDbClient.vipMembershipPayment.findMany({
          select: {
            amountTotal: true,
            outTradeNo: true,
            paidAt: true,
            sourceOrgId: true,
            targetCustomerId: true,
            tradeState: true,
            transactionId: true,
          },
          where: { outTradeNo: { in: outTradeNos } },
        })
      : [],
  ]);

  const organizationMap = new Map(
    organizations.map(
      (organization) => [Number(organization.id), organization] as const,
    ),
  );
  const initiatorMap = new Map(
    initiators.map((initiator) => [Number(initiator.id), initiator] as const),
  );
  const paymentMap = new Map(
    payments.map((payment) => [payment.outTradeNo, payment] as const),
  );

  return {
    items: jobs.map((job) => {
      const sourceOrgId = normalizePositiveInteger(job.sourceOrgId);
      const outTradeNo = normalizeString(job.lastPaymentOutTradeNo);
      const organization = sourceOrgId
        ? organizationMap.get(sourceOrgId)
        : undefined;
      const initiator = initiatorMap.get(Number(job.initiatorCenterUserId));
      const payment = outTradeNo ? paymentMap.get(outTradeNo) : undefined;

      return {
        ...serializeJob(job),
        initiator: initiator
          ? {
              customerType: initiator.customerType,
              id: Number(initiator.id),
              realName: initiator.realName,
              status: initiator.status,
              username: initiator.username,
            }
          : undefined,
        lastPayment: payment
          ? {
              amountTotal: payment.amountTotal,
              outTradeNo: payment.outTradeNo,
              paidAt: serializeDate(payment.paidAt),
              sourceOrgId: payment.sourceOrgId,
              targetCustomerId: payment.targetCustomerId,
              tradeState: payment.tradeState,
              transactionId: payment.transactionId,
            }
          : undefined,
        organization: organization
          ? {
              id: Number(organization.id),
              name: organization.name,
              sourceCustomerId: organization.sourceCustomerId,
              status: organization.status,
            }
          : undefined,
      };
    }),
    total: jobs.length,
  };
}

export async function requeueFailedManualOrganizationProvisioningJob(input: {
  confirmation?: unknown;
  execute?: unknown;
  jobId?: unknown;
  operator?: unknown;
  reason?: unknown;
}) {
  const jobId = normalizePositiveInteger(input.jobId);
  if (!jobId) {
    throw new OrganizationProvisioningRequeueError('jobId 必须是正整数');
  }

  const execute = input.execute === true;
  const confirmation = normalizeString(input.confirmation);
  const operator = normalizeString(input.operator) || 'unknown';
  const reason = normalizeString(input.reason);

  const job = await systemDbClient.tenantProvisioningJob.findUnique({
    where: { id: jobId },
  });
  if (!job) {
    throw new OrganizationProvisioningRequeueError(
      `租户开通任务不存在: ${jobId}`,
      404,
    );
  }

  if (job.status !== 'failed_manual') {
    throw new OrganizationProvisioningRequeueError(
      `仅允许重排 failed_manual 任务，当前状态为 ${job.status}`,
      409,
    );
  }

  if (job.sourceCustomerId !== 'public') {
    throw new OrganizationProvisioningRequeueError(
      `仅允许重排 public -> 租户任务，当前 sourceCustomerId=${job.sourceCustomerId}`,
      409,
    );
  }

  if (!job.targetCustomerId) {
    throw new OrganizationProvisioningRequeueError(
      '任务缺少 targetCustomerId，不能安全重排，请先定位根因',
      409,
    );
  }

  if (!job.sourceOrgId) {
    throw new OrganizationProvisioningRequeueError(
      '任务缺少 sourceOrgId，不能安全重排，请先按组织补齐开通任务',
      409,
    );
  }

  const organization = await systemDbClient.organization.findFirst({
    select: {
      id: true,
      name: true,
      sourceCustomerId: true,
      status: true,
    },
    where: {
      id: Number(job.sourceOrgId),
      sourceCustomerId: job.sourceCustomerId,
      status: 'active',
    },
  });
  if (!organization) {
    throw new OrganizationProvisioningRequeueError(
      `任务关联组织不存在或不可用: sourceOrgId=${job.sourceOrgId}`,
      409,
    );
  }

  const expectedConfirmation = buildRequeueConfirmation(job);
  const preview = {
    confirmation: expectedConfirmation,
    execute: false,
    job: serializeJob(job),
    organization,
    message:
      '预览模式，未写入。确认已修复根因后，携带 execute=true 和 confirmation 重排任务。',
  };

  if (!execute) {
    return preview;
  }

  if (confirmation !== expectedConfirmation) {
    throw new OrganizationProvisioningRequeueError(
      `确认串不匹配，请使用 confirmation=${expectedConfirmation}`,
      400,
    );
  }

  const updated = await systemDbClient.$transaction(async (tx) => {
    const result = await tx.tenantProvisioningJob.updateMany({
      data: {
        completedAt: null,
        errorMessage: null,
        heartbeatAt: null,
        lockedAt: null,
        lockOwner: null,
        retryCount: 0,
        startedAt: null,
        status: 'pending',
        step: 'manual_requeued',
      },
      where: {
        id: job.id,
        status: 'failed_manual',
      },
    });

    if (result.count === 0) {
      throw new OrganizationProvisioningRequeueError(
        '任务状态已变化，重排未执行，请重新预览后再操作',
        409,
      );
    }

    return tx.tenantProvisioningJob.findUniqueOrThrow({
      where: { id: job.id },
    });
  });

  console.info('租户开通 failed_manual 任务已手动重排', {
    jobId: job.id,
    operator,
    organizationId: organization.id,
    reason,
    targetCustomerId: job.targetCustomerId,
  });

  return {
    confirmation: expectedConfirmation,
    execute: true,
    job: serializeJob(updated),
    message: '任务已重置为 pending，worker 下一轮将全量重建目标库。',
    organization,
    previousJob: serializeJob(job),
  };
}
