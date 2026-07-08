package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** 组织开通完成通知收件人预览测试；只使用 fake JdbcTemplate，不连接真实中心库。 */
class OrganizationProvisioningCompletedNotificationRecipientPlanServiceTest {

  @Test
  void buildPlanReturnsBlockedWhenRequiredTablesAreMissing() {
    RecipientJdbcTemplate jdbcTemplate =
        new RecipientJdbcTemplate(Set.of("tenant_provisioning_job", "organization_member"));
    OrganizationProvisioningCompletedNotificationRecipientPlanService service =
        new OrganizationProvisioningCompletedNotificationRecipientPlanService(jdbcTemplate);

    Map<String, Object> plan =
        service.buildPlan(31, "org001", "tenant_org001", List.of("in_app", "sms"));

    assertThat(plan)
        .containsEntry("recipientResolutionStatus", "blocked")
        .containsEntry("recipientCount", 0)
        .containsEntry("centerDbReadOnly", true)
        .containsEntry("targetDbAccessed", false)
        .containsEntry("sendEnabled", false)
        .containsEntry("providerCallEnabled", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("中心库收件人解析表未就绪: user");
    assertThat(jdbcTemplate.updateSql).isEmpty();
  }

  @Test
  void buildPlanReturnsMaskedRecipientPreviewForActiveMembers() {
    RecipientJdbcTemplate jdbcTemplate =
        new RecipientJdbcTemplate(Set.of("tenant_provisioning_job", "organization_member", "user"));
    jdbcTemplate.job = JobFixture.valid();
    jdbcTemplate.members.add(
        new MemberFixture(1L, 1001L, "owner", "owner01", "张三", 1, "13800138000", 1));
    jdbcTemplate.members.add(
        new MemberFixture(2L, 1002L, "member", "disabled01", "李四", 0, "13900139000", 1));
    OrganizationProvisioningCompletedNotificationRecipientPlanService service =
        new OrganizationProvisioningCompletedNotificationRecipientPlanService(jdbcTemplate);

    Map<String, Object> plan =
        service.buildPlan(
            31,
            "org001",
            "tenant_org001",
            List.of("in_app", "sms", "sms", ""));

    assertThat(plan)
        .containsEntry("recipientResolutionStatus", "preview_only")
        .containsEntry("recipientCount", 1)
        .containsEntry("scannedMemberCount", 2)
        .containsEntry("invalidRecipientCount", 1)
        .containsEntry("sourceOrgId", 7L)
        .containsEntry("sourceCustomerId", "public")
        .containsEntry("centerDbReadOnly", true)
        .containsEntry("targetDbAccessed", false)
        .containsEntry("sendEnabled", false)
        .containsEntry("providerCallEnabled", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("存在中心账号缺失或停用的组织成员: 1");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> recipients =
        (List<Map<String, Object>>) plan.get("recipients");
    assertThat(recipients).hasSize(1);
    assertThat(recipients.get(0))
        .containsEntry("centerUserId", 1001L)
        .containsEntry("username", "owner01")
        .containsEntry("realName", "张三")
        .containsEntry("phoneMasked", "138****8000")
        .containsEntry("memberRole", "owner")
        .containsEntry("recipientScope", "organization_owner")
        .containsEntry("sendEnabled", false)
        .containsEntry("providerCallEnabled", false);
    assertThat((List<Object>) recipients.get(0).get("channels")).containsExactly("in_app", "sms");
    assertThat(jdbcTemplate.updateSql).isEmpty();
  }

  @Test
  void buildPlanReturnsBlockedWhenMessageDoesNotMatchJob() {
    RecipientJdbcTemplate jdbcTemplate =
        new RecipientJdbcTemplate(Set.of("tenant_provisioning_job", "organization_member", "user"));
    jdbcTemplate.job = JobFixture.valid();
    OrganizationProvisioningCompletedNotificationRecipientPlanService service =
        new OrganizationProvisioningCompletedNotificationRecipientPlanService(jdbcTemplate);

    Map<String, Object> plan =
        service.buildPlan(31, "org002", "tenant_org002", List.of("wechat_work"));

    assertThat(plan)
        .containsEntry("recipientResolutionStatus", "blocked")
        .containsEntry("recipientCount", 0)
        .containsEntry("sourceOrgId", 7L)
        .containsEntry("providerCallEnabled", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly(
            "消息 targetCustomerId 与开通任务不一致",
            "消息 targetDbName 与开通任务不一致");
    assertThat(jdbcTemplate.updateSql).isEmpty();
  }

  @Test
  void buildPlanKeepsScanCountersWhenAllMembersAreDisabled() {
    RecipientJdbcTemplate jdbcTemplate =
        new RecipientJdbcTemplate(Set.of("tenant_provisioning_job", "organization_member", "user"));
    jdbcTemplate.job = JobFixture.valid();
    jdbcTemplate.members.add(
        new MemberFixture(1L, 1001L, "owner", "owner01", "张三", 0, "13800138000", 1));
    OrganizationProvisioningCompletedNotificationRecipientPlanService service =
        new OrganizationProvisioningCompletedNotificationRecipientPlanService(jdbcTemplate);

    Map<String, Object> plan =
        service.buildPlan(31, "org001", "tenant_org001", List.of("in_app"));

    assertThat(plan)
        .containsEntry("recipientResolutionStatus", "blocked")
        .containsEntry("recipientCount", 0)
        .containsEntry("scannedMemberCount", 1)
        .containsEntry("invalidRecipientCount", 1)
        .containsEntry("providerCallEnabled", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly(
            "存在中心账号缺失或停用的组织成员: 1",
            "没有可发送的 active 中心账号");
    assertThat(jdbcTemplate.updateSql).isEmpty();
  }

  private static final class RecipientJdbcTemplate extends JdbcTemplate {

    private final Set<String> readyTables;
    private final List<String> updateSql = new ArrayList<>();
    private final List<MemberFixture> members = new ArrayList<>();
    private JobFixture job;

    private RecipientJdbcTemplate(Set<String> readyTables) {
      this.readyTables = new LinkedHashSet<>(readyTables);
    }

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      String tableName = String.valueOf(args[0]);
      return requiredType.cast(readyTables.contains(tableName) ? 1L : 0L);
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      if (sql.contains("FROM tenant_provisioning_job")) {
        return job == null ? List.of() : List.of(mapJob(rowMapper, job));
      }
      if (sql.contains("FROM organization_member")) {
        return members.stream().map(member -> mapMember(rowMapper, member)).toList();
      }
      return List.of();
    }

    @Override
    public int update(String sql, Object... args) {
      updateSql.add(sql);
      return 0;
    }

    private <T> T mapJob(RowMapper<T> rowMapper, JobFixture job) {
      try {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("id")).thenReturn(job.id);
        when(rs.getObject("initiator_center_user_id")).thenReturn(job.initiatorCenterUserId);
        when(rs.getObject("source_org_id")).thenReturn(job.sourceOrgId);
        when(rs.getString("source_customer_id")).thenReturn(job.sourceCustomerId);
        when(rs.getString("target_customer_id")).thenReturn(job.targetCustomerId);
        when(rs.getString("target_db_name")).thenReturn(job.targetDbName);
        when(rs.getString("status")).thenReturn(job.status);
        when(rs.getString("step")).thenReturn(job.step);
        return rowMapper.mapRow(rs, 0);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }

    private <T> T mapMember(RowMapper<T> rowMapper, MemberFixture member) {
      try {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("member_id")).thenReturn(member.memberId);
        when(rs.getLong("center_user_id")).thenReturn(member.centerUserId);
        when(rs.getString("member_role")).thenReturn(member.memberRole);
        when(rs.getObject("source_user_id")).thenReturn(null);
        when(rs.getString("center_username")).thenReturn(member.username);
        when(rs.getString("center_real_name")).thenReturn(member.realName);
        when(rs.getObject("center_status")).thenReturn(member.centerStatus);
        when(rs.getString("customer_type")).thenReturn("public");
        when(rs.getString("center_phone")).thenReturn(member.phone);
        when(rs.getObject("center_user_exists")).thenReturn(member.centerUserExists);
        return rowMapper.mapRow(rs, 0);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
    }
  }

  private record JobFixture(
      long id,
      long initiatorCenterUserId,
      long sourceOrgId,
      String sourceCustomerId,
      String targetCustomerId,
      String targetDbName,
      String status,
      String step) {

    private static JobFixture valid() {
      return new JobFixture(
          31L, 1001L, 7L, "public", "org001", "tenant_org001", "active", "completed");
    }
  }

  private record MemberFixture(
      long memberId,
      long centerUserId,
      String memberRole,
      String username,
      String realName,
      int centerStatus,
      String phone,
      int centerUserExists) {}
}
