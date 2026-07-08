package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.messaging.BusinessOutboxPublisher;
import cn.yizuw.magic.backend.messaging.VipMembershipPaymentCreatedEvent;
import cn.yizuw.magic.backend.messaging.VipMembershipPaymentNotifiedEvent;
import cn.yizuw.magic.backend.messaging.VipMembershipRefundNotifiedEvent;
import cn.yizuw.magic.backend.messaging.VipMembershipRefundRequestedEvent;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantContext;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.PreparedStatementCreator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.env.MockEnvironment;

/** 微信支付本地快照与业务 outbox 事件联动测试，不连接真实微信或数据库。 */
class WechatPayRefundOrderServiceTest {

  private BusinessOutboxPublisher businessOutboxPublisher;
  private JdbcTemplate centerJdbcTemplate;
  private WechatPayRefundOrderService service;

  @BeforeEach
  void setUp() {
    businessOutboxPublisher = org.mockito.Mockito.mock(BusinessOutboxPublisher.class);
    centerJdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
    service =
        new WechatPayRefundOrderService(
            new AppProperties(), businessOutboxPublisher, centerJdbcTemplate);
    TenantContext.set(
        new UserTokenPayload(
            1001L,
            "customer_1",
            "customer_1",
            2002L,
            List.of(),
            null,
            null,
            List.of("User"),
            1L,
            "alice"));
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void createAppPrepayLocalPublishesOutboxEventWhenPaymentSnapshotRecorded() {
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_payment")))
        .thenReturn(1L);
    when(centerJdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
    when(businessOutboxPublisher.publishVipMembershipPaymentCreated(any()))
        .thenReturn("evt_payment_created_1");

    Map<String, Object> result =
        service.createAppPrepayLocal(
            Map.of("amount", 98_000, "attach", "vip-membership", "description", "会员服务"));

    assertThat(result)
        .containsEntry("outboxEventId", "evt_payment_created_1")
        .containsEntry("outboxEventQueued", true)
        .containsEntry("paymentSnapshotRecorded", true)
        .containsEntry("vipMembership", true);
    ArgumentCaptor<VipMembershipPaymentCreatedEvent> captor =
        ArgumentCaptor.forClass(VipMembershipPaymentCreatedEvent.class);
    verify(businessOutboxPublisher).publishVipMembershipPaymentCreated(captor.capture());
    VipMembershipPaymentCreatedEvent event = captor.getValue();
    assertThat(event.amountTotal()).isEqualTo(98_000);
    assertThat(event.centerUserId()).isEqualTo(1001);
    assertThat(event.channel()).isEqualTo("wechat_app");
    assertThat(event.outTradeNo()).startsWith("wxapp_");
    assertThat(event.sourceCustomerId()).isEqualTo("customer_1");
    assertThat(event.username()).isEqualTo("alice");
  }

  @Test
  void createH5PrepayLocalPublishesH5OutboxEventWhenPaymentSnapshotRecorded() {
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_payment")))
        .thenReturn(1L);
    when(centerJdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
    when(businessOutboxPublisher.publishVipMembershipPaymentCreated(any()))
        .thenReturn("evt_payment_created_2");

    Map<String, Object> result =
        service.createH5PrepayLocal(
            Map.of("amount", 98_000, "attach", "vip-membership", "description", "会员服务"));

    assertThat(result)
        .containsEntry("outboxEventId", "evt_payment_created_2")
        .containsEntry("outboxEventQueued", true)
        .containsEntry("paymentSnapshotRecorded", true);
    ArgumentCaptor<VipMembershipPaymentCreatedEvent> captor =
        ArgumentCaptor.forClass(VipMembershipPaymentCreatedEvent.class);
    verify(businessOutboxPublisher).publishVipMembershipPaymentCreated(captor.capture());
    assertThat(captor.getValue().channel()).isEqualTo("wechat_h5");
    assertThat(captor.getValue().outTradeNo()).startsWith("wxh5_");
  }

  @Test
  void createH5PrepayLocalDoesNotPublishOutboxWhenPaymentTableMissing() {
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_payment")))
        .thenReturn(0L);

    Map<String, Object> result =
        service.createH5PrepayLocal(
            Map.of("amount", 98_000, "attach", "vip-membership", "description", "会员服务"));

    assertThat(result)
        .containsEntry("outboxEventQueued", false)
        .containsEntry("paymentSnapshotRecorded", false)
        .doesNotContainKey("outboxEventId");
    verify(businessOutboxPublisher, never()).publishVipMembershipPaymentCreated(any());
  }

  @Test
  void acceptPayNotificationLocalPublishesOutboxEventWhenPaymentUpdated() {
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_payment")))
        .thenReturn(1L);
    when(centerJdbcTemplate.update(anyString(), eq("SUCCESS"), eq("4200001"), eq("wxapp_1")))
        .thenReturn(1);
    when(centerJdbcTemplate.query(
            anyString(),
            org.mockito.ArgumentMatchers.<RowMapper<Map<String, Object>>>any(),
            eq("wxapp_1")))
        .thenReturn(
            List.of(
                Map.of(
                    "amountTotal",
                    98_000,
                    "centerUserId",
                    1001,
                    "outTradeNo",
                    "wxapp_1",
                    "sourceCustomerId",
                    "customer_1")));
    when(businessOutboxPublisher.publishVipMembershipPaymentNotified(any()))
        .thenReturn("evt_payment_notified_1");

    Map<String, Object> result =
        service.acceptPayNotificationLocal(
            """
            {"resource":{"out_trade_no":"wxapp_1","trade_state":"SUCCESS","transaction_id":"4200001"}}
            """,
            Map.of());

    assertThat(result)
        .containsEntry("outboxEventId", "evt_payment_notified_1")
        .containsEntry("outboxEventQueued", true)
        .containsEntry("outTradeNo", "wxapp_1")
        .containsEntry("paymentSnapshotUpdated", true);
    ArgumentCaptor<VipMembershipPaymentNotifiedEvent> captor =
        ArgumentCaptor.forClass(VipMembershipPaymentNotifiedEvent.class);
    verify(businessOutboxPublisher).publishVipMembershipPaymentNotified(captor.capture());
    VipMembershipPaymentNotifiedEvent event = captor.getValue();
    assertThat(event.amountTotal()).isEqualTo(98_000);
    assertThat(event.centerUserId()).isEqualTo(1001);
    assertThat(event.outTradeNo()).isEqualTo("wxapp_1");
    assertThat(event.sourceCustomerId()).isEqualTo("customer_1");
    assertThat(event.tradeState()).isEqualTo("SUCCESS");
    assertThat(event.transactionId()).isEqualTo("4200001");
  }

  @Test
  void acceptPayNotificationLocalDoesNotPublishOutboxWhenPaymentUpdateMisses() {
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_payment")))
        .thenReturn(1L);
    when(centerJdbcTemplate.update(anyString(), eq("SUCCESS"), eq("4200001"), eq("missing_order")))
        .thenReturn(0);

    Map<String, Object> result =
        service.acceptPayNotificationLocal(
            """
            {"resource":{"out_trade_no":"missing_order","trade_state":"SUCCESS","transaction_id":"4200001"}}
            """,
            Map.of());

    assertThat(result)
        .containsEntry("outboxEventQueued", false)
        .containsEntry("outTradeNo", "missing_order")
        .containsEntry("paymentSnapshotUpdated", false)
        .doesNotContainKey("outboxEventId");
    verify(businessOutboxPublisher, never()).publishVipMembershipPaymentNotified(any());
  }

  @Test
  void acceptPayNotificationLocalVerifiesSignatureWhenGateEnabled() {
    WechatPaySignatureVerificationService verifier =
        org.mockito.Mockito.mock(WechatPaySignatureVerificationService.class);
    String rawBody = "{\"resource\":{\"out_trade_no\":\"wxapp_1\",\"trade_state\":\"SUCCESS\"}}";
    service =
        new WechatPayRefundOrderService(
            new AppProperties(),
            businessOutboxPublisher,
            centerJdbcTemplate,
            verifier,
            new MockEnvironment().withProperty("WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED", "true"));
    when(verifier.verify("PUB_KEY_ID_1", "1780000000", "nonce-1", rawBody, "signature-1"))
        .thenReturn(
            new WechatPaySignatureVerificationService.WechatPaySignatureVerification(
                true, "message", "PUB_KEY_ID_1"));
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_payment")))
        .thenReturn(0L);

    Map<String, Object> result =
        service.acceptPayNotificationLocal(
            rawBody,
            Map.of(
                "wechatpay-serial",
                "PUB_KEY_ID_1",
                "Wechatpay-Timestamp",
                "1780000000",
                "Wechatpay-Nonce",
                "nonce-1",
                "Wechatpay-Signature",
                "signature-1"));

    assertThat(result)
        .containsEntry("outTradeNo", "wxapp_1")
        .containsEntry("paymentSnapshotUpdated", false)
        .containsEntry("signatureVerified", true);
    verify(verifier).verify("PUB_KEY_ID_1", "1780000000", "nonce-1", rawBody, "signature-1");
    verify(businessOutboxPublisher, never()).publishVipMembershipPaymentNotified(any());
  }

  @Test
  void acceptPayNotificationLocalRejectsInvalidSignatureBeforeDatabaseWrite() {
    WechatPaySignatureVerificationService verifier =
        org.mockito.Mockito.mock(WechatPaySignatureVerificationService.class);
    String rawBody = "{\"resource\":{\"out_trade_no\":\"wxapp_1\",\"trade_state\":\"SUCCESS\"}}";
    service =
        new WechatPayRefundOrderService(
            new AppProperties(),
            businessOutboxPublisher,
            centerJdbcTemplate,
            verifier,
            new MockEnvironment().withProperty("WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED", "true"));
    when(verifier.verify("PUB_KEY_ID_1", "1780000000", "nonce-1", rawBody, "bad-signature"))
        .thenReturn(
            new WechatPaySignatureVerificationService.WechatPaySignatureVerification(
                false, "message", "PUB_KEY_ID_1"));

    assertThatThrownBy(
            () ->
                service.acceptPayNotificationLocal(
                    rawBody,
                    Map.of(
                        "Wechatpay-Serial",
                        "PUB_KEY_ID_1",
                        "Wechatpay-Timestamp",
                        "1780000000",
                        "Wechatpay-Nonce",
                        "nonce-1",
                        "Wechatpay-Signature",
                        "bad-signature")))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付回调签名校验失败");
    verifyNoInteractions(centerJdbcTemplate, businessOutboxPublisher);
  }

  @Test
  void acceptPayNotificationLocalDecryptsResourceWhenGateEnabled() {
    WechatPayNotificationDecryptService decryptService =
        org.mockito.Mockito.mock(WechatPayNotificationDecryptService.class);
    String rawBody = "{\"resource\":{\"algorithm\":\"AEAD_AES_256_GCM\",\"ciphertext\":\"encrypted\"}}";
    service =
        new WechatPayRefundOrderService(
            new AppProperties(),
            businessOutboxPublisher,
            centerJdbcTemplate,
            null,
            decryptService,
            new MockEnvironment().withProperty("WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED", "true"));
    when(decryptService.decrypt(rawBody))
        .thenReturn(
            new WechatPayNotificationDecryptService.WechatPayDecryptedResource(
                "{\"out_trade_no\":\"wxapp_1\",\"trade_state\":\"SUCCESS\"}",
                Map.of("out_trade_no", "wxapp_1", "trade_state", "SUCCESS"),
                "AEAD_AES_256_GCM"));
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_payment")))
        .thenReturn(0L);

    Map<String, Object> result = service.acceptPayNotificationLocal(rawBody, Map.of());

    assertThat(result)
        .containsEntry("outTradeNo", "wxapp_1")
        .containsEntry("paymentSnapshotUpdated", false)
        .containsEntry("resourceDecrypted", true);
    verify(decryptService).decrypt(rawBody);
    verify(businessOutboxPublisher, never()).publishVipMembershipPaymentNotified(any());
  }

  @Test
  void acceptRefundNotificationLocalDecryptsResourceWhenGateEnabled() {
    WechatPayNotificationDecryptService decryptService =
        org.mockito.Mockito.mock(WechatPayNotificationDecryptService.class);
    String rawBody = "{\"resource\":{\"algorithm\":\"AEAD_AES_256_GCM\",\"ciphertext\":\"encrypted\"}}";
    service =
        new WechatPayRefundOrderService(
            new AppProperties(),
            businessOutboxPublisher,
            centerJdbcTemplate,
            null,
            decryptService,
            new MockEnvironment().withProperty("WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED", "true"));
    when(decryptService.decrypt(rawBody))
        .thenReturn(
            new WechatPayNotificationDecryptService.WechatPayDecryptedResource(
                "{\"out_refund_no\":\"vip_refund_wxapp_1\",\"refund_status\":\"SUCCESS\"}",
                Map.of("out_refund_no", "vip_refund_wxapp_1", "refund_status", "SUCCESS"),
                "AEAD_AES_256_GCM"));
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_refund")))
        .thenReturn(0L);

    Map<String, Object> result = service.acceptRefundNotificationLocal(rawBody, Map.of());

    assertThat(result)
        .containsEntry("outRefundNo", "vip_refund_wxapp_1")
        .containsEntry("refundSnapshotUpdated", false)
        .containsEntry("resourceDecrypted", true);
    verify(decryptService).decrypt(rawBody);
    verify(businessOutboxPublisher, never()).publishVipMembershipRefundNotified(any());
  }

  @Test
  void acceptPayNotificationLocalRejectsDecryptFailureBeforeDatabaseWrite() {
    WechatPayNotificationDecryptService decryptService =
        org.mockito.Mockito.mock(WechatPayNotificationDecryptService.class);
    String rawBody = "{\"resource\":{\"algorithm\":\"AEAD_AES_256_GCM\",\"ciphertext\":\"bad\"}}";
    service =
        new WechatPayRefundOrderService(
            new AppProperties(),
            businessOutboxPublisher,
            centerJdbcTemplate,
            null,
            decryptService,
            new MockEnvironment().withProperty("WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED", "true"));
    when(decryptService.decrypt(rawBody))
        .thenThrow(
            new BusinessException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "微信支付回调 resource 解密失败"));

    assertThatThrownBy(() -> service.acceptPayNotificationLocal(rawBody, Map.of()))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付回调 resource 解密失败");
    verify(decryptService).decrypt(rawBody);
    verifyNoInteractions(centerJdbcTemplate, businessOutboxPublisher);
  }

  @Test
  void createRefundLocalPublishesOutboxEventWhenRefundCreated() {
    TenantContext.set(
        new UserTokenPayload(
            1001L,
            "customer_1",
            "customer_1",
            2002L,
            List.of(),
            null,
            null,
            List.of("Super"),
            1L,
            "alice"));
    businessOutboxPublisher = org.mockito.Mockito.mock(BusinessOutboxPublisher.class);
    centerJdbcTemplate = new RefundScenarioJdbcTemplate();
    service =
        new WechatPayRefundOrderService(
            new AppProperties(), businessOutboxPublisher, centerJdbcTemplate);
    when(businessOutboxPublisher.publishVipMembershipRefundRequested(any()))
        .thenReturn("evt_refund_requested_1");

    @SuppressWarnings("unchecked")
    Map<String, Object> result =
        (Map<String, Object>)
            service.createRefundLocal(Map.of("outTradeNo", "wxapp_1", "reason", "用户申请退款"));

    assertThat(result)
        .containsEntry("mode", "local_refund_request")
        .containsEntry("outRefundNo", "vip_refund_wxapp_1")
        .containsEntry("outTradeNo", "wxapp_1")
        .containsEntry("outboxEventId", "evt_refund_requested_1")
        .containsEntry("outboxEventQueued", true)
        .containsEntry("submittedToWechat", false);
    ArgumentCaptor<VipMembershipRefundRequestedEvent> captor =
        ArgumentCaptor.forClass(VipMembershipRefundRequestedEvent.class);
    verify(businessOutboxPublisher).publishVipMembershipRefundRequested(captor.capture());
    VipMembershipRefundRequestedEvent event = captor.getValue();
    assertThat(event.amountTotal()).isEqualTo(98_000);
    assertThat(event.centerUserId()).isEqualTo(1001);
    assertThat(event.customerId()).isEqualTo("customer_1");
    assertThat(event.outRefundNo()).isEqualTo("vip_refund_wxapp_1");
    assertThat(event.outTradeNo()).isEqualTo("wxapp_1");
    assertThat(event.reason()).isEqualTo("用户申请退款");
    assertThat(event.refundAmount()).isEqualTo(98_000);
    assertThat(event.transactionId()).isEqualTo("4200001");
  }

  @Test
  void acceptRefundNotificationLocalPublishesOutboxEventWhenRefundUpdated() {
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_refund")))
        .thenReturn(1L);
    when(centerJdbcTemplate.update(
            anyString(), eq("5000001"), eq("SUCCESS"), anyString(), eq("vip_refund_wxapp_1")))
        .thenReturn(1);
    when(centerJdbcTemplate.query(
            anyString(),
            org.mockito.ArgumentMatchers.<RowMapper<Map<String, Object>>>any(),
            eq("vip_refund_wxapp_1")))
        .thenReturn(
            List.of(
                Map.of(
                    "amountTotal",
                    98_000,
                    "centerUserId",
                    1001,
                    "customerId",
                    "customer_1",
                    "outRefundNo",
                    "vip_refund_wxapp_1",
                    "outTradeNo",
                    "wxapp_1",
                    "refundAmount",
                    98_000,
                    "refundId",
                    "5000001",
                    "status",
                    "SUCCESS")));
    when(businessOutboxPublisher.publishVipMembershipRefundNotified(any()))
        .thenReturn("evt_refund_notified_1");

    Map<String, Object> result =
        service.acceptRefundNotificationLocal(
            """
            {"resource":{"out_refund_no":"vip_refund_wxapp_1","refund_id":"5000001","refund_status":"SUCCESS"}}
            """,
            Map.of());

    assertThat(result)
        .containsEntry("mode", "local_refund_notify_ack")
        .containsEntry("outRefundNo", "vip_refund_wxapp_1")
        .containsEntry("outboxEventId", "evt_refund_notified_1")
        .containsEntry("outboxEventQueued", true)
        .containsEntry("refundSnapshotUpdated", true);
    ArgumentCaptor<VipMembershipRefundNotifiedEvent> captor =
        ArgumentCaptor.forClass(VipMembershipRefundNotifiedEvent.class);
    verify(businessOutboxPublisher).publishVipMembershipRefundNotified(captor.capture());
    VipMembershipRefundNotifiedEvent event = captor.getValue();
    assertThat(event.amountTotal()).isEqualTo(98_000);
    assertThat(event.centerUserId()).isEqualTo(1001);
    assertThat(event.customerId()).isEqualTo("customer_1");
    assertThat(event.outRefundNo()).isEqualTo("vip_refund_wxapp_1");
    assertThat(event.outTradeNo()).isEqualTo("wxapp_1");
    assertThat(event.refundAmount()).isEqualTo(98_000);
    assertThat(event.refundId()).isEqualTo("5000001");
    assertThat(event.refundStatus()).isEqualTo("SUCCESS");
  }

  @Test
  void acceptRefundNotificationLocalDoesNotPublishOutboxWhenRefundUpdateMisses() {
    when(centerJdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("vip_membership_refund")))
        .thenReturn(1L);
    when(centerJdbcTemplate.update(
            anyString(), eq("5000001"), eq("SUCCESS"), anyString(), eq("missing_refund")))
        .thenReturn(0);

    Map<String, Object> result =
        service.acceptRefundNotificationLocal(
            """
            {"resource":{"out_refund_no":"missing_refund","refund_id":"5000001","refund_status":"SUCCESS"}}
            """,
            Map.of());

    assertThat(result)
        .containsEntry("outRefundNo", "missing_refund")
        .containsEntry("outboxEventQueued", false)
        .containsEntry("refundSnapshotUpdated", false)
        .doesNotContainKey("outboxEventId");
    verify(businessOutboxPublisher, never()).publishVipMembershipRefundNotified(any());
  }

  private static final class RefundScenarioJdbcTemplate extends JdbcTemplate {

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(1L);
    }

    @Override
    public int update(PreparedStatementCreator psc) {
      return 1;
    }

    @Override
    public int update(String sql, Object... args) {
      return 1;
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      if (sql.contains("FROM vip_membership_payment")) {
        return rows(paymentRow());
      }
      if (sql.contains("status IN")) {
        return List.of();
      }
      if (sql.contains("WHERE out_refund_no")) {
        return rows(refundRow("CREATE_PENDING"));
      }
      return List.of();
    }

    @SuppressWarnings("unchecked")
    private <T> List<T> rows(Map<String, Object> row) {
      return (List<T>) List.of(row);
    }

    private Map<String, Object> paymentRow() {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("amountTotal", 98_000);
      row.put("centerUserId", 1001);
      row.put("outTradeNo", "wxapp_1");
      row.put("sourceCustomerId", "customer_1");
      row.put("targetCustomerId", null);
      row.put("tradeState", "SUCCESS");
      row.put("transactionId", "4200001");
      return row;
    }

    private Map<String, Object> refundRow(String status) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("amountTotal", 98_000);
      row.put("centerUserId", 1001);
      row.put("createTime", "2026-07-02T10:00:00+08:00");
      row.put("customerId", "customer_1");
      row.put("outRefundNo", "vip_refund_wxapp_1");
      row.put("outTradeNo", "wxapp_1");
      row.put("reason", "用户申请退款");
      row.put("refundAmount", 98_000);
      row.put("refundId", null);
      row.put("status", status);
      row.put("successAt", null);
      return row;
    }
  }
}
