package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.config.AppProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 业务 outbox publisher 测试；只验证事件封装，不连接 Kafka 或数据库。 */
class BusinessOutboxPublisherTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @Test
  void publishVipMembershipPaymentCreatedSkipsWhenFeatureDisabled() {
    AppProperties appProperties = new AppProperties();
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);
    BusinessOutboxPublisher publisher = new BusinessOutboxPublisher(appProperties, outboxService);

    String eventId = publisher.publishVipMembershipPaymentCreated(event());

    assertThat(eventId).isNull();
    verify(outboxService, never()).enqueue(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void publishVipMembershipPaymentCreatedWritesOutboxWhenEnabled() throws Exception {
    AppProperties appProperties = new AppProperties();
    appProperties.getKafka().setOutboxEventWriteEnabled(true);
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);
    when(outboxService.enqueue(org.mockito.ArgumentMatchers.any())).thenReturn("evt_outbox_1");
    BusinessOutboxPublisher publisher = new BusinessOutboxPublisher(appProperties, outboxService);

    String eventId = publisher.publishVipMembershipPaymentCreated(event());

    assertThat(eventId).isEqualTo("evt_outbox_1");
    ArgumentCaptor<OutboxEventRequest> captor = ArgumentCaptor.forClass(OutboxEventRequest.class);
    verify(outboxService).enqueue(captor.capture());
    OutboxEventRequest request = captor.getValue();
    assertThat(request.aggregateId()).isEqualTo("wxapp_1");
    assertThat(request.aggregateType()).isEqualTo("vip_membership_payment");
    assertThat(request.customerId()).isEqualTo("customer_1");
    assertThat(request.eventType()).isEqualTo("vip.membership.payment.created");
    assertThat(request.idempotencyKey()).isEqualTo("vip-membership-payment-created:wxapp_1");
    assertThat(request.topic()).isEqualTo("magic.vip-membership.payment");

    Map<String, Object> payload =
        JSON.readValue(request.payload(), new TypeReference<Map<String, Object>>() {});
    assertThat(payload)
        .containsEntry("amountTotal", 98_000)
        .containsEntry("centerUserId", 1001)
        .containsEntry("channel", "wechat_app")
        .containsEntry("outTradeNo", "wxapp_1")
        .containsEntry("sourceCustomerId", "customer_1")
        .containsEntry("username", "alice");
  }

  @Test
  void publishVipMembershipPaymentNotifiedWritesOutboxWhenEnabled() throws Exception {
    AppProperties appProperties = new AppProperties();
    appProperties.getKafka().setOutboxEventWriteEnabled(true);
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);
    when(outboxService.enqueue(org.mockito.ArgumentMatchers.any())).thenReturn("evt_outbox_2");
    BusinessOutboxPublisher publisher = new BusinessOutboxPublisher(appProperties, outboxService);

    String eventId =
        publisher.publishVipMembershipPaymentNotified(
            new VipMembershipPaymentNotifiedEvent(
                98_000, 1001, "wxapp_1", "customer_1", "SUCCESS", "4200001"));

    assertThat(eventId).isEqualTo("evt_outbox_2");
    ArgumentCaptor<OutboxEventRequest> captor = ArgumentCaptor.forClass(OutboxEventRequest.class);
    verify(outboxService).enqueue(captor.capture());
    OutboxEventRequest request = captor.getValue();
    assertThat(request.aggregateId()).isEqualTo("wxapp_1");
    assertThat(request.aggregateType()).isEqualTo("vip_membership_payment");
    assertThat(request.customerId()).isEqualTo("customer_1");
    assertThat(request.eventType()).isEqualTo("vip.membership.payment.notified");
    assertThat(request.idempotencyKey()).isEqualTo("vip-membership-payment-notified:wxapp_1");
    assertThat(request.topic()).isEqualTo("magic.vip-membership.payment");

    Map<String, Object> payload =
        JSON.readValue(request.payload(), new TypeReference<Map<String, Object>>() {});
    assertThat(payload)
        .containsEntry("amountTotal", 98_000)
        .containsEntry("centerUserId", 1001)
        .containsEntry("mode", "local_notify_ack")
        .containsEntry("outTradeNo", "wxapp_1")
        .containsEntry("sourceCustomerId", "customer_1")
        .containsEntry("tradeState", "SUCCESS")
        .containsEntry("transactionId", "4200001");
  }

  @Test
  void publishVipMembershipRefundRequestedWritesOutboxWhenEnabled() throws Exception {
    AppProperties appProperties = new AppProperties();
    appProperties.getKafka().setOutboxEventWriteEnabled(true);
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);
    when(outboxService.enqueue(org.mockito.ArgumentMatchers.any())).thenReturn("evt_outbox_3");
    BusinessOutboxPublisher publisher = new BusinessOutboxPublisher(appProperties, outboxService);

    String eventId =
        publisher.publishVipMembershipRefundRequested(
            new VipMembershipRefundRequestedEvent(
                98_000,
                1001,
                "customer_1",
                "vip_refund_wxapp_1",
                "wxapp_1",
                "用户申请退款",
                98_000,
                "4200001"));

    assertThat(eventId).isEqualTo("evt_outbox_3");
    ArgumentCaptor<OutboxEventRequest> captor = ArgumentCaptor.forClass(OutboxEventRequest.class);
    verify(outboxService).enqueue(captor.capture());
    OutboxEventRequest request = captor.getValue();
    assertThat(request.aggregateId()).isEqualTo("vip_refund_wxapp_1");
    assertThat(request.aggregateType()).isEqualTo("vip_membership_refund");
    assertThat(request.customerId()).isEqualTo("customer_1");
    assertThat(request.eventType()).isEqualTo("vip.membership.refund.requested");
    assertThat(request.idempotencyKey())
        .isEqualTo("vip-membership-refund-requested:vip_refund_wxapp_1");
    assertThat(request.topic()).isEqualTo("magic.vip-membership.refund");

    Map<String, Object> payload =
        JSON.readValue(request.payload(), new TypeReference<Map<String, Object>>() {});
    assertThat(payload)
        .containsEntry("amountTotal", 98_000)
        .containsEntry("centerUserId", 1001)
        .containsEntry("customerId", "customer_1")
        .containsEntry("mode", "local_refund_request")
        .containsEntry("outRefundNo", "vip_refund_wxapp_1")
        .containsEntry("outTradeNo", "wxapp_1")
        .containsEntry("reason", "用户申请退款")
        .containsEntry("refundAmount", 98_000)
        .containsEntry("transactionId", "4200001");
  }

  @Test
  void publishVipMembershipRefundNotifiedWritesOutboxWhenEnabled() throws Exception {
    AppProperties appProperties = new AppProperties();
    appProperties.getKafka().setOutboxEventWriteEnabled(true);
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);
    when(outboxService.enqueue(org.mockito.ArgumentMatchers.any())).thenReturn("evt_outbox_4");
    BusinessOutboxPublisher publisher = new BusinessOutboxPublisher(appProperties, outboxService);

    String eventId =
        publisher.publishVipMembershipRefundNotified(
            new VipMembershipRefundNotifiedEvent(
                98_000,
                1001,
                "customer_1",
                "vip_refund_wxapp_1",
                "wxapp_1",
                "5000001",
                98_000,
                "SUCCESS"));

    assertThat(eventId).isEqualTo("evt_outbox_4");
    ArgumentCaptor<OutboxEventRequest> captor = ArgumentCaptor.forClass(OutboxEventRequest.class);
    verify(outboxService).enqueue(captor.capture());
    OutboxEventRequest request = captor.getValue();
    assertThat(request.aggregateId()).isEqualTo("vip_refund_wxapp_1");
    assertThat(request.aggregateType()).isEqualTo("vip_membership_refund");
    assertThat(request.customerId()).isEqualTo("customer_1");
    assertThat(request.eventType()).isEqualTo("vip.membership.refund.notified");
    assertThat(request.idempotencyKey())
        .isEqualTo("vip-membership-refund-notified:vip_refund_wxapp_1");
    assertThat(request.topic()).isEqualTo("magic.vip-membership.refund");

    Map<String, Object> payload =
        JSON.readValue(request.payload(), new TypeReference<Map<String, Object>>() {});
    assertThat(payload)
        .containsEntry("amountTotal", 98_000)
        .containsEntry("centerUserId", 1001)
        .containsEntry("customerId", "customer_1")
        .containsEntry("mode", "local_refund_notify_ack")
        .containsEntry("outRefundNo", "vip_refund_wxapp_1")
        .containsEntry("outTradeNo", "wxapp_1")
        .containsEntry("refundAmount", 98_000)
        .containsEntry("refundId", "5000001")
        .containsEntry("refundStatus", "SUCCESS");
  }

  @Test
  void publishOrganizationProvisioningRequeuedWritesOutboxWhenEnabled() throws Exception {
    AppProperties appProperties = new AppProperties();
    appProperties.getKafka().setOutboxEventWriteEnabled(true);
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);
    when(outboxService.enqueue(org.mockito.ArgumentMatchers.any())).thenReturn("evt_outbox_5");
    BusinessOutboxPublisher publisher = new BusinessOutboxPublisher(appProperties, outboxService);

    String eventId =
        publisher.publishOrganizationProvisioningRequeued(
            new OrganizationProvisioningRequeuedEvent(
                1001,
                31,
                "wxapp_1",
                "admin",
                "failed_manual",
                "2026-07-02T11:00:00+08:00",
                "public",
                7,
                "pending",
                "manual_requeued",
                "org001",
                "tenant_org001"));

    assertThat(eventId).isEqualTo("evt_outbox_5");
    ArgumentCaptor<OutboxEventRequest> captor = ArgumentCaptor.forClass(OutboxEventRequest.class);
    verify(outboxService).enqueue(captor.capture());
    OutboxEventRequest request = captor.getValue();
    assertThat(request.aggregateId()).isEqualTo("31");
    assertThat(request.aggregateType()).isEqualTo("tenant_provisioning_job");
    assertThat(request.customerId()).isEqualTo("org001");
    assertThat(request.eventType()).isEqualTo("organization.provisioning.requeued");
    assertThat(request.idempotencyKey())
        .isEqualTo("organization-provisioning-requeued:31:2026-07-02T11:00:00+08:00");
    assertThat(request.topic()).isEqualTo("magic.organization.provisioning");

    Map<String, Object> payload =
        JSON.readValue(request.payload(), new TypeReference<Map<String, Object>>() {});
    assertThat(payload)
        .containsEntry("initiatorCenterUserId", 1001)
        .containsEntry("jobId", 31)
        .containsEntry("lastPaymentOutTradeNo", "wxapp_1")
        .containsEntry("mode", "manual_requeue")
        .containsEntry("operator", "admin")
        .containsEntry("previousStatus", "failed_manual")
        .containsEntry("requeuedAt", "2026-07-02T11:00:00+08:00")
        .containsEntry("sourceCustomerId", "public")
        .containsEntry("sourceOrgId", 7)
        .containsEntry("status", "pending")
        .containsEntry("step", "manual_requeued")
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001");
  }

  @Test
  void publishOrganizationProvisioningCompletedWritesOutboxWhenEnabled() throws Exception {
    AppProperties appProperties = new AppProperties();
    appProperties.getKafka().setOutboxEventWriteEnabled(true);
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);
    when(outboxService.enqueue(org.mockito.ArgumentMatchers.any())).thenReturn("evt_outbox_6");
    BusinessOutboxPublisher publisher = new BusinessOutboxPublisher(appProperties, outboxService);

    String eventId =
        publisher.publishOrganizationProvisioningCompleted(
            new OrganizationProvisioningCompletedEvent(
                "2026-07-03T10:20:00Z",
                1001,
                31,
                "wxapp_1",
                "public",
                7,
                "active",
                "completed",
                "org001",
                "tenant_org001"));

    assertThat(eventId).isEqualTo("evt_outbox_6");
    ArgumentCaptor<OutboxEventRequest> captor = ArgumentCaptor.forClass(OutboxEventRequest.class);
    verify(outboxService).enqueue(captor.capture());
    OutboxEventRequest request = captor.getValue();
    assertThat(request.aggregateId()).isEqualTo("31");
    assertThat(request.aggregateType()).isEqualTo("tenant_provisioning_job");
    assertThat(request.customerId()).isEqualTo("org001");
    assertThat(request.eventType()).isEqualTo("organization.provisioning.completed");
    assertThat(request.idempotencyKey()).isEqualTo("organization-provisioning-completed:31");
    assertThat(request.topic()).isEqualTo("magic.organization.provisioning");

    Map<String, Object> payload =
        JSON.readValue(request.payload(), new TypeReference<Map<String, Object>>() {});
    assertThat(payload)
        .containsEntry("completedAt", "2026-07-03T10:20:00Z")
        .containsEntry("initiatorCenterUserId", 1001)
        .containsEntry("jobId", 31)
        .containsEntry("lastPaymentOutTradeNo", "wxapp_1")
        .containsEntry("mode", "worker_completed")
        .containsEntry("sourceCustomerId", "public")
        .containsEntry("sourceOrgId", 7)
        .containsEntry("status", "active")
        .containsEntry("step", "completed")
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001");
  }

  private VipMembershipPaymentCreatedEvent event() {
    return new VipMembershipPaymentCreatedEvent(
        98_000, 1001, "wechat_app", "wxapp_1", "customer_1", "alice");
  }
}
