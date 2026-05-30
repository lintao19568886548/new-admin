import { requestClient } from '#/api/request';

export namespace OrganizationProvisioningAdminApi {
  export interface SerializedJob {
    completedAt: null | string;
    createTime: null | string;
    errorMessage: null | string;
    heartbeatAt: null | string;
    id: number;
    initiatorCenterUserId: number;
    lastPaymentOutTradeNo: null | string;
    lockedAt: null | string;
    lockOwner: null | string;
    retryCount: number;
    sourceCustomerId: string;
    sourceOrgId: null | number;
    startedAt: null | string;
    status: string;
    step: null | string;
    targetCity: null | string;
    targetCompanyShortName: null | string;
    targetCustomerId: null | string;
    targetDbName: null | string;
    updateTime: null | string;
  }

  export interface OrganizationSummary {
    id: number;
    name: string;
    sourceCustomerId: string;
    status: string;
  }

  export interface InitiatorSummary {
    customerType?: null | string;
    id: number;
    realName?: null | string;
    status?: null | number;
    username?: null | string;
  }

  export interface PaymentSummary {
    amountTotal: number;
    outTradeNo: string;
    paidAt?: null | string;
    sourceOrgId?: null | number;
    targetCustomerId?: null | string;
    tradeState: string;
    transactionId?: null | string;
  }

  export interface FailedManualJob extends SerializedJob {
    initiator?: InitiatorSummary;
    lastPayment?: PaymentSummary;
    organization?: OrganizationSummary;
  }

  export interface FailedManualJobList {
    items: FailedManualJob[];
    total: number;
  }

  export interface RequeueResult {
    confirmation: string;
    execute: boolean;
    job: SerializedJob;
    message: string;
    organization: OrganizationSummary;
    previousJob?: SerializedJob;
  }
}

export function getFailedManualOrganizationProvisioningJobs(limit = 50) {
  return requestClient.get<OrganizationProvisioningAdminApi.FailedManualJobList>(
    '/organization/provisioning/failed-manual',
    {
      params: { limit },
    },
  );
}

export function requeueFailedManualOrganizationProvisioningJob(data: {
  confirmation?: string;
  execute?: boolean;
  jobId: number;
  reason?: string;
}) {
  return requestClient.post<OrganizationProvisioningAdminApi.RequeueResult>(
    '/organization/provisioning/requeue-failed-manual',
    data,
  );
}
