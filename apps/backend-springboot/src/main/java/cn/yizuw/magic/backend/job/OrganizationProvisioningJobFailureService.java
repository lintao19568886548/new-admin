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

/** 组织空间开通失败收口服务；只释放中心库任务租约并写入 retry/manual 失败状态。 */
@Service
public class OrganizationProvisioningJobFailureService {

  private static final int DEFAULT_MAX_RETRY = 5;

  private final JdbcTemplate centerJdbcTemplate;

  public OrganizationProvisioningJobFailureService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 标记组织开通任务失败。
   *
   * <p>本方法复刻旧 worker `markJobFailed(...)` 的中心库写入：`retry_count + 1`，未达最大
   * 重试次数时进入 `failed_retryable/retry_waiting`，达到后进入 `failed_manual/failed`。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> markTenantProvisioningJobFailed(
      long jobId, String workerId, String failureReason, int maxRetry, Instant failedAt) {
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通失败收口缺少 jobId");
    }
    if (!StringUtils.hasText(workerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通失败收口缺少 workerId");
    }
    if (!StringUtils.hasText(failureReason)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通失败收口缺少 failureReason");
    }
    String normalizedWorkerId = workerId.trim();
    String normalizedFailureReason = failureReason.trim();
    int normalizedMaxRetry = maxRetry > 0 ? maxRetry : DEFAULT_MAX_RETRY;
    Instant now = failedAt == null ? Instant.now() : failedAt;

    Map<String, Object> result =
        baseResult(jobId, normalizedWorkerId, normalizedFailureReason, normalizedMaxRetry, now);
    if (!tableExists("tenant_provisioning_job")) {
      return result;
    }

    FailureJob job = findProvisioningJob(jobId, normalizedWorkerId);
    result.put("tableReady", true);
    if (job == null) {
      result.put("failureStatus", "lease_lost");
      result.put("blockedReasons", List.of("任务不存在或租约已丢失，无法标记失败"));
      return result;
    }
    result.putAll(jobMap(job));
    result.put("leaseValid", true);

    int nextRetryCount = Math.max(0, job.retryCount() == null ? 0 : job.retryCount()) + 1;
    boolean failedManual = nextRetryCount >= normalizedMaxRetry;
    String targetStatus = failedManual ? "failed_manual" : "failed_retryable";
    String targetStep = failedManual ? "failed" : "retry_waiting";
    int updatedRows =
        updateJobFailed(
            job,
            normalizedWorkerId,
            normalizedFailureReason,
            nextRetryCount,
            targetStatus,
            targetStep,
            now);
    result.put("failedManual", failedManual);
    result.put("failureStatus", updatedRows > 0 ? "success" : "lease_lost");
    result.put("retryable", !failedManual);
    result.put("retryCount", nextRetryCount);
    result.put("targetStatus", targetStatus);
    result.put("targetStep", targetStep);
    result.put("tenantProvisioningFailed", updatedRows > 0);
    result.put("updatedRows", updatedRows);
    if (updatedRows <= 0) {
      result.put("leaseValid", false);
      result.put("blockedReasons", List.of("任务失败收口时租约已失效"));
      return result;
    }
    result.put("blockedReasons", List.of());
    result.put("heartbeatAt", null);
    result.put("lockedAt", null);
    result.put("lockOwner", null);
    result.put("status", targetStatus);
    result.put("step", targetStep);
    result.put("updateTime", now.toString());
    return result;
  }

  private Map<String, Object> baseResult(
      long jobId, String workerId, String failureReason, int maxRetry, Instant failedAt) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("blockedReasons", List.of());
    result.put("failedAt", failedAt.toString());
    result.put("failedManual", false);
    result.put("failureReason", failureReason);
    result.put("failureStatus", "table_not_ready");
    result.put("jobId", jobId);
    result.put("leaseValid", false);
    result.put("maxRetry", maxRetry);
    result.put("retryable", false);
    result.put("tableReady", false);
    result.put("targetTable", "tenant_provisioning_job");
    result.put("tenantProvisioningFailed", false);
    result.put("updatedRows", 0);
    result.put("workerId", workerId);
    return result;
  }

  private FailureJob findProvisioningJob(long jobId, String workerId) {
    List<FailureJob> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, initiator_center_user_id, source_org_id, source_customer_id,
                   target_customer_id, target_db_name, status, step, retry_count,
                   lock_owner, locked_at, heartbeat_at, update_time
            FROM tenant_provisioning_job
            WHERE id = ?
              AND lock_owner = ?
              AND status = 'provisioning'
            LIMIT 1
            """,
            (rs, rowNum) -> failureJob(rs),
            jobId,
            workerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private int updateJobFailed(
      FailureJob job,
      String workerId,
      String failureReason,
      int retryCount,
      String targetStatus,
      String targetStep,
      Instant now) {
    return centerJdbcTemplate.update(
        """
        UPDATE tenant_provisioning_job
        SET error_message = ?,
            heartbeat_at = NULL,
            locked_at = NULL,
            lock_owner = NULL,
            retry_count = ?,
            status = ?,
            step = ?,
            update_time = ?
        WHERE id = ?
          AND lock_owner = ?
          AND status = 'provisioning'
        """,
        failureReason,
        retryCount,
        targetStatus,
        targetStep,
        timestamp(now),
        job.id(),
        workerId);
  }

  private FailureJob failureJob(ResultSet rs) throws SQLException {
    return new FailureJob(
        rs.getLong("id"),
        longObject(rs, "initiator_center_user_id"),
        longObject(rs, "source_org_id"),
        rs.getString("source_customer_id"),
        rs.getString("target_customer_id"),
        rs.getString("target_db_name"),
        rs.getString("status"),
        rs.getString("step"),
        integerObject(rs, "retry_count"),
        rs.getString("lock_owner"),
        instant(rs.getTimestamp("locked_at")),
        instant(rs.getTimestamp("heartbeat_at")),
        instant(rs.getTimestamp("update_time")));
  }

  private Map<String, Object> jobMap(FailureJob job) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("heartbeatAt", iso(job.heartbeatAt()));
    map.put("initiatorCenterUserId", job.initiatorCenterUserId());
    map.put("jobId", job.id());
    map.put("lockedAt", iso(job.lockedAt()));
    map.put("lockOwner", job.lockOwner());
    map.put("previousRetryCount", job.retryCount());
    map.put("retryCount", job.retryCount());
    map.put("sourceCustomerId", job.sourceCustomerId());
    map.put("sourceOrgId", job.sourceOrgId());
    map.put("status", job.status());
    map.put("step", job.step());
    map.put("targetCustomerId", job.targetCustomerId());
    map.put("targetDbName", job.targetDbName());
    map.put("updateTime", iso(job.updateTime()));
    return map;
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
    long value = rs.getLong(column);
    return rs.wasNull() ? null : value;
  }

  private Integer integerObject(ResultSet rs, String column) throws SQLException {
    int value = rs.getInt(column);
    return rs.wasNull() ? null : value;
  }

  private Instant instant(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant();
  }

  private String iso(Instant instant) {
    return instant == null ? null : instant.toString();
  }

  private Timestamp timestamp(Instant instant) {
    return instant == null ? null : Timestamp.from(instant);
  }

  private record FailureJob(
      long id,
      Long initiatorCenterUserId,
      Long sourceOrgId,
      String sourceCustomerId,
      String targetCustomerId,
      String targetDbName,
      String status,
      String step,
      Integer retryCount,
      String lockOwner,
      Instant lockedAt,
      Instant heartbeatAt,
      Instant updateTime) {}
}
