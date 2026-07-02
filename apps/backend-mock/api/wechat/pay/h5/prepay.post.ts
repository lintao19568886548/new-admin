import {
  badRequestResponse,
  serverErrorResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  createWechatH5Prepay,
  WechatPayRequestError,
} from '~/utils/wechat-pay';
import {
  createWechatPrepayContext,
  normalizeOptionalString,
} from '~/utils/wechat-pay-prepay';

function normalizeH5Type(value: unknown) {
  const normalized = String(value || '').trim();
  if (
    normalized === 'Android' ||
    normalized === 'iOS' ||
    normalized === 'Wap'
  ) {
    return normalized;
  }
  return 'Wap';
}

export default eventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown>;

  try {
    const prepared = await createWechatPrepayContext(event, body, 'wxh5');
    if (prepared.response) {
      return prepared.response;
    }

    const { context } = prepared;
    const result = await createWechatH5Prepay({
      amount: {
        currency: context.currency,
        total: context.amount,
      },
      attach: context.attach,
      description: context.description,
      h5Info: {
        appName: normalizeOptionalString(body.appName) || '职维智管',
        appUrl: normalizeOptionalString(body.appUrl),
        bundleId: normalizeOptionalString(body.bundleId),
        packageName: normalizeOptionalString(body.packageName),
        type: normalizeH5Type(body.h5Type),
      },
      outTradeNo: context.outTradeNo,
      payerClientIp: context.payerClientIp,
    });

    return useResponseSuccess({
      checkoutFlowToken: context.checkoutFlowToken,
      h5Url: result.h5Url,
      outTradeNo: result.outTradeNo,
    });
  } catch (error) {
    console.error('创建微信 H5 预支付订单失败:', error);
    if (error instanceof WechatPayRequestError) {
      return badRequestResponse(error.message, event);
    }

    return serverErrorResponse(
      error instanceof Error ? error.message : '创建微信 H5 预支付订单失败',
      event,
    );
  }
});
