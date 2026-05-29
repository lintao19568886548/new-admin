import { requestClient } from '#/api/request';

export interface WechatAppLaunchParams {
  appId: string;
  nonceStr: string;
  outTradeNo: string;
  packageValue: 'Sign=WXPay';
  partnerId: string;
  prepayId: string;
  sign: string;
  timeStamp: string;
}

export interface CreateWechatAppPrepayParams {
  amount: number;
  attach?: string;
  currency?: string;
  description: string;
  deviceId?: string;
  outTradeNo?: string;
  tenantIdentity?: {
    city: string;
    companyShortName: string;
  };
}

export interface CreateWechatAppPrepayResponse {
  checkoutFlowToken?: string;
  launchParams: WechatAppLaunchParams;
  prepayId: string;
}

export interface WechatPayAppConfig {
  appId: string;
  mchId: string;
}

export type TenantProvisioningStatusValue =
  | 'active'
  | 'failed_manual'
  | 'failed_retryable'
  | 'none'
  | 'pending'
  | 'provisioning';

export interface TenantProvisioningStatus {
  currentCustomerId?: string;
  isTenantProvisioning: boolean;
  requiresRelogin?: boolean;
  sourceCustomerId?: string;
  sourceOrganization?: {
    city?: string;
    companyShortName?: string;
    id: number;
    memberRole: string;
    name: string;
    sourceCustomerId: string;
  };
  sourceOrganizationCount?: number;
  targetCity?: string;
  targetCompanyShortName?: string;
  targetCustomerId?: string;
  tenantProvisioningMessage?: string;
  tenantProvisioningStatus: TenantProvisioningStatusValue;
}

export type VipMembershipWechatOrderReason =
  | 'amount-mismatch'
  | 'missing-center-user'
  | 'missing-out-trade-no'
  | 'missing-user-context'
  | 'not-vip-membership'
  | 'stale-payment'
  | 'trade-not-success';

export interface WechatPayOrderStatus {
  amount: {
    currency: string;
    payerCurrency: string;
    payerTotal: number;
    total: number;
  };
  appId: string;
  attach: string;
  bankType: string;
  mchId: string;
  outTradeNo: string;
  success: boolean;
  successTime: string;
  tradeState: string;
  tradeStateDesc: string;
  transactionId: string;
  vipMembershipResult?: {
    alreadyApplied: boolean;
    applied: boolean;
    matched: boolean;
    provisioningStatus?: TenantProvisioningStatusValue;
    reason?: VipMembershipWechatOrderReason;
    vipExpireAt?: string;
  };
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

export interface VipMembershipRefundOrderList {
  items: VipMembershipRefundOrder[];
}

interface VipCheckoutFlowRequestOptions {
  checkoutFlowToken?: string;
}

function buildVipCheckoutFlowHeaders(
  options?: VipCheckoutFlowRequestOptions,
): Record<string, string> | undefined {
  const checkoutFlowToken = String(options?.checkoutFlowToken || '').trim();
  if (!checkoutFlowToken) {
    return undefined;
  }
  return {
    'x-vip-checkout-flow-token': checkoutFlowToken,
  };
}

export async function createWechatAppPrepay(data: CreateWechatAppPrepayParams) {
  return requestClient.post<CreateWechatAppPrepayResponse>(
    '/wechat/pay/app/prepay',
    data,
  );
}

export async function getWechatPayAppConfig() {
  return requestClient.get<WechatPayAppConfig>('/wechat/pay/app/config');
}

export async function queryWechatPayOrder(
  outTradeNo: string,
  options?: VipCheckoutFlowRequestOptions,
) {
  return requestClient.get<WechatPayOrderStatus>('/wechat/pay/query', {
    headers: buildVipCheckoutFlowHeaders(options),
    params: {
      outTradeNo,
    },
  });
}

export async function refundVipMembershipWechatOrder(data: {
  outTradeNo: string;
  reason?: string;
}) {
  return requestClient.post<VipMembershipRefundResult>(
    '/wechat/pay/refund',
    data,
  );
}

export async function refundVipMembershipWechatOrders(data: {
  outTradeNos: string[];
  reason?: string;
}) {
  return requestClient.post<VipMembershipRefundResult[]>(
    '/wechat/pay/refund',
    data,
  );
}

export async function listVipMembershipRefundOrders() {
  return requestClient.get<VipMembershipRefundOrderList>(
    '/wechat/pay/refund/orders',
  );
}

export async function getTenantProvisioningStatus(
  options?: VipCheckoutFlowRequestOptions,
) {
  return requestClient.get<TenantProvisioningStatus>(
    '/tenant/provisioning/status',
    {
      headers: buildVipCheckoutFlowHeaders(options),
    },
  );
}
