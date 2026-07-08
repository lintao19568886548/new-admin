package cn.yizuw.magic.backend.job;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/** 会员退款对账 worker 的只读候选退款扫描器；不请求微信、不更新退款状态。 */
@Repository
public class VipMembershipRefundReconcileScanner {

  private final JdbcTemplate centerJdbcTemplate;

  public VipMembershipRefundReconcileScanner(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 扫描旧退款 worker 会处理的到期退款单。
   *
   * <p>本批只输出预检结果，便于先确认真实库中的待处理退款质量；真实对账提交和状态写回留给后续批次。
   */
  public Map<String, Object> scanCandidates(int limit) {
    int normalizedLimit = Math.max(1, Math.min(limit, 100));
    if (!tableExists("vip_membership_refund")) {
      return Map.of(
          "items",
          List.of(),
          "readyCount",
          0,
          "requestedLimit",
          normalizedLimit,
          "tableReady",
          false,
          "total",
          0);
    }
    List<Map<String, Object>> items =
        centerJdbcTemplate.query(
            """
            SELECT id, out_refund_no, refund_id, out_trade_no, transaction_id,
                   center_user_id, customer_id, amount_total, refund_amount,
                   status, reason, channel, requested_at, success_at,
                   last_checked_at, next_check_at, create_time, update_time
            FROM vip_membership_refund
            WHERE (next_check_at IS NULL OR next_check_at <= NOW())
              AND status NOT IN ('ABNORMAL', 'CLOSED', 'SUCCESS')
            ORDER BY CASE WHEN next_check_at IS NULL THEN 0 ELSE 1 END,
                     next_check_at ASC,
                     create_time ASC,
                     id ASC
            LIMIT ?
            """,
            (rs, rowNum) -> refundMap(rs),
            normalizedLimit);
    long readyCount = items.stream().filter(item -> Boolean.TRUE.equals(item.get("ready"))).count();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", items);
    result.put("readyCount", readyCount);
    result.put("requestedLimit", normalizedLimit);
    result.put("tableReady", true);
    result.put("total", items.size());
    return result;
  }

  private Map<String, Object> refundMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("amountTotal", rs.getObject("amount_total"));
    map.put("centerUserId", rs.getObject("center_user_id"));
    map.put("channel", rs.getString("channel"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("customerId", rs.getString("customer_id"));
    map.put("id", rs.getInt("id"));
    map.put("lastCheckedAt", toIso(rs.getTimestamp("last_checked_at")));
    map.put("nextCheckAt", toIso(rs.getTimestamp("next_check_at")));
    map.put("outRefundNo", rs.getString("out_refund_no"));
    map.put("outTradeNo", rs.getString("out_trade_no"));
    map.put("reason", rs.getString("reason"));
    map.put("refundAmount", rs.getObject("refund_amount"));
    map.put("refundId", rs.getString("refund_id"));
    map.put("requestedAt", toIso(rs.getTimestamp("requested_at")));
    map.put("status", rs.getString("status"));
    map.put("successAt", toIso(rs.getTimestamp("success_at")));
    map.put("transactionId", rs.getString("transaction_id"));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("ready", ready(map));
    map.put("blockedReason", blockedReason(map));
    map.put("plannedAction", plannedAction(map));
    return map;
  }

  private boolean ready(Map<String, Object> refund) {
    return !StringUtils.hasText(blockedReason(refund));
  }

  private String blockedReason(Map<String, Object> refund) {
    if (!StringUtils.hasText(string(refund.get("outRefundNo")))) {
      return "缺少 outRefundNo";
    }
    if (!StringUtils.hasText(string(refund.get("outTradeNo")))) {
      return "缺少 outTradeNo";
    }
    if (!StringUtils.hasText(string(refund.get("customerId")))) {
      return "缺少 customerId";
    }
    if (!positive(refund.get("centerUserId"))) {
      return "缺少 centerUserId";
    }
    if (!positive(refund.get("amountTotal"))) {
      return "缺少 amountTotal";
    }
    if (!positive(refund.get("refundAmount"))) {
      return "缺少 refundAmount";
    }
    if (!StringUtils.hasText(string(refund.get("status")))) {
      return "缺少 status";
    }
    return "";
  }

  private String plannedAction(Map<String, Object> refund) {
    String status = normalizeStatus(refund.get("status"));
    if ("PENDING".equals(status) || "PROCESSING".equals(status)) {
      return "query_wechat_refund";
    }
    return "query_then_create_wechat_refund";
  }

  private String normalizeStatus(Object value) {
    if (value == null) {
      return "";
    }
    String status = String.valueOf(value).trim();
    return status.isEmpty() ? "" : status.toUpperCase(java.util.Locale.ROOT);
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

  private boolean positive(Object value) {
    if (value instanceof Number number) {
      return number.longValue() > 0;
    }
    if (value == null) {
      return false;
    }
    try {
      return Long.parseLong(String.valueOf(value)) > 0;
    } catch (NumberFormatException error) {
      return false;
    }
  }

  private String string(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
