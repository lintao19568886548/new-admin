import type {
  CreateWechatAppPrepayParams,
  CreateWechatH5PrepayParams,
  WechatAppLaunchParams,
  WechatPayOrderStatus,
} from '#/api/wechat-pay';

import { Capacitor } from '@capacitor/core';

import {
  createWechatAppPrepay,
  createWechatH5Prepay,
  queryWechatPayOrder,
} from '#/api/wechat-pay';

const WECHAT_PAY_RESULT_EVENT = 'native-wechat-pay-result';
const DEFAULT_WECHAT_PAY_WAIT_MS = 120_000;

interface AndroidWechatPayInterface {
  isWechatInstalled?: (appId: string) => boolean;
  launchWechatPay?: (payloadJson: string) => string;
}

export interface NativeWechatPayLaunchResult {
  errCode?: number;
  errStr?: string;
  launched: boolean;
  message?: string;
  ok: boolean;
  reason?: string;
  transaction?: string;
}

export interface WechatAppPayExecutionResult {
  checkoutFlowToken?: string;
  launchParams: WechatAppLaunchParams;
  payResult: NativeWechatPayLaunchResult;
  prepayId: string;
  queryOrderStatus: () => Promise<WechatPayOrderStatus>;
}

export interface WechatH5PayExecutionResult {
  checkoutFlowToken?: string;
  h5Url: string;
  outTradeNo: string;
  payResult: NativeWechatPayLaunchResult;
  queryOrderStatus: () => Promise<WechatPayOrderStatus>;
}

export type WechatUnifiedPayExecutionResult =
  | (WechatAppPayExecutionResult & { mode: 'app' })
  | (WechatH5PayExecutionResult & { mode: 'h5' });

function buildFailedResult(
  reason: string,
  message: string,
): NativeWechatPayLaunchResult {
  return {
    launched: false,
    message,
    ok: false,
    reason,
  };
}

function getAndroidInterface() {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    (
      window as Window & {
        AndroidInterface?: AndroidWechatPayInterface;
      }
    ).AndroidInterface ?? null
  );
}

function normalizeNativeWechatPayResult(
  result: Partial<NativeWechatPayLaunchResult>,
): NativeWechatPayLaunchResult {
  return {
    errCode: typeof result.errCode === 'number' ? result.errCode : undefined,
    errStr: result.errStr,
    launched: result.launched === true,
    message: result.message,
    ok: result.ok === true,
    reason: result.reason,
    transaction: result.transaction,
  };
}

function parseNativeWechatPayResult(rawResult?: string) {
  if (!rawResult) {
    return buildFailedResult('empty-result', '原生微信支付未返回结果');
  }

  try {
    return normalizeNativeWechatPayResult(
      JSON.parse(rawResult) as Partial<NativeWechatPayLaunchResult>,
    );
  } catch (error) {
    console.warn('解析原生微信支付结果失败:', error);
    return buildFailedResult('parse-error', '解析原生微信支付结果失败');
  }
}

export function canUseNativeWechatPay() {
  return (
    Capacitor.getPlatform() === 'android' &&
    typeof getAndroidInterface()?.launchWechatPay === 'function'
  );
}

export function resolveWechatH5Type(): 'Android' | 'iOS' | 'Wap' {
  if (typeof navigator === 'undefined') {
    return 'Wap';
  }

  const userAgent = navigator.userAgent || '';
  if (/android/i.test(userAgent)) {
    return 'Android';
  }
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return 'iOS';
  }
  return 'Wap';
}

export function isWechatInstalled(appId: string) {
  if (!appId || !canUseNativeWechatPay()) {
    return false;
  }

  try {
    return !!getAndroidInterface()?.isWechatInstalled?.(appId);
  } catch (error) {
    console.warn('检测微信安装状态失败:', error);
    return false;
  }
}

export async function launchNativeWechatPay(
  params: WechatAppLaunchParams,
  waitMs = DEFAULT_WECHAT_PAY_WAIT_MS,
): Promise<NativeWechatPayLaunchResult> {
  if (!params.appId) {
    return buildFailedResult(
      'app-id-missing',
      '未配置微信开放平台移动应用 AppID',
    );
  }

  if (!canUseNativeWechatPay()) {
    return buildFailedResult('unavailable', '当前设备不支持原生微信支付');
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const cleanup = () => {
      window.removeEventListener(
        WECHAT_PAY_RESULT_EVENT,
        handleWechatPayResult as EventListener,
      );
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };

    const finalize = (result: NativeWechatPayLaunchResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleWechatPayResult = (
      event: CustomEvent<Partial<NativeWechatPayLaunchResult>>,
    ) => {
      finalize(normalizeNativeWechatPayResult(event.detail || {}));
    };

    window.addEventListener(
      WECHAT_PAY_RESULT_EVENT,
      handleWechatPayResult as EventListener,
    );

    timeoutId = window.setTimeout(() => {
      finalize(
        buildFailedResult(
          'timeout',
          '等待微信支付结果超时，请主动查询订单状态',
        ),
      );
    }, waitMs);

    try {
      const rawResult = getAndroidInterface()?.launchWechatPay?.(
        JSON.stringify(params),
      );
      const launchResult = parseNativeWechatPayResult(rawResult);
      if (!launchResult.ok || !launchResult.launched) {
        finalize(launchResult);
      }
    } catch (error) {
      console.warn('调用原生微信支付失败:', error);
      finalize(
        buildFailedResult(
          'native-exception',
          error instanceof Error ? error.message : '调用原生微信支付失败',
        ),
      );
    }
  });
}

export async function payWithWechatApp(
  payload: CreateWechatAppPrepayParams,
): Promise<WechatAppPayExecutionResult> {
  const prepay = await createWechatAppPrepay(payload);
  const payResult = await launchNativeWechatPay(prepay.launchParams);

  return {
    checkoutFlowToken: prepay.checkoutFlowToken,
    launchParams: prepay.launchParams,
    payResult,
    prepayId: prepay.prepayId,
    queryOrderStatus: () =>
      queryWechatPayOrder(prepay.launchParams.outTradeNo, {
        checkoutFlowToken: prepay.checkoutFlowToken,
      }),
  };
}

export async function payWithWechatH5(
  payload: CreateWechatH5PrepayParams,
): Promise<WechatH5PayExecutionResult> {
  const prepay = await createWechatH5Prepay({
    ...payload,
    appUrl:
      payload.appUrl ||
      (typeof window === 'undefined' ? undefined : window.location.origin),
    h5Type: payload.h5Type || resolveWechatH5Type(),
  });

  return {
    checkoutFlowToken: prepay.checkoutFlowToken,
    h5Url: prepay.h5Url,
    outTradeNo: prepay.outTradeNo,
    payResult: {
      launched: true,
      message: '已打开微信 H5 支付页面',
      ok: true,
    },
    queryOrderStatus: () =>
      queryWechatPayOrder(prepay.outTradeNo, {
        checkoutFlowToken: prepay.checkoutFlowToken,
      }),
  };
}

export async function payWithWechatEverywhere(
  payload: CreateWechatH5PrepayParams,
): Promise<WechatUnifiedPayExecutionResult> {
  if (canUseNativeWechatPay()) {
    const execution = await payWithWechatApp(payload);
    return {
      ...execution,
      mode: 'app',
    };
  }

  const execution = await payWithWechatH5(payload);
  return {
    ...execution,
    mode: 'h5',
  };
}
