package cn.yizuw.magic.backend.job;

import java.lang.management.ManagementFactory;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 组织空间开通 worker 的任务认领服务；只抢占租约，不执行建库、复制数据或成员切换。 */
@Service
public class OrganizationProvisioningJobClaimService {

  private static final int DEFAULT_MAX_RETRY = 5;
  private static final long DEFAULT_STALE_AFTER_MS = 10 * 60 * 1000L;

  private final JdbcTemplate centerJdbcTemplate;
  private final String defaultWorkerId;

  public OrganizationProvisioningJobClaimService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.defaultWorkerId =
        "springboot-organization-provisioning:" + ManagementFactory.getRuntimeMXBean().getName();
  }

  /**
   * 认领可执行的组织开通任务。
   *
   * <p>本方法只把候选任务从 `pending/failed_retryable` 或超时 `provisioning` 切到
   * `provisioning/claimed`，并写入租约字段；真正建库、复制租户数据、切换成员关系继续留到后续批次。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> claimCandidates(
      int requestedLimit, String workerId, long staleAfterMs, int maxRetry, Instant claimedAt) {
    int normalizedLimit = Math.max(1, Math.min(requestedLimit, 10));
    long normalizedStaleAfterMs = staleAfterMs > 0 ? staleAfterMs : DEFAULT_STALE_AFTER_MS;
    int normalizedMaxRetry = maxRetry > 0 ? maxRetry : DEFAULT_MAX_RETRY;
    String normalizedWorkerId =
        StringUtils.hasText(workerId) ? workerId.trim() : defaultWorkerId;
    Instant now = claimedAt == null ? Instant.now() : claimedAt;

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("claimedAt", now.toString());
    result.put("claimedCount", 0);
    result.put("items", List.of());
    result.put("maxRetry", normalizedMaxRetry);
    result.put("requestedLimit", normalizedLimit);
    result.put("staleAfterMs", normalizedStaleAfterMs);
    result.put("tableReady", false);
    result.put("workerId", normalizedWorkerId);
    if (!tableExists("tenant_provisioning_job")) {
      return result;
    }

    List<Map<String, Object>> items = new ArrayList<>();
    Instant staleBefore = now.minusMillis(normalizedStaleAfterMs);
    for (int index = 0; index < normalizedLimit; index += 1) {
      ProvisioningClaimCandidate candidate = findNextCandidate(normalizedMaxRetry, staleBefore);
      if (candidate == null) {
        break;
      }
      int updatedRows = claimCandidate(candidate, normalizedWorkerId, now, normalizedMaxRetry);
      if (updatedRows <= 0) {
        items.add(claimSkipped(candidate, "optimistic_lock_lost", now));
        continue;
      }
      ProvisioningClaimCandidate claimed = findById(candidate.id());
      items.add(claimedItem(claimed == null ? candidate : claimed, updatedRows, now));
    }

    long claimedCount = items.stream().filter(item -> Boolean.TRUE.equals(item.get("claimed"))).count();
    result.put("claimedCount", claimedCount);
    result.put("items", items);
    result.put("tableReady", true);
    return result;
  }

  private ProvisioningClaimCandidate findNextCandidate(int maxRetry, Instant staleBefore) {
    List<ProvisioningClaimCandidate> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, initiator_center_user_id, source_org_id, source_customer_id,
                   target_customer_id, target_db_name, status, step, retry_count,
                   lock_owner, locked_at, heartbeat_at, started_at, create_time, update_time
            FROM tenant_provisioning_job
            WHERE retry_count < ?
              AND source_customer_id = 'public'
              AND target_customer_id IS NOT NULL
              AND target_customer_id <> ''
              AND target_db_name IS NOT NULL
              AND target_db_name <> ''
              AND source_org_id IS NOT NULL
              AND initiator_center_user_id IS NOT NULL
              AND (
                status IN ('pending', 'failed_retryable')
                OR (status = 'provisioning' AND heartbeat_at IS NOT NULL AND heartbeat_at < ?)
              )
            ORDER BY create_time ASC, id ASC
            LIMIT 1
            """,
            (rs, rowNum) -> candidate(rs),
            maxRetry,
            timestamp(staleBefore));
    return rows.isEmpty() ? null : rows.get(0);
  }

  private ProvisioningClaimCandidate findById(long id) {
    List<ProvisioningClaimCandidate> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, initiator_center_user_id, source_org_id, source_customer_id,
                   target_customer_id, target_db_name, status, step, retry_count,
                   lock_owner, locked_at, heartbeat_at, started_at, create_time, update_time
            FROM tenant_provisioning_job
            WHERE id = ?
            """,
            (rs, rowNum) -> candidate(rs),
            id);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private int claimCandidate(
      ProvisioningClaimCandidate candidate, String workerId, Instant now, int maxRetry) {
    return centerJdbcTemplate.update(
        """
        UPDATE tenant_provisioning_job
        SET error_message = NULL,
            heartbeat_at = ?,
            locked_at = ?,
            lock_owner = ?,
            started_at = ?,
            status = 'provisioning',
            step = 'claimed',
            update_time = ?
        WHERE id = ?
          AND retry_count < ?
          AND status = ?
          AND lock_owner <=> ?
          AND locked_at <=> ?
          AND heartbeat_at <=> ?
          AND started_at <=> ?
        """,
        timestamp(now),
        timestamp(now),
        workerId,
        timestamp(now),
        timestamp(now),
        candidate.id(),
        maxRetry,
        candidate.status(),
        candidate.lockOwner(),
        timestamp(candidate.lockedAt()),
        timestamp(candidate.heartbeatAt()),
        timestamp(candidate.startedAt()));
  }

  private Map<String, Object> claimedItem(
      ProvisioningClaimCandidate candidate, int updatedRows, Instant claimedAt) {
    Map<String, Object> item = candidateMap(candidate);
    item.put("claimStatus", "claimed");
    item.put("claimed", true);
    item.put("claimedAt", claimedAt.toString());
    item.put("updatedRows", updatedRows);
    return item;
  }

  private Map<String, Object> claimSkipped(
      ProvisioningClaimCandidate candidate, String reason, Instant claimedAt) {
    Map<String, Object> item = candidateMap(candidate);
    item.put("claimStatus", "skipped");
    item.put("claimed", false);
    item.put("claimedAt", claimedAt.toString());
    item.put("skippedReason", reason);
    item.put("updatedRows", 0);
    return item;
  }

  private Map<String, Object> candidateMap(ProvisioningClaimCandidate candidate) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("createTime", iso(candidate.createTime()));
    item.put("heartbeatAt", iso(candidate.heartbeatAt()));
    item.put("id", candidate.id());
    item.put("initiatorCenterUserId", candidate.initiatorCenterUserId());
    item.put("lockedAt", iso(candidate.lockedAt()));
    item.put("lockOwner", candidate.lockOwner());
    item.put("retryCount", candidate.retryCount());
    item.put("sourceCustomerId", candidate.sourceCustomerId());
    item.put("sourceOrgId", candidate.sourceOrgId());
    item.put("startedAt", iso(candidate.startedAt()));
    item.put("status", candidate.status());
    item.put("step", candidate.step());
    item.put("targetCustomerId", candidate.targetCustomerId());
    item.put("targetDbName", candidate.targetDbName());
    item.put("updateTime", iso(candidate.updateTime()));
    return item;
  }

  private ProvisioningClaimCandidate candidate(ResultSet rs) throws SQLException {
    return new ProvisioningClaimCandidate(
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
        instant(rs.getTimestamp("started_at")),
        instant(rs.getTimestamp("create_time")),
        instant(rs.getTimestamp("update_time")));
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

  private record ProvisioningClaimCandidate(
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
      Instant startedAt,
      Instant createTime,
      Instant updateTime) {}
}
