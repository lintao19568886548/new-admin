package cn.yizuw.magic.backend.messaging;

/** 会员退款通知本地落库事件；用于后续权益回滚和组织状态补偿 worker 消费。 */
public record VipMembershipRefundNotifiedEvent(
    int amountTotal,
    int centerUserId,
    String customerId,
    String outRefundNo,
    String outTradeNo,
    String refundId,
    int refundAmount,
    String refundStatus) {}
