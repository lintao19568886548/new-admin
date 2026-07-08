package cn.yizuw.magic.backend.messaging;

/** 会员支付本地快照创建事件；业务事务内写入 outbox，后续由 Kafka dispatcher 派发。 */
public record VipMembershipPaymentCreatedEvent(
    int amountTotal,
    int centerUserId,
    String channel,
    String outTradeNo,
    String sourceCustomerId,
    String username) {}
