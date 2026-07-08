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

/** 组织空间开通 Super 权限闭包复制预览测试；只读计划，不写目标租户库。 */
class OrganizationProvisioningSuperPermissionClosurePlanServiceTest {

  @Test
  void previewReturnsTableNotReadyWhenProvisioningTableMissing() {
    SuperClosureJdbcTemplate jdbcTemplate = new SuperClosureJdbcTemplate(false);
    FakeSuperClosurePreviewClient previewClient = new FakeSuperClosurePreviewClient();

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewSuperPermissionClosure(
                31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("executeCopy", false)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", false)
        .containsEntry("superPermissionClosureStatus", "table_not_ready")
        .containsEntry("tableReady", false)
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("workerId", "worker-a");
    assertThat((List<?>) result.get("plannedCopyTables")).isEmpty();
    assertThat(jdbcTemplate.queries).isEmpty();
    assertThat(previewClient.sourceJdbcUrls).isEmpty();
  }

  @Test
  void previewReportsLeaseLostWhenStepDoesNotMatch() {
    SuperClosureJdbcTemplate jdbcTemplate = new SuperClosureJdbcTemplate(true);
    JobFixture job = JobFixture.valid();
    job.step = "cloning_schema";
    jdbcTemplate.jobs.add(job);
    FakeSuperClosurePreviewClient previewClient = new FakeSuperClosurePreviewClient();

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewSuperPermissionClosure(
                31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("leaseValid", false)
        .containsEntry("superPermissionClosureStatus", "lease_lost")
        .containsEntry("tableReady", true);
    assertThat(result.get("blockedReasons"))
        .isEqualTo(List.of("任务不存在、租约已丢失或步骤不是 seeding_base_data"));
    assertThat(previewClient.sourceJdbcUrls).isEmpty();
  }

  @Test
  void previewReturnsReadyClosurePlanWithoutExecutingCopy() {
    SuperClosureJdbcTemplate jdbcTemplate = new SuperClosureJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSuperClosurePreviewClient previewClient = new FakeSuperClosurePreviewClient();
    previewClient.inspection =
        new OrganizationProvisioningSuperPermissionClosurePreviewClient
            .SuperPermissionClosureInspection(
            List.of(),
            List.of(),
            new OrganizationProvisioningSuperPermissionClosurePreviewClient
                .SourceSuperPermissionClosure(4, 6, 5, 8, 7, 1, 4),
            new OrganizationProvisioningSuperPermissionClosurePreviewClient
                .TargetSuperPermissionClosure(0, 0, 0, 0, 0, false, 0));

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewSuperPermissionClosure(
                31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("executeCopy", false)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("nextExplicitSwitch", "executeSuperPermissionClosure")
        .containsEntry("requiredStep", "seeding_base_data")
        .containsEntry("sourceCustomerId", "public")
        .containsEntry("superPermissionClosureStatus", "ready")
        .containsEntry("targetAlreadyHasSuper", false)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry("targetWriteExecuted", false);
    assertThat(result.get("plannedCopyTables"))
        .isEqualTo(List.of("menu", "menu_meta", "role", "code", "role_menu", "role_code"));
    @SuppressWarnings("unchecked")
    Map<String, Object> sourceSuperClosure =
        (Map<String, Object>) result.get("sourceSuperClosure");
    assertThat(sourceSuperClosure)
        .containsEntry("codeRowsToCopy", 4L)
        .containsEntry("menuMetaRowsToCopy", 6L)
        .containsEntry("menuRowsToCopy", 5L)
        .containsEntry("roleCodeRowsToCopy", 8L)
        .containsEntry("roleMenuRowsToCopy", 7L)
        .containsEntry("superRoleId", 1L)
        .containsEntry("uniqueCodeIdsToCopy", 4L);
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
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void previewBlocksWhenRequiredClosureTablesAreMissing() {
    SuperClosureJdbcTemplate jdbcTemplate = new SuperClosureJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSuperClosurePreviewClient previewClient = new FakeSuperClosurePreviewClient();
    previewClient.inspection =
        new OrganizationProvisioningSuperPermissionClosurePreviewClient
            .SuperPermissionClosureInspection(
            List.of("role_code"),
            List.of("menu_meta"),
            new OrganizationProvisioningSuperPermissionClosurePreviewClient
                .SourceSuperPermissionClosure(0, 0, 0, 0, 0, 0, 0),
            new OrganizationProvisioningSuperPermissionClosurePreviewClient
                .TargetSuperPermissionClosure(0, 0, 0, 0, 0, false, 0));

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewSuperPermissionClosure(
                31L, "worker-a", Instant.parse("2026-07-02T10:20:00Z"));

    assertThat(result)
        .containsEntry("leaseValid", true)
        .containsEntry("superPermissionClosureStatus", "blocked")
        .containsEntry("targetWriteExecuted", false);
    assertThat(result.get("missingSourceTables")).isEqualTo(List.of("role_code"));
    assertThat(result.get("missingTargetTables")).isEqualTo(List.of("menu_meta"));
    assertThat(result.get("blockedReasons"))
        .isEqualTo(List.of("Super 权限闭包复制所需表未就绪，请先确认 schema clone 是否完整"));
    assertThat((List<?>) result.get("plannedCopyTables")).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void previewRequiresJobIdAndWorkerId() {
    OrganizationProvisioningSuperPermissionClosurePlanService service =
        service(new SuperClosureJdbcTemplate(true), new FakeSuperClosurePreviewClient());

    assertThatThrownBy(
            () -> service.previewSuperPermissionClosure(0L, "worker-a", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通 Super 权限闭包预览缺少 jobId");
    assertThatThrownBy(
            () -> service.previewSuperPermissionClosure(31L, " ", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通 Super 权限闭包预览缺少 workerId");
  }

  @Test
  void executeCopiesClosureOnlyWhenConfirmTargetDbNameMatches() {
    SuperClosureJdbcTemplate jdbcTemplate = new SuperClosureJdbcTemplate(true);
    jdbcTemplate.updateRows = 1;
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSuperClosurePreviewClient previewClient = new FakeSuperClosurePreviewClient();
    FakeSuperClosureCopyClient copyClient = new FakeSuperClosureCopyClient();

    Map<String, Object> result =
        service(jdbcTemplate, previewClient, copyClient)
            .executeSuperPermissionClosure(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-02T10:25:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "tenant_org001")
        .containsEntry("executeCopy", true)
        .containsEntry("heartbeatUpdatedRows", 6)
        .containsEntry("nextExplicitSwitch", "executeBaseDataTables")
        .containsEntry("superPermissionClosureCopied", true)
        .containsEntry("superPermissionClosureExecuted", true)
        .containsEntry("superPermissionClosureStatus", "success")
        .containsEntry("targetWriteExecuted", true);
    assertThat(result.get("copiedTables"))
        .isEqualTo(List.of("menu", "menu_meta", "role", "code", "role_menu", "role_code"));
    @SuppressWarnings("unchecked")
    Map<String, Object> copyResult = (Map<String, Object>) result.get("copyResult");
    assertThat(copyResult)
        .containsEntry("codeRowsCopied", 4L)
        .containsEntry("foreignKeyChecksDisabled", true)
        .containsEntry("foreignKeyChecksRestored", true)
        .containsEntry("menuMetaRowsCopied", 6L)
        .containsEntry("menuRowsCopied", 5L)
        .containsEntry("roleCodeRowsCopied", 8L)
        .containsEntry("roleMenuRowsCopied", 7L)
        .containsEntry("roleRowsCopied", 1L)
        .containsEntry("superRoleId", 1L)
        .containsEntry("totalRowsCopied", 31L);
    assertThat(copyClient.sourceJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    assertThat(copyClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(jdbcTemplate.updateCount).isEqualTo(6);
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-02T10:25:00Z"));
  }

  @Test
  void executeDoesNotCopyWhenConfirmTargetDbNameMismatches() {
    SuperClosureJdbcTemplate jdbcTemplate = new SuperClosureJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    FakeSuperClosureCopyClient copyClient = new FakeSuperClosureCopyClient();

    Map<String, Object> result =
        service(jdbcTemplate, new FakeSuperClosurePreviewClient(), copyClient)
            .executeSuperPermissionClosure(
                31L, "worker-a", "wrong_db", Instant.parse("2026-07-02T10:25:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("executeCopy", false)
        .containsEntry("superPermissionClosureCopied", false)
        .containsEntry("superPermissionClosureExecuted", false)
        .containsEntry("superPermissionClosureStatus", "blocked")
        .containsEntry("targetWriteExecuted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(copyClient.sourceJdbcUrls).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void executeStopsWhenHeartbeatLeaseIsLostDuringCopy() {
    SuperClosureJdbcTemplate jdbcTemplate = new SuperClosureJdbcTemplate(true);
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.updateRows = 0;
    FakeSuperClosureCopyClient copyClient = new FakeSuperClosureCopyClient();

    assertThatThrownBy(
            () ->
                service(jdbcTemplate, new FakeSuperClosurePreviewClient(), copyClient)
                    .executeSuperPermissionClosure(
                        31L,
                        "worker-a",
                        "tenant_org001",
                        Instant.parse("2026-07-02T10:25:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessage("租户开通任务租约已失效，停止 Super 权限闭包复制");
    assertThat(copyClient.sourceJdbcUrls).hasSize(1);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
  }

  private OrganizationProvisioningSuperPermissionClosurePlanService service(
      SuperClosureJdbcTemplate jdbcTemplate,
      OrganizationProvisioningSuperPermissionClosurePreviewClient previewClient) {
    return service(jdbcTemplate, previewClient, new FakeSuperClosureCopyClient());
  }

  private OrganizationProvisioningSuperPermissionClosurePlanService service(
      SuperClosureJdbcTemplate jdbcTemplate,
      OrganizationProvisioningSuperPermissionClosurePreviewClient previewClient,
      OrganizationProvisioningSuperPermissionClosureCopyClient copyClient) {
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
    return new OrganizationProvisioningSuperPermissionClosurePlanService(
        jdbcTemplate, appProperties, tenantProperties, environment, copyClient, previewClient);
  }

  private static final class FakeSuperClosurePreviewClient
      implements OrganizationProvisioningSuperPermissionClosurePreviewClient {

    private SuperPermissionClosureInspection inspection =
        new SuperPermissionClosureInspection(
            List.of(),
            List.of(),
            new SourceSuperPermissionClosure(1, 1, 1, 1, 1, 1, 1),
            new TargetSuperPermissionClosure(0, 0, 0, 0, 0, false, 0));
    private final List<String> sourceJdbcUrls = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public SuperPermissionClosureInspection inspect(String sourceJdbcUrl, String targetJdbcUrl) {
      sourceJdbcUrls.add(sourceJdbcUrl);
      targetJdbcUrls.add(targetJdbcUrl);
      return inspection;
    }
  }

  private static final class FakeSuperClosureCopyClient
      implements OrganizationProvisioningSuperPermissionClosureCopyClient {

    private final List<String> sourceJdbcUrls = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public SuperPermissionClosureCopyResult copySuperPermissionClosure(
        String sourceJdbcUrl, String targetJdbcUrl, java.util.function.IntSupplier heartbeatAfterEachCopiedTable) {
      sourceJdbcUrls.add(sourceJdbcUrl);
      targetJdbcUrls.add(targetJdbcUrl);
      for (int i = 0; i < 6; i++) {
        heartbeatAfterEachCopiedTable.getAsInt();
      }
      return new SuperPermissionClosureCopyResult(
          List.of("menu", "menu_meta", "role", "code", "role_menu", "role_code"),
          4,
          true,
          true,
          6,
          5,
          8,
          7,
          1,
          1,
          31);
    }
  }

  private static final class SuperClosureJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final List<String> queries = new ArrayList<>();
    private final boolean tableReady;
    private int updateCount;
    private int updateRows;

    private SuperClosureJdbcTemplate(boolean tableReady) {
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
