package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.tenant.TenantDataSourceProperties;
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
import org.springframework.mock.env.MockEnvironment;

/** 组织空间开通目标库重建预览测试；只生成 DDL 计划，不执行真实 DROP/CREATE DATABASE。 */
class OrganizationProvisioningDatabaseRebuildPlanServiceTest {

  @Test
  void previewRebuildDatabaseReturnsTableNotReadyWhenProvisioningTableMissing() {
    RebuildPlanJdbcTemplate jdbcTemplate = new RebuildPlanJdbcTemplate(false);

    Map<String, Object> result =
        service(jdbcTemplate)
            .previewRebuildDatabase(31L, "worker-a", Instant.parse("2026-07-02T09:30:00Z"));

    assertThat(result)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", false)
        .containsEntry("planStatus", "table_not_ready")
        .containsEntry("ready", false)
        .containsEntry("tableReady", false)
        .containsEntry("workerId", "worker-a");
    assertThat((List<?>) result.get("ddlPreview")).isEmpty();
    assertThat(jdbcTemplate.queries).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void previewRebuildDatabaseReturnsReadyDdlPlanForValidLease() {
    RebuildPlanJdbcTemplate jdbcTemplate = new RebuildPlanJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());

    Map<String, Object> result =
        service(jdbcTemplate)
            .previewRebuildDatabase(31L, "worker-a", Instant.parse("2026-07-02T09:30:00Z"));

    assertThat(result)
        .containsEntry("executeDdl", false)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("nextExplicitSwitch", "executeRebuildDatabase")
        .containsEntry("planStatus", "ready")
        .containsEntry("ready", true)
        .containsEntry("requiredStep", "rebuilding_database")
        .containsEntry("sourceCustomerId", "public")
        .containsEntry("tableReady", true)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry("workerId", "worker-a");
    assertThat((List<?>) result.get("blockedReasons")).isEmpty();
    assertThat(result.get("ddlPreview"))
        .isEqualTo(
            List.of(
            "DROP DATABASE IF EXISTS `tenant_org001`",
            "CREATE DATABASE `tenant_org001` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"));
    @SuppressWarnings("unchecked")
    Map<String, Object> targetJdbcUrlPreview =
        (Map<String, Object>) result.get("targetJdbcUrlPreview");
    assertThat(targetJdbcUrlPreview)
        .containsEntry("database", "tenant_org001")
        .containsEntry("host", "127.0.0.1")
        .containsEntry("passwordRedacted", true)
        .containsEntry("port", 3306)
        .containsEntry("scheme", "mysql")
        .containsEntry("usernamePresent", true);
    @SuppressWarnings("unchecked")
    Map<String, Object> adminJdbcUrlPreview =
        (Map<String, Object>) result.get("adminJdbcUrlPreview");
    assertThat(adminJdbcUrlPreview)
        .containsEntry("database", null)
        .containsEntry("withoutDatabase", true);
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void previewRebuildDatabaseBlocksProtectedDatabaseAndPublicTarget() {
    RebuildPlanJdbcTemplate jdbcTemplate = new RebuildPlanJdbcTemplate(true);
    JobFixture job = JobFixture.valid();
    job.targetCustomerId = "public";
    job.targetDbName = "magic_center";
    jdbcTemplate.jobs.add(job);

    Map<String, Object> result =
        service(jdbcTemplate)
            .previewRebuildDatabase(31L, "worker-a", Instant.parse("2026-07-02T09:30:00Z"));

    assertThat(result)
        .containsEntry("leaseValid", true)
        .containsEntry("planStatus", "blocked")
        .containsEntry("ready", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons)
        .contains(
            "拒绝把 public 作为自动开通目标租户",
            "拒绝重建受保护数据库: magic_center");
    assertThat((List<?>) result.get("ddlPreview")).isEmpty();
  }

  @Test
  void previewRebuildDatabaseReportsLeaseLostWhenWorkerOrStepDoesNotMatch() {
    RebuildPlanJdbcTemplate jdbcTemplate = new RebuildPlanJdbcTemplate(true);
    JobFixture job = JobFixture.valid();
    job.step = "cloning_schema";
    jdbcTemplate.jobs.add(job);

    Map<String, Object> result =
        service(jdbcTemplate)
            .previewRebuildDatabase(31L, "worker-a", Instant.parse("2026-07-02T09:30:00Z"));

    assertThat(result)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", false)
        .containsEntry("planStatus", "lease_lost")
        .containsEntry("ready", false)
        .containsEntry("tableReady", true);
    assertThat(result.get("blockedReasons"))
        .isEqualTo(List.of("任务不存在、租约已丢失或步骤不是 rebuilding_database"));
    assertThat((List<?>) result.get("ddlPreview")).isEmpty();
  }

  @Test
  void previewRebuildDatabaseRequiresJobIdAndWorkerId() {
    OrganizationProvisioningDatabaseRebuildPlanService service =
        service(new RebuildPlanJdbcTemplate(true));

    assertThatThrownBy(() -> service.previewRebuildDatabase(0L, "worker-a", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通目标库重建预览缺少 jobId");
    assertThatThrownBy(() -> service.previewRebuildDatabase(31L, " ", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通目标库重建预览缺少 workerId");
  }

  @Test
  void executeRebuildDatabaseRunsDdlOnlyWhenConfirmTargetDbNameMatches() {
    RebuildPlanJdbcTemplate jdbcTemplate = new RebuildPlanJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeDatabaseAdminClient adminClient = new FakeDatabaseAdminClient();

    Map<String, Object> result =
        service(jdbcTemplate, adminClient)
            .executeRebuildDatabase(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-02T09:35:00Z"));

    assertThat(result)
        .containsEntry("executeDdl", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("nextExplicitSwitch", "markCloningSchema")
        .containsEntry("rebuildStatus", "success")
        .containsEntry("schemaCloneStarted", false);
    assertThat(result.get("ddlExecuted"))
        .isEqualTo(
            List.of(
                "DROP DATABASE IF EXISTS `tenant_org001`",
                "CREATE DATABASE `tenant_org001` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"));
    assertThat(adminClient.targetJdbcUrls).containsExactly(
        "mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-02T09:35:00Z"));
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("rebuilding_database");
  }

  @Test
  void executeRebuildDatabaseDoesNotRunDdlWhenConfirmTargetDbNameMismatches() {
    RebuildPlanJdbcTemplate jdbcTemplate = new RebuildPlanJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeDatabaseAdminClient adminClient = new FakeDatabaseAdminClient();

    Map<String, Object> result =
        service(jdbcTemplate, adminClient)
            .executeRebuildDatabase(
                31L,
                "worker-a",
                "wrong_db",
                Instant.parse("2026-07-02T09:35:00Z"));

    assertThat(result)
        .containsEntry("executeDdl", false)
        .containsEntry("heartbeatUpdatedRows", 0)
        .containsEntry("ready", false)
        .containsEntry("rebuildStatus", "blocked");
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(adminClient.targetJdbcUrls).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  private OrganizationProvisioningDatabaseRebuildPlanService service(
      RebuildPlanJdbcTemplate jdbcTemplate) {
    return service(jdbcTemplate, new FakeDatabaseAdminClient());
  }

  private OrganizationProvisioningDatabaseRebuildPlanService service(
      RebuildPlanJdbcTemplate jdbcTemplate, OrganizationProvisioningDatabaseAdminClient adminClient) {
    AppProperties appProperties = new AppProperties();
    TenantDataSourceProperties tenantProperties = new TenantDataSourceProperties();
    tenantProperties.setDefaultJdbcUrl(
        "mysql://root:pwd@127.0.0.1:3306/magic?serverTimezone=Asia/Shanghai");
    tenantProperties.setPublicJdbcUrl(
        "mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    MockEnvironment environment =
        new MockEnvironment()
            .withProperty(
                "spring.datasource.center.jdbc-url",
                "mysql://root:pwd@127.0.0.1:3306/magic_center?serverTimezone=Asia/Shanghai");
    return new OrganizationProvisioningDatabaseRebuildPlanService(
        jdbcTemplate, appProperties, tenantProperties, environment, adminClient);
  }

  private static final class FakeDatabaseAdminClient
      implements OrganizationProvisioningDatabaseAdminClient {

    private final List<List<String>> ddlBatches = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public List<String> rebuildDatabase(String targetJdbcUrl, List<String> ddlStatements) {
      targetJdbcUrls.add(targetJdbcUrl);
      ddlBatches.add(ddlStatements);
      return List.copyOf(ddlStatements);
    }
  }

  private static final class RebuildPlanJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final List<String> queries = new ArrayList<>();
    private final boolean tableReady;
    private int updateCount;

    private RebuildPlanJdbcTemplate(boolean tableReady) {
      this.tableReady = tableReady;
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      if (sql.contains("information_schema.tables")) {
        return requiredType.cast(tableReady ? 1L : 0L);
      }
      return requiredType.cast(0L);
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      queries.add(sql);
      long jobId = ((Number) args[0]).longValue();
      String workerId = String.valueOf(args[1]);
      return (List<T>)
          jobs.stream()
              .filter(job -> job.id == jobId)
              .filter(job -> workerId.equals(job.lockOwner))
              .filter(job -> "provisioning".equals(job.status))
              .filter(job -> "rebuilding_database".equals(job.step))
              .map(job -> map(rowMapper, resultSet(job)))
              .toList();
    }

    @Override
    public int update(String sql, Object... args) {
      updateCount++;
      long jobId = ((Number) args[2]).longValue();
      String workerId = String.valueOf(args[3]);
      JobFixture job =
          jobs.stream()
              .filter(row -> row.id == jobId)
              .filter(row -> workerId.equals(row.lockOwner))
              .filter(row -> "provisioning".equals(row.status))
              .filter(row -> "rebuilding_database".equals(row.step))
              .findFirst()
              .orElse(null);
      if (job == null) {
        return 0;
      }
      job.heartbeatAt = ((Timestamp) args[0]).toInstant();
      job.updateTime = ((Timestamp) args[1]).toInstant();
      return 1;
    }

    private <T> T map(RowMapper<T> rowMapper, ResultSet resultSet) {
      try {
        return rowMapper.mapRow(resultSet, 0);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private ResultSet resultSet(JobFixture job) {
      ResultSet rs = mock(ResultSet.class);
      try {
        when(rs.getLong("id")).thenReturn(job.id);
        when(rs.getString("source_customer_id")).thenReturn(job.sourceCustomerId);
        when(rs.getString("target_customer_id")).thenReturn(job.targetCustomerId);
        when(rs.getString("target_db_name")).thenReturn(job.targetDbName);
        when(rs.getString("status")).thenReturn(job.status);
        when(rs.getString("step")).thenReturn(job.step);
        when(rs.getString("lock_owner")).thenReturn(job.lockOwner);
        when(rs.getTimestamp("locked_at")).thenReturn(timestamp(job.lockedAt));
        when(rs.getTimestamp("heartbeat_at")).thenReturn(timestamp(job.heartbeatAt));
        when(rs.getTimestamp("update_time")).thenReturn(timestamp(job.updateTime));
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
      return rs;
    }

    private Timestamp timestamp(Instant instant) {
      return instant == null ? null : Timestamp.from(instant);
    }
  }

  private static final class JobFixture {

    private Instant heartbeatAt = Instant.parse("2026-07-02T09:10:00Z");
    private final long id = 31L;
    private final Instant lockedAt = Instant.parse("2026-07-02T09:00:00Z");
    private final String lockOwner = "worker-a";
    private final String sourceCustomerId = "public";
    private final String status = "provisioning";
    private Instant updateTime = Instant.parse("2026-07-02T09:10:00Z");
    private String step = "rebuilding_database";
    private String targetCustomerId = "org001";
    private String targetDbName = "tenant_org001";

    private static JobFixture valid() {
      return new JobFixture();
    }
  }
}
