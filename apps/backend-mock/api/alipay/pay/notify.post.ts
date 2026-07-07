import { parseAndVerifyAlipayNotify } from '~/utils/alipay-pay';
import { handleVipMembershipWechatOrder } from '~/utils/vip-membership';

export default eventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown>;

  try {
    const notification = await parseAndVerifyAlipayNotify(body);
    const paid =
      notification.tradeStatus === 'TRADE_SUCCESS' ||
      notification.tradeStatus === 'TRADE_FINISHED';

    const vipMembershipResult = await handleVipMembershipWechatOrder({
      amount: {
        total: Math.round(Number(notification.totalAmount || 0) * 100),
      },
      attach: notification.attach,
      outTradeNo: notification.outTradeNo,
      successTime: notification.gmtPayment,
      tradeState: paid ? 'SUCCESS' : notification.tradeStatus,
      transactionId: notification.tradeNo,
    });

    console.info('收到支付宝支付回调:', {
      outTradeNo: notification.outTradeNo,
      tradeNo: notification.tradeNo,
      tradeStatus: notification.tradeStatus,
      vipMembership: vipMembershipResult,
    });

    return 'success';
  } catch (error) {
    console.error('处理支付宝支付回调失败:', error);
    setResponseStatus(event, 500);
    return 'fail';
  }
});
