import { handleVipMembershipWechatRefundNotification } from '~/utils/vip-membership';
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
    const refund = await handleVipMembershipWechatRefundNotification({
      eventId: decryptedNotification.notification.id,
      resource: decryptedNotification.resource,
    });

    console.info('收到微信 APP 退款回调:', {
      eventType: decryptedNotification.notification.event_type,
      outRefundNo: decryptedNotification.resource.out_refund_no,
      outTradeNo: decryptedNotification.resource.out_trade_no,
      refundId: decryptedNotification.resource.refund_id,
      refundStatus:
        decryptedNotification.resource.refund_status ||
        decryptedNotification.resource.status,
      vipMembershipRefund: refund
        ? {
            outRefundNo: refund.outRefundNo,
            status: refund.status,
          }
        : null,
    });

    return {
      code: 'SUCCESS',
      message: '成功',
    };
  } catch (error) {
    console.error('处理微信 APP 退款回调失败:', error);
    setResponseStatus(event, 500);
    return {
      code: 'FAIL',
      message: error instanceof Error ? error.message : '处理微信退款回调失败',
    };
  }
});
