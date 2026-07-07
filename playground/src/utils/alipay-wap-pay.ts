import type {
  AlipayPayOrderStatus,
  CreateAlipayWapPrepayParams,
} from '#/api/alipay-pay';

import { createAlipayWapPrepay, queryAlipayPayOrder } from '#/api/alipay-pay';

export interface AlipayWapPayExecutionResult {
  checkoutFlowToken?: string;
  outTradeNo: string;
  payUrl: string;
  queryOrderStatus: () => Promise<AlipayPayOrderStatus>;
}

export function resolveAlipayReturnUrl() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('alipayOutTradeNo');
  return url.toString();
}

export async function payWithAlipayWap(
  payload: CreateAlipayWapPrepayParams,
): Promise<AlipayWapPayExecutionResult> {
  const prepay = await createAlipayWapPrepay({
    ...payload,
    returnUrl: payload.returnUrl || resolveAlipayReturnUrl(),
  });

  return {
    checkoutFlowToken: prepay.checkoutFlowToken,
    outTradeNo: prepay.outTradeNo,
    payUrl: prepay.payUrl,
    queryOrderStatus: () =>
      queryAlipayPayOrder(prepay.outTradeNo, {
        checkoutFlowToken: prepay.checkoutFlowToken,
      }),
  };
}
