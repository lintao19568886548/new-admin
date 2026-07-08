package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 组织空间开通 worker 的步骤推进服务；只更新任务步骤，不执行建库或数据复制。 */
@Service
public class OrganizationProvisioningJobStepService {

  private static final String CLAIMED_STEP = "claimed";
  private static final String CLONING_SCHEMA_STEP = "cloning_schema";
  private static final String REBUILDING_DATABASE_STEP = "rebuilding_database";
  private static final String SEEDING_BASE_DATA_STEP = "seeding_base_data";

  private final JdbcTemplate centerJdbcTemplate;

  public OrganizationProvisioningJobStepService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 标记任务准备进入目标库重建阶段。
   *
   * <p>本方法只复刻旧 worker 调用 `updateJobStep(job, "rebuilding_database")` 的步骤写入；
   * 不执行 `DROP DATABASE`、`CREATE DATABASE`、schema clone 或数据复制。灰度阶段额外要求
   * `step=claimed`，避免把已经进入后续阶段的任务误回退。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> markRebuildingDatabase(
      long jobId, String workerId, Instant markedAt) {
    return markStep(
        jobId,
        workerId,
        markedAt,
        CLAIMED_STEP,
        REBUILDING_DATABASE_STEP,
        "组织开通任务步骤推进缺少 jobId",
        "组织开通任务步骤推进缺少 workerId");
  }

  /**
   * 标记任务准备进入 schema clone 阶段。
   *
   * <p>本方法只复刻旧 worker 调用 `updateJobStep(job, "cloning_schema")` 的步骤写入；
   * 不执行 `SHOW CREATE TABLE`、建表、索引复制或基础数据复制。灰度阶段额外要求
   * `step=rebuilding_database`，避免跳过目标库重建。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> markCloningSchema(long jobId, String workerId, Instant markedAt) {
    return markStep(
        jobId,
        workerId,
        markedAt,
        REBUILDING_DATABASE_STEP,
        CLONING_SCHEMA_STEP,
        "组织开通 schema clone 步骤推进缺少 jobId",
        "组织开通 schema clone 步骤推进缺少 workerId");
  }

  /**
   * 标记任务准备进入基础数据复制阶段。
   *
   * <p>本方法只复刻旧 worker 调用 `updateJobStep(job, "seeding_base_data")` 的步骤写入；
   * 不复制 Super 权限闭包、不复制基础表、不迁移组织角色或成员。灰度阶段额外要求
   * `step=cloning_schema`，避免在 schema clone 未完成时进入数据复制阶段。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> markSeedingBaseData(long jobId, String workerId, Instant markedAt) {
    return markStep(
        jobId,
        workerId,
        markedAt,
        CLONING_SCHEMA_STEP,
        SEEDING_BASE_DATA_STEP,
        "组织开通基础数据复制步骤推进缺少 jobId",
        "组织开通基础数据复制步骤推进缺少 workerId");
  }

  private Map<String, Object> markStep(
      long jobId,
      String workerId,
      Instant markedAt,
      String fromStep,
      String targetStep,
      String missingJobIdMessage,
      String missingWorkerIdMessage) {
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, missingJobIdMessage);
    }
    if (!StringUtils.hasText(workerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, missingWorkerIdMessage);
    }
    String normalizedWorkerId = workerId.trim();
    Instant now = markedAt == null ? Instant.now() : markedAt;

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("fromStep", fromStep);
    result.put("jobId", jobId);
    result.put("leaseValid", false);
    result.put("markedAt", now.toString());
    result.put("stepStatus", "table_not_ready");
    result.put("tableReady", false);
    result.put("targetStep", targetStep);
    result.put("targetTable", "tenant_provisioning_job");
    result.put("updatedRows", 0);
    result.put("workerId", normalizedWorkerId);
    if (!tableExists("tenant_provisioning_job")) {
      return result;
    }

    int updatedRows = updateStep(jobId, normalizedWorkerId, now, fromStep, targetStep);
    result.put("leaseValid", updatedRows > 0);
    result.put("stepStatus", updatedRows > 0 ? "success" : "lease_lost");
    result.put("tableReady", true);
    result.put("updatedRows", updatedRows);
    return result;
  }

  private int updateStep(
      long jobId, String workerId, Instant now, String fromStep, String targetStep) {
    return centerJdbcTemplate.update(
        """
        UPDATE tenant_provisioning_job
        SET error_message = NULL,
            heartbeat_at = ?,
            step = ?,
            update_time = ?
        WHERE id = ?
          AND lock_owner = ?
          AND status = 'provisioning'
          AND step = ?
        """,
        timestamp(now),
        targetStep,
        timestamp(now),
        jobId,
        workerId,
        fromStep);
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

  private Timestamp timestamp(Instant instant) {
    return instant == null ? null : Timestamp.from(instant);
  }
}
