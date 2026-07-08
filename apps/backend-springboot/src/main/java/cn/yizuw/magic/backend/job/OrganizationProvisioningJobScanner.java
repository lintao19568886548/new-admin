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

/** 组织空间开通 worker 的只读候选任务扫描器；不加锁、不建库、不修改任务状态。 */
@Repository
public class OrganizationProvisioningJobScanner {

  private final JdbcTemplate centerJdbcTemplate;

  public OrganizationProvisioningJobScanner(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 扫描可进入组织空间开通 worker 的候选任务。
   *
   * <p>当前批次只做预检和可观测输出，不抢占任务锁；真正执行前还需要补齐租约、心跳和幂等状态流转。
   */
  public Map<String, Object> scanCandidates(int limit) {
    int normalizedLimit = Math.max(1, Math.min(limit, 100));
    if (!tableExists("tenant_provisioning_job")) {
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
            SELECT id, initiator_center_user_id, source_org_id, source_customer_id,
                   target_customer_id, target_db_name, target_city,
                   target_company_short_name, status, step, retry_count,
                   last_payment_out_trade_no, lock_owner, heartbeat_at,
                   create_time, update_time
            FROM tenant_provisioning_job
            WHERE status IN ('pending', 'failed_retryable')
              AND source_customer_id = 'public'
            ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
                     update_time ASC,
                     id ASC
            LIMIT ?
            """,
            (rs, rowNum) -> jobMap(rs),
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

  private Map<String, Object> jobMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("heartbeatAt", toIso(rs.getTimestamp("heartbeat_at")));
    map.put("id", rs.getInt("id"));
    map.put("initiatorCenterUserId", rs.getObject("initiator_center_user_id"));
    map.put("lastPaymentOutTradeNo", rs.getString("last_payment_out_trade_no"));
    map.put("lockOwner", rs.getString("lock_owner"));
    map.put("retryCount", rs.getObject("retry_count"));
    map.put("sourceCustomerId", rs.getString("source_customer_id"));
    map.put("sourceOrgId", rs.getObject("source_org_id"));
    map.put("status", rs.getString("status"));
    map.put("step", rs.getString("step"));
    map.put("targetCity", rs.getString("target_city"));
    map.put("targetCompanyShortName", rs.getString("target_company_short_name"));
    map.put("targetCustomerId", rs.getString("target_customer_id"));
    map.put("targetDbName", rs.getString("target_db_name"));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("ready", ready(map));
    map.put("blockedReason", blockedReason(map));
    return map;
  }

  private boolean ready(Map<String, Object> job) {
    return !StringUtils.hasText(blockedReason(job));
  }

  private String blockedReason(Map<String, Object> job) {
    if (!StringUtils.hasText(string(job.get("targetCustomerId")))) {
      return "缺少 targetCustomerId";
    }
    if (!StringUtils.hasText(string(job.get("targetDbName")))) {
      return "缺少 targetDbName";
    }
    if (job.get("sourceOrgId") == null) {
      return "缺少 sourceOrgId";
    }
    if (job.get("initiatorCenterUserId") == null) {
      return "缺少 initiatorCenterUserId";
    }
    return "";
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

  private String string(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
