import { AlipayRequestError, createAlipayWapPay } from '~/utils/alipay-pay';
import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  createWechatPrepayContext,
  normalizeOptionalString,
} from '~/utils/wechat-pay-prepay';

export default eventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown>;

  try {
    const prepared = await createWechatPrepayContext(event, body, 'alipaywap');
    if (prepared.response) {
      return prepared.response;
    }

    const { context } = prepared;
    const result = await createAlipayWapPay({
      amountTotal: context.amount,
      attach: context.attach,
      body: normalizeOptionalString(body.body) || context.description,
      notifyUrl: normalizeOptionalString(body.notifyUrl),
      outTradeNo: context.outTradeNo,
      quitUrl: normalizeOptionalString(body.quitUrl),
      returnUrl: normalizeOptionalString(body.returnUrl),
      subject: context.description,
    });

    return useResponseSuccess({
      checkoutFlowToken: context.checkoutFlowToken,
      outTradeNo: result.outTradeNo,
      payUrl: result.payUrl,
    });
  } catch (error) {
    console.error('创建支付宝 WAP 支付订单失败:', error);
    if (error instanceof AlipayRequestError) {
      return badRequestResponse(error.message, event);
    }

    return serverErrorResponse(
      error instanceof Error ? error.message : '创建支付宝 WAP 支付订单失败',
      event,
    );
  }
});
