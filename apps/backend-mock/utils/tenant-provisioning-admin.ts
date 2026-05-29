import { systemDbClient } from '~/utils/db';

type TenantProvisioningRequeueJob = {
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

export class TenantProvisioningRequeueError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'TenantProvisioningRequeueError';
  }
}

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeJob(job: TenantProvisioningRequeueJob) {
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

export async function requeueFailedManualTenantProvisioningJob(input: {
  confirmation?: unknown;
  execute?: unknown;
  jobId?: unknown;
  operator?: unknown;
  reason?: unknown;
}) {
  const jobId = normalizePositiveInteger(input.jobId);
  if (!jobId) {
    throw new TenantProvisioningRequeueError('jobId 必须是正整数');
  }

  const execute = input.execute === true;
  const confirmation = normalizeString(input.confirmation);
  const operator = normalizeString(input.operator) || 'unknown';
  const reason = normalizeString(input.reason);

  const job = await systemDbClient.tenantProvisioningJob.findUnique({
    where: { id: jobId },
  });
  if (!job) {
    throw new TenantProvisioningRequeueError(
      `租户开通任务不存在: ${jobId}`,
      404,
    );
  }

  if (job.status !== 'failed_manual') {
    throw new TenantProvisioningRequeueError(
      `仅允许重排 failed_manual 任务，当前状态为 ${job.status}`,
      409,
    );
  }

  if (job.sourceCustomerId !== 'public') {
    throw new TenantProvisioningRequeueError(
      `仅允许重排 public -> 租户任务，当前 sourceCustomerId=${job.sourceCustomerId}`,
      409,
    );
  }

  if (!job.targetCustomerId) {
    throw new TenantProvisioningRequeueError(
      '任务缺少 targetCustomerId，不能安全重排，请先定位根因',
      409,
    );
  }

  if (!job.sourceOrgId) {
    throw new TenantProvisioningRequeueError(
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
    throw new TenantProvisioningRequeueError(
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
    throw new TenantProvisioningRequeueError(
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
      throw new TenantProvisioningRequeueError(
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
