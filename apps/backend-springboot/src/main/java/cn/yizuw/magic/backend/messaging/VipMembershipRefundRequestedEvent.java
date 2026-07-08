package cn.yizuw.magic.backend.messaging;

/** 会员退款本地申请事件；用于后续真实微信退款提交 worker 消费。 */
public record VipMembershipRefundRequestedEvent(
    int amountTotal,
    int centerUserId,
    String customerId,
    String outRefundNo,
    String outTradeNo,
    String reason,
    int refundAmount,
    String transactionId) {}
