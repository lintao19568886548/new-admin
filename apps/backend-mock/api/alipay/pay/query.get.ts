import { AlipayRequestError, queryAlipayPayOrder } from '~/utils/alipay-pay';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { verifyVipCheckoutFlowTokenFromEvent } from '~/utils/vip-checkout-flow-token';
import {
  getVipMembershipPaymentOwner,
  handleVipMembershipWechatOrder,
} from '~/utils/vip-membership';

export default eventHandler(async (event) => {
  const outTradeNo = String(getQuery(event).outTradeNo || '').trim();

  if (!outTradeNo) {
    return badRequestResponse('缺少 outTradeNo 参数', event);
  }

  try {
    const owner = await getVipMembershipPaymentOwner(outTradeNo);
    if (!owner) {
      return forbiddenResponse(event, '无权查询该支付订单');
    }
    const flowTokenPayload =
      event.context.vipCheckoutFlow ??
      verifyVipCheckoutFlowTokenFromEvent(event);

    if (flowTokenPayload) {
      if (
        flowTokenPayload.outTradeNo !== outTradeNo ||
        flowTokenPayload.centerUserId !== owner.centerUserId ||
        flowTokenPayload.sourceCustomerId !== owner.sourceCustomerId
      ) {
        return forbiddenResponse(event, '无权查询该支付订单');
      }
    } else {
      const userinfo = await verifyAccessToken(event);
      if (!userinfo) {
        return unAuthorizedResponse(event);
      }

      const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
      if (owner.centerUserId !== centerUserId) {
        return forbiddenResponse(event, '无权查询该支付订单');
      }
    }

    const result = await queryAlipayPayOrder(outTradeNo);
    const vipMembershipResult = await handleVipMembershipWechatOrder({
      amount: result.amount,
      attach: result.attach,
      outTradeNo: result.outTradeNo,
      successTime: result.successTime,
      tradeState: result.success ? 'SUCCESS' : result.tradeState,
      transactionId: result.tradeNo,
    });

    console.info('支付宝查单同步会员状态:', vipMembershipResult);

    return useResponseSuccess({
      ...result,
      vipMembershipResult,
    });
  } catch (error) {
    console.error('查询支付宝订单失败:', error);
    if (error instanceof AlipayRequestError) {
      return badRequestResponse(error.message, event);
    }

    return serverErrorResponse(
      error instanceof Error ? error.message : '查询支付宝订单失败',
      event,
    );
  }
});
