import type {
  OrganizationProvisioningStatusValue,
  VipMembershipWechatOrderReason,
} from '#/api/wechat-pay';

import { requestClient } from '#/api/request';

export interface CreateAlipayWapPrepayParams {
  amount: number;
  attach?: string;
  body?: string;
  currency?: string;
  description: string;
  organizationIdentity?: {
    city: string;
    companyShortName: string;
  };
  outTradeNo?: string;
  planId?: 'monthly' | 'quarterly' | 'yearly';
  quitUrl?: string;
  returnUrl?: string;
}

export interface CreateAlipayWapPrepayResponse {
  checkoutFlowToken?: string;
  outTradeNo: string;
  payUrl: string;
}

export interface AlipayPayAppConfig {
  appId: string;
  configured?: boolean;
  gatewayUrl: string;
  missing?: string[];
}

export interface AlipayPayOrderStatus {
  amount: {
    currency: string;
    payerCurrency: string;
    payerTotal: number;
    total: number;
  };
  appId: string;
  attach: string;
  buyerLogonId: string;
  outTradeNo: string;
  success: boolean;
  successTime: string;
  tradeNo: string;
  tradeState: string;
  tradeStateDesc: string;
  vipMembershipResult?: {
    alreadyApplied: boolean;
    applied: boolean;
    matched: boolean;
    provisioningStatus?: OrganizationProvisioningStatusValue;
    reason?: VipMembershipWechatOrderReason;
    vipExpireAt?: string;
  };
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

export async function createAlipayWapPrepay(data: CreateAlipayWapPrepayParams) {
  return requestClient.post<CreateAlipayWapPrepayResponse>(
    '/alipay/pay/wap/prepay',
    data,
  );
}

export async function getAlipayPayAppConfig() {
  return requestClient.get<AlipayPayAppConfig>('/alipay/pay/app/config');
}

export async function queryAlipayPayOrder(
  outTradeNo: string,
  options?: VipCheckoutFlowRequestOptions,
) {
  return requestClient.get<AlipayPayOrderStatus>('/alipay/pay/query', {
    headers: buildVipCheckoutFlowHeaders(options),
    params: {
      outTradeNo,
    },
  });
}
