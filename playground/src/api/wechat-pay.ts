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
}

export interface CreateWechatAppPrepayResponse {
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
  isTenantProvisioning: boolean;
  sourceCustomerId?: string;
  targetCustomerId?: string;
  tenantProvisioningMessage?: string;
  tenantProvisioningStatus: TenantProvisioningStatusValue;
}

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

export async function queryWechatPayOrder(outTradeNo: string) {
  return requestClient.get<WechatPayOrderStatus>('/wechat/pay/query', {
    params: {
      outTradeNo,
    },
  });
}

export async function getTenantProvisioningStatus() {
  return requestClient.get<TenantProvisioningStatus>(
    '/tenant/provisioning/status',
  );
}
