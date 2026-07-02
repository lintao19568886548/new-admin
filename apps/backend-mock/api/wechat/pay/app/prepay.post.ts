import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  createWechatAppPrepay,
  WechatPayRequestError,
} from '~/utils/wechat-pay';
import {
  createWechatPrepayContext,
  normalizeOptionalString,
} from '~/utils/wechat-pay-prepay';

export default eventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown>;

  try {
    const prepared = await createWechatPrepayContext(event, body, 'wxapp');
    if (prepared.response) {
      return prepared.response;
    }

    const { context } = prepared;
    const result = await createWechatAppPrepay({
      amount: {
        currency: context.currency,
        total: context.amount,
      },
      attach: context.attach,
      description: context.description,
      deviceId: normalizeOptionalString(body.deviceId),
      outTradeNo: context.outTradeNo,
      payerClientIp: context.payerClientIp,
    });

    return useResponseSuccess({
      checkoutFlowToken: context.checkoutFlowToken,
      launchParams: result.launchParams,
      prepayId: result.prepayId,
    });
  } catch (error) {
    console.error('创建微信 APP 预支付订单失败:', error);
    if (error instanceof WechatPayRequestError) {
      return badRequestResponse(error.message, event);
    }

    return serverErrorResponse(
      error instanceof Error ? error.message : '创建微信 APP 预支付订单失败',
      event,
    );
  }
});
