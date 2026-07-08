package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 会员退款成功后的权益回滚服务；预览只读，真实执行必须由 Job 显式开关触发。 */
@Service
public class VipMembershipEntitlementRollbackPreviewService {

  private static final String ACTIVE_ENTITLEMENT_STATUS = "active";
  private static final String REFUNDED_ENTITLEMENT_STATUS = "refunded";

  private final JdbcTemplate centerJdbcTemplate;

  public VipMembershipEntitlementRollbackPreviewService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 预览旧端 `revokeVipMembershipForRefundWithClient` 会处理的退款权益回滚动作。
   *
   * <p>这里不会执行 `FOR UPDATE` 锁、不会更新支付单、不会把权益改为 refunded，也不会重算
   * `vip_membership` 汇总；只返回后续执行批次需要人工核对的目标行和字段。
   */
  @Transactional(readOnly = true)
  public VipMembershipEntitlementRollbackPreview preview(
      String expectedOutTradeNo, String outRefundNo, Instant previewedAt) {
    String outTradeNo = requiredText(expectedOutTradeNo, "outTradeNo");
    Instant now = previewedAt == null ? Instant.now() : previewedAt;
    Map<String, Boolean> tableStatus = tableStatus();
    List<String> missingTables =
        tableStatus.entrySet().stream()
            .filter(entry -> !Boolean.TRUE.equals(entry.getValue()))
            .map(Map.Entry::getKey)
            .toList();
    if (!missingTables.isEmpty()) {
      return blocked(
          outTradeNo,
          outRefundNo,
          "",
          tableStatus,
          "会员权益回滚依赖表不存在：" + String.join(",", missingTables),
          now);
    }

    PaymentSnapshot payment = findPayment(outTradeNo);
    if (payment == null) {
      return blocked(outTradeNo, outRefundNo, "", tableStatus, "会员退款缺少对应支付单", now);
    }
    String membershipCustomerId = firstText(payment.targetCustomerId(), payment.sourceCustomerId());
    if (!StringUtils.hasText(membershipCustomerId)) {
      return blocked(outTradeNo, outRefundNo, "", tableStatus, "会员退款支付单缺少客户空间", now);
    }

    EntitlementSnapshot entitlement = findEntitlement(outTradeNo);
    if (entitlement == null) {
      return blocked(
          outTradeNo,
          outRefundNo,
          membershipCustomerId,
          tableStatus,
          "会员退款缺少对应权益流水，请先人工核对订单数据",
          now,
          paymentUpdate(payment, now),
          null,
          null,
          null);
    }
    if (!membershipCustomerId.equals(entitlement.customerId())) {
      return blocked(
          outTradeNo,
          outRefundNo,
          membershipCustomerId,
          tableStatus,
          "会员权益客户空间与支付单客户空间不一致，请先人工核对订单数据",
          now,
          paymentUpdate(payment, now),
          entitlementUpdate(entitlement, outRefundNo, now),
          null,
          null);
    }

    EntitlementSnapshot latestRemainingEntitlement =
        findLatestActiveEntitlement(membershipCustomerId, outTradeNo);
    MembershipSnapshot currentMembership = findMembership(membershipCustomerId);
    Map<String, Object> membershipSummaryUpdate =
        membershipSummaryUpdate(membershipCustomerId, currentMembership, latestRemainingEntitlement, now);

    boolean alreadyRevoked = REFUNDED_ENTITLEMENT_STATUS.equals(normalize(entitlement.status()));
    boolean rollbackReady = ACTIVE_ENTITLEMENT_STATUS.equals(normalize(entitlement.status()));
    String blockedReason = "";
    if (alreadyRevoked) {
      blockedReason = "会员权益已标记为 refunded，本批不重复回滚";
    } else if (!rollbackReady) {
      blockedReason = "会员权益状态不是 active，本批不执行回滚";
    }

    return new VipMembershipEntitlementRollbackPreview(
        outTradeNo,
        clean(outRefundNo),
        membershipCustomerId,
        tableStatus,
        true,
        false,
        rollbackReady,
        alreadyRevoked,
        blockedReason,
        executionLock(membershipCustomerId),
        paymentUpdate(payment, now),
        entitlementUpdate(entitlement, outRefundNo, now),
        membershipSummaryUpdate,
        entitlementSummary(latestRemainingEntitlement),
        now.toString());
  }

  /**
   * 执行会员退款成功后的权益回滚。
   *
   * <p>这是高风险写操作，只能在退款远程查询确认为 `SUCCESS`、本地退款状态写回成功，并且 Job 显式传入
   * `entitlementRollback=true` 后调用。方法内部按旧端顺序锁定客户、更新支付单、标记权益为 `refunded`，
   * 再根据剩余 active 权益重算 `vip_membership` 汇总；不写 outbox、不修改组织开通任务。
   */
  @Transactional(readOnly = false)
  public VipMembershipEntitlementRollbackResult rollback(
      String expectedOutTradeNo, String outRefundNo, Instant executedAt) {
    String outTradeNo = requiredText(expectedOutTradeNo, "outTradeNo");
    Instant now = executedAt == null ? Instant.now() : executedAt;
    Map<String, Boolean> tableStatus = tableStatus();
    List<String> missingTables =
        tableStatus.entrySet().stream()
            .filter(entry -> !Boolean.TRUE.equals(entry.getValue()))
            .map(Map.Entry::getKey)
            .toList();
    if (!missingTables.isEmpty()) {
      throw new BusinessException(
          HttpStatus.CONFLICT, "会员权益回滚依赖表不存在：" + String.join(",", missingTables));
    }

    PaymentSnapshot payment = findPayment(outTradeNo);
    if (payment == null) {
      throw new BusinessException(HttpStatus.CONFLICT, "会员退款缺少对应支付单");
    }
    String membershipCustomerId = firstText(payment.targetCustomerId(), payment.sourceCustomerId());
    if (!StringUtils.hasText(membershipCustomerId)) {
      throw new BusinessException(HttpStatus.CONFLICT, "会员退款支付单缺少客户空间");
    }
    lockCustomerForVipMembership(membershipCustomerId);

    EntitlementSnapshot entitlement = findEntitlement(outTradeNo);
    if (entitlement == null) {
      throw new BusinessException(HttpStatus.CONFLICT, "会员退款缺少对应权益流水，请先人工核对订单数据");
    }
    if (!membershipCustomerId.equals(entitlement.customerId())) {
      throw new BusinessException(HttpStatus.CONFLICT, "会员权益客户空间与支付单客户空间不一致，请先人工核对订单数据");
    }

    boolean alreadyRevoked = REFUNDED_ENTITLEMENT_STATUS.equals(normalize(entitlement.status()));
    if (alreadyRevoked) {
      EntitlementSnapshot latestRemainingEntitlement =
          findLatestActiveEntitlement(membershipCustomerId, outTradeNo);
      return rollbackResult(
          outTradeNo,
          outRefundNo,
          membershipCustomerId,
          false,
          true,
          0,
          0,
          0,
          "会员权益已标记为 refunded，本批不重复回滚",
          latestRemainingEntitlement,
          now);
    }
    if (!ACTIVE_ENTITLEMENT_STATUS.equals(normalize(entitlement.status()))) {
      throw new BusinessException(HttpStatus.CONFLICT, "会员权益状态不是 active，本批不执行回滚");
    }

    int paymentUpdatedRows =
        centerJdbcTemplate.update(
            """
            UPDATE vip_membership_payment
            SET trade_state = 'REFUND',
                update_time = ?
            WHERE out_trade_no = ?
            """,
            timestamp(now),
            outTradeNo);
    int entitlementUpdatedRows =
        centerJdbcTemplate.update(
            """
            UPDATE vip_membership_entitlement
            SET status = 'refunded',
                refunded_at = ?,
                refunded_out_refund_no = ?,
                update_time = ?
            WHERE out_trade_no = ?
              AND status = 'active'
            """,
            timestamp(now),
            clean(outRefundNo),
            timestamp(now),
            outTradeNo);
    if (entitlementUpdatedRows <= 0) {
      throw new BusinessException(HttpStatus.CONFLICT, "会员权益状态已变化，请重新对账后再执行回滚");
    }

    EntitlementSnapshot latestRemainingEntitlement =
        findLatestActiveEntitlement(membershipCustomerId, outTradeNo);
    int membershipSummaryUpdatedRows =
        upsertMembershipSummary(membershipCustomerId, latestRemainingEntitlement, now);
    return rollbackResult(
        outTradeNo,
        outRefundNo,
        membershipCustomerId,
        true,
        false,
        paymentUpdatedRows,
        entitlementUpdatedRows,
        membershipSummaryUpdatedRows,
        "",
        latestRemainingEntitlement,
        now);
  }

  private VipMembershipEntitlementRollbackPreview blocked(
      String outTradeNo,
      String outRefundNo,
      String customerId,
      Map<String, Boolean> tableStatus,
      String reason,
      Instant now) {
    return blocked(outTradeNo, outRefundNo, customerId, tableStatus, reason, now, null, null, null, null);
  }

  private VipMembershipEntitlementRollbackPreview blocked(
      String outTradeNo,
      String outRefundNo,
      String customerId,
      Map<String, Boolean> tableStatus,
      String reason,
      Instant now,
      Map<String, Object> paymentUpdate,
      Map<String, Object> entitlementUpdate,
      Map<String, Object> membershipSummaryUpdate,
      Map<String, Object> latestRemainingEntitlement) {
    return new VipMembershipEntitlementRollbackPreview(
        outTradeNo,
        clean(outRefundNo),
        customerId,
        tableStatus,
        tableStatus.values().stream().allMatch(Boolean.TRUE::equals),
        false,
        false,
        false,
        reason,
        StringUtils.hasText(customerId) ? executionLock(customerId) : null,
        paymentUpdate,
        entitlementUpdate,
        membershipSummaryUpdate,
        latestRemainingEntitlement,
        now.toString());
  }

  private Map<String, Boolean> tableStatus() {
    Map<String, Boolean> status = new LinkedHashMap<>();
    status.put("vip_membership_payment", tableExists("vip_membership_payment"));
    status.put("vip_membership_entitlement", tableExists("vip_membership_entitlement"));
    status.put("vip_membership", tableExists("vip_membership"));
    status.put("customer", tableExists("customer"));
    return status;
  }

  private PaymentSnapshot findPayment(String outTradeNo) {
    List<PaymentSnapshot> rows =
        centerJdbcTemplate.query(
            """
            SELECT out_trade_no, center_user_id, source_customer_id, target_customer_id,
                   trade_state, transaction_id, amount_total
            FROM vip_membership_payment
            WHERE out_trade_no = ?
            """,
            (rs, rowNum) -> paymentSnapshot(rs),
            outTradeNo);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private EntitlementSnapshot findEntitlement(String outTradeNo) {
    List<EntitlementSnapshot> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, customer_id, center_user_id, out_trade_no, transaction_id,
                   amount_total, duration_months, start_at, end_at, status,
                   refunded_at, refunded_out_refund_no
            FROM vip_membership_entitlement
            WHERE out_trade_no = ?
            """,
            (rs, rowNum) -> entitlementSnapshot(rs),
            outTradeNo);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private EntitlementSnapshot findLatestActiveEntitlement(String customerId, String excludedOutTradeNo) {
    List<EntitlementSnapshot> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, customer_id, center_user_id, out_trade_no, transaction_id,
                   amount_total, duration_months, start_at, end_at, status,
                   refunded_at, refunded_out_refund_no
            FROM vip_membership_entitlement
            WHERE customer_id = ?
              AND status = 'active'
              AND out_trade_no <> ?
            ORDER BY end_at DESC, id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> entitlementSnapshot(rs),
            customerId,
            excludedOutTradeNo);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private MembershipSnapshot findMembership(String customerId) {
    List<MembershipSnapshot> rows =
        centerJdbcTemplate.query(
            """
            SELECT customer_id, status, expire_at, last_payer_center_user_id,
                   last_out_trade_no, last_transaction_id
            FROM vip_membership
            WHERE customer_id = ?
            """,
            (rs, rowNum) -> membershipSnapshot(rs),
            customerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void lockCustomerForVipMembership(String customerId) {
    List<String> rows =
        centerJdbcTemplate.query(
            """
            SELECT customer_id
            FROM customer
            WHERE customer_id = ?
            FOR UPDATE
            """,
            (rs, rowNum) -> rs.getString("customer_id"),
            customerId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.CONFLICT, "会员权益回滚缺少客户锁定行");
    }
  }

  private int upsertMembershipSummary(
      String customerId, EntitlementSnapshot latestRemainingEntitlement, Instant now) {
    String status = "inactive";
    Instant expireAt = now;
    String lastOutTradeNo = null;
    Long lastPayerCenterUserId = null;
    String lastTransactionId = null;
    if (latestRemainingEntitlement != null) {
      expireAt = latestRemainingEntitlement.endAt();
      status = expireAt != null && expireAt.isAfter(now) ? "active" : "inactive";
      lastOutTradeNo = latestRemainingEntitlement.outTradeNo();
      lastPayerCenterUserId = latestRemainingEntitlement.centerUserId();
      lastTransactionId = latestRemainingEntitlement.transactionId();
    }
    return centerJdbcTemplate.update(
        """
        INSERT INTO vip_membership (
            customer_id, status, expire_at, last_payer_center_user_id,
            last_out_trade_no, last_transaction_id, create_time, update_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            expire_at = VALUES(expire_at),
            last_payer_center_user_id = VALUES(last_payer_center_user_id),
            last_out_trade_no = VALUES(last_out_trade_no),
            last_transaction_id = VALUES(last_transaction_id),
            update_time = VALUES(update_time)
        """,
        customerId,
        status,
        timestamp(now),
        lastPayerCenterUserId,
        lastOutTradeNo,
        lastTransactionId,
        timestamp(now),
        timestamp(now));
  }

  private VipMembershipEntitlementRollbackResult rollbackResult(
      String outTradeNo,
      String outRefundNo,
      String customerId,
      boolean rollbackExecuted,
      boolean alreadyRevoked,
      int paymentUpdatedRows,
      int entitlementUpdatedRows,
      int membershipSummaryUpdatedRows,
      String skippedReason,
      EntitlementSnapshot latestRemainingEntitlement,
      Instant now) {
    Map<String, Object> summary =
        membershipSummaryUpdate(customerId, null, latestRemainingEntitlement, now);
    summary.put("writeEnabled", rollbackExecuted);
    return new VipMembershipEntitlementRollbackResult(
        outTradeNo,
        clean(outRefundNo),
        customerId,
        rollbackExecuted,
        alreadyRevoked,
        paymentUpdatedRows,
        entitlementUpdatedRows,
        membershipSummaryUpdatedRows,
        skippedReason,
        latestRemainingEntitlement == null
            ? "no_active_entitlement_after_refund"
            : "latest_active_entitlement_after_refund",
        summary,
        entitlementSummary(latestRemainingEntitlement),
        now.toString());
  }

  private Map<String, Object> executionLock(String customerId) {
    Map<String, Object> lock = new LinkedHashMap<>();
    lock.put("targetTable", "customer");
    lock.put("where", Map.of("customer_id", customerId));
    lock.put("lockMode", "FOR UPDATE");
    lock.put("writeEnabled", false);
    return lock;
  }

  private Map<String, Object> paymentUpdate(PaymentSnapshot payment, Instant now) {
    Map<String, Object> update = new LinkedHashMap<>();
    update.put("targetTable", "vip_membership_payment");
    update.put("where", Map.of("out_trade_no", payment.outTradeNo()));
    update.put("currentTradeState", payment.tradeState());
    update.put("writeEnabled", false);
    update.put("updateColumns", Map.of("trade_state", "REFUND", "update_time", now.toString()));
    return update;
  }

  private Map<String, Object> entitlementUpdate(
      EntitlementSnapshot entitlement, String outRefundNo, Instant now) {
    Map<String, Object> columns = new LinkedHashMap<>();
    columns.put("status", REFUNDED_ENTITLEMENT_STATUS);
    columns.put("refunded_at", now.toString());
    columns.put("refunded_out_refund_no", clean(outRefundNo));
    columns.put("update_time", now.toString());

    Map<String, Object> update = new LinkedHashMap<>();
    update.put("targetTable", "vip_membership_entitlement");
    update.put("where", Map.of("out_trade_no", entitlement.outTradeNo()));
    update.put("currentStatus", entitlement.status());
    update.put("id", entitlement.id());
    update.put("writeEnabled", false);
    update.put("updateColumns", columns);
    return update;
  }

  private Map<String, Object> membershipSummaryUpdate(
      String customerId,
      MembershipSnapshot currentMembership,
      EntitlementSnapshot latestRemainingEntitlement,
      Instant now) {
    Map<String, Object> columns = new LinkedHashMap<>();
    if (latestRemainingEntitlement == null) {
      columns.put("status", "inactive");
      columns.put("expire_at", now.toString());
      columns.put("last_out_trade_no", null);
      columns.put("last_payer_center_user_id", null);
      columns.put("last_transaction_id", null);
    } else {
      columns.put(
          "status",
          latestRemainingEntitlement.endAt() != null && latestRemainingEntitlement.endAt().isAfter(now)
              ? "active"
              : "inactive");
      columns.put("expire_at", iso(latestRemainingEntitlement.endAt()));
      columns.put("last_out_trade_no", latestRemainingEntitlement.outTradeNo());
      columns.put("last_payer_center_user_id", latestRemainingEntitlement.centerUserId());
      columns.put("last_transaction_id", latestRemainingEntitlement.transactionId());
    }
    columns.put("update_time", now.toString());

    Map<String, Object> update = new LinkedHashMap<>();
    update.put("targetTable", "vip_membership");
    update.put("where", Map.of("customer_id", customerId));
    update.put("operation", currentMembership == null ? "insert_or_update" : "update");
    update.put("currentSummary", membershipSummary(currentMembership));
    update.put(
        "summarySource",
        latestRemainingEntitlement == null
            ? "no_active_entitlement_after_refund"
            : "latest_active_entitlement_after_refund");
    update.put("writeEnabled", false);
    update.put("updateColumns", columns);
    return update;
  }

  private Map<String, Object> membershipSummary(MembershipSnapshot membership) {
    if (membership == null) {
      return null;
    }
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("customerId", membership.customerId());
    summary.put("expireAt", iso(membership.expireAt()));
    summary.put("lastOutTradeNo", membership.lastOutTradeNo());
    summary.put("lastPayerCenterUserId", membership.lastPayerCenterUserId());
    summary.put("lastTransactionId", membership.lastTransactionId());
    summary.put("status", membership.status());
    return summary;
  }

  private Map<String, Object> entitlementSummary(EntitlementSnapshot entitlement) {
    if (entitlement == null) {
      return null;
    }
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("amountTotal", entitlement.amountTotal());
    summary.put("centerUserId", entitlement.centerUserId());
    summary.put("customerId", entitlement.customerId());
    summary.put("durationMonths", entitlement.durationMonths());
    summary.put("endAt", iso(entitlement.endAt()));
    summary.put("outTradeNo", entitlement.outTradeNo());
    summary.put("startAt", iso(entitlement.startAt()));
    summary.put("status", entitlement.status());
    summary.put("transactionId", entitlement.transactionId());
    return summary;
  }

  private PaymentSnapshot paymentSnapshot(ResultSet rs) throws SQLException {
    return new PaymentSnapshot(
        rs.getString("out_trade_no"),
        longObject(rs, "center_user_id"),
        rs.getString("source_customer_id"),
        rs.getString("target_customer_id"),
        rs.getString("trade_state"),
        rs.getString("transaction_id"),
        integerObject(rs, "amount_total"));
  }

  private EntitlementSnapshot entitlementSnapshot(ResultSet rs) throws SQLException {
    return new EntitlementSnapshot(
        rs.getInt("id"),
        rs.getString("customer_id"),
        longObject(rs, "center_user_id"),
        rs.getString("out_trade_no"),
        rs.getString("transaction_id"),
        integerObject(rs, "amount_total"),
        integerObject(rs, "duration_months"),
        instant(rs.getTimestamp("start_at")),
        instant(rs.getTimestamp("end_at")),
        rs.getString("status"),
        instant(rs.getTimestamp("refunded_at")),
        rs.getString("refunded_out_refund_no"));
  }

  private MembershipSnapshot membershipSnapshot(ResultSet rs) throws SQLException {
    return new MembershipSnapshot(
        rs.getString("customer_id"),
        rs.getString("status"),
        instant(rs.getTimestamp("expire_at")),
        longObject(rs, "last_payer_center_user_id"),
        rs.getString("last_out_trade_no"),
        rs.getString("last_transaction_id"));
  }

  private boolean tableExists(String tableName) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            Long.class,
            tableName);
    return count != null && count > 0;
  }

  private Long longObject(ResultSet rs, String column) throws SQLException {
    Object value = rs.getObject(column);
    return value instanceof Number number ? number.longValue() : null;
  }

  private Integer integerObject(ResultSet rs, String column) throws SQLException {
    Object value = rs.getObject(column);
    return value instanceof Number number ? number.intValue() : null;
  }

  private Instant instant(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant();
  }

  private Timestamp timestamp(Instant instant) {
    return instant == null ? null : Timestamp.from(instant);
  }

  private String iso(Instant instant) {
    return instant == null ? null : instant.toString();
  }

  private String firstText(String first, String second) {
    return StringUtils.hasText(clean(first)) ? clean(first) : clean(second);
  }

  private String requiredText(String value, String name) {
    String cleaned = clean(value);
    if (!StringUtils.hasText(cleaned)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少会员权益回滚预览参数 " + name);
    }
    return cleaned;
  }

  private String normalize(String value) {
    return clean(value).toLowerCase(java.util.Locale.ROOT);
  }

  private String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  private record PaymentSnapshot(
      String outTradeNo,
      Long centerUserId,
      String sourceCustomerId,
      String targetCustomerId,
      String tradeState,
      String transactionId,
      Integer amountTotal) {}

  private record EntitlementSnapshot(
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

  private record MembershipSnapshot(
      String customerId,
      String status,
      Instant expireAt,
      Long lastPayerCenterUserId,
      String lastOutTradeNo,
      String lastTransactionId) {}

  public record VipMembershipEntitlementRollbackPreview(
      String outTradeNo,
      String outRefundNo,
      String customerId,
      Map<String, Boolean> tableStatus,
      boolean tableReady,
      boolean writeEnabled,
      boolean rollbackReady,
      boolean alreadyRevoked,
      String blockedReason,
      Map<String, Object> executionLock,
      Map<String, Object> paymentUpdate,
      Map<String, Object> entitlementUpdate,
      Map<String, Object> membershipSummaryUpdate,
      Map<String, Object> latestRemainingEntitlement,
      String previewedAt) {}

  public record VipMembershipEntitlementRollbackResult(
      String outTradeNo,
      String outRefundNo,
      String customerId,
      boolean rollbackExecuted,
      boolean alreadyRevoked,
      int paymentUpdatedRows,
      int entitlementUpdatedRows,
      int membershipSummaryUpdatedRows,
      String skippedReason,
      String membershipSummarySource,
      Map<String, Object> membershipSummary,
      Map<String, Object> latestRemainingEntitlement,
      String executedAt) {}
}
