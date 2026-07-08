package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** 组织空间开通任务心跳测试；只使用 fake JdbcTemplate，不执行建库、复制或状态流转。 */
class OrganizationProvisioningJobHeartbeatServiceTest {

  @Test
  void refreshHeartbeatReturnsTableNotReadyWhenProvisioningTableMissing() {
    OrganizationProvisioningJobHeartbeatService service =
        new OrganizationProvisioningJobHeartbeatService(new HeartbeatJdbcTemplate(false));

    Map<String, Object> result =
        service.refreshHeartbeat(31L, "worker-a", Instant.parse("2026-07-02T09:10:00Z"));

    assertThat(result)
        .containsEntry("heartbeatStatus", "table_not_ready")
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", false)
        .containsEntry("tableReady", false)
        .containsEntry("updatedRows", 0)
        .containsEntry("workerId", "worker-a");
  }

  @Test
  void refreshHeartbeatUpdatesOnlyLeaseTimestampWhenWorkerStillOwnsJob() {
    HeartbeatJdbcTemplate jdbcTemplate = new HeartbeatJdbcTemplate(true);
    jdbcTemplate.jobs.add(new JobFixture(31L, "worker-a", "provisioning"));
    OrganizationProvisioningJobHeartbeatService service =
        new OrganizationProvisioningJobHeartbeatService(jdbcTemplate);

    Map<String, Object> result =
        service.refreshHeartbeat(31L, "worker-a", Instant.parse("2026-07-02T09:10:00Z"));

    assertThat(result)
        .containsEntry("heartbeatStatus", "success")
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("tableReady", true)
        .containsEntry("updatedRows", 1)
        .containsEntry("workerId", "worker-a");
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-02T09:10:00Z"));
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("claimed");
    assertThat(jdbcTemplate.updateSql())
        .singleElement()
        .asString()
        .contains("UPDATE tenant_provisioning_job")
        .contains("heartbeat_at")
        .contains("status = 'provisioning'")
        .doesNotContain("step =");
  }

  @Test
  void refreshHeartbeatReportsLeaseLostWhenOwnerOrStatusNoLongerMatches() {
    HeartbeatJdbcTemplate jdbcTemplate = new HeartbeatJdbcTemplate(true);
    jdbcTemplate.jobs.add(new JobFixture(32L, "other-worker", "provisioning"));
    OrganizationProvisioningJobHeartbeatService service =
        new OrganizationProvisioningJobHeartbeatService(jdbcTemplate);

    Map<String, Object> result =
        service.refreshHeartbeat(32L, "worker-a", Instant.parse("2026-07-02T09:10:00Z"));

    assertThat(result)
        .containsEntry("heartbeatStatus", "lease_lost")
        .containsEntry("jobId", 32L)
        .containsEntry("leaseValid", false)
        .containsEntry("tableReady", true)
        .containsEntry("updatedRows", 0);
  }

  @Test
  void refreshHeartbeatRequiresJobIdAndWorkerId() {
    OrganizationProvisioningJobHeartbeatService service =
        new OrganizationProvisioningJobHeartbeatService(new HeartbeatJdbcTemplate(true));

    assertThatThrownBy(() -> service.refreshHeartbeat(0L, "worker-a", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通任务心跳缺少 jobId");
    assertThatThrownBy(() -> service.refreshHeartbeat(31L, " ", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通任务心跳缺少 workerId");
  }

  private static final class HeartbeatJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final boolean tableReady;
    private final List<String> updateSql = new ArrayList<>();

    private HeartbeatJdbcTemplate(boolean tableReady) {
      this.tableReady = tableReady;
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(tableReady ? 1L : 0L);
    }

    @Override
    public int update(String sql, Object... args) {
      updateSql.add(sql);
      long id = ((Number) args[2]).longValue();
      String workerId = String.valueOf(args[3]);
      JobFixture job =
          jobs.stream()
              .filter(row -> row.id == id)
              .filter(row -> workerId.equals(row.lockOwner))
              .filter(row -> "provisioning".equals(row.status))
              .findFirst()
              .orElse(null);
      if (job == null) {
        return 0;
      }
      job.heartbeatAt = ((Timestamp) args[0]).toInstant();
      job.updateTime = ((Timestamp) args[1]).toInstant();
      return 1;
    }

    private List<String> updateSql() {
      return updateSql;
    }
  }

  private static final class JobFixture {

    private Instant heartbeatAt = Instant.parse("2026-07-02T09:00:00Z");
    private final long id;
    private final String lockOwner;
    private final String status;
    private final String step = "claimed";
    private Instant updateTime = Instant.parse("2026-07-02T09:00:00Z");

    private JobFixture(long id, String lockOwner, String status) {
      this.id = id;
      this.lockOwner = lockOwner;
      this.status = status;
    }
  }
}
