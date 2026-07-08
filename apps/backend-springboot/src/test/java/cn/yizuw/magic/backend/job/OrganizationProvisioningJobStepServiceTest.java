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

/** 组织空间开通步骤推进测试；只使用 fake JdbcTemplate，不执行 DROP/CREATE DATABASE。 */
class OrganizationProvisioningJobStepServiceTest {

  @Test
  void markRebuildingDatabaseReturnsTableNotReadyWhenProvisioningTableMissing() {
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(new StepJdbcTemplate(false));

    Map<String, Object> result =
        service.markRebuildingDatabase(31L, "worker-a", Instant.parse("2026-07-02T09:20:00Z"));

    assertThat(result)
        .containsEntry("fromStep", "claimed")
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", false)
        .containsEntry("stepStatus", "table_not_ready")
        .containsEntry("tableReady", false)
        .containsEntry("targetStep", "rebuilding_database")
        .containsEntry("updatedRows", 0)
        .containsEntry("workerId", "worker-a");
  }

  @Test
  void markRebuildingDatabaseUpdatesStepOnlyWhenClaimedLeaseStillOwned() {
    StepJdbcTemplate jdbcTemplate = new StepJdbcTemplate(true);
    jdbcTemplate.jobs.add(new JobFixture(31L, "worker-a", "provisioning", "claimed"));
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(jdbcTemplate);

    Map<String, Object> result =
        service.markRebuildingDatabase(31L, "worker-a", Instant.parse("2026-07-02T09:20:00Z"));

    assertThat(result)
        .containsEntry("fromStep", "claimed")
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("stepStatus", "success")
        .containsEntry("tableReady", true)
        .containsEntry("targetStep", "rebuilding_database")
        .containsEntry("updatedRows", 1)
        .containsEntry("workerId", "worker-a");
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-02T09:20:00Z"));
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("rebuilding_database");
    assertThat(jdbcTemplate.updateSql())
        .singleElement()
        .asString()
        .contains("UPDATE tenant_provisioning_job")
        .contains("step = ?")
        .doesNotContain("DROP DATABASE")
        .doesNotContain("CREATE DATABASE");
  }

  @Test
  void markRebuildingDatabaseReportsLeaseLostWhenStepAlreadyMoved() {
    StepJdbcTemplate jdbcTemplate = new StepJdbcTemplate(true);
    jdbcTemplate.jobs.add(new JobFixture(32L, "worker-a", "provisioning", "cloning_schema"));
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(jdbcTemplate);

    Map<String, Object> result =
        service.markRebuildingDatabase(32L, "worker-a", Instant.parse("2026-07-02T09:20:00Z"));

    assertThat(result)
        .containsEntry("jobId", 32L)
        .containsEntry("leaseValid", false)
        .containsEntry("stepStatus", "lease_lost")
        .containsEntry("tableReady", true)
        .containsEntry("updatedRows", 0);
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("cloning_schema");
  }

  @Test
  void markRebuildingDatabaseRequiresJobIdAndWorkerId() {
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(new StepJdbcTemplate(true));

    assertThatThrownBy(() -> service.markRebuildingDatabase(0L, "worker-a", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通任务步骤推进缺少 jobId");
    assertThatThrownBy(() -> service.markRebuildingDatabase(31L, " ", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通任务步骤推进缺少 workerId");
  }

  @Test
  void markCloningSchemaReturnsTableNotReadyWhenProvisioningTableMissing() {
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(new StepJdbcTemplate(false));

    Map<String, Object> result =
        service.markCloningSchema(31L, "worker-a", Instant.parse("2026-07-02T09:40:00Z"));

    assertThat(result)
        .containsEntry("fromStep", "rebuilding_database")
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", false)
        .containsEntry("stepStatus", "table_not_ready")
        .containsEntry("tableReady", false)
        .containsEntry("targetStep", "cloning_schema")
        .containsEntry("updatedRows", 0)
        .containsEntry("workerId", "worker-a");
  }

  @Test
  void markCloningSchemaUpdatesStepOnlyAfterDatabaseRebuild() {
    StepJdbcTemplate jdbcTemplate = new StepJdbcTemplate(true);
    jdbcTemplate.jobs.add(new JobFixture(31L, "worker-a", "provisioning", "rebuilding_database"));
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(jdbcTemplate);

    Map<String, Object> result =
        service.markCloningSchema(31L, "worker-a", Instant.parse("2026-07-02T09:40:00Z"));

    assertThat(result)
        .containsEntry("fromStep", "rebuilding_database")
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("stepStatus", "success")
        .containsEntry("tableReady", true)
        .containsEntry("targetStep", "cloning_schema")
        .containsEntry("updatedRows", 1)
        .containsEntry("workerId", "worker-a");
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-02T09:40:00Z"));
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("cloning_schema");
    assertThat(jdbcTemplate.updateSql())
        .singleElement()
        .asString()
        .contains("UPDATE tenant_provisioning_job")
        .contains("step = ?")
        .doesNotContain("SHOW CREATE TABLE")
        .doesNotContain("CREATE TABLE")
        .doesNotContain("INSERT INTO");
  }

  @Test
  void markCloningSchemaReportsLeaseLostWhenDatabaseRebuildWasNotMarked() {
    StepJdbcTemplate jdbcTemplate = new StepJdbcTemplate(true);
    jdbcTemplate.jobs.add(new JobFixture(32L, "worker-a", "provisioning", "claimed"));
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(jdbcTemplate);

    Map<String, Object> result =
        service.markCloningSchema(32L, "worker-a", Instant.parse("2026-07-02T09:40:00Z"));

    assertThat(result)
        .containsEntry("jobId", 32L)
        .containsEntry("leaseValid", false)
        .containsEntry("stepStatus", "lease_lost")
        .containsEntry("tableReady", true)
        .containsEntry("updatedRows", 0);
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("claimed");
  }

  @Test
  void markCloningSchemaRequiresJobIdAndWorkerId() {
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(new StepJdbcTemplate(true));

    assertThatThrownBy(() -> service.markCloningSchema(0L, "worker-a", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通 schema clone 步骤推进缺少 jobId");
    assertThatThrownBy(() -> service.markCloningSchema(31L, " ", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通 schema clone 步骤推进缺少 workerId");
  }

  @Test
  void markSeedingBaseDataUpdatesStepOnlyAfterSchemaClone() {
    StepJdbcTemplate jdbcTemplate = new StepJdbcTemplate(true);
    jdbcTemplate.jobs.add(new JobFixture(31L, "worker-a", "provisioning", "cloning_schema"));
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(jdbcTemplate);

    Map<String, Object> result =
        service.markSeedingBaseData(31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("fromStep", "cloning_schema")
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("stepStatus", "success")
        .containsEntry("tableReady", true)
        .containsEntry("targetStep", "seeding_base_data")
        .containsEntry("updatedRows", 1)
        .containsEntry("workerId", "worker-a");
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-02T10:20:00Z"));
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("seeding_base_data");
    assertThat(jdbcTemplate.updateSql())
        .singleElement()
        .asString()
        .contains("UPDATE tenant_provisioning_job")
        .contains("step = ?")
        .doesNotContain("INSERT INTO")
        .doesNotContain("SELECT")
        .doesNotContain("COMMIT");
  }

  @Test
  void markSeedingBaseDataReportsLeaseLostWhenSchemaCloneWasNotMarked() {
    StepJdbcTemplate jdbcTemplate = new StepJdbcTemplate(true);
    jdbcTemplate.jobs.add(new JobFixture(32L, "worker-a", "provisioning", "rebuilding_database"));
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(jdbcTemplate);

    Map<String, Object> result =
        service.markSeedingBaseData(32L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("fromStep", "cloning_schema")
        .containsEntry("jobId", 32L)
        .containsEntry("leaseValid", false)
        .containsEntry("stepStatus", "lease_lost")
        .containsEntry("tableReady", true)
        .containsEntry("targetStep", "seeding_base_data")
        .containsEntry("updatedRows", 0);
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("rebuilding_database");
  }

  @Test
  void markSeedingBaseDataRequiresJobIdAndWorkerId() {
    OrganizationProvisioningJobStepService service =
        new OrganizationProvisioningJobStepService(new StepJdbcTemplate(true));

    assertThatThrownBy(() -> service.markSeedingBaseData(0L, "worker-a", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通基础数据复制步骤推进缺少 jobId");
    assertThatThrownBy(() -> service.markSeedingBaseData(31L, " ", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通基础数据复制步骤推进缺少 workerId");
  }

  private static final class StepJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final boolean tableReady;
    private final List<String> updateSql = new ArrayList<>();

    private StepJdbcTemplate(boolean tableReady) {
      this.tableReady = tableReady;
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      return requiredType.cast(tableReady ? 1L : 0L);
    }

    @Override
    public int update(String sql, Object... args) {
      updateSql.add(sql);
      String targetStep = String.valueOf(args[1]);
      long id = ((Number) args[3]).longValue();
      String workerId = String.valueOf(args[4]);
      String fromStep = String.valueOf(args[5]);
      JobFixture job =
          jobs.stream()
              .filter(row -> row.id == id)
              .filter(row -> workerId.equals(row.lockOwner))
              .filter(row -> "provisioning".equals(row.status))
              .filter(row -> fromStep.equals(row.step))
              .findFirst()
              .orElse(null);
      if (job == null) {
        return 0;
      }
      job.heartbeatAt = ((Timestamp) args[0]).toInstant();
      job.updateTime = ((Timestamp) args[2]).toInstant();
      job.step = targetStep;
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
    private String step;
    private Instant updateTime = Instant.parse("2026-07-02T09:00:00Z");

    private JobFixture(long id, String lockOwner, String status, String step) {
      this.id = id;
      this.lockOwner = lockOwner;
      this.status = status;
      this.step = step;
    }
  }
}
