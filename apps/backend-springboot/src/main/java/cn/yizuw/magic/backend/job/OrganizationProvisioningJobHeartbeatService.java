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

/** 组织空间开通 worker 的任务心跳服务；只刷新租约，不改变 step 或执行业务副作用。 */
@Service
public class OrganizationProvisioningJobHeartbeatService {

  private final JdbcTemplate centerJdbcTemplate;

  public OrganizationProvisioningJobHeartbeatService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 刷新已认领任务的 heartbeat。
   *
   * <p>旧 worker 只按 `id + lockOwner + status=provisioning` 乐观续租；这里保持同样边界，
   * 不校验或改写 step，不创建数据库，不复制数据，也不写 outbox。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> refreshHeartbeat(long jobId, String workerId, Instant heartbeatAt) {
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通任务心跳缺少 jobId");
    }
    if (!StringUtils.hasText(workerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通任务心跳缺少 workerId");
    }
    String normalizedWorkerId = workerId.trim();
    Instant now = heartbeatAt == null ? Instant.now() : heartbeatAt;

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("heartbeatAt", now.toString());
    result.put("heartbeatStatus", "table_not_ready");
    result.put("jobId", jobId);
    result.put("leaseValid", false);
    result.put("tableReady", false);
    result.put("targetTable", "tenant_provisioning_job");
    result.put("updatedRows", 0);
    result.put("workerId", normalizedWorkerId);
    if (!tableExists("tenant_provisioning_job")) {
      return result;
    }

    int updatedRows = updateHeartbeat(jobId, normalizedWorkerId, now);
    result.put("heartbeatStatus", updatedRows > 0 ? "success" : "lease_lost");
    result.put("leaseValid", updatedRows > 0);
    result.put("tableReady", true);
    result.put("updatedRows", updatedRows);
    return result;
  }

  private int updateHeartbeat(long jobId, String workerId, Instant now) {
    return centerJdbcTemplate.update(
        """
        UPDATE tenant_provisioning_job
        SET heartbeat_at = ?,
            update_time = ?
        WHERE id = ?
          AND lock_owner = ?
          AND status = 'provisioning'
        """,
        timestamp(now),
        timestamp(now),
        jobId,
        workerId);
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
