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

/** 组织空间开通基础数据复制预览测试；只读 app_versions 计划，不写目标租户库。 */
class OrganizationProvisioningBaseDataCopyPlanServiceTest {

  @Test
  void previewReturnsTableNotReadyWhenProvisioningTableMissing() {
    BaseDataJdbcTemplate jdbcTemplate = new BaseDataJdbcTemplate(false);
    FakeBaseDataPreviewClient previewClient = new FakeBaseDataPreviewClient();

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewBaseDataTables(31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("baseDataCopyStatus", "table_not_ready")
        .containsEntry("executeCopy", false)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", false)
        .containsEntry("tableReady", false)
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("workerId", "worker-a");
    assertThat(result.get("plannedCopyTables")).isEqualTo(List.of("app_versions"));
    assertThat(jdbcTemplate.queries).isEmpty();
    assertThat(previewClient.sourceJdbcUrls).isEmpty();
  }

  @Test
  void previewReportsLeaseLostWhenStepDoesNotMatch() {
    BaseDataJdbcTemplate jdbcTemplate = new BaseDataJdbcTemplate(true);
    JobFixture job = JobFixture.valid();
    job.step = "cloning_schema";
    jdbcTemplate.jobs.add(job);
    FakeBaseDataPreviewClient previewClient = new FakeBaseDataPreviewClient();

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewBaseDataTables(31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("baseDataCopyStatus", "lease_lost")
        .containsEntry("leaseValid", false)
        .containsEntry("tableReady", true);
    assertThat(result.get("blockedReasons"))
        .isEqualTo(List.of("任务不存在、租约已丢失或步骤不是 seeding_base_data"));
    assertThat(previewClient.sourceJdbcUrls).isEmpty();
  }

  @Test
  void previewReturnsReadyBaseDataPlanWithoutExecutingCopy() {
    BaseDataJdbcTemplate jdbcTemplate = new BaseDataJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeBaseDataPreviewClient previewClient = new FakeBaseDataPreviewClient();
    previewClient.inspection =
        new OrganizationProvisioningBaseDataCopyPreviewClient.BaseDataCopyInspection(
            List.of(),
            List.of(),
            List.of(
                new OrganizationProvisioningBaseDataCopyPreviewClient.BaseDataTablePlan(
                    "app_versions", 3, 1)));

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewBaseDataTables(31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("baseDataCopyStatus", "ready")
        .containsEntry("executeCopy", false)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("nextExplicitSwitch", "executeBaseDataTables")
        .containsEntry("requiredStep", "seeding_base_data")
        .containsEntry("sourceCustomerId", "public")
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry("targetWriteExecuted", false);
    assertThat(result.get("plannedCopyTables")).isEqualTo(List.of("app_versions"));
    assertThat(result.get("tablePlans"))
        .isEqualTo(
            List.of(
                Map.of(
                    "sourceRowsToCopy",
                    3L,
                    "tableName",
                    "app_versions",
                    "targetExistingRows",
                    1L)));
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
    assertThat(previewClient.sourceJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    assertThat(previewClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(previewClient.tableNames).containsExactly(List.of("app_versions"));
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void previewBlocksWhenRequiredBaseDataTablesAreMissing() {
    BaseDataJdbcTemplate jdbcTemplate = new BaseDataJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeBaseDataPreviewClient previewClient = new FakeBaseDataPreviewClient();
    previewClient.inspection =
        new OrganizationProvisioningBaseDataCopyPreviewClient.BaseDataCopyInspection(
            List.of("app_versions"),
            List.of("app_versions"),
            List.of(
                new OrganizationProvisioningBaseDataCopyPreviewClient.BaseDataTablePlan(
                    "app_versions", 0, 0)));

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewBaseDataTables(31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("baseDataCopyStatus", "blocked")
        .containsEntry("leaseValid", true)
        .containsEntry("targetWriteExecuted", false);
    assertThat(result.get("missingSourceTables")).isEqualTo(List.of("app_versions"));
    assertThat(result.get("missingTargetTables")).isEqualTo(List.of("app_versions"));
    assertThat(result.get("blockedReasons"))
        .isEqualTo(List.of("基础数据复制所需表未就绪，请先确认 schema clone 是否完整"));
    assertThat(result.get("plannedCopyTables")).isEqualTo(List.of("app_versions"));
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void previewRequiresJobIdAndWorkerId() {
    OrganizationProvisioningBaseDataCopyPlanService service =
        service(new BaseDataJdbcTemplate(true), new FakeBaseDataPreviewClient());

    assertThatThrownBy(() -> service.previewBaseDataTables(0L, "worker-a", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通基础数据复制预览缺少 jobId");
    assertThatThrownBy(() -> service.previewBaseDataTables(31L, " ", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通基础数据复制预览缺少 workerId");
  }

  @Test
  void executeCopiesBaseDataTablesOnlyWhenConfirmTargetDbNameMatches() {
    BaseDataJdbcTemplate jdbcTemplate = new BaseDataJdbcTemplate(true);
    jdbcTemplate.updateRows = 1;
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeBaseDataPreviewClient previewClient = new FakeBaseDataPreviewClient();
    FakeBaseDataCopyClient copyClient = new FakeBaseDataCopyClient();

    Map<String, Object> result =
        service(jdbcTemplate, previewClient, copyClient)
            .executeBaseDataTables(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-02T10:25:00Z"));

    assertThat(result)
        .containsEntry("baseDataCopyStatus", "success")
        .containsEntry("baseDataTablesCopied", true)
        .containsEntry("baseDataTablesExecuted", true)
        .containsEntry("confirmTargetDbName", "tenant_org001")
        .containsEntry("executeCopy", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("nextExplicitSwitch", "migrateOrganizationRolesAndMembers")
        .containsEntry("targetWriteExecuted", true);
    assertThat(result.get("copiedTables")).isEqualTo(List.of("app_versions"));
    @SuppressWarnings("unchecked")
    Map<String, Object> copyResult = (Map<String, Object>) result.get("copyResult");
    assertThat(copyResult)
        .containsEntry("appVersionRowsCopied", 3L)
        .containsEntry("copiedChunks", 1L)
        .containsEntry("totalRowsCopied", 3L);
    assertThat(copyClient.sourceJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    assertThat(copyClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(copyClient.tableNames).containsExactly(List.of("app_versions"));
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-02T10:25:00Z"));
  }

  @Test
  void executeDoesNotCopyWhenConfirmTargetDbNameMismatches() {
    BaseDataJdbcTemplate jdbcTemplate = new BaseDataJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeBaseDataCopyClient copyClient = new FakeBaseDataCopyClient();

    Map<String, Object> result =
        service(jdbcTemplate, new FakeBaseDataPreviewClient(), copyClient)
            .executeBaseDataTables(
                31L, "worker-a", "wrong_db", Instant.parse("2026-07-02T10:25:00Z"));

    assertThat(result)
        .containsEntry("baseDataCopyStatus", "blocked")
        .containsEntry("baseDataTablesCopied", false)
        .containsEntry("baseDataTablesExecuted", false)
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("executeCopy", false)
        .containsEntry("targetWriteExecuted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(copyClient.sourceJdbcUrls).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void executeStopsWhenHeartbeatLeaseIsLostDuringCopy() {
    BaseDataJdbcTemplate jdbcTemplate = new BaseDataJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.updateRows = 0;
    FakeBaseDataCopyClient copyClient = new FakeBaseDataCopyClient();

    assertThatThrownBy(
            () ->
                service(jdbcTemplate, new FakeBaseDataPreviewClient(), copyClient)
                    .executeBaseDataTables(
                        31L,
                        "worker-a",
                        "tenant_org001",
                        Instant.parse("2026-07-02T10:25:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessage("租户开通任务租约已失效，停止基础数据复制");
    assertThat(copyClient.sourceJdbcUrls).hasSize(1);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
  }

  private OrganizationProvisioningBaseDataCopyPlanService service(
      BaseDataJdbcTemplate jdbcTemplate,
      OrganizationProvisioningBaseDataCopyPreviewClient previewClient) {
    return service(jdbcTemplate, previewClient, new FakeBaseDataCopyClient());
  }

  private OrganizationProvisioningBaseDataCopyPlanService service(
      BaseDataJdbcTemplate jdbcTemplate,
      OrganizationProvisioningBaseDataCopyPreviewClient previewClient,
      OrganizationProvisioningBaseDataCopyClient copyClient) {
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
    return new OrganizationProvisioningBaseDataCopyPlanService(
        jdbcTemplate, appProperties, tenantProperties, environment, copyClient, previewClient);
  }

  private static final class FakeBaseDataPreviewClient
      implements OrganizationProvisioningBaseDataCopyPreviewClient {

    private BaseDataCopyInspection inspection =
        new BaseDataCopyInspection(
            List.of(),
            List.of(),
            List.of(new BaseDataTablePlan("app_versions", 1, 0)));
    private final List<String> sourceJdbcUrls = new ArrayList<>();
    private final List<List<String>> tableNames = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public BaseDataCopyInspection inspect(
        String sourceJdbcUrl, String targetJdbcUrl, List<String> tableNames) {
      sourceJdbcUrls.add(sourceJdbcUrl);
      targetJdbcUrls.add(targetJdbcUrl);
      this.tableNames.add(List.copyOf(tableNames));
      return inspection;
    }
  }

  private static final class FakeBaseDataCopyClient
      implements OrganizationProvisioningBaseDataCopyClient {

    private final List<String> sourceJdbcUrls = new ArrayList<>();
    private final List<List<String>> tableNames = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public BaseDataCopyResult copyBaseDataTables(
        String sourceJdbcUrl,
        String targetJdbcUrl,
        List<String> tableNames,
        java.util.function.IntSupplier heartbeatAfterEachCopiedChunk) {
      sourceJdbcUrls.add(sourceJdbcUrl);
      targetJdbcUrls.add(targetJdbcUrl);
      this.tableNames.add(List.copyOf(tableNames));
      heartbeatAfterEachCopiedChunk.getAsInt();
      return new BaseDataCopyResult(List.of("app_versions"), 3, 1, 3);
    }
  }

  private static final class BaseDataJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final List<String> queries = new ArrayList<>();
    private final boolean tableReady;
    private int updateCount;
    private int updateRows;

    private BaseDataJdbcTemplate(boolean tableReady) {
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
              .filter(job -> "seeding_base_data".equals(job.step))
              .map(job -> map(rowMapper, resultSet(job)))
              .toList();
    }

    @Override
    public int update(String sql, Object... args) {
      updateCount++;
      if (updateRows <= 0) {
        return 0;
      }
      long jobId = ((Number) args[2]).longValue();
      String workerId = String.valueOf(args[3]);
      JobFixture job =
          jobs.stream()
              .filter(row -> row.id == jobId)
              .filter(row -> workerId.equals(row.lockOwner))
              .filter(row -> "provisioning".equals(row.status))
              .filter(row -> "seeding_base_data".equals(row.step))
              .findFirst()
              .orElse(null);
      if (job == null) {
        return 0;
      }
      job.heartbeatAt = ((Timestamp) args[0]).toInstant();
      job.updateTime = ((Timestamp) args[1]).toInstant();
      return updateRows;
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

    private Instant heartbeatAt = Instant.parse("2026-07-02T10:15:00Z");
    private final long id = 31L;
    private final Instant lockedAt = Instant.parse("2026-07-02T10:00:00Z");
    private final String lockOwner = "worker-a";
    private final String sourceCustomerId = "public";
    private final String status = "provisioning";
    private Instant updateTime = Instant.parse("2026-07-02T10:15:00Z");
    private String step = "seeding_base_data";
    private String targetCustomerId = "org001";
    private String targetDbName = "tenant_org001";

    private static JobFixture valid() {
      return new JobFixture();
    }
  }
}
