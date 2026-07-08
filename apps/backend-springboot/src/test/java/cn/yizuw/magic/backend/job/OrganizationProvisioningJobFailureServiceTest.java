package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.common.BusinessException;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** 组织开通失败收口测试；只验证中心库任务 retry/manual 失败状态，不执行补偿或消息消费。 */
class OrganizationProvisioningJobFailureServiceTest {

  @Test
  void markTenantProvisioningJobFailedReturnsTableNotReadyWhenTableMissing() {
    FailureJdbcTemplate jdbcTemplate = new FailureJdbcTemplate(false);

    Map<String, Object> result =
        new OrganizationProvisioningJobFailureService(jdbcTemplate)
            .markTenantProvisioningJobFailed(
                31L,
                "worker-a",
                "schema clone failed",
                5,
                Instant.parse("2026-07-03T11:00:00Z"));

    assertThat(result)
        .containsEntry("failureStatus", "table_not_ready")
        .containsEntry("tableReady", false)
        .containsEntry("tenantProvisioningFailed", false)
        .containsEntry("updatedRows", 0)
        .containsEntry("workerId", "worker-a");
    assertThat(jdbcTemplate.updateSql).isEmpty();
  }

  @Test
  void markTenantProvisioningJobFailedRequiresJobIdWorkerIdAndReason() {
    OrganizationProvisioningJobFailureService service =
        new OrganizationProvisioningJobFailureService(new FailureJdbcTemplate(true));

    assertThatThrownBy(
            () ->
                service.markTenantProvisioningJobFailed(
                    0L, "worker-a", "failed", 5, Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通失败收口缺少 jobId");
    assertThatThrownBy(
            () ->
                service.markTenantProvisioningJobFailed(
                    31L, " ", "failed", 5, Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通失败收口缺少 workerId");
    assertThatThrownBy(
            () ->
                service.markTenantProvisioningJobFailed(
                    31L, "worker-a", " ", 5, Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通失败收口缺少 failureReason");
  }

  @Test
  void markTenantProvisioningJobFailedWritesRetryableFailureBeforeMaxRetry() {
    FailureJdbcTemplate jdbcTemplate = new FailureJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid(1));

    Map<String, Object> result =
        new OrganizationProvisioningJobFailureService(jdbcTemplate)
            .markTenantProvisioningJobFailed(
                31L,
                "worker-a",
                "copy base data failed",
                5,
                Instant.parse("2026-07-03T11:00:00Z"));

    assertThat(result)
        .containsEntry("failedManual", false)
        .containsEntry("failureReason", "copy base data failed")
        .containsEntry("failureStatus", "success")
        .containsEntry("leaseValid", true)
        .containsEntry("previousRetryCount", 1)
        .containsEntry("retryable", true)
        .containsEntry("retryCount", 2)
        .containsEntry("status", "failed_retryable")
        .containsEntry("step", "retry_waiting")
        .containsEntry("targetStatus", "failed_retryable")
        .containsEntry("targetStep", "retry_waiting")
        .containsEntry("tenantProvisioningFailed", true)
        .containsEntry("updatedRows", 1);
    JobFixture job = jdbcTemplate.jobs.get(0);
    assertThat(job.errorMessage).isEqualTo("copy base data failed");
    assertThat(job.heartbeatAt).isNull();
    assertThat(job.lockedAt).isNull();
    assertThat(job.lockOwner).isNull();
    assertThat(job.retryCount).isEqualTo(2);
    assertThat(job.status).isEqualTo("failed_retryable");
    assertThat(job.step).isEqualTo("retry_waiting");
    assertThat(jdbcTemplate.updateSql)
        .singleElement()
        .asString()
        .contains("UPDATE tenant_provisioning_job")
        .contains("retry_count = ?")
        .doesNotContain("INSERT INTO event_outbox")
        .doesNotContain("DROP DATABASE");
  }

  @Test
  void markTenantProvisioningJobFailedWritesManualFailureAtMaxRetry() {
    FailureJdbcTemplate jdbcTemplate = new FailureJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid(4));

    Map<String, Object> result =
        new OrganizationProvisioningJobFailureService(jdbcTemplate)
            .markTenantProvisioningJobFailed(
                31L,
                "worker-a",
                "target user missing",
                5,
                Instant.parse("2026-07-03T11:05:00Z"));

    assertThat(result)
        .containsEntry("failedManual", true)
        .containsEntry("failureStatus", "success")
        .containsEntry("retryable", false)
        .containsEntry("retryCount", 5)
        .containsEntry("status", "failed_manual")
        .containsEntry("step", "failed")
        .containsEntry("targetStatus", "failed_manual")
        .containsEntry("targetStep", "failed")
        .containsEntry("tenantProvisioningFailed", true);
    JobFixture job = jdbcTemplate.jobs.get(0);
    assertThat(job.retryCount).isEqualTo(5);
    assertThat(job.status).isEqualTo("failed_manual");
    assertThat(job.step).isEqualTo("failed");
  }

  @Test
  void markTenantProvisioningJobFailedReportsLeaseLostWhenWorkerDoesNotOwnJob() {
    FailureJdbcTemplate jdbcTemplate = new FailureJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid(1));

    Map<String, Object> result =
        new OrganizationProvisioningJobFailureService(jdbcTemplate)
            .markTenantProvisioningJobFailed(
                31L,
                "worker-b",
                "copy failed",
                5,
                Instant.parse("2026-07-03T11:00:00Z"));

    assertThat(result)
        .containsEntry("failureStatus", "lease_lost")
        .containsEntry("leaseValid", false)
        .containsEntry("tableReady", true)
        .containsEntry("tenantProvisioningFailed", false)
        .containsEntry("updatedRows", 0);
    assertThat(result.get("blockedReasons")).isEqualTo(List.of("任务不存在或租约已丢失，无法标记失败"));
    assertThat(jdbcTemplate.updateSql).isEmpty();
  }

  private static final class FailureJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final boolean tableReady;
    private final List<String> updateSql = new ArrayList<>();

    private FailureJdbcTemplate(boolean tableReady) {
      this.tableReady = tableReady;
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(tableReady ? 1L : 0L);
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      if (!sql.contains("FROM tenant_provisioning_job")) {
        return List.of();
      }
      long jobId = ((Number) args[0]).longValue();
      String workerId = String.valueOf(args[1]);
      JobFixture job =
          jobs.stream()
              .filter(item -> item.id == jobId)
              .filter(item -> workerId.equals(item.lockOwner))
              .filter(item -> "provisioning".equals(item.status))
              .findFirst()
              .orElse(null);
      if (job == null) {
        return List.of();
      }
      try {
        ResultSet rs = org.mockito.Mockito.mock(ResultSet.class);
        when(rs.getLong("id")).thenReturn(job.id);
        when(rs.getLong("initiator_center_user_id")).thenReturn(job.initiatorCenterUserId);
        when(rs.getLong("source_org_id")).thenReturn(job.sourceOrgId);
        when(rs.getString("source_customer_id")).thenReturn(job.sourceCustomerId);
        when(rs.getString("target_customer_id")).thenReturn(job.targetCustomerId);
        when(rs.getString("target_db_name")).thenReturn(job.targetDbName);
        when(rs.getString("status")).thenReturn(job.status);
        when(rs.getString("step")).thenReturn(job.step);
        when(rs.getInt("retry_count")).thenReturn(job.retryCount);
        when(rs.getString("lock_owner")).thenReturn(job.lockOwner);
        when(rs.getTimestamp("locked_at")).thenReturn(timestamp(job.lockedAt));
        when(rs.getTimestamp("heartbeat_at")).thenReturn(timestamp(job.heartbeatAt));
        when(rs.getTimestamp("update_time")).thenReturn(timestamp(job.updateTime));
        return List.of(rowMapper.mapRow(rs, 0));
      } catch (Exception error) {
        throw new IllegalStateException(error);
      }
    }

    @Override
    public int update(String sql, Object... args) {
      updateSql.add(sql);
      long jobId = ((Number) args[5]).longValue();
      String workerId = String.valueOf(args[6]);
      JobFixture job =
          jobs.stream()
              .filter(item -> item.id == jobId)
              .filter(item -> workerId.equals(item.lockOwner))
              .filter(item -> "provisioning".equals(item.status))
              .findFirst()
              .orElse(null);
      if (job == null) {
        return 0;
      }
      job.errorMessage = String.valueOf(args[0]);
      job.heartbeatAt = null;
      job.lockedAt = null;
      job.lockOwner = null;
      job.retryCount = ((Number) args[1]).intValue();
      job.status = String.valueOf(args[2]);
      job.step = String.valueOf(args[3]);
      job.updateTime = ((Timestamp) args[4]).toInstant();
      return 1;
    }

    private Timestamp timestamp(Instant instant) {
      return instant == null ? null : Timestamp.from(instant);
    }
  }

  private static final class JobFixture {

    private String errorMessage;
    private Instant heartbeatAt = Instant.parse("2026-07-03T10:50:00Z");
    private final long id = 31L;
    private final long initiatorCenterUserId = 1001L;
    private Instant lockedAt = Instant.parse("2026-07-03T10:50:00Z");
    private String lockOwner = "worker-a";
    private int retryCount;
    private final String sourceCustomerId = "public";
    private final long sourceOrgId = 1001L;
    private String status = "provisioning";
    private String step = "seeding_base_data";
    private final String targetCustomerId = "org001";
    private final String targetDbName = "tenant_org001";
    private Instant updateTime = Instant.parse("2026-07-03T10:50:00Z");

    private JobFixture(int retryCount) {
      this.retryCount = retryCount;
    }

    private static JobFixture valid(int retryCount) {
      return new JobFixture(retryCount);
    }
  }
}
