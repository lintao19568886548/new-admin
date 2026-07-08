package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.messaging.BusinessOutboxPublisher;
import cn.yizuw.magic.backend.messaging.OrganizationProvisioningCompletedEvent;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 组织空间开通完成收口服务；只标记中心库任务完成并可选写 outbox 事件。 */
@Service
public class OrganizationProvisioningJobCompletionService {

  private static final List<String> REQUIRED_TABLES =
      List.of(
          "tenant_provisioning_job",
          "organization_member",
          "organization_tenant_mapping",
          "user_tenant_mapping");

  private final BusinessOutboxPublisher businessOutboxPublisher;
  private final JdbcTemplate centerJdbcTemplate;

  public OrganizationProvisioningJobCompletionService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate,
      BusinessOutboxPublisher businessOutboxPublisher) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.businessOutboxPublisher = businessOutboxPublisher;
  }

  /**
   * 标记组织开通任务完成。
   *
   * <p>本批只复刻旧 worker 完成段的 `tenant_provisioning_job` 状态收口：`status=active`、
   * `step=completed`、清空锁和 heartbeat；不执行建库、schema clone、成员迁移或消息消费。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> completeTenantProvisioningJob(
      long jobId, String workerId, String confirmTargetDbName, Instant completedAt) {
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通完成收口缺少 jobId");
    }
    if (!StringUtils.hasText(workerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通完成收口缺少 workerId");
    }
    String normalizedWorkerId = workerId.trim();
    Instant now = completedAt == null ? Instant.now() : completedAt;
    Map<String, Object> result = baseResult(jobId, normalizedWorkerId, confirmTargetDbName, now);

    List<String> missingTables = missingRequiredTables();
    result.put("missingCenterTables", missingTables);
    if (!missingTables.isEmpty()) {
      result.put("blockedReasons", List.of("组织开通完成收口所需中心库表未就绪"));
      return result;
    }

    CompletionJob job = findProvisioningJob(jobId, normalizedWorkerId);
    if (job == null) {
      result.put("completionStatus", "lease_lost");
      result.put("blockedReasons", List.of("任务不存在或租约已丢失，无法完成组织开通任务"));
      result.put("tableReady", true);
      return result;
    }
    result.putAll(jobMap(job));
    result.put("leaseValid", true);
    result.put("tableReady", true);

    if (!StringUtils.hasText(confirmTargetDbName)
        || !job.targetDbName().equals(confirmTargetDbName.trim())) {
      result.put("completionStatus", "blocked");
      result.put("blockedReasons", List.of("confirmTargetDbName 与任务 targetDbName 不一致"));
      return result;
    }

    List<String> blockedReasons = completionBlockedReasons(job);
    if (!blockedReasons.isEmpty()) {
      result.put("completionStatus", "blocked");
      result.put("blockedReasons", blockedReasons);
      return result;
    }

    int updatedRows = updateJobCompleted(job, normalizedWorkerId, now);
    result.put("updatedRows", updatedRows);
    if (updatedRows <= 0) {
      result.put("completionStatus", "lease_lost");
      result.put("leaseValid", false);
      result.put("blockedReasons", List.of("任务完成收口时租约已失效"));
      return result;
    }

    CompletionJob completedJob = job.completed(now);
    String outboxEventId =
        businessOutboxPublisher.publishOrganizationProvisioningCompleted(
            organizationProvisioningCompletedEvent(completedJob, now));
    result.putAll(jobMap(completedJob));
    result.put("blockedReasons", List.of());
    result.put("completionStatus", "success");
    result.put("outboxEventQueued", StringUtils.hasText(outboxEventId));
    if (StringUtils.hasText(outboxEventId)) {
      result.put("outboxEventId", outboxEventId);
    }
    result.put("tenantProvisioningCompleted", true);
    return result;
  }

  private Map<String, Object> baseResult(
      long jobId, String workerId, String confirmTargetDbName, Instant completedAt) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("blockedReasons", List.of());
    result.put("completionStatus", "table_not_ready");
    result.put("completedAt", completedAt.toString());
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("jobId", jobId);
    result.put("leaseValid", false);
    result.put("missingCenterTables", List.of());
    result.put("outboxEventQueued", false);
    result.put("requiredStep", "seeding_base_data");
    result.put("tableReady", false);
    result.put("targetStatus", "active");
    result.put("targetStep", "completed");
    result.put("targetTable", "tenant_provisioning_job");
    result.put("tenantProvisioningCompleted", false);
    result.put("updatedRows", 0);
    result.put("workerId", workerId);
    return result;
  }

  private List<String> missingRequiredTables() {
    List<String> missing = new ArrayList<>();
    for (String tableName : REQUIRED_TABLES) {
      if (!tableExists(tableName)) {
        missing.add(tableName);
      }
    }
    return missing;
  }

  private CompletionJob findProvisioningJob(long jobId, String workerId) {
    List<CompletionJob> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, initiator_center_user_id, source_org_id, source_customer_id,
                   target_customer_id, target_db_name, last_payment_out_trade_no,
                   status, step, lock_owner, completed_at, locked_at, heartbeat_at, update_time
            FROM tenant_provisioning_job
            WHERE id = ?
              AND lock_owner = ?
              AND status = 'provisioning'
              AND step = 'seeding_base_data'
            LIMIT 1
            """,
            (rs, rowNum) -> completionJob(rs),
            jobId,
            workerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<String> completionBlockedReasons(CompletionJob job) {
    List<String> reasons = new ArrayList<>();
    if (!StringUtils.hasText(job.targetCustomerId())) {
      reasons.add("缺少 targetCustomerId");
    }
    if (!StringUtils.hasText(job.targetDbName())) {
      reasons.add("缺少 targetDbName");
    }
    if (job.sourceOrgId() == null || job.sourceOrgId() <= 0) {
      reasons.add("缺少 sourceOrgId");
    }
    if (reasons.isEmpty() && organizationTenantMappingRows(job) <= 0) {
      reasons.add("中心库 organization_tenant_mapping 未指向当前开通任务");
    }
    long activeMemberCount =
        job.sourceOrgId() == null || job.sourceOrgId() <= 0
            ? 0
            : activeMemberCount(job.sourceOrgId(), job.sourceCustomerId());
    long targetMappingCount =
        StringUtils.hasText(job.targetCustomerId())
            ? targetUserTenantMappingCount(job.sourceOrgId(), job.sourceCustomerId(), job.targetCustomerId())
            : 0;
    if (activeMemberCount <= 0) {
      reasons.add("组织缺少 active 成员，禁止完成开通任务");
    } else if (targetMappingCount < activeMemberCount) {
      reasons.add("中心用户目标租户映射未全部写入，禁止完成开通任务");
    }
    return reasons;
  }

  private long organizationTenantMappingRows(CompletionJob job) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM organization_tenant_mapping
            WHERE organization_id = ?
              AND target_customer_id = ?
              AND target_db_name = ?
              AND tenant_provisioning_job_id = ?
              AND status = 'active'
            """,
            Long.class,
            job.sourceOrgId(),
            job.targetCustomerId(),
            job.targetDbName(),
            job.id());
    return count == null ? 0 : count;
  }

  private long activeMemberCount(long sourceOrgId, String sourceCustomerId) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM organization_member
            WHERE organization_id = ?
              AND source_customer_id = ?
              AND status = 'active'
            """,
            Long.class,
            sourceOrgId,
            sourceCustomerId);
    return count == null ? 0 : count;
  }

  private long targetUserTenantMappingCount(
      Long sourceOrgId, String sourceCustomerId, String targetCustomerId) {
    if (sourceOrgId == null || sourceOrgId <= 0) {
      return 0;
    }
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(DISTINCT mapping.center_user_id)
            FROM organization_member member
            INNER JOIN user_tenant_mapping mapping
              ON mapping.center_user_id = member.center_user_id
             AND mapping.customer_id = ?
             AND mapping.customer_user_id IS NOT NULL
             AND mapping.customer_user_id > 0
            WHERE member.organization_id = ?
              AND member.source_customer_id = ?
              AND member.status = 'active'
            """,
            Long.class,
            targetCustomerId,
            sourceOrgId,
            sourceCustomerId);
    return count == null ? 0 : count;
  }

  private int updateJobCompleted(CompletionJob job, String workerId, Instant now) {
    return centerJdbcTemplate.update(
        """
        UPDATE tenant_provisioning_job
        SET completed_at = ?,
            error_message = NULL,
            heartbeat_at = NULL,
            locked_at = NULL,
            lock_owner = NULL,
            status = 'active',
            step = 'completed',
            update_time = ?
        WHERE id = ?
          AND lock_owner = ?
          AND status = 'provisioning'
          AND step = 'seeding_base_data'
        """,
        timestamp(now),
        timestamp(now),
        job.id(),
        workerId);
  }

  private OrganizationProvisioningCompletedEvent organizationProvisioningCompletedEvent(
      CompletionJob job, Instant completedAt) {
    return new OrganizationProvisioningCompletedEvent(
        completedAt.toString(),
        job.initiatorCenterUserId(),
        (int) job.id(),
        job.lastPaymentOutTradeNo(),
        job.sourceCustomerId(),
        job.sourceOrgId() == null ? null : job.sourceOrgId().intValue(),
        job.status(),
        job.step(),
        job.targetCustomerId(),
        job.targetDbName());
  }

  private CompletionJob completionJob(ResultSet rs) throws SQLException {
    return new CompletionJob(
        rs.getLong("id"),
        nullableInt(rs, "initiator_center_user_id"),
        nullableLong(rs, "source_org_id"),
        rs.getString("source_customer_id"),
        rs.getString("target_customer_id"),
        rs.getString("target_db_name"),
        rs.getString("last_payment_out_trade_no"),
        rs.getString("status"),
        rs.getString("step"),
        rs.getString("lock_owner"),
        instant(rs.getTimestamp("completed_at")),
        instant(rs.getTimestamp("locked_at")),
        instant(rs.getTimestamp("heartbeat_at")),
        instant(rs.getTimestamp("update_time")));
  }

  private Map<String, Object> jobMap(CompletionJob job) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("completedAt", iso(job.completedAt()));
    map.put("heartbeatAt", iso(job.heartbeatAt()));
    map.put("initiatorCenterUserId", job.initiatorCenterUserId());
    map.put("jobId", job.id());
    map.put("lastPaymentOutTradeNo", job.lastPaymentOutTradeNo());
    map.put("lockedAt", iso(job.lockedAt()));
    map.put("lockOwner", job.lockOwner());
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

  private Long nullableLong(ResultSet rs, String column) throws SQLException {
    long value = rs.getLong(column);
    return rs.wasNull() ? null : value;
  }

  private Integer nullableInt(ResultSet rs, String column) throws SQLException {
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

  private String string(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private record CompletionJob(
      long id,
      Integer initiatorCenterUserId,
      Long sourceOrgId,
      String sourceCustomerId,
      String targetCustomerId,
      String targetDbName,
      String lastPaymentOutTradeNo,
      String status,
      String step,
      String lockOwner,
      Instant completedAt,
      Instant lockedAt,
      Instant heartbeatAt,
      Instant updateTime) {

    private CompletionJob completed(Instant completedAt) {
      return new CompletionJob(
          id,
          initiatorCenterUserId,
          sourceOrgId,
          sourceCustomerId,
          targetCustomerId,
          targetDbName,
          lastPaymentOutTradeNo,
          "active",
          "completed",
          null,
          completedAt,
          null,
          null,
          completedAt);
    }
  }
}
