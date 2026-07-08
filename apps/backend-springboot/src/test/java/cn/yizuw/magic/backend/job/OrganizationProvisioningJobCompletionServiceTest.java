package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.messaging.BusinessOutboxPublisher;
import cn.yizuw.magic.backend.messaging.OrganizationProvisioningCompletedEvent;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** 组织开通完成收口测试；只验证中心库任务状态收口和 outbox 事件边界。 */
class OrganizationProvisioningJobCompletionServiceTest {

  @Test
  void completeTenantProvisioningJobReturnsTableNotReadyWhenCenterTablesMissing() {
    CompletionJdbcTemplate jdbcTemplate = new CompletionJdbcTemplate();
    jdbcTemplate.tables.remove("organization_tenant_mapping");
    BusinessOutboxPublisher publisher = org.mockito.Mockito.mock(BusinessOutboxPublisher.class);

    Map<String, Object> result =
        new OrganizationProvisioningJobCompletionService(jdbcTemplate, publisher)
            .completeTenantProvisioningJob(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T10:20:00Z"));

    assertThat(result)
        .containsEntry("completionStatus", "table_not_ready")
        .containsEntry("tableReady", false)
        .containsEntry("tenantProvisioningCompleted", false)
        .containsEntry("updatedRows", 0)
        .containsEntry("workerId", "worker-a");
    assertThat(result.get("missingCenterTables")).isEqualTo(List.of("organization_tenant_mapping"));
    verify(publisher, never())
        .publishOrganizationProvisioningCompleted(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void completeTenantProvisioningJobRequiresJobIdAndWorkerId() {
    CompletionJdbcTemplate jdbcTemplate = new CompletionJdbcTemplate();
    BusinessOutboxPublisher publisher = org.mockito.Mockito.mock(BusinessOutboxPublisher.class);
    OrganizationProvisioningJobCompletionService service =
        new OrganizationProvisioningJobCompletionService(jdbcTemplate, publisher);

    assertThatThrownBy(
            () ->
                service.completeTenantProvisioningJob(
                    0L, "worker-a", "tenant_org001", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通完成收口缺少 jobId");
    assertThatThrownBy(
            () ->
                service.completeTenantProvisioningJob(
                    31L, " ", "tenant_org001", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织开通完成收口缺少 workerId");
  }

  @Test
  void completeTenantProvisioningJobBlocksWhenConfirmTargetDbNameMismatches() {
    CompletionJdbcTemplate jdbcTemplate = new CompletionJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    BusinessOutboxPublisher publisher = org.mockito.Mockito.mock(BusinessOutboxPublisher.class);

    Map<String, Object> result =
        new OrganizationProvisioningJobCompletionService(jdbcTemplate, publisher)
            .completeTenantProvisioningJob(
                31L, "worker-a", "wrong_db", Instant.parse("2026-07-03T10:20:00Z"));

    assertThat(result)
        .containsEntry("completionStatus", "blocked")
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("leaseValid", true)
        .containsEntry("tableReady", true)
        .containsEntry("tenantProvisioningCompleted", false)
        .containsEntry("updatedRows", 0);
    assertThat(result.get("blockedReasons"))
        .isEqualTo(List.of("confirmTargetDbName 与任务 targetDbName 不一致"));
    assertThat(jdbcTemplate.updateSql).isEmpty();
    verify(publisher, never())
        .publishOrganizationProvisioningCompleted(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void completeTenantProvisioningJobBlocksWhenCenterSwitchWasNotFinished() {
    CompletionJdbcTemplate jdbcTemplate = new CompletionJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.organizationTenantMappingRows = 1;
    jdbcTemplate.activeMemberRows = 2;
    jdbcTemplate.targetMappingRows = 1;
    BusinessOutboxPublisher publisher = org.mockito.Mockito.mock(BusinessOutboxPublisher.class);

    Map<String, Object> result =
        new OrganizationProvisioningJobCompletionService(jdbcTemplate, publisher)
            .completeTenantProvisioningJob(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T10:20:00Z"));

    assertThat(result)
        .containsEntry("completionStatus", "blocked")
        .containsEntry("tenantProvisioningCompleted", false)
        .containsEntry("updatedRows", 0);
    assertThat(result.get("blockedReasons"))
        .isEqualTo(List.of("中心用户目标租户映射未全部写入，禁止完成开通任务"));
    assertThat(jdbcTemplate.updateSql).isEmpty();
    verify(publisher, never())
        .publishOrganizationProvisioningCompleted(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void completeTenantProvisioningJobMarksActiveAndQueuesOutbox() {
    CompletionJdbcTemplate jdbcTemplate = new CompletionJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.organizationTenantMappingRows = 1;
    jdbcTemplate.activeMemberRows = 2;
    jdbcTemplate.targetMappingRows = 2;
    BusinessOutboxPublisher publisher = org.mockito.Mockito.mock(BusinessOutboxPublisher.class);
    when(publisher.publishOrganizationProvisioningCompleted(org.mockito.ArgumentMatchers.any()))
        .thenReturn("evt_completed_1");

    Map<String, Object> result =
        new OrganizationProvisioningJobCompletionService(jdbcTemplate, publisher)
            .completeTenantProvisioningJob(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T10:20:00Z"));

    assertThat(result)
        .containsEntry("completionStatus", "success")
        .containsEntry("completedAt", "2026-07-03T10:20:00Z")
        .containsEntry("heartbeatAt", null)
        .containsEntry("jobId", 31L)
        .containsEntry("leaseValid", true)
        .containsEntry("lockOwner", null)
        .containsEntry("outboxEventId", "evt_completed_1")
        .containsEntry("outboxEventQueued", true)
        .containsEntry("status", "active")
        .containsEntry("step", "completed")
        .containsEntry("tenantProvisioningCompleted", true)
        .containsEntry("updatedRows", 1);
    assertThat(jdbcTemplate.jobs.get(0).status).isEqualTo("active");
    assertThat(jdbcTemplate.jobs.get(0).step).isEqualTo("completed");
    assertThat(jdbcTemplate.jobs.get(0).lockOwner).isNull();
    assertThat(jdbcTemplate.jobs.get(0).completedAt)
        .isEqualTo(Instant.parse("2026-07-03T10:20:00Z"));
    assertThat(jdbcTemplate.updateSql)
        .singleElement()
        .asString()
        .contains("UPDATE tenant_provisioning_job")
        .contains("status = 'active'")
        .contains("step = 'completed'")
        .doesNotContain("DROP DATABASE")
        .doesNotContain("CREATE DATABASE");

    ArgumentCaptor<OrganizationProvisioningCompletedEvent> captor =
        ArgumentCaptor.forClass(OrganizationProvisioningCompletedEvent.class);
    verify(publisher).publishOrganizationProvisioningCompleted(captor.capture());
    OrganizationProvisioningCompletedEvent event = captor.getValue();
    assertThat(event.completedAt()).isEqualTo("2026-07-03T10:20:00Z");
    assertThat(event.initiatorCenterUserId()).isEqualTo(1001);
    assertThat(event.jobId()).isEqualTo(31);
    assertThat(event.lastPaymentOutTradeNo()).isEqualTo("wxapp_1");
    assertThat(event.sourceCustomerId()).isEqualTo("public");
    assertThat(event.sourceOrgId()).isEqualTo(1001);
    assertThat(event.status()).isEqualTo("active");
    assertThat(event.step()).isEqualTo("completed");
    assertThat(event.targetCustomerId()).isEqualTo("org001");
    assertThat(event.targetDbName()).isEqualTo("tenant_org001");
  }

  private static final class CompletionJdbcTemplate extends JdbcTemplate {

    private long activeMemberRows;
    private final List<JobFixture> jobs = new ArrayList<>();
    private long organizationTenantMappingRows;
    private final Set<String> tables =
        new LinkedHashSet<>(
            List.of(
                "tenant_provisioning_job",
                "organization_member",
                "organization_tenant_mapping",
                "user_tenant_mapping"));
    private long targetMappingRows;
    private final List<String> updateSql = new ArrayList<>();

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      long value;
      if (sql.contains("information_schema.tables")) {
        value = tables.contains(String.valueOf(args[0])) ? 1 : 0;
      } else if (sql.contains("FROM organization_tenant_mapping")) {
        value = organizationTenantMappingRows;
      } else if (sql.contains("user_tenant_mapping")) {
        value = targetMappingRows;
      } else if (sql.contains("FROM organization_member")) {
        value = activeMemberRows;
      } else {
        value = 0;
      }
      return requiredType.cast(value);
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
              .filter(item -> "seeding_base_data".equals(item.step))
              .findFirst()
              .orElse(null);
      if (job == null) {
        return List.of();
      }
      try {
        ResultSet rs = org.mockito.Mockito.mock(ResultSet.class);
        when(rs.getLong("id")).thenReturn(job.id);
        when(rs.getInt("initiator_center_user_id")).thenReturn(job.initiatorCenterUserId);
        when(rs.getLong("source_org_id")).thenReturn(job.sourceOrgId);
        when(rs.getString("source_customer_id")).thenReturn(job.sourceCustomerId);
        when(rs.getString("target_customer_id")).thenReturn(job.targetCustomerId);
        when(rs.getString("target_db_name")).thenReturn(job.targetDbName);
        when(rs.getString("last_payment_out_trade_no")).thenReturn(job.lastPaymentOutTradeNo);
        when(rs.getString("status")).thenReturn(job.status);
        when(rs.getString("step")).thenReturn(job.step);
        when(rs.getString("lock_owner")).thenReturn(job.lockOwner);
        when(rs.getTimestamp("completed_at")).thenReturn(timestamp(job.completedAt));
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
      long jobId = ((Number) args[2]).longValue();
      String workerId = String.valueOf(args[3]);
      JobFixture job =
          jobs.stream()
              .filter(item -> item.id == jobId)
              .filter(item -> workerId.equals(item.lockOwner))
              .filter(item -> "provisioning".equals(item.status))
              .filter(item -> "seeding_base_data".equals(item.step))
              .findFirst()
              .orElse(null);
      if (job == null) {
        return 0;
      }
      Instant completedAt = ((Timestamp) args[0]).toInstant();
      job.completedAt = completedAt;
      job.heartbeatAt = null;
      job.lockedAt = null;
      job.lockOwner = null;
      job.status = "active";
      job.step = "completed";
      job.updateTime = ((Timestamp) args[1]).toInstant();
      return 1;
    }

    private Timestamp timestamp(Instant instant) {
      return instant == null ? null : Timestamp.from(instant);
    }
  }

  private static final class JobFixture {

    private Instant completedAt;
    private Instant heartbeatAt = Instant.parse("2026-07-03T10:00:00Z");
    private final long id;
    private final int initiatorCenterUserId;
    private final String lastPaymentOutTradeNo;
    private Instant lockedAt = Instant.parse("2026-07-03T10:00:00Z");
    private String lockOwner;
    private final String sourceCustomerId;
    private final long sourceOrgId;
    private String status;
    private String step;
    private final String targetCustomerId;
    private final String targetDbName;
    private Instant updateTime = Instant.parse("2026-07-03T10:00:00Z");

    private JobFixture(
        long id,
        int initiatorCenterUserId,
        long sourceOrgId,
        String sourceCustomerId,
        String targetCustomerId,
        String targetDbName,
        String lastPaymentOutTradeNo,
        String status,
        String step,
        String lockOwner) {
      this.id = id;
      this.initiatorCenterUserId = initiatorCenterUserId;
      this.sourceOrgId = sourceOrgId;
      this.sourceCustomerId = sourceCustomerId;
      this.targetCustomerId = targetCustomerId;
      this.targetDbName = targetDbName;
      this.lastPaymentOutTradeNo = lastPaymentOutTradeNo;
      this.status = status;
      this.step = step;
      this.lockOwner = lockOwner;
    }

    private static JobFixture valid() {
      return new JobFixture(
          31L,
          1001,
          1001L,
          "public",
          "org001",
          "tenant_org001",
          "wxapp_1",
          "provisioning",
          "seeding_base_data",
          "worker-a");
    }
  }
}
