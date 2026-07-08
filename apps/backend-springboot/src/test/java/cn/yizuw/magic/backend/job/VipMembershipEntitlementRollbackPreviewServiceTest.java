package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** 会员权益回滚预览服务测试；只用 fake JdbcTemplate，不连接真实中心库。 */
class VipMembershipEntitlementRollbackPreviewServiceTest {

  @Test
  void previewBuildsReadonlyRollbackPlanForActiveEntitlement() {
    PreviewJdbcTemplate jdbcTemplate = new PreviewJdbcTemplate();
    jdbcTemplate.addPayment(
        new PaymentFixture(
            "wxapp_order_1", 1001L, "source_customer_1", "target_customer_1", "SUCCESS", "4200001", 98000));
    jdbcTemplate.addEntitlement(
        new EntitlementFixture(
            11,
            "target_customer_1",
            1001L,
            "wxapp_order_1",
            "4200001",
            98000,
            12,
            Instant.parse("2026-08-01T00:00:00Z"),
            Instant.parse("2027-08-01T00:00:00Z"),
            "active",
            null,
            null));
    jdbcTemplate.addEntitlement(
        new EntitlementFixture(
            10,
            "target_customer_1",
            1001L,
            "wxapp_order_previous",
            "4200000",
            98000,
            12,
            Instant.parse("2025-08-01T00:00:00Z"),
            Instant.parse("2026-08-01T00:00:00Z"),
            "active",
            null,
            null));
    jdbcTemplate.addMembership(
        new MembershipFixture(
            "target_customer_1",
            "active",
            Instant.parse("2027-08-01T00:00:00Z"),
            1001L,
            "wxapp_order_1",
            "4200001"));
    VipMembershipEntitlementRollbackPreviewService service =
        new VipMembershipEntitlementRollbackPreviewService(jdbcTemplate);

    VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackPreview preview =
        service.preview(
            "wxapp_order_1",
            "vip_refund_wxapp_1",
            Instant.parse("2026-07-02T08:10:00Z"));

    assertThat(preview.tableReady()).isTrue();
    assertThat(preview.writeEnabled()).isFalse();
    assertThat(preview.rollbackReady()).isTrue();
    assertThat(preview.alreadyRevoked()).isFalse();
    assertThat(preview.blockedReason()).isEmpty();
    assertThat(preview.customerId()).isEqualTo("target_customer_1");
    assertThat(preview.executionLock())
        .containsEntry("targetTable", "customer")
        .containsEntry("lockMode", "FOR UPDATE")
        .containsEntry("writeEnabled", false);
    assertThat(preview.paymentUpdate())
        .containsEntry("targetTable", "vip_membership_payment")
        .containsEntry("writeEnabled", false);
    assertThat(preview.entitlementUpdate())
        .containsEntry("targetTable", "vip_membership_entitlement")
        .containsEntry("currentStatus", "active")
        .containsEntry("writeEnabled", false);
    @SuppressWarnings("unchecked")
    Map<String, Object> entitlementColumns =
        (Map<String, Object>) preview.entitlementUpdate().get("updateColumns");
    assertThat(entitlementColumns)
        .containsEntry("status", "refunded")
        .containsEntry("refunded_out_refund_no", "vip_refund_wxapp_1");
    @SuppressWarnings("unchecked")
    Map<String, Object> summaryColumns =
        (Map<String, Object>) preview.membershipSummaryUpdate().get("updateColumns");
    assertThat(summaryColumns)
        .containsEntry("status", "active")
        .containsEntry("last_out_trade_no", "wxapp_order_previous")
        .containsEntry("last_transaction_id", "4200000");
    assertThat(preview.latestRemainingEntitlement()).containsEntry("outTradeNo", "wxapp_order_previous");
  }

  @Test
  void previewBlocksWhenEntitlementIsMissingButStillShowsPaymentUpdate() {
    PreviewJdbcTemplate jdbcTemplate = new PreviewJdbcTemplate();
    jdbcTemplate.addPayment(
        new PaymentFixture(
            "wxapp_order_2", 1002L, "source_customer_2", "", "SUCCESS", "4200002", 98000));
    VipMembershipEntitlementRollbackPreviewService service =
        new VipMembershipEntitlementRollbackPreviewService(jdbcTemplate);

    VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackPreview preview =
        service.preview(
            "wxapp_order_2",
            "vip_refund_wxapp_2",
            Instant.parse("2026-07-02T08:10:00Z"));

    assertThat(preview.tableReady()).isTrue();
    assertThat(preview.rollbackReady()).isFalse();
    assertThat(preview.blockedReason()).isEqualTo("会员退款缺少对应权益流水，请先人工核对订单数据");
    assertThat(preview.customerId()).isEqualTo("source_customer_2");
    assertThat(preview.paymentUpdate()).containsEntry("targetTable", "vip_membership_payment");
    assertThat(preview.entitlementUpdate()).isNull();
    assertThat(preview.membershipSummaryUpdate()).isNull();
  }

  @Test
  void previewBlocksWhenRequiredTablesAreMissing() {
    PreviewJdbcTemplate jdbcTemplate = new PreviewJdbcTemplate();
    jdbcTemplate.tableStatus().put("customer", false);
    VipMembershipEntitlementRollbackPreviewService service =
        new VipMembershipEntitlementRollbackPreviewService(jdbcTemplate);

    VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackPreview preview =
        service.preview(
            "wxapp_order_3",
            "vip_refund_wxapp_3",
            Instant.parse("2026-07-02T08:10:00Z"));

    assertThat(preview.tableReady()).isFalse();
    assertThat(preview.blockedReason()).contains("会员权益回滚依赖表不存在：customer");
    assertThat(preview.paymentUpdate()).isNull();
  }

  @Test
  void rollbackUpdatesPaymentEntitlementAndMembershipSummary() {
    PreviewJdbcTemplate jdbcTemplate = new PreviewJdbcTemplate();
    jdbcTemplate.addCustomer("target_customer_1");
    jdbcTemplate.addPayment(
        new PaymentFixture(
            "wxapp_order_1", 1001L, "source_customer_1", "target_customer_1", "SUCCESS", "4200001", 98000));
    jdbcTemplate.addEntitlement(
        new EntitlementFixture(
            11,
            "target_customer_1",
            1001L,
            "wxapp_order_1",
            "4200001",
            98000,
            12,
            Instant.parse("2026-08-01T00:00:00Z"),
            Instant.parse("2027-08-01T00:00:00Z"),
            "active",
            null,
            null));
    jdbcTemplate.addEntitlement(
        new EntitlementFixture(
            10,
            "target_customer_1",
            1001L,
            "wxapp_order_previous",
            "4200000",
            98000,
            12,
            Instant.parse("2025-08-01T00:00:00Z"),
            Instant.parse("2026-08-01T00:00:00Z"),
            "active",
            null,
            null));
    VipMembershipEntitlementRollbackPreviewService service =
        new VipMembershipEntitlementRollbackPreviewService(jdbcTemplate);

    VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackResult result =
        service.rollback(
            "wxapp_order_1",
            "vip_refund_wxapp_1",
            Instant.parse("2026-07-02T08:10:00Z"));

    assertThat(result.rollbackExecuted()).isTrue();
    assertThat(result.paymentUpdatedRows()).isEqualTo(1);
    assertThat(result.entitlementUpdatedRows()).isEqualTo(1);
    assertThat(result.membershipSummaryUpdatedRows()).isEqualTo(2);
    assertThat(result.membershipSummarySource()).isEqualTo("latest_active_entitlement_after_refund");
    assertThat(result.latestRemainingEntitlement()).containsEntry("outTradeNo", "wxapp_order_previous");
    assertThat(jdbcTemplate.updateSql())
        .anySatisfy(sql -> assertThat(sql).contains("UPDATE vip_membership_payment"))
        .anySatisfy(sql -> assertThat(sql).contains("UPDATE vip_membership_entitlement"))
        .anySatisfy(sql -> assertThat(sql).contains("INSERT INTO vip_membership"));
  }

  @Test
  void rollbackSkipsAlreadyRefundedEntitlementIdempotently() {
    PreviewJdbcTemplate jdbcTemplate = new PreviewJdbcTemplate();
    jdbcTemplate.addCustomer("target_customer_1");
    jdbcTemplate.addPayment(
        new PaymentFixture(
            "wxapp_order_1", 1001L, "source_customer_1", "target_customer_1", "REFUND", "4200001", 98000));
    jdbcTemplate.addEntitlement(
        new EntitlementFixture(
            11,
            "target_customer_1",
            1001L,
            "wxapp_order_1",
            "4200001",
            98000,
            12,
            Instant.parse("2026-08-01T00:00:00Z"),
            Instant.parse("2027-08-01T00:00:00Z"),
            "refunded",
            Instant.parse("2026-07-02T08:00:00Z"),
            "vip_refund_wxapp_1"));
    VipMembershipEntitlementRollbackPreviewService service =
        new VipMembershipEntitlementRollbackPreviewService(jdbcTemplate);

    VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackResult result =
        service.rollback(
            "wxapp_order_1",
            "vip_refund_wxapp_1",
            Instant.parse("2026-07-02T08:10:00Z"));

    assertThat(result.rollbackExecuted()).isFalse();
    assertThat(result.alreadyRevoked()).isTrue();
    assertThat(result.skippedReason()).contains("已标记为 refunded");
    assertThat(jdbcTemplate.updateSql()).isEmpty();
  }

  private record PaymentFixture(
      String outTradeNo,
      Long centerUserId,
      String sourceCustomerId,
      String targetCustomerId,
      String tradeState,
      String transactionId,
      Integer amountTotal) {}

  private record EntitlementFixture(
      int id,
      String customerId,
      Long centerUserId,
      String outTradeNo,
      String transactionId,
      Integer amountTotal,
      Integer durationMonths,
      Instant startAt,
      Instant endAt,
      String status,
      Instant refundedAt,
      String refundedOutRefundNo) {}

  private record MembershipFixture(
      String customerId,
      String status,
      Instant expireAt,
      Long lastPayerCenterUserId,
      String lastOutTradeNo,
      String lastTransactionId) {}

  private static final class PreviewJdbcTemplate extends JdbcTemplate {

    private final Map<String, EntitlementFixture> entitlements = new LinkedHashMap<>();
    private final Map<String, MembershipFixture> memberships = new LinkedHashMap<>();
    private final Map<String, PaymentFixture> payments = new LinkedHashMap<>();
    private final java.util.Set<String> customers = new java.util.LinkedHashSet<>();
    private final Map<String, Boolean> tableStatus = new LinkedHashMap<>();
    private final List<String> updateSql = new java.util.ArrayList<>();

    private PreviewJdbcTemplate() {
      tableStatus.put("vip_membership_payment", true);
      tableStatus.put("vip_membership_entitlement", true);
      tableStatus.put("vip_membership", true);
      tableStatus.put("customer", true);
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      String tableName = String.valueOf(args[0]);
      return requiredType.cast(Boolean.TRUE.equals(tableStatus.get(tableName)) ? 1L : 0L);
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      if (sql.contains("FROM vip_membership_payment")) {
        PaymentFixture payment = payments.get(String.valueOf(args[0]));
        return payment == null ? List.of() : List.of(map(rowMapper, resultSet(payment)));
      }
      if (sql.contains("FROM customer") && sql.contains("FOR UPDATE")) {
        String customerId = String.valueOf(args[0]);
        return customers.contains(customerId) ? List.of(map(rowMapper, resultSet(customerId))) : List.of();
      }
      if (sql.contains("FROM vip_membership_entitlement") && sql.contains("out_trade_no = ?")) {
        EntitlementFixture entitlement = entitlements.get(String.valueOf(args[0]));
        return entitlement == null ? List.of() : List.of(map(rowMapper, resultSet(entitlement)));
      }
      if (sql.contains("FROM vip_membership_entitlement") && sql.contains("status = 'active'")) {
        String customerId = String.valueOf(args[0]);
        String excludedOutTradeNo = String.valueOf(args[1]);
        return entitlements.values().stream()
            .filter(row -> customerId.equals(row.customerId()))
            .filter(row -> "active".equals(row.status()))
            .filter(row -> !excludedOutTradeNo.equals(row.outTradeNo()))
            .sorted(
                java.util.Comparator
                    .comparing(EntitlementFixture::endAt, java.util.Comparator.reverseOrder())
                    .thenComparing(EntitlementFixture::id, java.util.Comparator.reverseOrder()))
            .limit(1)
            .map(row -> map(rowMapper, resultSet(row)))
            .toList();
      }
      if (sql.contains("FROM vip_membership")) {
        MembershipFixture membership = memberships.get(String.valueOf(args[0]));
        return membership == null ? List.of() : List.of(map(rowMapper, resultSet(membership)));
      }
      return List.of();
    }

    @Override
    public int update(String sql, Object... args) {
      updateSql.add(sql);
      if (sql.contains("UPDATE vip_membership_payment")) {
        return payments.containsKey(String.valueOf(args[1])) ? 1 : 0;
      }
      if (sql.contains("UPDATE vip_membership_entitlement")) {
        EntitlementFixture entitlement = entitlements.get(String.valueOf(args[3]));
        return entitlement != null && "active".equals(entitlement.status()) ? 1 : 0;
      }
      if (sql.contains("INSERT INTO vip_membership")) {
        return 2;
      }
      return 0;
    }

    private void addPayment(PaymentFixture payment) {
      payments.put(payment.outTradeNo(), payment);
    }

    private void addCustomer(String customerId) {
      customers.add(customerId);
    }

    private void addEntitlement(EntitlementFixture entitlement) {
      entitlements.put(entitlement.outTradeNo(), entitlement);
    }

    private void addMembership(MembershipFixture membership) {
      memberships.put(membership.customerId(), membership);
    }

    private Map<String, Boolean> tableStatus() {
      return tableStatus;
    }

    private List<String> updateSql() {
      return updateSql;
    }

    private <T> T map(RowMapper<T> rowMapper, ResultSet resultSet) {
      try {
        return rowMapper.mapRow(resultSet, 0);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private ResultSet resultSet(PaymentFixture payment) {
      try {
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("out_trade_no")).thenReturn(payment.outTradeNo());
        when(resultSet.getObject("center_user_id")).thenReturn(payment.centerUserId());
        when(resultSet.getString("source_customer_id")).thenReturn(payment.sourceCustomerId());
        when(resultSet.getString("target_customer_id")).thenReturn(payment.targetCustomerId());
        when(resultSet.getString("trade_state")).thenReturn(payment.tradeState());
        when(resultSet.getString("transaction_id")).thenReturn(payment.transactionId());
        when(resultSet.getObject("amount_total")).thenReturn(payment.amountTotal());
        return resultSet;
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private ResultSet resultSet(String customerId) {
      try {
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("customer_id")).thenReturn(customerId);
        return resultSet;
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private ResultSet resultSet(EntitlementFixture entitlement) {
      try {
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getInt("id")).thenReturn(entitlement.id());
        when(resultSet.getString("customer_id")).thenReturn(entitlement.customerId());
        when(resultSet.getObject("center_user_id")).thenReturn(entitlement.centerUserId());
        when(resultSet.getString("out_trade_no")).thenReturn(entitlement.outTradeNo());
        when(resultSet.getString("transaction_id")).thenReturn(entitlement.transactionId());
        when(resultSet.getObject("amount_total")).thenReturn(entitlement.amountTotal());
        when(resultSet.getObject("duration_months")).thenReturn(entitlement.durationMonths());
        when(resultSet.getTimestamp("start_at")).thenReturn(timestamp(entitlement.startAt()));
        when(resultSet.getTimestamp("end_at")).thenReturn(timestamp(entitlement.endAt()));
        when(resultSet.getString("status")).thenReturn(entitlement.status());
        when(resultSet.getTimestamp("refunded_at")).thenReturn(timestamp(entitlement.refundedAt()));
        when(resultSet.getString("refunded_out_refund_no")).thenReturn(entitlement.refundedOutRefundNo());
        return resultSet;
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private ResultSet resultSet(MembershipFixture membership) {
      try {
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("customer_id")).thenReturn(membership.customerId());
        when(resultSet.getString("status")).thenReturn(membership.status());
        when(resultSet.getTimestamp("expire_at")).thenReturn(timestamp(membership.expireAt()));
        when(resultSet.getObject("last_payer_center_user_id")).thenReturn(membership.lastPayerCenterUserId());
        when(resultSet.getString("last_out_trade_no")).thenReturn(membership.lastOutTradeNo());
        when(resultSet.getString("last_transaction_id")).thenReturn(membership.lastTransactionId());
        return resultSet;
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private Timestamp timestamp(Instant instant) {
      return instant == null ? null : Timestamp.from(instant);
    }
  }
}
