package cn.yizuw.magic.backend.messaging;

/** 会员支付通知本地落库事件；用于后续会员权益和组织开通 worker 消费。 */
public record VipMembershipPaymentNotifiedEvent(
    int amountTotal,
    int centerUserId,
    String outTradeNo,
    String sourceCustomerId,
    String tradeState,
    String transactionId) {}
