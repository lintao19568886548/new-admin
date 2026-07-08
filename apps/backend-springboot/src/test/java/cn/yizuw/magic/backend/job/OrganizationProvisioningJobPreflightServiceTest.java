package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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

/** 组织空间开通预检测试；只用 fake JdbcTemplate，不执行真实建库、复制或状态流转。 */
class OrganizationProvisioningJobPreflightServiceTest {

  @Test
  void preflightClaimedJobsReturnsNotReadyWhenProvisioningTableMissing() {
    PreflightJdbcTemplate jdbcTemplate = new PreflightJdbcTemplate();
    jdbcTemplate.missingTables.add("tenant_provisioning_job");

    Map<String, Object> result =
        service(jdbcTemplate)
            .preflightClaimedJobs(5, "worker-a", null, Instant.parse("2026-07-02T09:00:00Z"));

    assertThat(result)
        .containsEntry("preflightedCount", 0)
        .containsEntry("readyCount", 0L)
        .containsEntry("requestedLimit", 5)
        .containsEntry("tableReady", false);
    assertThat(result.get("items")).isEqualTo(List.of());
    @SuppressWarnings("unchecked")
    Map<String, Boolean> tableStatus = (Map<String, Boolean>) result.get("tableStatus");
    assertThat(tableStatus).containsEntry("tenant_provisioning_job", false);
  }

  @Test
  void preflightClaimedJobsReportsReadyPlanForValidClaimedJob() {
    PreflightJdbcTemplate jdbcTemplate = new PreflightJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.centerUsers.add(new CenterUserFixture(1001L, "public", "owner", 1, "owner"));
    jdbcTemplate.organizations.add(new OrganizationFixture(7L, "public", "active"));
    jdbcTemplate.members.add(new MemberFixture(7L, 1001L, "public", "owner", "public", 1, true));

    Map<String, Object> result =
        service(jdbcTemplate)
            .preflightClaimedJobs(1, "worker-a", 31L, Instant.parse("2026-07-02T09:00:00Z"));

    assertThat(result)
        .containsEntry("preflightedCount", 1)
        .containsEntry("readyCount", 1L)
        .containsEntry("tableReady", true)
        .containsEntry("workerId", "worker-a");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("id", 31L)
        .containsEntry("ready", true)
        .containsEntry("activeMappingTargetCustomerId", "");
    @SuppressWarnings("unchecked")
    Map<String, Object> safety = (Map<String, Object>) items.get(0).get("targetDatabaseSafety");
    assertThat(safety).containsEntry("safe", true).containsEntry("targetDbName", "tenant_org001");
    assertThat((List<?>) items.get(0).get("blockedReasons")).isEmpty();
    @SuppressWarnings("unchecked")
    List<String> plannedSteps = (List<String>) items.get(0).get("plannedSteps");
    assertThat(plannedSteps).contains("stop_before_database_rebuild");
  }

  @Test
  void preflightClaimedJobsBlocksProtectedDatabaseAndNonOwnerInitiator() {
    PreflightJdbcTemplate jdbcTemplate = new PreflightJdbcTemplate();
    JobFixture job = JobFixture.valid();
    job.targetDbName = "magic_center";
    jdbcTemplate.jobs.add(job);
    jdbcTemplate.centerUsers.add(new CenterUserFixture(1001L, "public", "owner", 1, "owner"));
    jdbcTemplate.organizations.add(new OrganizationFixture(7L, "public", "active"));
    jdbcTemplate.members.add(new MemberFixture(7L, 1001L, "public", "member", "public", 1, true));

    Map<String, Object> result =
        service(jdbcTemplate)
            .preflightClaimedJobs(1, "worker-a", 31L, Instant.parse("2026-07-02T09:00:00Z"));

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) items.get(0).get("blockedReasons");
    assertThat(items.get(0)).containsEntry("ready", false);
    assertThat(blockedReasons)
        .contains(
            "拒绝使用受保护数据库作为目标库: magic_center",
            "开通发起人不是组织 active owner: centerUserId=1001, sourceOrgId=7");
  }

  private OrganizationProvisioningJobPreflightService service(PreflightJdbcTemplate jdbcTemplate) {
    AppProperties appProperties = new AppProperties();
    TenantDataSourceProperties tenantProperties = new TenantDataSourceProperties();
    tenantProperties.setDefaultJdbcUrl("mysql://root:pwd@127.0.0.1:3306/magic?serverTimezone=Asia/Shanghai");
    tenantProperties.setPublicJdbcUrl("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    MockEnvironment environment =
        new MockEnvironment()
            .withProperty(
                "spring.datasource.center.jdbc-url",
                "mysql://root:pwd@127.0.0.1:3306/magic_center?serverTimezone=Asia/Shanghai");
    return new OrganizationProvisioningJobPreflightService(
        jdbcTemplate, appProperties, tenantProperties, environment);
  }

  private static final class PreflightJdbcTemplate extends JdbcTemplate {

    private final List<JobFixture> jobs = new ArrayList<>();
    private final List<CenterUserFixture> centerUsers = new ArrayList<>();
    private final List<MemberFixture> members = new ArrayList<>();
    private final List<String> missingTables = new ArrayList<>();
    private final List<OrganizationFixture> organizations = new ArrayList<>();
    private String activeMappingTargetCustomerId = "";

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      if (sql.contains("information_schema.tables")) {
        return requiredType.cast(missingTables.contains(String.valueOf(args[0])) ? 0L : 1L);
      }
      if (sql.contains("member_role = 'owner'")) {
        long sourceOrgId = ((Number) args[0]).longValue();
        String sourceCustomerId = String.valueOf(args[1]);
        long centerUserId = ((Number) args[2]).longValue();
        long count =
            members.stream()
                .filter(member -> member.organizationId == sourceOrgId)
                .filter(member -> sourceCustomerId.equals(member.sourceCustomerId))
                .filter(member -> member.centerUserId == centerUserId)
                .filter(member -> "owner".equals(member.memberRole))
                .count();
        return requiredType.cast(count);
      }
      return requiredType.cast(0L);
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      if (sql.contains("FROM tenant_provisioning_job")) {
        String workerId = stringArg(args, args.length >= 3 ? args.length - 2 : -1);
        Long jobId = numericArg(args, 0);
        return (List<T>)
            jobs.stream()
                .filter(job -> jobId == null || job.id == jobId)
                .filter(job -> !hasText(workerId) || workerId.equals(job.lockOwner))
                .map(job -> map(rowMapper, resultSet(job)))
                .toList();
      }
      if (sql.contains("FROM `user`") && sql.contains("WHERE id = ?")) {
        long id = ((Number) args[0]).longValue();
        return (List<T>)
            centerUsers.stream()
                .filter(user -> user.id == id)
                .map(user -> map(rowMapper, resultSet(user)))
                .toList();
      }
      if (sql.contains("FROM organization\n") && sql.contains("status = 'active'")) {
        long id = ((Number) args[0]).longValue();
        String sourceCustomerId = String.valueOf(args[1]);
        return (List<T>)
            organizations.stream()
                .filter(org -> org.id == id)
                .filter(org -> sourceCustomerId.equals(org.sourceCustomerId))
                .filter(org -> "active".equals(org.status))
                .map(org -> map(rowMapper, resultSet(org)))
                .toList();
      }
      if (sql.contains("FROM organization_tenant_mapping")) {
        return hasText(activeMappingTargetCustomerId)
            ? List.of((T) activeMappingTargetCustomerId)
            : List.of();
      }
      if (sql.contains("FROM organization_member member")) {
        long sourceOrgId = ((Number) args[0]).longValue();
        String sourceCustomerId = String.valueOf(args[1]);
        return (List<T>)
            members.stream()
                .filter(member -> member.organizationId == sourceOrgId)
                .filter(member -> sourceCustomerId.equals(member.sourceCustomerId))
                .map(member -> map(rowMapper, resultSet(member)))
                .toList();
      }
      return List.of();
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
        when(rs.getObject("initiator_center_user_id")).thenReturn(job.initiatorCenterUserId);
        when(rs.getObject("source_org_id")).thenReturn(job.sourceOrgId);
        when(rs.getString("source_customer_id")).thenReturn(job.sourceCustomerId);
        when(rs.getString("target_customer_id")).thenReturn(job.targetCustomerId);
        when(rs.getString("target_db_name")).thenReturn(job.targetDbName);
        when(rs.getString("target_city")).thenReturn(job.targetCity);
        when(rs.getString("target_company_short_name")).thenReturn(job.targetCompanyShortName);
        when(rs.getString("status")).thenReturn(job.status);
        when(rs.getString("step")).thenReturn(job.step);
        when(rs.getObject("retry_count")).thenReturn(job.retryCount);
        when(rs.getString("lock_owner")).thenReturn(job.lockOwner);
        when(rs.getTimestamp("locked_at")).thenReturn(timestamp(job.lockedAt));
        when(rs.getTimestamp("heartbeat_at")).thenReturn(timestamp(job.heartbeatAt));
        when(rs.getTimestamp("started_at")).thenReturn(timestamp(job.startedAt));
        when(rs.getTimestamp("create_time")).thenReturn(timestamp(job.createTime));
        when(rs.getTimestamp("update_time")).thenReturn(timestamp(job.updateTime));
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
      return rs;
    }

    private ResultSet resultSet(CenterUserFixture user) {
      ResultSet rs = mock(ResultSet.class);
      try {
        when(rs.getLong("id")).thenReturn(user.id);
        when(rs.getString("customer_type")).thenReturn(user.customerType);
        when(rs.getString("real_name")).thenReturn(user.realName);
        when(rs.getObject("status")).thenReturn(user.status);
        when(rs.getString("username")).thenReturn(user.username);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
      return rs;
    }

    private ResultSet resultSet(OrganizationFixture organization) {
      ResultSet rs = mock(ResultSet.class);
      try {
        when(rs.getLong("id")).thenReturn(organization.id);
        when(rs.getString("name")).thenReturn("source org");
        when(rs.getString("source_customer_id")).thenReturn(organization.sourceCustomerId);
        when(rs.getString("status")).thenReturn(organization.status);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
      return rs;
    }

    private ResultSet resultSet(MemberFixture member) {
      ResultSet rs = mock(ResultSet.class);
      try {
        when(rs.getObject("center_user_id")).thenReturn(member.centerUserId);
        when(rs.getString("member_role")).thenReturn(member.memberRole);
        when(rs.getString("customer_type")).thenReturn(member.customerType);
        when(rs.getObject("status")).thenReturn(member.status);
        when(rs.getInt("center_user_exists")).thenReturn(member.centerUserExists ? 1 : 0);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
      return rs;
    }

    private Timestamp timestamp(Instant instant) {
      return instant == null ? null : Timestamp.from(instant);
    }

    private Long numericArg(Object[] args, int index) {
      if (index < 0 || index >= args.length || !(args[index] instanceof Number number)) {
        return null;
      }
      return number.longValue();
    }

    private String stringArg(Object[] args, int index) {
      if (index < 0 || index >= args.length || args[index] instanceof Number) {
        return "";
      }
      return String.valueOf(args[index]);
    }

    private boolean hasText(String value) {
      return value != null && !value.trim().isEmpty();
    }
  }

  private static final class JobFixture {

    private final Instant createTime = Instant.parse("2026-07-02T08:00:00Z");
    private final Instant heartbeatAt = Instant.parse("2026-07-02T08:30:00Z");
    private final Long initiatorCenterUserId = 1001L;
    private final Long sourceOrgId = 7L;
    private final Instant lockedAt = Instant.parse("2026-07-02T08:30:00Z");
    private final String lockOwner = "worker-a";
    private final int retryCount = 0;
    private final String sourceCustomerId = "public";
    private final Instant startedAt = Instant.parse("2026-07-02T08:30:00Z");
    private final String status = "provisioning";
    private final String step = "claimed";
    private final String targetCity = "杭州";
    private final String targetCompanyShortName = "测试组织";
    private final String targetCustomerId = "org001";
    private final Instant updateTime = Instant.parse("2026-07-02T08:30:00Z");
    private long id = 31L;
    private String targetDbName = "tenant_org001";

    private static JobFixture valid() {
      return new JobFixture();
    }
  }

  private record CenterUserFixture(
      long id, String customerType, String realName, int status, String username) {}

  private record OrganizationFixture(long id, String sourceCustomerId, String status) {}

  private record MemberFixture(
      long organizationId,
      long centerUserId,
      String sourceCustomerId,
      String memberRole,
      String customerType,
      int status,
      boolean centerUserExists) {}
}
