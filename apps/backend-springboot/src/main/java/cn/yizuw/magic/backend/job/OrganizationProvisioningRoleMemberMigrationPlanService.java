package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.tenant.TenantDataSourceProperties;
import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 组织角色和成员迁移计划服务；按灰度开关分阶段预览和执行目标租户库写入。 */
@Service
public class OrganizationProvisioningRoleMemberMigrationPlanService {

  private static final String SEEDING_BASE_DATA_STEP = "seeding_base_data";
  private static final List<String> CENTER_TABLES =
      List.of("tenant_provisioning_job", "organization_member", "user", "user_tenant_mapping");
  private static final List<String> CENTER_USER_SWITCH_TABLES =
      List.of(
          "customer",
          "organization_tenant_mapping",
          "refresh_token",
          "tenant_provisioning_role_snapshot");
  private static final List<String> PLANNED_ROLE_TABLES =
      List.of("role", "code", "park", "role_menu", "role_park", "role_code");
  private static final List<String> PLANNED_MEMBER_TABLES =
      List.of("user", "user_role", "user_code");
  private static final List<String> PLANNED_USER_SCOPED_TABLES =
      List.of(
          "localization",
          "attendances",
          "feedback",
          "leave_application",
          "reimbursement",
          "reimbursement_image",
          "investment",
          "investment_image");
  private static final Set<String> SYSTEM_DATABASE_NAMES =
      Set.of("information_schema", "mysql", "performance_schema", "sys");

  private final AppProperties appProperties;
  private final JdbcTemplate centerJdbcTemplate;
  private final Environment environment;
  private final OrganizationProvisioningCenterUserSwitchClient centerUserSwitchClient;
  private final OrganizationProvisioningMemberMigrationClient memberMigrationClient;
  private final OrganizationProvisioningRoleMemberMigrationPreviewClient previewClient;
  private final OrganizationProvisioningRoleSnapshotCenterWriteClient roleSnapshotCenterWriteClient;
  private final OrganizationProvisioningRoleSnapshotCopyClient roleSnapshotCopyClient;
  private final TenantDataSourceProperties tenantDataSourceProperties;
  private final OrganizationProvisioningUserScopedDataMigrationClient userScopedDataMigrationClient;

  public OrganizationProvisioningRoleMemberMigrationPlanService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate,
      AppProperties appProperties,
      TenantDataSourceProperties tenantDataSourceProperties,
      Environment environment,
      OrganizationProvisioningRoleMemberMigrationPreviewClient previewClient,
      OrganizationProvisioningCenterUserSwitchClient centerUserSwitchClient,
      OrganizationProvisioningMemberMigrationClient memberMigrationClient,
      OrganizationProvisioningRoleSnapshotCopyClient roleSnapshotCopyClient,
      OrganizationProvisioningRoleSnapshotCenterWriteClient roleSnapshotCenterWriteClient,
      OrganizationProvisioningUserScopedDataMigrationClient userScopedDataMigrationClient) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.appProperties = appProperties;
    this.tenantDataSourceProperties = tenantDataSourceProperties;
    this.environment = environment;
    this.previewClient = previewClient;
    this.centerUserSwitchClient = centerUserSwitchClient;
    this.memberMigrationClient = memberMigrationClient;
    this.roleSnapshotCopyClient = roleSnapshotCopyClient;
    this.roleSnapshotCenterWriteClient = roleSnapshotCenterWriteClient;
    this.userScopedDataMigrationClient = userScopedDataMigrationClient;
  }

  /**
   * 预览旧 worker 的 `copyOrganizationRoleSnapshot(...)` 和
   * `resolveOrganizationMembers(...)` 前置条件。
   *
   * <p>本方法只读中心库、源租户库和目标租户库；不复制角色、不创建目标用户、
   * 不更新 `tenant_provisioning_role_snapshot`，也不刷新 heartbeat。
   */
  @Transactional(readOnly = true)
  public Map<String, Object> previewMigration(long jobId, String workerId, Instant previewedAt) {
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织角色成员迁移预览缺少 jobId");
    }
    if (!StringUtils.hasText(workerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织角色成员迁移预览缺少 workerId");
    }
    String normalizedWorkerId = workerId.trim();
    Instant now = previewedAt == null ? Instant.now() : previewedAt;
    Map<String, Object> result = baseResult(jobId, normalizedWorkerId, now);

    List<String> missingCenterTables = missingCenterTables();
    result.put("missingCenterTables", missingCenterTables);
    if (!missingCenterTables.isEmpty()) {
      result.put("blockedReasons", List.of("组织角色成员迁移所需中心库表未就绪"));
      return result;
    }

    result.put("tableReady", true);
    ProvisioningRoleMemberJob job = findSeedingBaseDataJob(jobId, normalizedWorkerId);
    if (job == null) {
      result.put("blockedReasons", List.of("任务不存在、租约已丢失或步骤不是 seeding_base_data"));
      result.put("roleMemberMigrationStatus", "lease_lost");
      return result;
    }
    result.putAll(jobMap(job));
    result.put("leaseValid", true);

    List<String> blockedReasons = new ArrayList<>(blockedReasons(job));
    List<CenterMember> members =
        job.sourceOrgId() == null || job.sourceOrgId() <= 0
            ? List.of()
            : findActiveMembers(job.sourceOrgId(), job.sourceCustomerId());
    result.put("activeMemberCount", members.size());
    result.put("centerMemberPlans", memberPlanMaps(members));
    if (job.sourceOrgId() != null && job.sourceOrgId() > 0 && members.isEmpty()) {
      blockedReasons.add("组织缺少 active 成员: sourceOrgId=" + job.sourceOrgId());
    }
    blockedReasons.addAll(centerMemberBlockedReasons(members, job));

    String sourceJdbcUrl = blockedReasons.isEmpty() ? resolveSourceJdbcUrl(job) : "";
    String targetJdbcUrl = blockedReasons.isEmpty() ? resolveTargetJdbcUrl(job) : "";
    if (!blockedReasons.isEmpty()) {
      result.put("blockedReasons", blockedReasons);
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    Map<Long, Long> sourceMappings =
        findSourceUserMappings(
            job.sourceCustomerId(),
            members.stream().map(CenterMember::centerUserId).distinct().toList());
    List<OrganizationProvisioningRoleMemberMigrationPreviewClient.SourceUserLookup> sourceLookups =
        members.stream().map(member -> sourceUserLookup(member, sourceMappings)).toList();
    result.put("sourceJdbcUrlPreview", jdbcUrlPreview(sourceJdbcUrl));
    result.put("targetJdbcUrlPreview", jdbcUrlPreview(targetJdbcUrl));

    OrganizationProvisioningRoleMemberMigrationPreviewClient.RoleMemberMigrationInspection
        inspection =
            previewClient.inspect(sourceJdbcUrl, targetJdbcUrl, job.sourceOrgId(), sourceLookups);
    result.put("missingSourceTables", inspection.missingSourceTables());
    result.put("missingTargetTables", inspection.missingTargetTables());
    result.put("sourceUserPlans", sourceUserPlanMaps(inspection.memberSourceUsers()));
    result.put("roleSnapshotPlan", roleSnapshotPlanMap(inspection));
    result.put("sourceUserMappingCount", sourceMappings.size());

    blockedReasons.addAll(inspectionBlockedReasons(inspection, job.sourceOrgId()));
    if (!blockedReasons.isEmpty()) {
      result.put("blockedReasons", blockedReasons);
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    result.put("blockedReasons", List.of());
    result.put("roleMemberMigrationStatus", "ready");
    result.put("nextExplicitSwitch", "executeOrganizationRolesAndMembers");
    return result;
  }

  /**
   * 显式执行组织角色快照复制。
   *
   * <p>本批只复制旧 worker `copyOrganizationRoleSnapshot(...)` 覆盖的角色、权限码、园区和关联表；
   * 不创建目标用户、不分配成员角色、不迁移用户范围数据、不写中心库角色快照。
   */
  public Map<String, Object> executeOrganizationRolesAndMembers(
      long jobId, String workerId, String confirmTargetDbName, Instant executedAt) {
    Map<String, Object> result = previewMigration(jobId, workerId, executedAt);
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("executeMigration", false);
    result.put("heartbeatUpdatedRows", 0);
    result.put("organizationMembersMigrated", false);
    result.put("roleSnapshotCopied", false);
    result.put("roleSnapshotExecuted", false);
    if (!"ready".equals(result.get("roleMemberMigrationStatus"))) {
      return result;
    }

    String targetDbName = string(result.get("targetDbName"));
    if (!StringUtils.hasText(confirmTargetDbName)
        || !targetDbName.equals(confirmTargetDbName.trim())) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "confirmTargetDbName 与任务 targetDbName 不一致"));
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    long sourceOrgId = numberValue(result.get("sourceOrgId"));
    String sourceJdbcUrl = sourceJdbcUrlFromResult(result);
    String targetJdbcUrl = targetJdbcUrlFromResult(result);
    Instant now = executedAt == null ? Instant.now() : executedAt;
    AtomicInteger heartbeatRows = new AtomicInteger();
    OrganizationProvisioningRoleSnapshotCopyClient.RoleSnapshotCopyResult copyResult =
        roleSnapshotCopyClient.copyOrganizationRoleSnapshot(
            sourceJdbcUrl,
            targetJdbcUrl,
            sourceOrgId,
            () -> {
              int rows = refreshHeartbeat(jobId, workerId.trim(), now);
              if (rows <= 0) {
                throw new BusinessException(
                    HttpStatus.CONFLICT, "租户开通任务租约已失效，停止组织角色快照复制");
              }
              heartbeatRows.addAndGet(rows);
              return rows;
            });

    result.put("copiedTables", copyResult.copiedTables());
    result.put("copyResult", copyResultMap(copyResult));
    result.put("executeMigration", true);
    result.put("heartbeatUpdatedRows", heartbeatRows.get());
    result.put("migrationPreviewOnly", false);
    result.put("nextExplicitSwitch", "executeOrganizationMembers");
    result.put("organizationMembersMigrated", false);
    result.put("roleMemberMigrationStatus", "success");
    result.put("roleSnapshotCopied", true);
    result.put("roleSnapshotExecuted", true);
    result.put("roleSnapshotPlan", executedRoleSnapshotPlan(copyResult));
    result.put("targetWriteExecuted", true);
    return result;
  }

  /**
   * 显式执行组织成员迁移。
   *
   * <p>本批只创建/更新目标租户用户，并重建成员的 `user_role`、`user_code`；
   * 不迁移用户范围业务表、不写中心库角色快照、不切换中心用户租户归属。
   */
  public Map<String, Object> executeOrganizationMembers(
      long jobId, String workerId, String confirmTargetDbName, Instant executedAt) {
    Map<String, Object> result = previewMigration(jobId, workerId, executedAt);
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("executeMigration", false);
    result.put("heartbeatUpdatedRows", 0);
    result.put("memberMigrationExecuted", false);
    result.put("organizationMembersMigrated", false);
    result.put("roleSnapshotCopied", false);
    result.put("roleSnapshotExecuted", false);
    result.put("targetUsersUpserted", 0L);
    result.put("userCodeRowsInserted", 0L);
    result.put("userRoleRowsInserted", 0L);
    if (!"ready".equals(result.get("roleMemberMigrationStatus"))) {
      return result;
    }

    String targetDbName = string(result.get("targetDbName"));
    if (!StringUtils.hasText(confirmTargetDbName)
        || !targetDbName.equals(confirmTargetDbName.trim())) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "confirmTargetDbName 与任务 targetDbName 不一致"));
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    ProvisioningRoleMemberJob job = jobFromResult(result);
    String sourceJdbcUrl = sourceJdbcUrlFromResult(result);
    String targetJdbcUrl = targetJdbcUrlFromResult(result);
    Instant now = executedAt == null ? Instant.now() : executedAt;
    AtomicInteger heartbeatRows = new AtomicInteger();
    OrganizationProvisioningMemberMigrationClient.MemberMigrationResult migrationResult =
        memberMigrationClient.migrateOrganizationMembers(
            sourceJdbcUrl,
            targetJdbcUrl,
            job.sourceOrgId(),
            job.targetCustomerId(),
            memberMigrationCommands(job),
            () -> {
              int rows = refreshHeartbeat(jobId, workerId.trim(), now);
              if (rows <= 0) {
                throw new BusinessException(
                    HttpStatus.CONFLICT, "租户开通任务租约已失效，停止组织成员迁移");
              }
              heartbeatRows.addAndGet(rows);
              return rows;
            });

    result.put("executeMigration", true);
    result.put("heartbeatUpdatedRows", heartbeatRows.get());
    result.put("memberMigrationExecuted", true);
    result.put("memberMigrationResult", memberMigrationResultMap(migrationResult));
    result.put("migratedMemberTables", PLANNED_MEMBER_TABLES);
    result.put("migrationPreviewOnly", false);
    result.put("nextExplicitSwitch", "executeOrganizationUserScopedData");
    result.put("organizationMembersMigrated", true);
    result.put("organizationMembersMigratedCount", migrationResult.organizationMembersMigrated());
    result.put("roleMemberMigrationStatus", "success");
    result.put("targetUsersUpserted", migrationResult.targetUsersUpserted());
    result.put("targetWriteExecuted", true);
    result.put("totalMemberRowsWritten", migrationResult.totalRowsWritten());
    result.put("userCodeRowsInserted", migrationResult.userCodeRowsInserted());
    result.put("userRoleRowsInserted", migrationResult.userRoleRowsInserted());
    return result;
  }

  /**
   * 显式执行组织成员用户范围业务数据迁移。
   *
   * <p>本批只复制旧 worker `migrateUserScopedData(...)` 覆盖的成员业务表及其 park/image
   * 依赖；不创建用户、不分配角色、不写中心库角色快照、不切换中心用户租户归属。
   */
  public Map<String, Object> executeOrganizationUserScopedData(
      long jobId, String workerId, String confirmTargetDbName, Instant executedAt) {
    Map<String, Object> result = previewMigration(jobId, workerId, executedAt);
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("executeMigration", false);
    result.put("heartbeatUpdatedRows", 0);
    result.put("memberMigrationExecuted", false);
    result.put("organizationMembersMigrated", false);
    result.put("roleSnapshotCopied", false);
    result.put("roleSnapshotExecuted", false);
    result.put("userScopedDataMigrated", false);
    result.put("userScopedDataMigrationExecuted", false);
    result.put("userScopedRowsCopied", 0L);
    if (!"ready".equals(result.get("roleMemberMigrationStatus"))) {
      return result;
    }

    String targetDbName = string(result.get("targetDbName"));
    if (!StringUtils.hasText(confirmTargetDbName)
        || !targetDbName.equals(confirmTargetDbName.trim())) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "confirmTargetDbName 与任务 targetDbName 不一致"));
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    ProvisioningRoleMemberJob job = jobFromResult(result);
    String sourceJdbcUrl = sourceJdbcUrlFromResult(result);
    String targetJdbcUrl = targetJdbcUrlFromResult(result);
    Instant now = executedAt == null ? Instant.now() : executedAt;
    AtomicInteger heartbeatRows = new AtomicInteger();
    OrganizationProvisioningUserScopedDataMigrationClient.UserScopedDataMigrationResult
        migrationResult =
            userScopedDataMigrationClient.migrateUserScopedData(
                sourceJdbcUrl,
                targetJdbcUrl,
                job.targetCustomerId(),
                userScopedDataMigrationCommands(job),
                () -> {
                  int rows = refreshHeartbeat(jobId, workerId.trim(), now);
                  if (rows <= 0) {
                    throw new BusinessException(
                        HttpStatus.CONFLICT, "租户开通任务租约已失效，停止组织用户范围数据迁移");
                  }
                  heartbeatRows.addAndGet(rows);
                  return rows;
                });

    result.put("copiedTables", migrationResult.copiedTables());
    result.put("executeMigration", true);
    result.put("heartbeatUpdatedRows", heartbeatRows.get());
    result.put("migratedUserScopedTables", PLANNED_USER_SCOPED_TABLES);
    result.put("migrationPreviewOnly", false);
    result.put("nextExplicitSwitch", "writeTenantProvisioningRoleSnapshot");
    result.put("roleMemberMigrationStatus", "success");
    result.put("targetWriteExecuted", true);
    result.put("userScopedCopiedChunks", migrationResult.copiedChunks());
    result.put("userScopedDataMigrated", true);
    result.put("userScopedDataMigrationExecuted", true);
    result.put("userScopedDataMigrationResult", userScopedDataMigrationResultMap(migrationResult));
    result.put("userScopedMigratedMemberCount", migrationResult.migratedMemberCount());
    result.put("userScopedRowsCopied", migrationResult.totalRowsCopied());
    return result;
  }

  /**
   * 显式写入中心库组织开通角色快照。
   *
   * <p>本批只按旧 worker `saveOrganizationProvisioningRoleSnapshots(...)` 语义删除并重建
   * `tenant_provisioning_role_snapshot`；不切换中心用户租户归属、不推进 step、不标记任务完成。
   */
  public Map<String, Object> writeTenantProvisioningRoleSnapshot(
      long jobId, String workerId, String confirmTargetDbName, Instant executedAt) {
    Map<String, Object> result = previewMigration(jobId, workerId, executedAt);
    result.put("centerWriteExecuted", false);
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("executeMigration", false);
    result.put("heartbeatUpdatedRows", 0);
    result.put("roleSnapshotCenterWriteExecuted", false);
    result.put("roleSnapshotRowsDeleted", 0L);
    result.put("roleSnapshotRowsInserted", 0L);
    result.put("tenantProvisioningRoleSnapshotWritten", false);
    result.put("targetWriteExecuted", false);
    if (!"ready".equals(result.get("roleMemberMigrationStatus"))) {
      return result;
    }

    String targetDbName = string(result.get("targetDbName"));
    if (!StringUtils.hasText(confirmTargetDbName)
        || !targetDbName.equals(confirmTargetDbName.trim())) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "confirmTargetDbName 与任务 targetDbName 不一致"));
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    if (!tableExists("tenant_provisioning_role_snapshot")) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "中心库缺少 tenant_provisioning_role_snapshot 表"));
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    ProvisioningRoleMemberJob job = jobFromResult(result);
    Instant now = executedAt == null ? Instant.now() : executedAt;
    AtomicInteger heartbeatRows = new AtomicInteger();
    OrganizationProvisioningRoleSnapshotCenterWriteClient.RoleSnapshotCenterWriteResult writeResult =
        roleSnapshotCenterWriteClient.writeRoleSnapshots(
            job.id(),
            job.sourceOrgId(),
            roleSnapshotCenterWriteCommands(result),
            () -> {
              int rows = refreshHeartbeat(jobId, workerId.trim(), now);
              if (rows <= 0) {
                throw new BusinessException(
                    HttpStatus.CONFLICT, "租户开通任务租约已失效，停止组织角色快照中心库写入");
              }
              heartbeatRows.addAndGet(rows);
              return rows;
            });

    result.put("centerWriteExecuted", true);
    result.put("executeMigration", true);
    result.put("heartbeatUpdatedRows", heartbeatRows.get());
    result.put("migrationPreviewOnly", false);
    result.put("nextExplicitSwitch", "switchCenterUserToTarget");
    result.put("roleMemberMigrationStatus", "success");
    result.put("roleSnapshotCenterWriteExecuted", true);
    result.put("roleSnapshotRowsDeleted", writeResult.deletedRows());
    result.put("roleSnapshotRowsInserted", writeResult.insertedRows());
    result.put("roleSnapshotWriteResult", roleSnapshotCenterWriteResultMap(writeResult));
    result.put("tenantProvisioningRoleSnapshotWritten", true);
    result.put("targetWriteExecuted", false);
    return result;
  }

  /**
   * 显式切换中心用户到目标租户。
   *
   * <p>本批只执行旧 worker `switchCenterUserToTarget(...)` 中任务完成前的中心库切换写入；
   * 不把 `tenant_provisioning_job` 标记为 completed，不写 outbox，不发布 Kafka/RabbitMQ。
   */
  public Map<String, Object> switchCenterUserToTarget(
      long jobId, String workerId, String confirmTargetDbName, Instant executedAt) {
    Map<String, Object> result = previewMigration(jobId, workerId, executedAt);
    result.put("centerSwitchExecuted", false);
    result.put("centerUsersSwitched", 0L);
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("executeMigration", false);
    result.put("heartbeatUpdatedRows", 0);
    result.put("organizationTenantMappingRowsAffected", 0);
    result.put("refreshTokenRowsRevoked", 0L);
    result.put("targetWriteExecuted", false);
    result.put("tenantProvisioningCompleted", false);
    result.put("userTenantMappingRowsAffected", 0L);
    if (!"ready".equals(result.get("roleMemberMigrationStatus"))) {
      return result;
    }

    String targetDbName = string(result.get("targetDbName"));
    if (!StringUtils.hasText(confirmTargetDbName)
        || !targetDbName.equals(confirmTargetDbName.trim())) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "confirmTargetDbName 与任务 targetDbName 不一致"));
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    List<String> missingCenterSwitchTables = missingCenterUserSwitchTables();
    result.put("missingCenterSwitchTables", missingCenterSwitchTables);
    if (!missingCenterSwitchTables.isEmpty()) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "中心用户切换所需中心库表未就绪"));
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    if (!roleSnapshotWrittenForJob(jobId)) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "中心库角色快照未写入，禁止切换中心用户"));
      result.put("roleMemberMigrationStatus", "blocked");
      return result;
    }

    ProvisioningRoleMemberJob job = jobFromResult(result);
    String targetJdbcUrl = targetJdbcUrlFromResult(result);
    Instant now = executedAt == null ? Instant.now() : executedAt;
    AtomicInteger heartbeatRows = new AtomicInteger();
    OrganizationProvisioningCenterUserSwitchClient.CenterUserSwitchResult switchResult =
        centerUserSwitchClient.switchCenterUsersToTarget(
            targetJdbcUrl,
            centerUserSwitchCommand(job),
            () -> {
              int rows = refreshHeartbeat(jobId, workerId.trim(), now);
              if (rows <= 0) {
                throw new BusinessException(
                    HttpStatus.CONFLICT, "租户开通任务租约已失效，停止中心用户租户切换");
              }
              heartbeatRows.addAndGet(rows);
              return rows;
            });

    result.put("centerSwitchExecuted", true);
    result.put("centerSwitchResult", centerUserSwitchResultMap(switchResult));
    result.put("centerUsersSwitched", switchResult.centerUsersSwitched());
    result.put("customerRowsAffected", switchResult.customerRowsAffected());
    result.put("executeMigration", true);
    result.put("heartbeatUpdatedRows", heartbeatRows.get());
    result.put("migrationPreviewOnly", false);
    result.put("nextExplicitSwitch", "completeTenantProvisioningJob");
    result.put(
        "organizationTenantMappingRowsAffected",
        switchResult.organizationTenantMappingRowsAffected());
    result.put("refreshTokenRowsRevoked", switchResult.refreshTokenRowsRevoked());
    result.put("roleMemberMigrationStatus", "success");
    result.put("targetWriteExecuted", false);
    result.put("tenantProvisioningCompleted", false);
    result.put("userTenantMappingRowsAffected", switchResult.userTenantMappingRowsAffected());
    return result;
  }

  private Map<String, Object> baseResult(long jobId, String workerId, Instant previewedAt) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("activeMemberCount", 0);
    result.put("blockedReasons", List.of());
    result.put("centerMemberPlans", List.of());
    result.put("executeMigration", false);
    result.put("jobId", jobId);
    result.put("leaseValid", false);
    result.put("migrationPreviewOnly", true);
    result.put("missingCenterTables", List.of());
    result.put("missingSourceTables", List.of());
    result.put("missingTargetTables", List.of());
    result.put("nextExplicitSwitch", "executeOrganizationRolesAndMembers");
    result.put("plannedMemberTables", PLANNED_MEMBER_TABLES);
    result.put("plannedRoleTables", PLANNED_ROLE_TABLES);
    result.put("plannedUserScopedTables", PLANNED_USER_SCOPED_TABLES);
    result.put("previewedAt", previewedAt.toString());
    result.put("requiredStep", SEEDING_BASE_DATA_STEP);
    result.put("roleMemberMigrationStatus", "table_not_ready");
    result.put("roleSnapshotPlan", Map.of());
    result.put("sourceJdbcUrlPreview", Map.of());
    result.put("sourceUserMappingCount", 0);
    result.put("sourceUserPlans", List.of());
    result.put("tableReady", false);
    result.put("targetJdbcUrlPreview", Map.of());
    result.put("targetTable", "tenant_provisioning_job");
    result.put("targetWriteExecuted", false);
    result.put("workerId", workerId);
    return result;
  }

  private List<String> missingCenterTables() {
    List<String> missing = new ArrayList<>();
    for (String tableName : CENTER_TABLES) {
      if (!tableExists(tableName)) {
        missing.add(tableName);
      }
    }
    return missing;
  }

  private List<String> missingCenterUserSwitchTables() {
    List<String> missing = new ArrayList<>();
    for (String tableName : CENTER_USER_SWITCH_TABLES) {
      if (!tableExists(tableName)) {
        missing.add(tableName);
      }
    }
    return missing;
  }

  private boolean roleSnapshotWrittenForJob(long jobId) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM tenant_provisioning_role_snapshot
            WHERE job_id = ?
            """,
            Long.class,
            jobId);
    return count != null && count > 0;
  }

  private ProvisioningRoleMemberJob findSeedingBaseDataJob(long jobId, String workerId) {
    List<ProvisioningRoleMemberJob> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, initiator_center_user_id, source_org_id, source_customer_id,
                   target_customer_id, target_db_name, target_city,
                   target_company_short_name, status, step, lock_owner,
                   locked_at, heartbeat_at, update_time
            FROM tenant_provisioning_job
            WHERE id = ?
              AND lock_owner = ?
              AND status = 'provisioning'
              AND step = 'seeding_base_data'
            LIMIT 1
            """,
            (rs, rowNum) -> job(rs),
            jobId,
            workerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private int refreshHeartbeat(long jobId, String workerId, Instant now) {
    return centerJdbcTemplate.update(
        """
        UPDATE tenant_provisioning_job
        SET heartbeat_at = ?,
            update_time = ?
        WHERE id = ?
          AND lock_owner = ?
          AND status = 'provisioning'
          AND step = 'seeding_base_data'
        """,
        Timestamp.from(now),
        Timestamp.from(now),
        jobId,
        workerId);
  }

  private List<CenterMember> findActiveMembers(long sourceOrgId, String sourceCustomerId) {
    return centerJdbcTemplate.query(
        """
        SELECT member.id AS member_id,
               member.center_user_id,
               member.member_role,
               member.source_user_id,
               center_user.username AS center_username,
               center_user.real_name AS center_real_name,
               center_user.password AS center_password,
               center_user.status AS center_status,
               center_user.customer_type,
               center_user.phone AS center_phone,
               center_user.home_path AS center_home_path
        FROM organization_member member
        LEFT JOIN `user` center_user
          ON center_user.id = member.center_user_id
        WHERE member.organization_id = ?
          AND member.source_customer_id = ?
          AND member.status = 'active'
        ORDER BY member.member_role DESC, member.id ASC
        """,
        (rs, rowNum) -> centerMember(rs),
        sourceOrgId,
        sourceCustomerId);
  }

  private Map<Long, Long> findSourceUserMappings(String sourceCustomerId, List<Long> centerUserIds) {
    if (centerUserIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(", ", centerUserIds.stream().map(ignored -> "?").toList());
    List<Object> args = new ArrayList<>();
    args.add(sourceCustomerId);
    args.addAll(centerUserIds);
    List<UserMapping> mappings =
        centerJdbcTemplate.query(
            """
            SELECT center_user_id, customer_user_id
            FROM user_tenant_mapping
            WHERE customer_id = ?
              AND center_user_id IN (
            """
                + placeholders
                + ")",
            (rs, rowNum) -> new UserMapping(rs.getLong("center_user_id"), rs.getLong("customer_user_id")),
            args.toArray());
    Map<Long, Long> result = new LinkedHashMap<>();
    for (UserMapping mapping : mappings) {
      result.put(mapping.centerUserId(), mapping.customerUserId());
    }
    return result;
  }

  private List<String> blockedReasons(ProvisioningRoleMemberJob job) {
    List<String> reasons = new ArrayList<>();
    if (job.sourceOrgId() == null || job.sourceOrgId() <= 0) {
      reasons.add("缺少 sourceOrgId，无法迁移组织角色/成员");
    }
    if (!StringUtils.hasText(job.sourceCustomerId())) {
      reasons.add("缺少 sourceCustomerId");
    }
    if (!StringUtils.hasText(job.targetCustomerId())) {
      reasons.add("缺少 targetCustomerId");
    } else if (!job.targetCustomerId().trim().matches("\\w+")) {
      reasons.add("targetCustomerId 不合法");
    } else if ("public".equals(job.targetCustomerId().trim())) {
      reasons.add("拒绝把 public 作为自动开通目标租户");
    }
    if (!StringUtils.hasText(job.targetDbName())) {
      reasons.add("缺少 targetDbName");
    } else if (!validDatabaseName(job.targetDbName())) {
      reasons.add("targetDbName 不合法");
    } else if (protectedDatabaseNames().contains(job.targetDbName().trim())) {
      reasons.add("拒绝写入受保护数据库: " + job.targetDbName().trim());
    }
    if (StringUtils.hasText(tenantDataSourceProperties.getJdbcUrlTemplate())
        && !tenantDataSourceProperties.getJdbcUrlTemplate().contains("{customerId}")) {
      reasons.add("CUSTOMER_DATABASE_URL_TEMPLATE 必须包含 {customerId} 占位符");
    }
    if (!StringUtils.hasText(tenantDataSourceProperties.getDefaultJdbcUrl())
        && !StringUtils.hasText(tenantDataSourceProperties.getJdbcUrlTemplate())) {
      reasons.add("缺少 DATABASE_URL 或 CUSTOMER_DATABASE_URL_TEMPLATE，无法解析租户连接");
    }
    if ("public".equals(job.sourceCustomerId())
        && !StringUtils.hasText(tenantDataSourceProperties.getPublicJdbcUrl())) {
      reasons.add("缺少 PUBLIC_DATABASE_URL，无法读取 public 源库");
    }
    if (reasons.isEmpty() && !StringUtils.hasText(resolveSourceJdbcUrl(job))) {
      reasons.add("无法解析源租户 JDBC URL");
    }
    if (reasons.isEmpty() && !StringUtils.hasText(resolveTargetJdbcUrl(job))) {
      reasons.add("无法解析目标租户 JDBC URL");
    }
    return reasons;
  }

  private List<String> centerMemberBlockedReasons(
      List<CenterMember> members, ProvisioningRoleMemberJob job) {
    List<String> reasons = new ArrayList<>();
    for (CenterMember member : members) {
      if (!StringUtils.hasText(member.centerUsername())) {
        reasons.add("组织成员中心用户不存在: " + member.centerUserId());
        continue;
      }
      if (member.centerStatus() != null && member.centerStatus() != 1) {
        reasons.add("组织成员中心用户已禁用: " + member.centerUserId());
      }
      String customerType = string(member.customerType());
      if (StringUtils.hasText(customerType)
          && !customerType.equals(job.sourceCustomerId())
          && !customerType.equals(job.targetCustomerId())) {
        reasons.add(
            "组织成员已归属到其他租户: centerUserId="
                + member.centerUserId()
                + ", customerType="
                + customerType);
      }
    }
    return reasons;
  }

  private List<String> inspectionBlockedReasons(
      OrganizationProvisioningRoleMemberMigrationPreviewClient.RoleMemberMigrationInspection
          inspection,
      long sourceOrgId) {
    List<String> reasons = new ArrayList<>();
    if (!inspection.missingSourceTables().isEmpty() || !inspection.missingTargetTables().isEmpty()) {
      reasons.add("组织角色/成员迁移所需源库或目标库表未就绪");
    }
    if (inspection.organizationRoles().isEmpty()) {
      reasons.add("组织缺少可迁移角色，请先回填默认员工角色: sourceOrgId=" + sourceOrgId);
    }
    if (!inspection.invalidParentRoleIds().isEmpty()) {
      reasons.add("组织角色树存在跨组织父级: roleIds=" + inspection.invalidParentRoleIds());
    }
    for (OrganizationProvisioningRoleMemberMigrationPreviewClient.MemberSourceUserPlan plan :
        inspection.memberSourceUsers()) {
      if (!plan.resolved()) {
        reasons.add(
            "未找到 public 库用户，centerUserId="
                + plan.centerUserId()
                + ", lookup="
                + plan.lookupMode()
                + ":"
                + plan.lookupValue());
      } else if (!"owner".equals(plan.memberRole()) && plan.organizationRoleCount() <= 0) {
        reasons.add(
            "组织普通成员缺少可迁移角色，请先回填默认员工角色: centerUserId="
                + plan.centerUserId()
                + ", sourceOrgId="
                + sourceOrgId);
      }
    }
    return reasons;
  }

  private OrganizationProvisioningRoleMemberMigrationPreviewClient.SourceUserLookup
      sourceUserLookup(CenterMember member, Map<Long, Long> sourceMappings) {
    return new OrganizationProvisioningRoleMemberMigrationPreviewClient.SourceUserLookup(
        member.centerUserId(),
        member.centerUsername(),
        member.sourceUserId(),
        sourceMappings.get(member.centerUserId()),
        StringUtils.hasText(member.memberRole()) ? member.memberRole() : "member");
  }

  private Map<String, Object> roleSnapshotPlanMap(
      OrganizationProvisioningRoleMemberMigrationPreviewClient.RoleMemberMigrationInspection
          inspection) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("invalidParentRoleIds", inspection.invalidParentRoleIds());
    map.put("roleCodeDistinctCodes", inspection.roleCodeDistinctCodes());
    map.put("roleCodeRows", inspection.roleCodeRows());
    map.put("roleCount", inspection.organizationRoles().size());
    map.put("roleIds", inspection.organizationRoles().stream().map(item -> item.roleId()).toList());
    map.put("roleMapMode", "identity");
    map.put("roleParkDistinctParks", inspection.roleParkDistinctParks());
    map.put("roleParkRows", inspection.roleParkRows());
    map.put("roleSnapshots", roleSnapshotMaps(inspection.organizationRoles()));
    return map;
  }

  private List<Map<String, Object>> roleSnapshotMaps(
      List<OrganizationProvisioningRoleMemberMigrationPreviewClient.OrganizationRolePlan> roles) {
    return roles.stream()
        .map(
            role -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("roleName", role.roleName());
              map.put("sourceRoleId", role.roleId());
              map.put("targetRoleId", role.roleId());
              return map;
            })
        .toList();
  }

  private Map<String, Object> executedRoleSnapshotPlan(
      OrganizationProvisioningRoleSnapshotCopyClient.RoleSnapshotCopyResult copyResult) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("roleCount", copyResult.roleSnapshots().size());
    map.put("roleIds", copyResult.roleSnapshots().stream().map(item -> item.sourceRoleId()).toList());
    map.put("roleMapMode", "identity");
    map.put(
        "roleSnapshots",
        copyResult.roleSnapshots().stream()
            .map(
                item -> {
                  Map<String, Object> snapshot = new LinkedHashMap<>();
                  snapshot.put("roleName", item.roleName());
                  snapshot.put("sourceRoleId", item.sourceRoleId());
                  snapshot.put("targetRoleId", item.targetRoleId());
                  return snapshot;
                })
            .toList());
    return map;
  }

  private Map<String, Object> copyResultMap(
      OrganizationProvisioningRoleSnapshotCopyClient.RoleSnapshotCopyResult copyResult) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("codeRowsCopied", copyResult.codeRowsCopied());
    map.put("copiedChunks", copyResult.copiedChunks());
    map.put("copiedTables", copyResult.copiedTables());
    map.put("parkRowsCopied", copyResult.parkRowsCopied());
    map.put("roleCodeRowsCopied", copyResult.roleCodeRowsCopied());
    map.put("roleMenuRowsCopied", copyResult.roleMenuRowsCopied());
    map.put("roleParkRowsCopied", copyResult.roleParkRowsCopied());
    map.put("roleRowsCopied", copyResult.roleRowsCopied());
    map.put("totalRowsCopied", copyResult.totalRowsCopied());
    return map;
  }

  private List<OrganizationProvisioningMemberMigrationClient.MemberMigrationCommand>
      memberMigrationCommands(ProvisioningRoleMemberJob job) {
    List<CenterMember> members = findActiveMembers(job.sourceOrgId(), job.sourceCustomerId());
    Map<Long, Long> sourceMappings =
        findSourceUserMappings(
            job.sourceCustomerId(),
            members.stream().map(CenterMember::centerUserId).distinct().toList());
    return members.stream()
        .map(
            member ->
                new OrganizationProvisioningMemberMigrationClient.MemberMigrationCommand(
                    member.centerUserId(),
                    member.centerUsername(),
                    member.centerRealName(),
                    member.centerPassword(),
                    member.centerPhone(),
                    member.centerHomePath(),
                    StringUtils.hasText(member.memberRole()) ? member.memberRole() : "member",
                    member.sourceUserId() != null
                        ? member.sourceUserId()
                        : sourceMappings.get(member.centerUserId())))
        .toList();
  }

  private Map<String, Object> memberMigrationResultMap(
      OrganizationProvisioningMemberMigrationClient.MemberMigrationResult migrationResult) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("members", memberMigrationItemMaps(migrationResult.members()));
    map.put("organizationMembersMigrated", migrationResult.organizationMembersMigrated());
    map.put("targetUsersUpserted", migrationResult.targetUsersUpserted());
    map.put("totalRowsWritten", migrationResult.totalRowsWritten());
    map.put("userCodeRowsInserted", migrationResult.userCodeRowsInserted());
    map.put("userRoleRowsInserted", migrationResult.userRoleRowsInserted());
    return map;
  }

  private List<Map<String, Object>> memberMigrationItemMaps(
      List<OrganizationProvisioningMemberMigrationClient.MemberMigrationItem> members) {
    return members.stream()
        .map(
            member -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("centerUserId", member.centerUserId());
              map.put("memberRole", member.memberRole());
              map.put("permissionCodes", member.permissionCodes());
              map.put("sourceUserId", member.sourceUserId());
              map.put("sourceUsername", member.sourceUsername());
              map.put("targetRoleIds", member.targetRoleIds());
              map.put("targetUserId", member.targetUserId());
              map.put("userCodeRowsInserted", member.userCodeRowsInserted());
              map.put("userRoleRowsInserted", member.userRoleRowsInserted());
              return map;
            })
        .toList();
  }

  private List<OrganizationProvisioningUserScopedDataMigrationClient.UserScopedDataMigrationCommand>
      userScopedDataMigrationCommands(ProvisioningRoleMemberJob job) {
    List<CenterMember> members = findActiveMembers(job.sourceOrgId(), job.sourceCustomerId());
    Map<Long, Long> sourceMappings =
        findSourceUserMappings(
            job.sourceCustomerId(),
            members.stream().map(CenterMember::centerUserId).distinct().toList());
    return members.stream()
        .map(
            member ->
                new OrganizationProvisioningUserScopedDataMigrationClient.UserScopedDataMigrationCommand(
                    member.centerUserId(),
                    member.centerUsername(),
                    member.centerPhone(),
                    member.sourceUserId() != null
                        ? member.sourceUserId()
                        : sourceMappings.get(member.centerUserId())))
        .toList();
  }

  private Map<String, Object> userScopedDataMigrationResultMap(
      OrganizationProvisioningUserScopedDataMigrationClient.UserScopedDataMigrationResult
          migrationResult) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("copiedChunks", migrationResult.copiedChunks());
    map.put("copiedTables", migrationResult.copiedTables());
    map.put("members", userScopedDataMigrationItemMaps(migrationResult.members()));
    map.put("migratedMemberCount", migrationResult.migratedMemberCount());
    map.put("tableCopies", tableCopySummaryMaps(migrationResult.tableCopies()));
    map.put("totalRowsCopied", migrationResult.totalRowsCopied());
    return map;
  }

  private List<
          OrganizationProvisioningRoleSnapshotCenterWriteClient.RoleSnapshotCenterWriteCommand>
      roleSnapshotCenterWriteCommands(Map<String, Object> result) {
    Object plan = result.get("roleSnapshotPlan");
    if (!(plan instanceof Map<?, ?> planMap)) {
      return List.of();
    }
    Object rawSnapshots = planMap.get("roleSnapshots");
    if (!(rawSnapshots instanceof List<?> snapshots)) {
      return List.of();
    }
    List<OrganizationProvisioningRoleSnapshotCenterWriteClient.RoleSnapshotCenterWriteCommand>
        commands = new ArrayList<>();
    for (Object rawSnapshot : snapshots) {
      if (!(rawSnapshot instanceof Map<?, ?> snapshotMap)) {
        continue;
      }
      commands.add(
          new OrganizationProvisioningRoleSnapshotCenterWriteClient.RoleSnapshotCenterWriteCommand(
              numberValue(snapshotMap.get("sourceRoleId")),
              numberValue(snapshotMap.get("targetRoleId")),
              nullableString(snapshotMap.get("roleName"))));
    }
    return commands;
  }

  private Map<String, Object> roleSnapshotCenterWriteResultMap(
      OrganizationProvisioningRoleSnapshotCenterWriteClient.RoleSnapshotCenterWriteResult
          writeResult) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("deletedRows", writeResult.deletedRows());
    map.put("insertedRows", writeResult.insertedRows());
    map.put("jobId", writeResult.jobId());
    map.put("snapshotCount", writeResult.snapshotCount());
    map.put("snapshots", roleSnapshotCenterWriteCommandMaps(writeResult.snapshots()));
    map.put("sourceOrgId", writeResult.sourceOrgId());
    return map;
  }

  private OrganizationProvisioningCenterUserSwitchClient.CenterUserSwitchCommand
      centerUserSwitchCommand(ProvisioningRoleMemberJob job) {
    return new OrganizationProvisioningCenterUserSwitchClient.CenterUserSwitchCommand(
        job.id(),
        job.lockOwner(),
        job.sourceOrgId(),
        job.sourceCustomerId(),
        job.targetCustomerId(),
        job.targetDbName(),
        job.targetCity(),
        job.targetCompanyShortName(),
        customerName(job),
        centerUserSwitchMemberCommands(job));
  }

  private List<OrganizationProvisioningCenterUserSwitchClient.CenterUserSwitchMemberCommand>
      centerUserSwitchMemberCommands(ProvisioningRoleMemberJob job) {
    return findActiveMembers(job.sourceOrgId(), job.sourceCustomerId()).stream()
        .map(
            member ->
                new OrganizationProvisioningCenterUserSwitchClient
                    .CenterUserSwitchMemberCommand(member.centerUserId(), member.centerUsername()))
        .toList();
  }

  private String customerName(ProvisioningRoleMemberJob job) {
    if (StringUtils.hasText(job.targetCompanyShortName())) {
      return job.targetCompanyShortName().trim();
    }
    String initiatorName =
        findActiveMembers(job.sourceOrgId(), job.sourceCustomerId()).stream()
            .filter(member -> job.initiatorCenterUserId() != null)
            .filter(member -> member.centerUserId() == job.initiatorCenterUserId())
            .map(member -> firstText(member.centerRealName(), member.centerUsername()))
            .filter(StringUtils::hasText)
            .findFirst()
            .orElse("");
    return (StringUtils.hasText(initiatorName) ? initiatorName : "用户") + "的专属空间";
  }

  private Map<String, Object> centerUserSwitchResultMap(
      OrganizationProvisioningCenterUserSwitchClient.CenterUserSwitchResult switchResult) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("centerUsersSwitched", switchResult.centerUsersSwitched());
    map.put("customerRowsAffected", switchResult.customerRowsAffected());
    map.put("jobId", switchResult.jobId());
    map.put("memberCount", switchResult.memberCount());
    map.put("members", centerUserSwitchMemberResultMaps(switchResult.members()));
    map.put(
        "organizationTenantMappingRowsAffected",
        switchResult.organizationTenantMappingRowsAffected());
    map.put("refreshTokenRowsRevoked", switchResult.refreshTokenRowsRevoked());
    map.put("targetCustomerId", switchResult.targetCustomerId());
    map.put("targetDbName", switchResult.targetDbName());
    map.put("userTenantMappingRowsAffected", switchResult.userTenantMappingRowsAffected());
    return map;
  }

  private List<Map<String, Object>> centerUserSwitchMemberResultMaps(
      List<OrganizationProvisioningCenterUserSwitchClient.CenterUserSwitchMemberResult> members) {
    return members.stream()
        .map(
            member -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("centerUserId", member.centerUserId());
              map.put("centerUsername", member.centerUsername());
              map.put("centerUserSwitched", member.centerUserSwitched());
              map.put("previousCustomerType", member.previousCustomerType());
              map.put("refreshTokenRowsRevoked", member.refreshTokenRowsRevoked());
              map.put("targetUserId", member.targetUserId());
              map.put("userTenantMappingRowsAffected", member.userTenantMappingRowsAffected());
              return map;
            })
        .toList();
  }

  private List<Map<String, Object>> roleSnapshotCenterWriteCommandMaps(
      List<OrganizationProvisioningRoleSnapshotCenterWriteClient.RoleSnapshotCenterWriteCommand>
          snapshots) {
    return snapshots.stream()
        .map(
            snapshot -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("roleName", snapshot.roleName());
              map.put("sourceRoleId", snapshot.sourceRoleId());
              map.put("targetRoleId", snapshot.targetRoleId());
              return map;
            })
        .toList();
  }

  private List<Map<String, Object>> userScopedDataMigrationItemMaps(
      List<OrganizationProvisioningUserScopedDataMigrationClient.UserScopedDataMigrationItem>
          members) {
    return members.stream()
        .map(
            member -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("centerUserId", member.centerUserId());
              map.put("copiedChunks", member.copiedChunks());
              map.put("sourceUserId", member.sourceUserId());
              map.put("sourceUsername", member.sourceUsername());
              map.put("tableCopies", tableCopySummaryMaps(member.tableCopies()));
              map.put("targetUserId", member.targetUserId());
              map.put("totalRowsCopied", member.totalRowsCopied());
              return map;
            })
        .toList();
  }

  private List<Map<String, Object>> tableCopySummaryMaps(
      List<OrganizationProvisioningUserScopedDataMigrationClient.TableCopySummary> summaries) {
    return summaries.stream()
        .map(
            summary -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("chunksCopied", summary.chunksCopied());
              map.put("rowsCopied", summary.rowsCopied());
              map.put("tableName", summary.tableName());
              return map;
            })
        .toList();
  }

  private List<Map<String, Object>> memberPlanMaps(List<CenterMember> members) {
    return members.stream()
        .map(
            member -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("centerUserId", member.centerUserId());
              map.put("centerUsername", member.centerUsername());
              map.put("customerType", member.customerType());
              map.put("passwordPresent", StringUtils.hasText(member.centerPassword()));
              map.put("memberRole", member.memberRole());
              map.put("sourceUserId", member.sourceUserId());
              return map;
            })
        .toList();
  }

  private List<Map<String, Object>> sourceUserPlanMaps(
      List<OrganizationProvisioningRoleMemberMigrationPreviewClient.MemberSourceUserPlan> plans) {
    return plans.stream()
        .map(
            plan -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("centerUserId", plan.centerUserId());
              map.put("lookupMode", plan.lookupMode());
              map.put("lookupValue", plan.lookupValue());
              map.put("memberRole", plan.memberRole());
              map.put("organizationRoleCount", plan.organizationRoleCount());
              map.put("resolved", plan.resolved());
              map.put("sourceStatus", plan.sourceStatus());
              map.put("sourceUserId", plan.sourceUserId());
              map.put("sourceUsername", plan.sourceUsername());
              return map;
            })
        .toList();
  }

  private String resolveSourceJdbcUrl(ProvisioningRoleMemberJob job) {
    if ("public".equals(job.sourceCustomerId())) {
      return stripWrappingQuotes(string(tenantDataSourceProperties.getPublicJdbcUrl()).trim());
    }
    return resolveTenantJdbcUrl(job.sourceCustomerId(), null);
  }

  private String sourceJdbcUrlFromResult(Map<String, Object> result) {
    return resolveSourceJdbcUrl(jobFromResult(result));
  }

  private String targetJdbcUrlFromResult(Map<String, Object> result) {
    return resolveTargetJdbcUrl(jobFromResult(result));
  }

  private ProvisioningRoleMemberJob jobFromResult(Map<String, Object> result) {
    return new ProvisioningRoleMemberJob(
        numberValue(result.get("jobId")),
        nullableNumberValue(result.get("initiatorCenterUserId")),
        nullableNumberValue(result.get("sourceOrgId")),
        string(result.get("sourceCustomerId")),
        string(result.get("targetCustomerId")),
        string(result.get("targetDbName")),
        string(result.get("targetCity")),
        string(result.get("targetCompanyShortName")),
        string(result.get("status")),
        string(result.get("step")),
        string(result.get("lockOwner")),
        null,
        null,
        null);
  }

  private String resolveTargetJdbcUrl(ProvisioningRoleMemberJob job) {
    return resolveTenantJdbcUrl(job.targetCustomerId(), job.targetDbName());
  }

  private String resolveTenantJdbcUrl(String customerId, String dbName) {
    String normalizedCustomerId = string(customerId).trim();
    String normalizedDbName = string(dbName).trim();
    String template = stripWrappingQuotes(string(tenantDataSourceProperties.getJdbcUrlTemplate()).trim());
    if (StringUtils.hasText(template)) {
      String rawUrl = template.replace("{customerId}", normalizedCustomerId);
      return StringUtils.hasText(normalizedDbName) ? applyDatabaseName(rawUrl, normalizedDbName) : rawUrl;
    }

    String defaultUrl = stripWrappingQuotes(string(tenantDataSourceProperties.getDefaultJdbcUrl()).trim());
    if (!StringUtils.hasText(defaultUrl)) {
      return "";
    }
    if (normalizedCustomerId.equals(appProperties.getDefaultCustomerId())) {
      return StringUtils.hasText(normalizedDbName) ? applyDatabaseName(defaultUrl, normalizedDbName) : defaultUrl;
    }
    String prefix =
        StringUtils.hasText(tenantDataSourceProperties.getDbPrefix())
            ? tenantDataSourceProperties.getDbPrefix()
            : "customer_";
    String plannedDbName =
        StringUtils.hasText(normalizedDbName) ? normalizedDbName : prefix + normalizedCustomerId;
    return applyDatabaseName(defaultUrl, prefix + normalizedCustomerId, plannedDbName);
  }

  private String applyDatabaseName(String rawUrl, String dbName) {
    return applyDatabaseName(rawUrl, dbName, dbName);
  }

  private String applyDatabaseName(String rawUrl, String databasePathName, String plannedDbName) {
    ParsedUrl parsed = parseUrl(rawUrl);
    String prefix = parsed.jdbcPrefix() ? "jdbc:" : "";
    StringBuilder builder = new StringBuilder(prefix).append(parsed.scheme()).append("://");
    if (StringUtils.hasText(parsed.userInfo())) {
      builder.append(parsed.userInfo()).append('@');
    }
    builder.append(parsed.host());
    if (parsed.port() > 0) {
      builder.append(':').append(parsed.port());
    }
    builder.append('/').append(databasePathName);
    if (StringUtils.hasText(parsed.query())) {
      builder.append('?').append(parsed.query());
    }
    if (!plannedDbName.equals(databasePathName)) {
      return applyDatabaseName(builder.toString(), plannedDbName);
    }
    return builder.toString();
  }

  private ParsedUrl parseUrl(String rawUrl) {
    if (!StringUtils.hasText(rawUrl)) {
      throw new IllegalArgumentException("database url is blank");
    }
    String normalized = stripWrappingQuotes(rawUrl.trim());
    boolean jdbcPrefix = normalized.startsWith("jdbc:");
    if (jdbcPrefix) {
      normalized = normalized.substring("jdbc:".length());
    }
    URI uri = URI.create(normalized);
    if (!StringUtils.hasText(uri.getScheme()) || !StringUtils.hasText(uri.getHost())) {
      throw new IllegalArgumentException("database url is invalid");
    }
    return new ParsedUrl(
        jdbcPrefix,
        uri.getScheme(),
        uri.getRawUserInfo(),
        uri.getHost(),
        uri.getPort(),
        uri.getRawPath(),
        uri.getRawQuery());
  }

  private Map<String, Object> jdbcUrlPreview(String rawUrl) {
    if (!StringUtils.hasText(rawUrl)) {
      return Map.of();
    }
    try {
      ParsedUrl parsed = parseUrl(rawUrl);
      Map<String, Object> preview = new LinkedHashMap<>();
      preview.put("database", databaseName(rawUrl));
      preview.put("host", parsed.host());
      preview.put("jdbcPrefix", parsed.jdbcPrefix());
      preview.put("passwordRedacted", StringUtils.hasText(parsed.userInfo()));
      preview.put("port", parsed.port() > 0 ? parsed.port() : 3306);
      preview.put("queryPresent", StringUtils.hasText(parsed.query()));
      preview.put("scheme", parsed.scheme());
      preview.put("usernamePresent", usernamePresent(parsed.userInfo()));
      return preview;
    } catch (IllegalArgumentException error) {
      return Map.of("parseError", true);
    }
  }

  private Set<String> protectedDatabaseNames() {
    Set<String> names = new LinkedHashSet<>(SYSTEM_DATABASE_NAMES);
    addDatabaseName(names, environment.getProperty("spring.datasource.center.jdbc-url"));
    addDatabaseName(names, environment.getProperty("CENTER_DATABASE_URL"));
    addDatabaseName(names, tenantDataSourceProperties.getDefaultJdbcUrl());
    addDatabaseName(names, environment.getProperty("DATABASE_URL"));
    addDatabaseName(names, tenantDataSourceProperties.getPublicJdbcUrl());
    addDatabaseName(names, environment.getProperty("PUBLIC_DATABASE_URL"));
    if (StringUtils.hasText(appProperties.getDefaultCustomerId())
        && StringUtils.hasText(tenantDataSourceProperties.getDbPrefix())) {
      names.add(tenantDataSourceProperties.getDbPrefix() + appProperties.getDefaultCustomerId());
    }
    return names;
  }

  private void addDatabaseName(Set<String> names, String rawUrl) {
    String name = databaseName(rawUrl);
    if (StringUtils.hasText(name)) {
      names.add(name);
    }
  }

  private String databaseName(String rawUrl) {
    if (!StringUtils.hasText(rawUrl)) {
      return "";
    }
    try {
      ParsedUrl parsed = parseUrl(rawUrl);
      String path = parsed.path();
      if (!StringUtils.hasText(path) || "/".equals(path)) {
        return "";
      }
      String[] segments = path.split("/");
      return segments.length == 0 ? "" : segments[segments.length - 1];
    } catch (IllegalArgumentException error) {
      return "";
    }
  }

  private boolean tableExists(String tableName) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            Long.class,
            tableName);
    return count != null && count > 0;
  }

  private ProvisioningRoleMemberJob job(ResultSet rs) throws SQLException {
    return new ProvisioningRoleMemberJob(
        rs.getLong("id"),
        nullableLong(rs, "initiator_center_user_id"),
        nullableLong(rs, "source_org_id"),
        rs.getString("source_customer_id"),
        rs.getString("target_customer_id"),
        rs.getString("target_db_name"),
        rs.getString("target_city"),
        rs.getString("target_company_short_name"),
        rs.getString("status"),
        rs.getString("step"),
        rs.getString("lock_owner"),
        instant(rs.getTimestamp("locked_at")),
        instant(rs.getTimestamp("heartbeat_at")),
        instant(rs.getTimestamp("update_time")));
  }

  private CenterMember centerMember(ResultSet rs) throws SQLException {
    return new CenterMember(
        rs.getLong("member_id"),
        rs.getLong("center_user_id"),
        nullableLong(rs, "source_user_id"),
        rs.getString("member_role"),
        rs.getString("center_username"),
        rs.getString("center_real_name"),
        rs.getString("center_password"),
        nullableInt(rs, "center_status"),
        rs.getString("customer_type"),
        rs.getString("center_phone"),
        rs.getString("center_home_path"));
  }

  private Map<String, Object> jobMap(ProvisioningRoleMemberJob job) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("heartbeatAt", iso(job.heartbeatAt()));
    map.put("initiatorCenterUserId", job.initiatorCenterUserId());
    map.put("jobId", job.id());
    map.put("lockedAt", iso(job.lockedAt()));
    map.put("lockOwner", job.lockOwner());
    map.put("sourceCustomerId", job.sourceCustomerId());
    map.put("sourceOrgId", job.sourceOrgId());
    map.put("status", job.status());
    map.put("step", job.step());
    map.put("targetCustomerId", job.targetCustomerId());
    map.put("targetCity", job.targetCity());
    map.put("targetCompanyShortName", job.targetCompanyShortName());
    map.put("targetDbName", job.targetDbName());
    map.put("updateTime", iso(job.updateTime()));
    return map;
  }

  private Long nullableLong(ResultSet rs, String column) throws SQLException {
    long value = rs.getLong(column);
    return rs.wasNull() ? null : value;
  }

  private Integer nullableInt(ResultSet rs, String column) throws SQLException {
    int value = rs.getInt(column);
    return rs.wasNull() ? null : value;
  }

  private Instant instant(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant();
  }

  private String iso(Instant instant) {
    return instant == null ? null : instant.toString();
  }

  private long numberValue(Object value) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    return Long.parseLong(String.valueOf(value));
  }

  private Long nullableNumberValue(Object value) {
    if (value == null) {
      return null;
    }
    return numberValue(value);
  }

  private List<String> appendReason(Object currentReasons, String reason) {
    List<String> reasons = new ArrayList<>();
    if (currentReasons instanceof List<?> list) {
      for (Object item : list) {
        String text = string(item);
        if (StringUtils.hasText(text)) {
          reasons.add(text);
        }
      }
    }
    reasons.add(reason);
    return reasons;
  }

  private String string(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String nullableString(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private String firstText(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value.trim();
      }
    }
    return "";
  }

  private String stripWrappingQuotes(String value) {
    if (value.length() >= 2
        && ((value.startsWith("\"") && value.endsWith("\""))
            || (value.startsWith("'") && value.endsWith("'")))) {
      return value.substring(1, value.length() - 1);
    }
    return value;
  }

  private boolean usernamePresent(String userInfo) {
    return StringUtils.hasText(userInfo) && StringUtils.hasText(userInfo.split(":", 2)[0]);
  }

  private boolean validDatabaseName(String dbName) {
    return StringUtils.hasText(dbName) && dbName.length() <= 100 && dbName.matches("\\w+");
  }

  private record ParsedUrl(
      boolean jdbcPrefix,
      String scheme,
      String userInfo,
      String host,
      int port,
      String path,
      String query) {}

  private record ProvisioningRoleMemberJob(
      long id,
      Long initiatorCenterUserId,
      Long sourceOrgId,
      String sourceCustomerId,
      String targetCustomerId,
      String targetDbName,
      String targetCity,
      String targetCompanyShortName,
      String status,
      String step,
      String lockOwner,
      Instant lockedAt,
      Instant heartbeatAt,
      Instant updateTime) {}

  private record CenterMember(
      long memberId,
      long centerUserId,
      Long sourceUserId,
      String memberRole,
      String centerUsername,
      String centerRealName,
      String centerPassword,
      Integer centerStatus,
      String customerType,
      String centerPhone,
      String centerHomePath) {}

  private record UserMapping(long centerUserId, long customerUserId) {}
}
