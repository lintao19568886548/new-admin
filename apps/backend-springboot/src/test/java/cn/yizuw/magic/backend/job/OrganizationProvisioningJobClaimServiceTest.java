package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** 组织空间开通任务认领服务测试；只使用 fake JdbcTemplate，不执行真实建库或数据复制。 */
class OrganizationProvisioningJobClaimServiceTest {

  @Test
  void claimCandidatesReturnsTableNotReadyWhenTableMissing() {
    OrganizationProvisioningJobClaimService service =
        new OrganizationProvisioningJobClaimService(new ClaimJdbcTemplate(false));

    Map<String, Object> result =
        service.claimCandidates(5, "worker-a", 60_000L, 5, Instant.parse("2026-07-02T08:00:00Z"));

    assertThat(result)
        .containsEntry("claimedCount", 0)
        .containsEntry("requestedLimit", 5)
        .containsEntry("tableReady", false)
        .containsEntry("workerId", "worker-a");
    assertThat(result.get("items")).isEqualTo(List.of());
  }

  @Test
  void claimCandidatesClaimsPendingJobWithoutExecutingProvisioningSteps() {
    ClaimJdbcTemplate jdbcTemplate = new ClaimJdbcTemplate(true);
    jdbcTemplate.addJob(job(31, "pending", null));
    OrganizationProvisioningJobClaimService service =
        new OrganizationProvisioningJobClaimService(jdbcTemplate);

    Map<String, Object> result =
        service.claimCandidates(5, "worker-a", 60_000L, 5, Instant.parse("2026-07-02T08:00:00Z"));

    assertThat(result)
        .containsEntry("claimedCount", 1L)
        .containsEntry("requestedLimit", 5)
        .containsEntry("tableReady", true)
        .containsEntry("workerId", "worker-a");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items).hasSize(1);
    assertThat(items.get(0))
        .containsEntry("claimStatus", "claimed")
        .containsEntry("claimed", true)
        .containsEntry("id", 31L)
        .containsEntry("lockOwner", "worker-a")
        .containsEntry("status", "provisioning")
        .containsEntry("step", "claimed")
        .containsEntry("updatedRows", 1);
    assertThat(jdbcTemplate.updateSql()).singleElement().asString().contains("UPDATE tenant_provisioning_job");
  }

  @Test
  void claimCandidatesCanReclaimStaleProvisioningJob() {
    ClaimJdbcTemplate jdbcTemplate = new ClaimJdbcTemplate(true);
    jdbcTemplate.addJob(
        job(32, "provisioning", Instant.parse("2026-07-02T07:30:00Z")).withLockOwner("old-worker"));
    OrganizationProvisioningJobClaimService service =
        new OrganizationProvisioningJobClaimService(jdbcTemplate);

    Map<String, Object> result =
        service.claimCandidates(1, "worker-b", 600_000L, 5, Instant.parse("2026-07-02T08:00:00Z"));

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("claimStatus", "claimed")
        .containsEntry("claimed", true)
        .containsEntry("id", 32L)
        .containsEntry("lockOwner", "worker-b");
  }

  @Test
  void claimCandidatesRecordsOptimisticLockLossWithoutThrowing() {
    ClaimJdbcTemplate jdbcTemplate = new ClaimJdbcTemplate(true);
    jdbcTemplate.updateRows = 0;
    jdbcTemplate.addJob(job(33, "pending", null));
    OrganizationProvisioningJobClaimService service =
        new OrganizationProvisioningJobClaimService(jdbcTemplate);

    Map<String, Object> result =
        service.claimCandidates(1, "worker-c", 60_000L, 5, Instant.parse("2026-07-02T08:00:00Z"));

    assertThat(result).containsEntry("claimedCount", 0L);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("claimStatus", "skipped")
        .containsEntry("claimed", false)
        .containsEntry("skippedReason", "optimistic_lock_lost")
        .containsEntry("updatedRows", 0);
  }

  private static JobFixture job(long id, String status, Instant heartbeatAt) {
    return new JobFixture(id, status, heartbeatAt);
  }

  private static final class JobFixture {

    private final Instant createTime = Instant.parse("2026-07-02T07:00:00Z");
    private Instant heartbeatAt;
    private Instant lockedAt;
    private String lockOwner;
    private final long id;
    private String status;
    private String step;
    private Instant startedAt;
    private Instant updateTime = Instant.parse("2026-07-02T07:00:00Z");

    private JobFixture(long id, String status, Instant heartbeatAt) {
      this.id = id;
      this.status = status;
      this.heartbeatAt = heartbeatAt;
      this.step = status;
    }

    private JobFixture withLockOwner(String owner) {
      this.lockOwner = owner;
      this.lockedAt = Instant.parse("2026-07-02T07:30:00Z");
      this.startedAt = Instant.parse("2026-07-02T07:30:00Z");
      return this;
    }
  }

  private static final class ClaimJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final boolean tableReady;
    private final List<String> updateSql = new ArrayList<>();
    private int updateRows = 1;

    private ClaimJdbcTemplate(boolean tableReady) {
      this.tableReady = tableReady;
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(tableReady ? 1L : 0L);
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      if (sql.contains("WHERE id = ?")) {
        long id = ((Number) args[0]).longValue();
        return jobs.stream().filter(job -> job.id == id).findFirst().map(job -> List.of(map(rowMapper, job))).orElse(List.of());
      }
      if (sql.contains("LIMIT 1")) {
        int maxRetry = ((Number) args[0]).intValue();
        Instant staleBefore = ((Timestamp) args[1]).toInstant();
        return jobs.stream()
            .filter(job -> eligible(job, maxRetry, staleBefore))
            .findFirst()
            .map(job -> List.of(map(rowMapper, job)))
            .orElse(List.of());
      }
      return List.of();
    }

    @Override
    public int update(String sql, Object... args) {
      updateSql.add(sql);
      if (updateRows <= 0) {
        return 0;
      }
      long id = ((Number) args[5]).longValue();
      JobFixture job = jobs.stream().filter(row -> row.id == id).findFirst().orElse(null);
      if (job == null) {
        return 0;
      }
      job.heartbeatAt = ((Timestamp) args[0]).toInstant();
      job.lockedAt = ((Timestamp) args[1]).toInstant();
      job.lockOwner = String.valueOf(args[2]);
      job.startedAt = ((Timestamp) args[3]).toInstant();
      job.updateTime = ((Timestamp) args[4]).toInstant();
      job.status = "provisioning";
      job.step = "claimed";
      return updateRows;
    }

    private boolean eligible(JobFixture job, int maxRetry, Instant staleBefore) {
      if (maxRetry <= 0) {
        return false;
      }
      if ("pending".equals(job.status) || "failed_retryable".equals(job.status)) {
        return true;
      }
      return "provisioning".equals(job.status)
          && job.heartbeatAt != null
          && job.heartbeatAt.isBefore(staleBefore);
    }

    private void addJob(JobFixture job) {
      jobs.add(job);
    }

    private List<String> updateSql() {
      return updateSql;
    }

    private <T> T map(RowMapper<T> rowMapper, JobFixture job) {
      try {
        return rowMapper.mapRow(resultSet(job), 0);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private ResultSet resultSet(JobFixture job) throws SQLException {
      ResultSet resultSet = mock(ResultSet.class);
      when(resultSet.getLong("id")).thenReturn(job.id);
      when(resultSet.getObject("initiator_center_user_id")).thenReturn(1001L);
      when(resultSet.getObject("source_org_id")).thenReturn(7L);
      when(resultSet.getString("source_customer_id")).thenReturn("public");
      when(resultSet.getString("target_customer_id")).thenReturn("org001");
      when(resultSet.getString("target_db_name")).thenReturn("tenant_org001");
      when(resultSet.getString("status")).thenReturn(job.status);
      when(resultSet.getString("step")).thenReturn(job.step);
      when(resultSet.getObject("retry_count")).thenReturn(0);
      when(resultSet.getString("lock_owner")).thenReturn(job.lockOwner);
      when(resultSet.getTimestamp("locked_at")).thenReturn(timestamp(job.lockedAt));
      when(resultSet.getTimestamp("heartbeat_at")).thenReturn(timestamp(job.heartbeatAt));
      when(resultSet.getTimestamp("started_at")).thenReturn(timestamp(job.startedAt));
      when(resultSet.getTimestamp("create_time")).thenReturn(timestamp(job.createTime));
      when(resultSet.getTimestamp("update_time")).thenReturn(timestamp(job.updateTime));
      return resultSet;
    }

    private Timestamp timestamp(Instant instant) {
      return instant == null ? null : Timestamp.from(instant);
    }
  }
}
