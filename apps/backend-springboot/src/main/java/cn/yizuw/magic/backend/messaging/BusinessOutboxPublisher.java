package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** 业务事件 outbox 写入封装；默认关闭，避免未建表环境影响主流程。 */
@Service
public class BusinessOutboxPublisher {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String ORG_PROVISIONING_COMPLETED = "organization.provisioning.completed";
  private static final String ORG_PROVISIONING_REQUEUED = "organization.provisioning.requeued";
  private static final String ORG_PROVISIONING_TOPIC = "magic.organization.provisioning";
  private static final String VIP_PAYMENT_CREATED = "vip.membership.payment.created";
  private static final String VIP_PAYMENT_NOTIFIED = "vip.membership.payment.notified";
  private static final String VIP_PAYMENT_TOPIC = "magic.vip-membership.payment";
  private static final String VIP_REFUND_NOTIFIED = "vip.membership.refund.notified";
  private static final String VIP_REFUND_REQUESTED = "vip.membership.refund.requested";
  private static final String VIP_REFUND_TOPIC = "magic.vip-membership.refund";

  private final AppProperties appProperties;
  private final OutboxService outboxService;

  public BusinessOutboxPublisher(AppProperties appProperties, OutboxService outboxService) {
    this.appProperties = appProperties;
    this.outboxService = outboxService;
  }

  /**
   * 写入会员支付创建事件。
   *
   * <p>只有显式开启 `app.kafka.outbox-event-write-enabled` 时才写表；开启后若 outbox 表缺失或写入失败，
   * 当前业务事务应失败，避免业务状态和事件流不一致。
   */
  public String publishVipMembershipPaymentCreated(VipMembershipPaymentCreatedEvent event) {
    if (!appProperties.getKafka().isOutboxEventWriteEnabled()) {
      return null;
    }
    return outboxService.enqueue(
        new OutboxEventRequest(
            event.outTradeNo(),
            "vip_membership_payment",
            event.sourceCustomerId(),
            VIP_PAYMENT_CREATED,
            "vip-membership-payment-created:" + event.outTradeNo(),
            payload(event),
            VIP_PAYMENT_TOPIC));
  }

  /**
   * 写入会员支付通知事件。
   *
   * <p>用于支付回调本地状态落库后的后续权益/开通 worker 消费；默认仍由开关控制，不裸发 Kafka。
   */
  public String publishVipMembershipPaymentNotified(VipMembershipPaymentNotifiedEvent event) {
    if (!appProperties.getKafka().isOutboxEventWriteEnabled()) {
      return null;
    }
    return outboxService.enqueue(
        new OutboxEventRequest(
            event.outTradeNo(),
            "vip_membership_payment",
            event.sourceCustomerId(),
            VIP_PAYMENT_NOTIFIED,
            "vip-membership-payment-notified:" + event.outTradeNo(),
            payload(event),
            VIP_PAYMENT_TOPIC));
  }

  /**
   * 写入会员退款申请事件。
   *
   * <p>退款接口只负责本地 `vip_membership_refund` 申请落库；真实微信退款提交交给后续 worker 消费该事件。
   */
  public String publishVipMembershipRefundRequested(VipMembershipRefundRequestedEvent event) {
    if (!appProperties.getKafka().isOutboxEventWriteEnabled()) {
      return null;
    }
    return outboxService.enqueue(
        new OutboxEventRequest(
            event.outRefundNo(),
            "vip_membership_refund",
            event.customerId(),
            VIP_REFUND_REQUESTED,
            "vip-membership-refund-requested:" + event.outRefundNo(),
            payload(event),
            VIP_REFUND_TOPIC));
  }

  /**
   * 写入会员退款通知事件。
   *
   * <p>用于退款回调本地状态落库后的后续权益回滚、组织状态补偿和对账 worker 消费。
   */
  public String publishVipMembershipRefundNotified(VipMembershipRefundNotifiedEvent event) {
    if (!appProperties.getKafka().isOutboxEventWriteEnabled()) {
      return null;
    }
    return outboxService.enqueue(
        new OutboxEventRequest(
            event.outRefundNo(),
            "vip_membership_refund",
            event.customerId(),
            VIP_REFUND_NOTIFIED,
            "vip-membership-refund-notified:" + event.outRefundNo(),
            payload(event),
            VIP_REFUND_TOPIC));
  }

  /**
   * 写入组织空间开通任务人工重排事件。
   *
   * <p>HTTP 接口只把任务重置为 pending；真实跨租户建库、初始化菜单和成员等动作仍由后续 worker 消费。
   */
  public String publishOrganizationProvisioningRequeued(
      OrganizationProvisioningRequeuedEvent event) {
    if (!appProperties.getKafka().isOutboxEventWriteEnabled()) {
      return null;
    }
    return outboxService.enqueue(
        new OutboxEventRequest(
            String.valueOf(event.jobId()),
            "tenant_provisioning_job",
            event.targetCustomerId(),
            ORG_PROVISIONING_REQUEUED,
            "organization-provisioning-requeued:" + event.jobId() + ":" + event.requeuedAt(),
            payload(event),
            ORG_PROVISIONING_TOPIC));
  }

  /**
   * 写入组织空间开通完成事件。
   *
   * <p>完成收口仍只写 outbox，不在业务事务里裸发 Kafka；通知、审计或缓存刷新由后续消费者处理。
   */
  public String publishOrganizationProvisioningCompleted(
      OrganizationProvisioningCompletedEvent event) {
    if (!appProperties.getKafka().isOutboxEventWriteEnabled()) {
      return null;
    }
    return outboxService.enqueue(
        new OutboxEventRequest(
            String.valueOf(event.jobId()),
            "tenant_provisioning_job",
            event.targetCustomerId(),
            ORG_PROVISIONING_COMPLETED,
            "organization-provisioning-completed:" + event.jobId(),
            payload(event),
            ORG_PROVISIONING_TOPIC));
  }

  private String payload(VipMembershipPaymentCreatedEvent event) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("amountTotal", event.amountTotal());
    payload.put("centerUserId", event.centerUserId());
    payload.put("channel", event.channel());
    payload.put("mode", "local_prepay_snapshot");
    payload.put("outTradeNo", event.outTradeNo());
    payload.put("sourceCustomerId", event.sourceCustomerId());
    payload.put("username", event.username());
    return toJson(payload, "会员支付 outbox 事件生成失败");
  }

  private String payload(VipMembershipPaymentNotifiedEvent event) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("amountTotal", event.amountTotal());
    payload.put("centerUserId", event.centerUserId());
    payload.put("mode", "local_notify_ack");
    payload.put("outTradeNo", event.outTradeNo());
    payload.put("sourceCustomerId", event.sourceCustomerId());
    payload.put("tradeState", event.tradeState());
    payload.put("transactionId", event.transactionId());
    return toJson(payload, "会员支付通知 outbox 事件生成失败");
  }

  private String payload(VipMembershipRefundRequestedEvent event) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("amountTotal", event.amountTotal());
    payload.put("centerUserId", event.centerUserId());
    payload.put("customerId", event.customerId());
    payload.put("mode", "local_refund_request");
    payload.put("outRefundNo", event.outRefundNo());
    payload.put("outTradeNo", event.outTradeNo());
    payload.put("reason", event.reason());
    payload.put("refundAmount", event.refundAmount());
    payload.put("transactionId", event.transactionId());
    return toJson(payload, "会员退款申请 outbox 事件生成失败");
  }

  private String payload(VipMembershipRefundNotifiedEvent event) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("amountTotal", event.amountTotal());
    payload.put("centerUserId", event.centerUserId());
    payload.put("customerId", event.customerId());
    payload.put("mode", "local_refund_notify_ack");
    payload.put("outRefundNo", event.outRefundNo());
    payload.put("outTradeNo", event.outTradeNo());
    payload.put("refundAmount", event.refundAmount());
    payload.put("refundId", event.refundId());
    payload.put("refundStatus", event.refundStatus());
    return toJson(payload, "会员退款通知 outbox 事件生成失败");
  }

  private String payload(OrganizationProvisioningRequeuedEvent event) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("initiatorCenterUserId", event.initiatorCenterUserId());
    payload.put("jobId", event.jobId());
    payload.put("lastPaymentOutTradeNo", event.lastPaymentOutTradeNo());
    payload.put("mode", "manual_requeue");
    payload.put("operator", event.operator());
    payload.put("previousStatus", event.previousStatus());
    payload.put("requeuedAt", event.requeuedAt());
    payload.put("sourceCustomerId", event.sourceCustomerId());
    payload.put("sourceOrgId", event.sourceOrgId());
    payload.put("status", event.status());
    payload.put("step", event.step());
    payload.put("targetCustomerId", event.targetCustomerId());
    payload.put("targetDbName", event.targetDbName());
    return toJson(payload, "组织开通重排 outbox 事件生成失败");
  }

  private String payload(OrganizationProvisioningCompletedEvent event) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("completedAt", event.completedAt());
    payload.put("initiatorCenterUserId", event.initiatorCenterUserId());
    payload.put("jobId", event.jobId());
    payload.put("lastPaymentOutTradeNo", event.lastPaymentOutTradeNo());
    payload.put("mode", "worker_completed");
    payload.put("sourceCustomerId", event.sourceCustomerId());
    payload.put("sourceOrgId", event.sourceOrgId());
    payload.put("status", event.status());
    payload.put("step", event.step());
    payload.put("targetCustomerId", event.targetCustomerId());
    payload.put("targetDbName", event.targetDbName());
    return toJson(payload, "组织开通完成 outbox 事件生成失败");
  }

  private String toJson(Map<String, Object> payload, String errorMessage) {
    try {
      return JSON.writeValueAsString(payload);
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, errorMessage);
    }
  }
}
