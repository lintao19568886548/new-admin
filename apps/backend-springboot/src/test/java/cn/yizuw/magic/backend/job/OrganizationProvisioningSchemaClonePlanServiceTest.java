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
import java.util.function.IntSupplier;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.env.MockEnvironment;

/** 组织空间开通 schema clone 预览测试；只读模板结构，不执行目标库 CREATE TABLE。 */
class OrganizationProvisioningSchemaClonePlanServiceTest {

  @Test
  void previewSchemaCloneReturnsTableNotReadyWhenProvisioningTableMissing() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(false);

    Map<String, Object> result =
        service(jdbcTemplate, new FakeSchemaMetadataClient())
            .previewSchemaClone(31L, "worker-a", 20, Instant.parse("2026-07-02T09:50:00Z"));

    assertThat(result)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", false)
        .containsEntry("schemaCloneStatus", "table_not_ready")
        .containsEntry("tableReady", false)
        .containsEntry("workerId", "worker-a");
    assertThat((List<?>) result.get("tablePlans")).isEmpty();
    assertThat(jdbcTemplate.queries).isEmpty();
  }

  @Test
  void previewSchemaCloneReturnsReadyCreateTablePlanWithoutExecutingDdl() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSchemaMetadataClient metadataClient = new FakeSchemaMetadataClient();
    metadataClient.inspection =
        new OrganizationProvisioningSchemaMetadataClient.SchemaInspection(
            List.of(
                new OrganizationProvisioningSchemaMetadataClient.TableSchema(
                    "user",
                    """
                    CREATE TABLE `user` (
                      `id` bigint NOT NULL AUTO_INCREMENT,
                      PRIMARY KEY (`id`)
                    ) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4
                    """),
                new OrganizationProvisioningSchemaMetadataClient.TableSchema(
                    "role",
                    "CREATE TABLE `role` (`id` bigint NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB")),
            2,
            false);

    Map<String, Object> result =
        service(jdbcTemplate, metadataClient)
            .previewSchemaClone(31L, "worker-a", 20, Instant.parse("2026-07-02T09:50:00Z"));

    assertThat(result)
        .containsEntry("dataCopyStarted", false)
        .containsEntry("executeDdl", false)
        .containsEntry("foreignKeyChecksDisabledInPreview", false)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("nextExplicitSwitch", "executeSchemaClone")
        .containsEntry("previewedTableCount", 2)
        .containsEntry("requiredStep", "cloning_schema")
        .containsEntry("schemaCloneStatus", "ready")
        .containsEntry("sourceCustomerId", "public")
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry("targetDdlExecuted", false)
        .containsEntry("totalBaseTableCount", 2);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> tablePlans = (List<Map<String, Object>>) result.get("tablePlans");
    assertThat(tablePlans).hasSize(2);
    assertThat(tablePlans.get(0))
        .containsEntry("tableName", "user")
        .containsEntry("sourceAutoIncrementRemoved", true);
    assertThat((String) tablePlans.get(0).get("createTableSqlPreview"))
        .startsWith("CREATE TABLE IF NOT EXISTS `user`")
        .doesNotContain("AUTO_INCREMENT=18");
    assertThat((String) tablePlans.get(1).get("createTableSqlPreview"))
        .startsWith("CREATE TABLE IF NOT EXISTS `role`");
    assertThat(metadataClient.templateJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    assertThat(metadataClient.tableLimits).containsExactly(20);
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void previewSchemaCloneHonorsTableLimitAndReportsLimitedPlan() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSchemaMetadataClient metadataClient = new FakeSchemaMetadataClient();
    metadataClient.inspection =
        new OrganizationProvisioningSchemaMetadataClient.SchemaInspection(
            List.of(
                new OrganizationProvisioningSchemaMetadataClient.TableSchema(
                    "user", "CREATE TABLE `user` (`id` bigint NOT NULL)")),
            3,
            true);

    Map<String, Object> result =
        service(jdbcTemplate, metadataClient)
            .previewSchemaClone(31L, "worker-a", 1, Instant.parse("2026-07-02T09:50:00Z"));

    assertThat(result)
        .containsEntry("limited", true)
        .containsEntry("previewedTableCount", 1)
        .containsEntry("schemaCloneStatus", "ready")
        .containsEntry("tableLimit", 1)
        .containsEntry("totalBaseTableCount", 3);
    assertThat(metadataClient.tableLimits).containsExactly(1);
  }

  @Test
  void previewSchemaCloneBlocksEmptyTemplateDatabase() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSchemaMetadataClient metadataClient = new FakeSchemaMetadataClient();
    metadataClient.inspection =
        new OrganizationProvisioningSchemaMetadataClient.SchemaInspection(List.of(), 0, false);

    Map<String, Object> result =
        service(jdbcTemplate, metadataClient)
            .previewSchemaClone(31L, "worker-a", 20, Instant.parse("2026-07-02T09:50:00Z"));

    assertThat(result)
        .containsEntry("previewedTableCount", 0)
        .containsEntry("schemaCloneStatus", "blocked")
        .containsEntry("totalBaseTableCount", 0);
    assertThat(result.get("blockedReasons")).isEqualTo(List.of("模板库没有可复制的基础表结构"));
  }

  @Test
  void previewSchemaCloneReportsLeaseLostWhenStepDoesNotMatch() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    JobFixture job = JobFixture.valid();
    job.step = "rebuilding_database";
    jdbcTemplate.jobs.add(job);

    Map<String, Object> result =
        service(jdbcTemplate, new FakeSchemaMetadataClient())
            .previewSchemaClone(31L, "worker-a", 20, Instant.parse("2026-07-02T09:50:00Z"));

    assertThat(result)
        .containsEntry("leaseValid", false)
        .containsEntry("schemaCloneStatus", "lease_lost")
        .containsEntry("tableReady", true);
    assertThat(result.get("blockedReasons"))
        .isEqualTo(List.of("任务不存在、租约已丢失或步骤不是 cloning_schema"));
  }

  @Test
  void previewSchemaCloneBlocksProtectedTargetDatabase() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    JobFixture job = JobFixture.valid();
    job.targetCustomerId = "public";
    job.targetDbName = "magic_center";
    jdbcTemplate.jobs.add(job);
    FakeSchemaMetadataClient metadataClient = new FakeSchemaMetadataClient();

    Map<String, Object> result =
        service(jdbcTemplate, metadataClient)
            .previewSchemaClone(31L, "worker-a", 20, Instant.parse("2026-07-02T09:50:00Z"));

    assertThat(result).containsEntry("schemaCloneStatus", "blocked");
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons)
        .contains("拒绝把 public 作为自动开通目标租户", "拒绝写入受保护数据库: magic_center");
    assertThat(metadataClient.templateJdbcUrls).isEmpty();
  }

  @Test
  void previewSchemaCloneRequiresJobIdAndWorkerId() {
    OrganizationProvisioningSchemaClonePlanService service =
        service(new SchemaCloneJdbcTemplate(true), new FakeSchemaMetadataClient());

    assertThatThrownBy(() -> service.previewSchemaClone(0L, "worker-a", 20, Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通 schema clone 预览缺少 jobId");
    assertThatThrownBy(() -> service.previewSchemaClone(31L, " ", 20, Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通 schema clone 预览缺少 workerId");
  }

  @Test
  void executeSchemaCloneCreatesTablesOnlyWhenConfirmTargetDbNameMatches() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSchemaMetadataClient metadataClient = new FakeSchemaMetadataClient();
    metadataClient.inspection =
        new OrganizationProvisioningSchemaMetadataClient.SchemaInspection(
            List.of(
                new OrganizationProvisioningSchemaMetadataClient.TableSchema(
                    "user", "CREATE TABLE `user` (`id` bigint NOT NULL)"),
                new OrganizationProvisioningSchemaMetadataClient.TableSchema(
                    "role", "CREATE TABLE `role` (`id` bigint NOT NULL)")),
            2,
            false);
    FakeSchemaDdlClient ddlClient = new FakeSchemaDdlClient();

    Map<String, Object> result =
        service(jdbcTemplate, metadataClient, ddlClient)
            .executeSchemaClone(
                31L,
                "worker-a",
                "tenant_org001",
                20,
                Instant.parse("2026-07-02T10:00:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "tenant_org001")
        .containsEntry("executeDdl", true)
        .containsEntry("heartbeatUpdatedRows", 2)
        .containsEntry("nextExplicitSwitch", "markSeedingBaseData")
        .containsEntry("schemaCloneExecuted", true)
        .containsEntry("schemaCloneStatus", "success")
        .containsEntry("targetDdlExecuted", true)
        .containsEntry("targetDdlExecutedCount", 2);
    assertThat(ddlClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(ddlClient.ddlBatches).singleElement().asList().hasSize(2);
    assertThat(jdbcTemplate.updateCount).isEqualTo(2);
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("cloning_schema");
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-02T10:00:00Z"));
  }

  @Test
  void executeSchemaCloneDoesNotRunWhenConfirmTargetDbNameMismatches() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSchemaDdlClient ddlClient = new FakeSchemaDdlClient();

    Map<String, Object> result =
        service(jdbcTemplate, new FakeSchemaMetadataClient(), ddlClient)
            .executeSchemaClone(
                31L, "worker-a", "wrong_db", 20, Instant.parse("2026-07-02T10:00:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("executeDdl", false)
        .containsEntry("schemaCloneExecuted", false)
        .containsEntry("schemaCloneStatus", "blocked")
        .containsEntry("targetDdlExecuted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(ddlClient.targetJdbcUrls).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void executeSchemaCloneRejectsLimitedPlanToAvoidPartialSchema() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSchemaMetadataClient metadataClient = new FakeSchemaMetadataClient();
    metadataClient.inspection =
        new OrganizationProvisioningSchemaMetadataClient.SchemaInspection(
            List.of(
                new OrganizationProvisioningSchemaMetadataClient.TableSchema(
                    "user", "CREATE TABLE `user` (`id` bigint NOT NULL)")),
            3,
            true);
    FakeSchemaDdlClient ddlClient = new FakeSchemaDdlClient();

    Map<String, Object> result =
        service(jdbcTemplate, metadataClient, ddlClient)
            .executeSchemaClone(
                31L,
                "worker-a",
                "tenant_org001",
                1,
                Instant.parse("2026-07-02T10:00:00Z"));

    assertThat(result)
        .containsEntry("executeDdl", false)
        .containsEntry("limited", true)
        .containsEntry("schemaCloneExecuted", false)
        .containsEntry("schemaCloneStatus", "blocked");
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("schemaTableLimit 小于基础表总数，拒绝执行部分建表");
    assertThat(ddlClient.targetJdbcUrls).isEmpty();
  }

  @Test
  void executeSchemaCloneStopsWhenHeartbeatLeaseIsLost() {
    SchemaCloneJdbcTemplate jdbcTemplate = new SchemaCloneJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.updateRows = 0;
    FakeSchemaMetadataClient metadataClient = new FakeSchemaMetadataClient();
    metadataClient.inspection =
        new OrganizationProvisioningSchemaMetadataClient.SchemaInspection(
            List.of(
                new OrganizationProvisioningSchemaMetadataClient.TableSchema(
                    "user", "CREATE TABLE `user` (`id` bigint NOT NULL)")),
            1,
            false);
    FakeSchemaDdlClient ddlClient = new FakeSchemaDdlClient();

    assertThatThrownBy(
            () ->
                service(jdbcTemplate, metadataClient, ddlClient)
                    .executeSchemaClone(
                        31L,
                        "worker-a",
                        "tenant_org001",
                        20,
                        Instant.parse("2026-07-02T10:00:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessage("租户开通任务租约已失效，停止 schema clone");
    assertThat(ddlClient.targetJdbcUrls).hasSize(1);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
  }

  private OrganizationProvisioningSchemaClonePlanService service(
      SchemaCloneJdbcTemplate jdbcTemplate, OrganizationProvisioningSchemaMetadataClient metadataClient) {
    return service(jdbcTemplate, metadataClient, new FakeSchemaDdlClient());
  }

  private OrganizationProvisioningSchemaClonePlanService service(
      SchemaCloneJdbcTemplate jdbcTemplate,
      OrganizationProvisioningSchemaMetadataClient metadataClient,
      OrganizationProvisioningSchemaDdlClient ddlClient) {
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
    return new OrganizationProvisioningSchemaClonePlanService(
        jdbcTemplate, appProperties, tenantProperties, environment, ddlClient, metadataClient);
  }

  private static final class FakeSchemaMetadataClient
      implements OrganizationProvisioningSchemaMetadataClient {

    private SchemaInspection inspection =
        new SchemaInspection(
            List.of(
                new TableSchema(
                    "user",
                    "CREATE TABLE `user` (`id` bigint NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB")),
            1,
            false);
    private final List<Integer> tableLimits = new ArrayList<>();
    private final List<String> templateJdbcUrls = new ArrayList<>();

    @Override
    public SchemaInspection inspectBaseTableSchema(String templateJdbcUrl, int tableLimit) {
      templateJdbcUrls.add(templateJdbcUrl);
      tableLimits.add(tableLimit);
      return inspection;
    }
  }

  private static final class FakeSchemaDdlClient implements OrganizationProvisioningSchemaDdlClient {

    private final List<List<String>> ddlBatches = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public List<String> createTables(
        String targetJdbcUrl, List<String> createTableStatements, IntSupplier heartbeatAfterEachTable) {
      targetJdbcUrls.add(targetJdbcUrl);
      ddlBatches.add(createTableStatements);
      for (int i = 0; i < createTableStatements.size(); i++) {
        heartbeatAfterEachTable.getAsInt();
      }
      return List.copyOf(createTableStatements);
    }
  }

  private static final class SchemaCloneJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final List<String> queries = new ArrayList<>();
    private final boolean tableReady;
    private int updateRows = 1;
    private int updateCount;

    private SchemaCloneJdbcTemplate(boolean tableReady) {
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
              .filter(job -> "cloning_schema".equals(job.step))
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
              .filter(row -> "cloning_schema".equals(row.step))
              .findFirst()
              .orElse(null);
      if (job == null || updateRows <= 0) {
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

    private Instant heartbeatAt = Instant.parse("2026-07-02T09:45:00Z");
    private final long id = 31L;
    private final Instant lockedAt = Instant.parse("2026-07-02T09:00:00Z");
    private final String lockOwner = "worker-a";
    private final String sourceCustomerId = "public";
    private final String status = "provisioning";
    private Instant updateTime = Instant.parse("2026-07-02T09:45:00Z");
    private String step = "cloning_schema";
    private String targetCustomerId = "org001";
    private String targetDbName = "tenant_org001";

    private static JobFixture valid() {
      return new JobFixture();
    }
  }
}
