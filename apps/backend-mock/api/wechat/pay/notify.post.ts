import type { VipMembershipWechatOrderResult } from '~/utils/vip-membership';

import {
  handleVipMembershipWechatOrder,
  isVipMembershipAttach,
} from '~/utils/vip-membership';
import {
  resolveWechatPaySignatureHeaders,
  verifyAndDecryptWechatPayNotification,
} from '~/utils/wechat-pay';

export default eventHandler(async (event) => {
  const rawBody = (await readRawBody(event, 'utf8')) || '';

  if (!rawBody) {
    setResponseStatus(event, 400);
    return {
      code: 'FAIL',
      message: '回调报文为空',
    };
  }

  try {
    const signatureHeaders = resolveWechatPaySignatureHeaders({
      nonce: getHeader(event, 'Wechatpay-Nonce'),
      serial: getHeader(event, 'Wechatpay-Serial'),
      signature: getHeader(event, 'Wechatpay-Signature'),
      timestamp: getHeader(event, 'Wechatpay-Timestamp'),
    });

    const decryptedNotification = await verifyAndDecryptWechatPayNotification({
      rawBody,
      signatureHeaders,
    });

    let vipMembershipResult: null | VipMembershipWechatOrderResult = null;

    if (isVipMembershipAttach(decryptedNotification.resource.attach)) {
      vipMembershipResult = await handleVipMembershipWechatOrder({
        amount: decryptedNotification.resource.amount,
        attach: decryptedNotification.resource.attach,
        outTradeNo: decryptedNotification.resource.out_trade_no,
        successTime: decryptedNotification.resource.success_time,
        tradeState: decryptedNotification.resource.trade_state,
        transactionId: decryptedNotification.resource.transaction_id,
      });
    }

    console.info('收到微信 APP 支付回调:', {
      eventType: decryptedNotification.notification.event_type,
      outTradeNo: decryptedNotification.resource.out_trade_no,
      tradeState: decryptedNotification.resource.trade_state,
      transactionId: decryptedNotification.resource.transaction_id,
      vipMembership: vipMembershipResult,
    });

    return {
      code: 'SUCCESS',
      message: '成功',
    };
  } catch (error) {
    console.error('处理微信 APP 支付回调失败:', error);
    setResponseStatus(event, 500);
    return {
      code: 'FAIL',
      message: error instanceof Error ? error.message : '处理微信支付回调失败',
    };
  }
});
