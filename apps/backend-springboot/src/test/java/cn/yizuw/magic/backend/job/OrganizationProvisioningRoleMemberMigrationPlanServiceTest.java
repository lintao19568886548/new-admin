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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.env.MockEnvironment;

/** 组织角色/成员迁移预览测试；当前只读预检，不写目标租户库。 */
class OrganizationProvisioningRoleMemberMigrationPlanServiceTest {

  @Test
  void previewReturnsTableNotReadyWhenCenterTablesAreMissing() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.centerTables.remove("tenant_provisioning_job");
    FakeRoleMemberPreviewClient previewClient = new FakeRoleMemberPreviewClient();

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewMigration(31L, "worker-a", Instant.parse("2026-07-03T09:00:00Z"));

    assertThat(result)
        .containsEntry("roleMemberMigrationStatus", "table_not_ready")
        .containsEntry("executeMigration", false)
        .containsEntry("leaseValid", false)
        .containsEntry("migrationPreviewOnly", true)
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("tableReady", false);
    assertThat(result.get("missingCenterTables")).isEqualTo(List.of("tenant_provisioning_job"));
    assertThat(result.get("blockedReasons")).isEqualTo(List.of("组织角色成员迁移所需中心库表未就绪"));
    assertThat(previewClient.sourceJdbcUrls).isEmpty();
  }

  @Test
  void previewReturnsReadyRoleMemberMigrationPlanWithoutExecutingWrites() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.members.add(MemberFixture.staff());
    FakeRoleMemberPreviewClient previewClient = new FakeRoleMemberPreviewClient();
    previewClient.inspection =
        new OrganizationProvisioningRoleMemberMigrationPreviewClient.RoleMemberMigrationInspection(
            List.of(),
            List.of(),
            List.of(
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.OrganizationRolePlan(
                    10L, null, "Org Admin"),
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.OrganizationRolePlan(
                    11L, 10L, "Staff")),
            List.of(),
            3,
            2,
            2,
            2,
            List.of(
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.MemberSourceUserPlan(
                    7L, "owner", "id", "70", true, 70L, "owner", 1, 0),
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.MemberSourceUserPlan(
                    8L, "member", "id", "88", true, 88L, "staff", 1, 1)));

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewMigration(31L, "worker-a", Instant.parse("2026-07-03T09:00:00Z"));

    assertThat(result)
        .containsEntry("activeMemberCount", 2)
        .containsEntry("executeMigration", false)
        .containsEntry("leaseValid", true)
        .containsEntry("migrationPreviewOnly", true)
        .containsEntry("nextExplicitSwitch", "executeOrganizationRolesAndMembers")
        .containsEntry("requiredStep", "seeding_base_data")
        .containsEntry("roleMemberMigrationStatus", "ready")
        .containsEntry("sourceCustomerId", "public")
        .containsEntry("sourceOrgId", 1001L)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry("targetWriteExecuted", false);
    assertThat(result.get("plannedRoleTables"))
        .isEqualTo(List.of("role", "code", "park", "role_menu", "role_park", "role_code"));
    assertThat(result.get("plannedMemberTables")).isEqualTo(List.of("user", "user_role", "user_code"));
    @SuppressWarnings("unchecked")
    Map<String, Object> roleSnapshotPlan = (Map<String, Object>) result.get("roleSnapshotPlan");
    assertThat(roleSnapshotPlan)
        .containsEntry("roleCount", 2)
        .containsEntry("roleCodeRows", 3L)
        .containsEntry("roleCodeDistinctCodes", 2L)
        .containsEntry("roleMapMode", "identity")
        .containsEntry("roleParkRows", 2L);
    assertThat(roleSnapshotPlan.get("roleIds")).isEqualTo(List.of(10L, 11L));
    assertThat(previewClient.sourceJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    assertThat(previewClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(previewClient.sourceOrgIds).containsExactly(1001L);
    OrganizationProvisioningRoleMemberMigrationPreviewClient.SourceUserLookup ownerLookup =
        previewClient.lookups.get(0).get(0);
    assertThat(ownerLookup.centerUserId()).isEqualTo(7L);
    assertThat(ownerLookup.effectiveSourceUserId()).isEqualTo(70L);
    assertThat(ownerLookup.memberRole()).isEqualTo("owner");
  }

  @Test
  void previewBlocksWhenRoleTreeOrMemberSourceRolesAreInvalid() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.staff());
    FakeRoleMemberPreviewClient previewClient = new FakeRoleMemberPreviewClient();
    previewClient.inspection =
        new OrganizationProvisioningRoleMemberMigrationPreviewClient.RoleMemberMigrationInspection(
            List.of(),
            List.of(),
            List.of(
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.OrganizationRolePlan(
                    11L, 999L, "Broken Staff")),
            List.of(11L),
            0,
            0,
            0,
            0,
            List.of(
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.MemberSourceUserPlan(
                    8L, "member", "id", "88", true, 88L, "staff", 1, 0)));

    Map<String, Object> result =
        service(jdbcTemplate, previewClient)
            .previewMigration(31L, "worker-a", Instant.parse("2026-07-03T09:00:00Z"));

    assertThat(result)
        .containsEntry("roleMemberMigrationStatus", "blocked")
        .containsEntry("executeMigration", false)
        .containsEntry("targetWriteExecuted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons)
        .contains(
            "组织角色树存在跨组织父级: roleIds=[11]",
            "组织普通成员缺少可迁移角色，请先回填默认员工角色: centerUserId=8, sourceOrgId=1001");
  }

  @Test
  void executeCopiesRoleSnapshotOnlyWhenConfirmTargetDbNameMatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.updateRows = 1;
    FakeRoleMemberPreviewClient previewClient = readyPreviewClient();
    FakeRoleSnapshotCopyClient copyClient = new FakeRoleSnapshotCopyClient();

    Map<String, Object> result =
        service(jdbcTemplate, previewClient, copyClient)
            .executeOrganizationRolesAndMembers(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T09:10:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "tenant_org001")
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("migrationPreviewOnly", false)
        .containsEntry("nextExplicitSwitch", "executeOrganizationMembers")
        .containsEntry("organizationMembersMigrated", false)
        .containsEntry("roleMemberMigrationStatus", "success")
        .containsEntry("roleSnapshotCopied", true)
        .containsEntry("roleSnapshotExecuted", true)
        .containsEntry("targetWriteExecuted", true);
    assertThat(result.get("copiedTables"))
        .isEqualTo(List.of("role", "code", "park", "role_menu", "role_park", "role_code"));
    @SuppressWarnings("unchecked")
    Map<String, Object> copyResult = (Map<String, Object>) result.get("copyResult");
    assertThat(copyResult)
        .containsEntry("roleRowsCopied", 2L)
        .containsEntry("codeRowsCopied", 2L)
        .containsEntry("parkRowsCopied", 1L)
        .containsEntry("totalRowsCopied", 11L);
    assertThat(copyClient.sourceJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    assertThat(copyClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(copyClient.sourceOrgIds).containsExactly(1001L);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-03T09:10:00Z"));
  }

  @Test
  void executeDoesNotCopyRoleSnapshotWhenConfirmTargetDbNameMismatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    FakeRoleSnapshotCopyClient copyClient = new FakeRoleSnapshotCopyClient();

    Map<String, Object> result =
        service(jdbcTemplate, readyPreviewClient(), copyClient)
            .executeOrganizationRolesAndMembers(
                31L, "worker-a", "wrong_db", Instant.parse("2026-07-03T09:10:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("executeMigration", false)
        .containsEntry("roleMemberMigrationStatus", "blocked")
        .containsEntry("roleSnapshotCopied", false)
        .containsEntry("roleSnapshotExecuted", false)
        .containsEntry("targetWriteExecuted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(copyClient.sourceJdbcUrls).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void executeStopsWhenHeartbeatLeaseIsLostDuringRoleSnapshotCopy() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.updateRows = 0;
    FakeRoleSnapshotCopyClient copyClient = new FakeRoleSnapshotCopyClient();

    assertThatThrownBy(
            () ->
                service(jdbcTemplate, readyPreviewClient(), copyClient)
                    .executeOrganizationRolesAndMembers(
                        31L,
                        "worker-a",
                        "tenant_org001",
                        Instant.parse("2026-07-03T09:10:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessage("租户开通任务租约已失效，停止组织角色快照复制");
    assertThat(copyClient.sourceJdbcUrls).hasSize(1);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
  }

  @Test
  void executeMigratesOrganizationMembersOnlyWhenConfirmTargetDbNameMatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.members.add(MemberFixture.staff());
    jdbcTemplate.updateRows = 1;
    FakeMemberMigrationClient memberMigrationClient = new FakeMemberMigrationClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyMembersPreviewClient(),
                new FakeRoleSnapshotCopyClient(),
                memberMigrationClient)
            .executeOrganizationMembers(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T09:20:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "tenant_org001")
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 2)
        .containsEntry("memberMigrationExecuted", true)
        .containsEntry("migrationPreviewOnly", false)
        .containsEntry("nextExplicitSwitch", "executeOrganizationUserScopedData")
        .containsEntry("organizationMembersMigrated", true)
        .containsEntry("organizationMembersMigratedCount", 2L)
        .containsEntry("roleMemberMigrationStatus", "success")
        .containsEntry("roleSnapshotCopied", false)
        .containsEntry("roleSnapshotExecuted", false)
        .containsEntry("targetUsersUpserted", 2L)
        .containsEntry("targetWriteExecuted", true)
        .containsEntry("userCodeRowsInserted", 2L)
        .containsEntry("userRoleRowsInserted", 2L);
    assertThat(result.get("migratedMemberTables")).isEqualTo(List.of("user", "user_role", "user_code"));
    @SuppressWarnings("unchecked")
    Map<String, Object> migrationResult = (Map<String, Object>) result.get("memberMigrationResult");
    assertThat(migrationResult)
        .containsEntry("organizationMembersMigrated", 2L)
        .containsEntry("targetUsersUpserted", 2L)
        .containsEntry("totalRowsWritten", 6L);
    assertThat(memberMigrationClient.sourceJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    assertThat(memberMigrationClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(memberMigrationClient.sourceOrgIds).containsExactly(1001L);
    assertThat(memberMigrationClient.targetCustomerIds).containsExactly("org001");
    List<OrganizationProvisioningMemberMigrationClient.MemberMigrationCommand> commands =
        memberMigrationClient.commands.get(0);
    assertThat(commands).hasSize(2);
    assertThat(commands.get(0).centerUserId()).isEqualTo(7L);
    assertThat(commands.get(0).centerPassword()).isNotBlank();
    assertThat(commands.get(0).sourceUserId()).isEqualTo(70L);
    assertThat(commands.get(1).centerUserId()).isEqualTo(8L);
    assertThat(commands.get(1).memberRole()).isEqualTo("member");
    assertThat(commands.get(1).sourceUserId()).isEqualTo(88L);
    assertThat(jdbcTemplate.updateCount).isEqualTo(2);
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-03T09:20:00Z"));
  }

  @Test
  void executeDoesNotMigrateOrganizationMembersWhenConfirmTargetDbNameMismatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    FakeMemberMigrationClient memberMigrationClient = new FakeMemberMigrationClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyPreviewClient(),
                new FakeRoleSnapshotCopyClient(),
                memberMigrationClient)
            .executeOrganizationMembers(
                31L, "worker-a", "wrong_db", Instant.parse("2026-07-03T09:20:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("executeMigration", false)
        .containsEntry("memberMigrationExecuted", false)
        .containsEntry("organizationMembersMigrated", false)
        .containsEntry("roleMemberMigrationStatus", "blocked")
        .containsEntry("targetWriteExecuted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(memberMigrationClient.sourceJdbcUrls).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void executeStopsWhenHeartbeatLeaseIsLostDuringMemberMigration() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.updateRows = 0;
    FakeMemberMigrationClient memberMigrationClient = new FakeMemberMigrationClient();

    assertThatThrownBy(
            () ->
                service(
                        jdbcTemplate,
                        readyPreviewClient(),
                        new FakeRoleSnapshotCopyClient(),
                        memberMigrationClient)
                    .executeOrganizationMembers(
                        31L,
                        "worker-a",
                        "tenant_org001",
                        Instant.parse("2026-07-03T09:20:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessage("租户开通任务租约已失效，停止组织成员迁移");
    assertThat(memberMigrationClient.sourceJdbcUrls).hasSize(1);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
  }

  @Test
  void executeMigratesOrganizationUserScopedDataOnlyWhenConfirmTargetDbNameMatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.members.add(MemberFixture.staff());
    jdbcTemplate.updateRows = 1;
    FakeUserScopedDataMigrationClient userScopedDataMigrationClient =
        new FakeUserScopedDataMigrationClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyMembersPreviewClient(),
                new FakeRoleSnapshotCopyClient(),
                new FakeMemberMigrationClient(),
                userScopedDataMigrationClient)
            .executeOrganizationUserScopedData(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T09:30:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "tenant_org001")
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 2)
        .containsEntry("memberMigrationExecuted", false)
        .containsEntry("migrationPreviewOnly", false)
        .containsEntry("nextExplicitSwitch", "writeTenantProvisioningRoleSnapshot")
        .containsEntry("organizationMembersMigrated", false)
        .containsEntry("roleMemberMigrationStatus", "success")
        .containsEntry("targetWriteExecuted", true)
        .containsEntry("userScopedCopiedChunks", 2L)
        .containsEntry("userScopedDataMigrated", true)
        .containsEntry("userScopedDataMigrationExecuted", true)
        .containsEntry("userScopedMigratedMemberCount", 2L)
        .containsEntry("userScopedRowsCopied", 6L);
    assertThat(result.get("migratedUserScopedTables"))
        .isEqualTo(
            List.of(
                "localization",
                "attendances",
                "feedback",
                "leave_application",
                "reimbursement",
                "reimbursement_image",
                "investment",
                "investment_image"));
    assertThat(result.get("copiedTables")).isEqualTo(List.of("localization", "attendances"));
    @SuppressWarnings("unchecked")
    Map<String, Object> migrationResult =
        (Map<String, Object>) result.get("userScopedDataMigrationResult");
    assertThat(migrationResult)
        .containsEntry("copiedChunks", 2L)
        .containsEntry("migratedMemberCount", 2L)
        .containsEntry("totalRowsCopied", 6L);
    assertThat(userScopedDataMigrationClient.sourceJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/public_magic?serverTimezone=Asia/Shanghai");
    assertThat(userScopedDataMigrationClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    assertThat(userScopedDataMigrationClient.targetCustomerIds).containsExactly("org001");
    List<OrganizationProvisioningUserScopedDataMigrationClient.UserScopedDataMigrationCommand>
        commands = userScopedDataMigrationClient.commands.get(0);
    assertThat(commands).hasSize(2);
    assertThat(commands.get(0).centerUserId()).isEqualTo(7L);
    assertThat(commands.get(0).centerPhone()).isEqualTo("13800000000");
    assertThat(commands.get(0).sourceUserId()).isEqualTo(70L);
    assertThat(commands.get(1).centerUserId()).isEqualTo(8L);
    assertThat(commands.get(1).sourceUserId()).isEqualTo(88L);
    assertThat(jdbcTemplate.updateCount).isEqualTo(2);
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-03T09:30:00Z"));
  }

  @Test
  void executeDoesNotMigrateUserScopedDataWhenConfirmTargetDbNameMismatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    FakeUserScopedDataMigrationClient userScopedDataMigrationClient =
        new FakeUserScopedDataMigrationClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyPreviewClient(),
                new FakeRoleSnapshotCopyClient(),
                new FakeMemberMigrationClient(),
                userScopedDataMigrationClient)
            .executeOrganizationUserScopedData(
                31L, "worker-a", "wrong_db", Instant.parse("2026-07-03T09:30:00Z"));

    assertThat(result)
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("executeMigration", false)
        .containsEntry("roleMemberMigrationStatus", "blocked")
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("userScopedDataMigrated", false)
        .containsEntry("userScopedDataMigrationExecuted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(userScopedDataMigrationClient.sourceJdbcUrls).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void executeStopsWhenHeartbeatLeaseIsLostDuringUserScopedDataMigration() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.updateRows = 0;
    FakeUserScopedDataMigrationClient userScopedDataMigrationClient =
        new FakeUserScopedDataMigrationClient();

    assertThatThrownBy(
            () ->
                service(
                        jdbcTemplate,
                        readyPreviewClient(),
                        new FakeRoleSnapshotCopyClient(),
                        new FakeMemberMigrationClient(),
                        userScopedDataMigrationClient)
                    .executeOrganizationUserScopedData(
                        31L,
                        "worker-a",
                        "tenant_org001",
                        Instant.parse("2026-07-03T09:30:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessage("租户开通任务租约已失效，停止组织用户范围数据迁移");
    assertThat(userScopedDataMigrationClient.sourceJdbcUrls).hasSize(1);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
  }

  @Test
  void writeTenantProvisioningRoleSnapshotOnlyWhenConfirmTargetDbNameMatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.centerTables.add("tenant_provisioning_role_snapshot");
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.members.add(MemberFixture.staff());
    jdbcTemplate.updateRows = 1;
    FakeRoleSnapshotCenterWriteClient roleSnapshotCenterWriteClient =
        new FakeRoleSnapshotCenterWriteClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyMembersPreviewClient(),
                new FakeRoleSnapshotCopyClient(),
                new FakeMemberMigrationClient(),
                new FakeUserScopedDataMigrationClient(),
                roleSnapshotCenterWriteClient)
            .writeTenantProvisioningRoleSnapshot(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T09:40:00Z"));

    assertThat(result)
        .containsEntry("centerWriteExecuted", true)
        .containsEntry("confirmTargetDbName", "tenant_org001")
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("migrationPreviewOnly", false)
        .containsEntry("nextExplicitSwitch", "switchCenterUserToTarget")
        .containsEntry("roleMemberMigrationStatus", "success")
        .containsEntry("roleSnapshotCenterWriteExecuted", true)
        .containsEntry("roleSnapshotRowsDeleted", 1L)
        .containsEntry("roleSnapshotRowsInserted", 2L)
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("tenantProvisioningRoleSnapshotWritten", true);
    @SuppressWarnings("unchecked")
    Map<String, Object> writeResult = (Map<String, Object>) result.get("roleSnapshotWriteResult");
    assertThat(writeResult)
        .containsEntry("deletedRows", 1L)
        .containsEntry("insertedRows", 2L)
        .containsEntry("jobId", 31L)
        .containsEntry("snapshotCount", 2L)
        .containsEntry("sourceOrgId", 1001L);
    assertThat(roleSnapshotCenterWriteClient.jobIds).containsExactly(31L);
    assertThat(roleSnapshotCenterWriteClient.sourceOrgIds).containsExactly(1001L);
    assertThat(roleSnapshotCenterWriteClient.commands).hasSize(1);
    List<OrganizationProvisioningRoleSnapshotCenterWriteClient.RoleSnapshotCenterWriteCommand>
        commands = roleSnapshotCenterWriteClient.commands.get(0);
    assertThat(commands)
        .extracting(
            OrganizationProvisioningRoleSnapshotCenterWriteClient
                .RoleSnapshotCenterWriteCommand::sourceRoleId)
        .containsExactly(10L, 11L);
    assertThat(commands)
        .extracting(
            OrganizationProvisioningRoleSnapshotCenterWriteClient
                .RoleSnapshotCenterWriteCommand::targetRoleId)
        .containsExactly(10L, 11L);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-03T09:40:00Z"));
  }

  @Test
  void writeTenantProvisioningRoleSnapshotBlocksWhenConfirmTargetDbNameMismatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.centerTables.add("tenant_provisioning_role_snapshot");
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    FakeRoleSnapshotCenterWriteClient roleSnapshotCenterWriteClient =
        new FakeRoleSnapshotCenterWriteClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyPreviewClient(),
                new FakeRoleSnapshotCopyClient(),
                new FakeMemberMigrationClient(),
                new FakeUserScopedDataMigrationClient(),
                roleSnapshotCenterWriteClient)
            .writeTenantProvisioningRoleSnapshot(
                31L, "worker-a", "wrong_db", Instant.parse("2026-07-03T09:40:00Z"));

    assertThat(result)
        .containsEntry("centerWriteExecuted", false)
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("executeMigration", false)
        .containsEntry("roleMemberMigrationStatus", "blocked")
        .containsEntry("roleSnapshotCenterWriteExecuted", false)
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("tenantProvisioningRoleSnapshotWritten", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(roleSnapshotCenterWriteClient.jobIds).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void writeTenantProvisioningRoleSnapshotStopsWhenHeartbeatLeaseIsLost() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.centerTables.add("tenant_provisioning_role_snapshot");
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.updateRows = 0;
    FakeRoleSnapshotCenterWriteClient roleSnapshotCenterWriteClient =
        new FakeRoleSnapshotCenterWriteClient();

    assertThatThrownBy(
            () ->
                service(
                        jdbcTemplate,
                        readyPreviewClient(),
                        new FakeRoleSnapshotCopyClient(),
                        new FakeMemberMigrationClient(),
                        new FakeUserScopedDataMigrationClient(),
                        roleSnapshotCenterWriteClient)
                    .writeTenantProvisioningRoleSnapshot(
                        31L,
                        "worker-a",
                        "tenant_org001",
                        Instant.parse("2026-07-03T09:40:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessage("租户开通任务租约已失效，停止组织角色快照中心库写入");
    assertThat(roleSnapshotCenterWriteClient.jobIds).containsExactly(31L);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
  }

  @Test
  void switchCenterUserToTargetOnlyWhenConfirmTargetDbNameMatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.centerTables.addAll(
        List.of("customer", "organization_tenant_mapping", "refresh_token", "tenant_provisioning_role_snapshot"));
    jdbcTemplate.roleSnapshotRows = 2;
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.members.add(MemberFixture.staff());
    jdbcTemplate.updateRows = 1;
    FakeCenterUserSwitchClient centerUserSwitchClient = new FakeCenterUserSwitchClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyMembersPreviewClient(),
                centerUserSwitchClient,
                new FakeRoleSnapshotCopyClient(),
                new FakeMemberMigrationClient(),
                new FakeUserScopedDataMigrationClient(),
                new FakeRoleSnapshotCenterWriteClient())
            .switchCenterUserToTarget(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T09:50:00Z"));

    assertThat(result)
        .containsEntry("centerSwitchExecuted", true)
        .containsEntry("centerUsersSwitched", 2L)
        .containsEntry("confirmTargetDbName", "tenant_org001")
        .containsEntry("customerRowsAffected", 1)
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("migrationPreviewOnly", false)
        .containsEntry("nextExplicitSwitch", "completeTenantProvisioningJob")
        .containsEntry("organizationTenantMappingRowsAffected", 1)
        .containsEntry("refreshTokenRowsRevoked", 2L)
        .containsEntry("roleMemberMigrationStatus", "success")
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("tenantProvisioningCompleted", false)
        .containsEntry("userTenantMappingRowsAffected", 2L);
    assertThat(centerUserSwitchClient.targetJdbcUrls)
        .containsExactly("mysql://root:pwd@127.0.0.1:3306/tenant_org001?serverTimezone=Asia/Shanghai");
    OrganizationProvisioningCenterUserSwitchClient.CenterUserSwitchCommand command =
        centerUserSwitchClient.commands.get(0);
    assertThat(command.jobId()).isEqualTo(31L);
    assertThat(command.lockOwner()).isEqualTo("worker-a");
    assertThat(command.sourceOrgId()).isEqualTo(1001L);
    assertThat(command.sourceCustomerId()).isEqualTo("public");
    assertThat(command.targetCustomerId()).isEqualTo("org001");
    assertThat(command.targetDbName()).isEqualTo("tenant_org001");
    assertThat(command.customerName()).isEqualTo("Owner的专属空间");
    assertThat(command.members()).hasSize(2);
    assertThat(command.members().get(0).centerUserId()).isEqualTo(7L);
    assertThat(command.members().get(1).centerUsername()).isEqualTo("staff");
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
    assertThat(jdbcTemplate.jobs.get(0).heartbeatAt)
        .isEqualTo(Instant.parse("2026-07-03T09:50:00Z"));
  }

  @Test
  void switchCenterUserToTargetBlocksWhenConfirmTargetDbNameMismatches() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    FakeCenterUserSwitchClient centerUserSwitchClient = new FakeCenterUserSwitchClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyPreviewClient(),
                centerUserSwitchClient,
                new FakeRoleSnapshotCopyClient(),
                new FakeMemberMigrationClient(),
                new FakeUserScopedDataMigrationClient(),
                new FakeRoleSnapshotCenterWriteClient())
            .switchCenterUserToTarget(
                31L, "worker-a", "wrong_db", Instant.parse("2026-07-03T09:50:00Z"));

    assertThat(result)
        .containsEntry("centerSwitchExecuted", false)
        .containsEntry("confirmTargetDbName", "wrong_db")
        .containsEntry("executeMigration", false)
        .containsEntry("roleMemberMigrationStatus", "blocked")
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("tenantProvisioningCompleted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("confirmTargetDbName 与任务 targetDbName 不一致");
    assertThat(centerUserSwitchClient.commands).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void switchCenterUserToTargetBlocksWhenRoleSnapshotWasNotWritten() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.centerTables.addAll(
        List.of("customer", "organization_tenant_mapping", "refresh_token", "tenant_provisioning_role_snapshot"));
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    FakeCenterUserSwitchClient centerUserSwitchClient = new FakeCenterUserSwitchClient();

    Map<String, Object> result =
        service(
                jdbcTemplate,
                readyPreviewClient(),
                centerUserSwitchClient,
                new FakeRoleSnapshotCopyClient(),
                new FakeMemberMigrationClient(),
                new FakeUserScopedDataMigrationClient(),
                new FakeRoleSnapshotCenterWriteClient())
            .switchCenterUserToTarget(
                31L,
                "worker-a",
                "tenant_org001",
                Instant.parse("2026-07-03T09:50:00Z"));

    assertThat(result)
        .containsEntry("centerSwitchExecuted", false)
        .containsEntry("executeMigration", false)
        .containsEntry("roleMemberMigrationStatus", "blocked")
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("tenantProvisioningCompleted", false);
    @SuppressWarnings("unchecked")
    List<String> blockedReasons = (List<String>) result.get("blockedReasons");
    assertThat(blockedReasons).contains("中心库角色快照未写入，禁止切换中心用户");
    assertThat(centerUserSwitchClient.commands).isEmpty();
    assertThat(jdbcTemplate.updateCount).isZero();
  }

  @Test
  void switchCenterUserToTargetStopsWhenHeartbeatLeaseIsLost() {
    RoleMemberJdbcTemplate jdbcTemplate = new RoleMemberJdbcTemplate();
    jdbcTemplate.centerTables.addAll(
        List.of("customer", "organization_tenant_mapping", "refresh_token", "tenant_provisioning_role_snapshot"));
    jdbcTemplate.roleSnapshotRows = 1;
    jdbcTemplate.jobs.add(JobFixture.valid());
    jdbcTemplate.members.add(MemberFixture.owner());
    jdbcTemplate.updateRows = 0;
    FakeCenterUserSwitchClient centerUserSwitchClient = new FakeCenterUserSwitchClient();

    assertThatThrownBy(
            () ->
                service(
                        jdbcTemplate,
                        readyPreviewClient(),
                        centerUserSwitchClient,
                        new FakeRoleSnapshotCopyClient(),
                        new FakeMemberMigrationClient(),
                        new FakeUserScopedDataMigrationClient(),
                        new FakeRoleSnapshotCenterWriteClient())
                    .switchCenterUserToTarget(
                        31L,
                        "worker-a",
                        "tenant_org001",
                        Instant.parse("2026-07-03T09:50:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessage("租户开通任务租约已失效，停止中心用户租户切换");
    assertThat(centerUserSwitchClient.commands).hasSize(1);
    assertThat(jdbcTemplate.updateCount).isEqualTo(1);
  }

  @Test
  void previewRequiresJobIdAndWorkerId() {
    OrganizationProvisioningRoleMemberMigrationPlanService service =
        service(new RoleMemberJdbcTemplate(), new FakeRoleMemberPreviewClient());

    assertThatThrownBy(() -> service.previewMigration(0L, "worker-a", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织角色成员迁移预览缺少 jobId");
    assertThatThrownBy(() -> service.previewMigration(31L, " ", Instant.now()))
        .isInstanceOf(BusinessException.class)
        .hasMessage("组织角色成员迁移预览缺少 workerId");
  }

  private FakeRoleMemberPreviewClient readyPreviewClient() {
    FakeRoleMemberPreviewClient previewClient = new FakeRoleMemberPreviewClient();
    previewClient.inspection =
        new OrganizationProvisioningRoleMemberMigrationPreviewClient.RoleMemberMigrationInspection(
            List.of(),
            List.of(),
            List.of(
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.OrganizationRolePlan(
                    10L, null, "Org Admin")),
            List.of(),
            1,
            1,
            0,
            0,
            List.of(
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.MemberSourceUserPlan(
                    7L, "owner", "id", "70", true, 70L, "owner", 1, 0)));
    return previewClient;
  }

  private FakeRoleMemberPreviewClient readyMembersPreviewClient() {
    FakeRoleMemberPreviewClient previewClient = new FakeRoleMemberPreviewClient();
    previewClient.inspection =
        new OrganizationProvisioningRoleMemberMigrationPreviewClient.RoleMemberMigrationInspection(
            List.of(),
            List.of(),
            List.of(
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.OrganizationRolePlan(
                    10L, null, "Org Admin"),
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.OrganizationRolePlan(
                    11L, 10L, "Staff")),
            List.of(),
            2,
            2,
            0,
            0,
            List.of(
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.MemberSourceUserPlan(
                    7L, "owner", "id", "70", true, 70L, "owner", 1, 0),
                new OrganizationProvisioningRoleMemberMigrationPreviewClient.MemberSourceUserPlan(
                    8L, "member", "id", "88", true, 88L, "staff", 1, 1)));
    return previewClient;
  }

  private OrganizationProvisioningRoleMemberMigrationPlanService service(
      RoleMemberJdbcTemplate jdbcTemplate,
      OrganizationProvisioningRoleMemberMigrationPreviewClient previewClient) {
    return service(jdbcTemplate, previewClient, new FakeRoleSnapshotCopyClient());
  }

  private OrganizationProvisioningRoleMemberMigrationPlanService service(
      RoleMemberJdbcTemplate jdbcTemplate,
      OrganizationProvisioningRoleMemberMigrationPreviewClient previewClient,
      OrganizationProvisioningRoleSnapshotCopyClient roleSnapshotCopyClient) {
    return service(jdbcTemplate, previewClient, roleSnapshotCopyClient, new FakeMemberMigrationClient());
  }

  private OrganizationProvisioningRoleMemberMigrationPlanService service(
      RoleMemberJdbcTemplate jdbcTemplate,
      OrganizationProvisioningRoleMemberMigrationPreviewClient previewClient,
      OrganizationProvisioningRoleSnapshotCopyClient roleSnapshotCopyClient,
      OrganizationProvisioningMemberMigrationClient memberMigrationClient) {
    return service(
        jdbcTemplate,
        previewClient,
        roleSnapshotCopyClient,
        memberMigrationClient,
        new FakeUserScopedDataMigrationClient());
  }

  private OrganizationProvisioningRoleMemberMigrationPlanService service(
      RoleMemberJdbcTemplate jdbcTemplate,
      OrganizationProvisioningRoleMemberMigrationPreviewClient previewClient,
      OrganizationProvisioningRoleSnapshotCopyClient roleSnapshotCopyClient,
      OrganizationProvisioningMemberMigrationClient memberMigrationClient,
      OrganizationProvisioningUserScopedDataMigrationClient userScopedDataMigrationClient) {
    return service(
        jdbcTemplate,
        previewClient,
        roleSnapshotCopyClient,
        memberMigrationClient,
        userScopedDataMigrationClient,
        new FakeRoleSnapshotCenterWriteClient());
  }

  private OrganizationProvisioningRoleMemberMigrationPlanService service(
      RoleMemberJdbcTemplate jdbcTemplate,
      OrganizationProvisioningRoleMemberMigrationPreviewClient previewClient,
      OrganizationProvisioningRoleSnapshotCopyClient roleSnapshotCopyClient,
      OrganizationProvisioningMemberMigrationClient memberMigrationClient,
      OrganizationProvisioningUserScopedDataMigrationClient userScopedDataMigrationClient,
      OrganizationProvisioningRoleSnapshotCenterWriteClient roleSnapshotCenterWriteClient) {
    return service(
        jdbcTemplate,
        previewClient,
        new FakeCenterUserSwitchClient(),
        roleSnapshotCopyClient,
        memberMigrationClient,
        userScopedDataMigrationClient,
        roleSnapshotCenterWriteClient);
  }

  private OrganizationProvisioningRoleMemberMigrationPlanService service(
      RoleMemberJdbcTemplate jdbcTemplate,
      OrganizationProvisioningRoleMemberMigrationPreviewClient previewClient,
      OrganizationProvisioningCenterUserSwitchClient centerUserSwitchClient,
      OrganizationProvisioningRoleSnapshotCopyClient roleSnapshotCopyClient,
      OrganizationProvisioningMemberMigrationClient memberMigrationClient,
      OrganizationProvisioningUserScopedDataMigrationClient userScopedDataMigrationClient,
      OrganizationProvisioningRoleSnapshotCenterWriteClient roleSnapshotCenterWriteClient) {
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
    return new OrganizationProvisioningRoleMemberMigrationPlanService(
        jdbcTemplate,
        appProperties,
        tenantProperties,
        environment,
        previewClient,
        centerUserSwitchClient,
        memberMigrationClient,
        roleSnapshotCopyClient,
        roleSnapshotCenterWriteClient,
        userScopedDataMigrationClient);
  }

  private static final class FakeRoleMemberPreviewClient
      implements OrganizationProvisioningRoleMemberMigrationPreviewClient {

    private RoleMemberMigrationInspection inspection =
        new RoleMemberMigrationInspection(List.of(), List.of(), List.of(), List.of(), 0, 0, 0, 0, List.of());
    private final List<List<SourceUserLookup>> lookups = new ArrayList<>();
    private final List<String> sourceJdbcUrls = new ArrayList<>();
    private final List<Long> sourceOrgIds = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public RoleMemberMigrationInspection inspect(
        String sourceJdbcUrl,
        String targetJdbcUrl,
        long sourceOrgId,
        List<SourceUserLookup> sourceUserLookups) {
      sourceJdbcUrls.add(sourceJdbcUrl);
      targetJdbcUrls.add(targetJdbcUrl);
      sourceOrgIds.add(sourceOrgId);
      lookups.add(List.copyOf(sourceUserLookups));
      return inspection;
    }
  }

  private static final class FakeRoleSnapshotCopyClient
      implements OrganizationProvisioningRoleSnapshotCopyClient {

    private final List<String> sourceJdbcUrls = new ArrayList<>();
    private final List<Long> sourceOrgIds = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public RoleSnapshotCopyResult copyOrganizationRoleSnapshot(
        String sourceJdbcUrl,
        String targetJdbcUrl,
        long sourceOrgId,
        java.util.function.IntSupplier heartbeatAfterEachCopiedChunk) {
      sourceJdbcUrls.add(sourceJdbcUrl);
      targetJdbcUrls.add(targetJdbcUrl);
      sourceOrgIds.add(sourceOrgId);
      heartbeatAfterEachCopiedChunk.getAsInt();
      return new RoleSnapshotCopyResult(
          List.of("role", "code", "park", "role_menu", "role_park", "role_code"),
          2,
          1,
          1,
          2,
          3,
          1,
          2,
          List.of(new RoleSnapshotItem(10L, 10L, "Org Admin"), new RoleSnapshotItem(11L, 11L, "Staff")),
          11);
    }
  }

  private static final class FakeMemberMigrationClient
      implements OrganizationProvisioningMemberMigrationClient {

    private final List<List<MemberMigrationCommand>> commands = new ArrayList<>();
    private final List<String> sourceJdbcUrls = new ArrayList<>();
    private final List<Long> sourceOrgIds = new ArrayList<>();
    private final List<String> targetCustomerIds = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public MemberMigrationResult migrateOrganizationMembers(
        String sourceJdbcUrl,
        String targetJdbcUrl,
        long sourceOrgId,
        String targetCustomerId,
        List<MemberMigrationCommand> members,
        java.util.function.IntSupplier heartbeatAfterEachMember) {
      sourceJdbcUrls.add(sourceJdbcUrl);
      targetJdbcUrls.add(targetJdbcUrl);
      sourceOrgIds.add(sourceOrgId);
      targetCustomerIds.add(targetCustomerId);
      commands.add(List.copyOf(members));

      List<MemberMigrationItem> items = new ArrayList<>();
      for (MemberMigrationCommand member : members) {
        heartbeatAfterEachMember.getAsInt();
        List<Long> roleIds = "owner".equals(member.memberRole()) ? List.of(1L) : List.of(11L);
        List<String> codes = "owner".equals(member.memberRole()) ? List.of("system:all") : List.of("staff:view");
        items.add(
            new MemberMigrationItem(
                member.centerUserId(),
                member.memberRole(),
                codes,
                member.sourceUserId(),
                member.centerUsername(),
                10_000L + member.centerUserId(),
                roleIds,
                codes.size(),
                roleIds.size()));
      }
      return new MemberMigrationResult(
          List.copyOf(items), items.size(), items.size(), items.size(), items.size());
    }
  }

  private static final class FakeUserScopedDataMigrationClient
      implements OrganizationProvisioningUserScopedDataMigrationClient {

    private final List<List<UserScopedDataMigrationCommand>> commands = new ArrayList<>();
    private final List<String> sourceJdbcUrls = new ArrayList<>();
    private final List<String> targetCustomerIds = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public UserScopedDataMigrationResult migrateUserScopedData(
        String sourceJdbcUrl,
        String targetJdbcUrl,
        String targetCustomerId,
        List<UserScopedDataMigrationCommand> members,
        java.util.function.IntSupplier heartbeatAfterEachCopiedChunk) {
      sourceJdbcUrls.add(sourceJdbcUrl);
      targetJdbcUrls.add(targetJdbcUrl);
      targetCustomerIds.add(targetCustomerId);
      commands.add(List.copyOf(members));

      List<UserScopedDataMigrationItem> items = new ArrayList<>();
      for (UserScopedDataMigrationCommand member : members) {
        heartbeatAfterEachCopiedChunk.getAsInt();
        List<TableCopySummary> memberCopies =
            List.of(
                new TableCopySummary("localization", 1, 1),
                new TableCopySummary("attendances", 2, 0));
        items.add(
            new UserScopedDataMigrationItem(
                member.centerUserId(),
                member.sourceUserId(),
                member.centerUsername(),
                10_000L + member.centerUserId(),
                3,
                1,
                memberCopies));
      }
      List<TableCopySummary> tableCopies =
          List.of(
              new TableCopySummary("localization", members.size(), members.size()),
              new TableCopySummary("attendances", members.size() * 2L, 0));
      return new UserScopedDataMigrationResult(List.copyOf(items), tableCopies, items.size());
    }
  }

  private static final class FakeRoleSnapshotCenterWriteClient
      implements OrganizationProvisioningRoleSnapshotCenterWriteClient {

    private final List<List<RoleSnapshotCenterWriteCommand>> commands = new ArrayList<>();
    private final List<Long> jobIds = new ArrayList<>();
    private final List<Long> sourceOrgIds = new ArrayList<>();

    @Override
    public RoleSnapshotCenterWriteResult writeRoleSnapshots(
        long jobId,
        long sourceOrgId,
        List<RoleSnapshotCenterWriteCommand> snapshots,
        java.util.function.IntSupplier heartbeatAfterCenterWrite) {
      jobIds.add(jobId);
      sourceOrgIds.add(sourceOrgId);
      commands.add(List.copyOf(snapshots));
      heartbeatAfterCenterWrite.getAsInt();
      return new RoleSnapshotCenterWriteResult(
          1L, snapshots.size(), jobId, sourceOrgId, List.copyOf(snapshots));
    }
  }

  private static final class FakeCenterUserSwitchClient
      implements OrganizationProvisioningCenterUserSwitchClient {

    private final List<CenterUserSwitchCommand> commands = new ArrayList<>();
    private final List<String> targetJdbcUrls = new ArrayList<>();

    @Override
    public CenterUserSwitchResult switchCenterUsersToTarget(
        String targetJdbcUrl,
        CenterUserSwitchCommand command,
        java.util.function.IntSupplier heartbeatAfterCenterSwitch) {
      targetJdbcUrls.add(targetJdbcUrl);
      commands.add(command);
      heartbeatAfterCenterSwitch.getAsInt();
      List<CenterUserSwitchMemberResult> members = new ArrayList<>();
      for (CenterUserSwitchMemberCommand member : command.members()) {
        members.add(
            new CenterUserSwitchMemberResult(
                member.centerUserId(),
                member.centerUsername(),
                10_000L + member.centerUserId(),
                command.sourceCustomerId(),
                true,
                1,
                1));
      }
      return new CenterUserSwitchResult(
          command.jobId(),
          command.targetCustomerId(),
          command.targetDbName(),
          1,
          1,
          List.copyOf(members));
    }
  }

  private static final class RoleMemberJdbcTemplate extends JdbcTemplate {

    private final Set<String> centerTables =
        new LinkedHashSet<>(
            List.of("tenant_provisioning_job", "organization_member", "user", "user_tenant_mapping"));
    private final List<JobFixture> jobs = new ArrayList<>();
    private final List<MemberFixture> members = new ArrayList<>();
    private long roleSnapshotRows;
    private int updateCount;
    private int updateRows;

    @Override
    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
      if (sql.contains("information_schema.tables")) {
        return requiredType.cast(centerTables.contains(String.valueOf(args[0])) ? 1L : 0L);
      }
      if (sql.contains("FROM tenant_provisioning_role_snapshot")) {
        return requiredType.cast(roleSnapshotRows);
      }
      return requiredType.cast(0L);
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      if (sql.contains("FROM tenant_provisioning_job")) {
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
      if (sql.contains("FROM organization_member member")) {
        long sourceOrgId = ((Number) args[0]).longValue();
        String sourceCustomerId = String.valueOf(args[1]);
        return (List<T>)
            members.stream()
                .filter(member -> member.sourceOrgId == sourceOrgId)
                .filter(member -> sourceCustomerId.equals(member.sourceCustomerId))
                .map(member -> map(rowMapper, resultSet(member)))
                .toList();
      }
      if (sql.contains("FROM user_tenant_mapping")) {
        return List.of();
      }
      return List.of();
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
        when(rs.getLong("initiator_center_user_id")).thenReturn(job.initiatorCenterUserId);
        when(rs.getLong("source_org_id")).thenReturn(job.sourceOrgId);
        when(rs.getString("source_customer_id")).thenReturn(job.sourceCustomerId);
        when(rs.getString("target_customer_id")).thenReturn(job.targetCustomerId);
        when(rs.getString("target_city")).thenReturn(job.targetCity);
        when(rs.getString("target_company_short_name")).thenReturn(job.targetCompanyShortName);
        when(rs.getString("target_db_name")).thenReturn(job.targetDbName);
        when(rs.getString("status")).thenReturn(job.status);
        when(rs.getString("step")).thenReturn(job.step);
        when(rs.getString("lock_owner")).thenReturn(job.lockOwner);
        when(rs.getTimestamp("locked_at")).thenReturn(timestamp(job.lockedAt));
        when(rs.getTimestamp("heartbeat_at")).thenReturn(timestamp(job.heartbeatAt));
        when(rs.getTimestamp("update_time")).thenReturn(timestamp(job.updateTime));
        when(rs.wasNull()).thenReturn(false);
      } catch (SQLException error) {
        throw new IllegalStateException(error);
      }
      return rs;
    }

    private ResultSet resultSet(MemberFixture member) {
      ResultSet rs = mock(ResultSet.class);
      try {
        when(rs.getLong("member_id")).thenReturn(member.memberId);
        when(rs.getLong("center_user_id")).thenReturn(member.centerUserId);
        when(rs.getLong("source_user_id")).thenReturn(member.sourceUserId);
        when(rs.getString("member_role")).thenReturn(member.memberRole);
        when(rs.getString("center_username")).thenReturn(member.centerUsername);
        when(rs.getString("center_real_name")).thenReturn(member.centerRealName);
        when(rs.getString("center_password")).thenReturn(member.centerPassword);
        when(rs.getInt("center_status")).thenReturn(member.centerStatus);
        when(rs.getString("customer_type")).thenReturn(member.customerType);
        when(rs.getString("center_phone")).thenReturn(member.centerPhone);
        when(rs.getString("center_home_path")).thenReturn(member.centerHomePath);
        when(rs.wasNull()).thenReturn(false);
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

    private Instant heartbeatAt = Instant.parse("2026-07-03T08:50:00Z");
    private final long id = 31L;
    private final long initiatorCenterUserId = 7L;
    private final Instant lockedAt = Instant.parse("2026-07-03T08:40:00Z");
    private final String lockOwner = "worker-a";
    private final String sourceCustomerId = "public";
    private final long sourceOrgId = 1001L;
    private final String status = "provisioning";
    private final String step = "seeding_base_data";
    private final String targetCity = "杭州";
    private final String targetCompanyShortName = null;
    private final String targetCustomerId = "org001";
    private final String targetDbName = "tenant_org001";
    private Instant updateTime = Instant.parse("2026-07-03T08:50:00Z");

    private static JobFixture valid() {
      return new JobFixture();
    }
  }

  private static final class MemberFixture {

    private String centerHomePath = "/dashboard";
    private String centerPassword = "hashed-owner-password";
    private String centerPhone = "13800000000";
    private String centerRealName = "Owner";
    private int centerStatus = 1;
    private long centerUserId = 7L;
    private String centerUsername = "owner";
    private String customerType = "public";
    private long memberId = 1L;
    private String memberRole = "owner";
    private String sourceCustomerId = "public";
    private long sourceOrgId = 1001L;
    private long sourceUserId = 70L;

    private static MemberFixture owner() {
      return new MemberFixture();
    }

    private static MemberFixture staff() {
      MemberFixture fixture = new MemberFixture();
      fixture.centerRealName = "Staff";
      fixture.centerPassword = "hashed-staff-password";
      fixture.centerUserId = 8L;
      fixture.centerUsername = "staff";
      fixture.memberId = 2L;
      fixture.memberRole = "member";
      fixture.sourceUserId = 88L;
      return fixture;
    }
  }
}
