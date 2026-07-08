package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.integration.wechat.WechatPayPublicConfigService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundCreateRequestFactory;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundQueryRequestFactory;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundRemoteService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class MigrationJobService {

  private static final Logger LOGGER = LoggerFactory.getLogger(MigrationJobService.class);
  private static final long REFUND_RECHECK_DELAY_SECONDS = 60L;

  private final OrganizationProvisioningJobScanner organizationProvisioningJobScanner;
  private final OrganizationProvisioningJobClaimService organizationProvisioningJobClaimService;
  private final OrganizationProvisioningJobPreflightService organizationProvisioningJobPreflightService;
  private final OrganizationProvisioningJobHeartbeatService organizationProvisioningJobHeartbeatService;
  private final OrganizationProvisioningJobStepService organizationProvisioningJobStepService;
  private final OrganizationProvisioningJobCompletionService organizationProvisioningJobCompletionService;
  private final OrganizationProvisioningJobFailureService organizationProvisioningJobFailureService;
  private final OrganizationProvisioningDatabaseRebuildPlanService organizationProvisioningDatabaseRebuildPlanService;
  private final OrganizationProvisioningSchemaClonePlanService organizationProvisioningSchemaClonePlanService;
  private final OrganizationProvisioningSuperPermissionClosurePlanService
      organizationProvisioningSuperPermissionClosurePlanService;
  private final OrganizationProvisioningBaseDataCopyPlanService organizationProvisioningBaseDataCopyPlanService;
  private final OrganizationProvisioningRoleMemberMigrationPlanService
      organizationProvisioningRoleMemberMigrationPlanService;
  private final VipMembershipRefundReconcileScanner vipMembershipRefundReconcileScanner;
  private final WechatPayPublicConfigService wechatPayPublicConfigService;
  private final WechatPayRefundQueryRequestFactory refundQueryRequestFactory;
  private final WechatPayRefundCreateRequestFactory refundCreateRequestFactory;
  private final WechatPayRefundRemoteService refundRemoteService;
  private final VipMembershipRefundWriteBackService refundWriteBackService;
  private final VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService;

  public MigrationJobService(
      OrganizationProvisioningJobScanner organizationProvisioningJobScanner,
      OrganizationProvisioningJobClaimService organizationProvisioningJobClaimService,
      OrganizationProvisioningJobPreflightService organizationProvisioningJobPreflightService,
      OrganizationProvisioningJobHeartbeatService organizationProvisioningJobHeartbeatService,
      OrganizationProvisioningJobStepService organizationProvisioningJobStepService,
      OrganizationProvisioningJobCompletionService organizationProvisioningJobCompletionService,
      OrganizationProvisioningJobFailureService organizationProvisioningJobFailureService,
      OrganizationProvisioningDatabaseRebuildPlanService organizationProvisioningDatabaseRebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService organizationProvisioningSchemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService
          organizationProvisioningSuperPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService organizationProvisioningBaseDataCopyPlanService,
      OrganizationProvisioningRoleMemberMigrationPlanService
          organizationProvisioningRoleMemberMigrationPlanService,
      VipMembershipRefundReconcileScanner vipMembershipRefundReconcileScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundQueryRequestFactory refundQueryRequestFactory,
      WechatPayRefundCreateRequestFactory refundCreateRequestFactory,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService,
      VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService) {
    this.organizationProvisioningJobScanner = organizationProvisioningJobScanner;
    this.organizationProvisioningJobClaimService = organizationProvisioningJobClaimService;
    this.organizationProvisioningJobPreflightService = organizationProvisioningJobPreflightService;
    this.organizationProvisioningJobHeartbeatService = organizationProvisioningJobHeartbeatService;
    this.organizationProvisioningJobStepService = organizationProvisioningJobStepService;
    this.organizationProvisioningJobCompletionService = organizationProvisioningJobCompletionService;
    this.organizationProvisioningJobFailureService = organizationProvisioningJobFailureService;
    this.organizationProvisioningDatabaseRebuildPlanService =
        organizationProvisioningDatabaseRebuildPlanService;
    this.organizationProvisioningSchemaClonePlanService = organizationProvisioningSchemaClonePlanService;
    this.organizationProvisioningSuperPermissionClosurePlanService =
        organizationProvisioningSuperPermissionClosurePlanService;
    this.organizationProvisioningBaseDataCopyPlanService = organizationProvisioningBaseDataCopyPlanService;
    this.organizationProvisioningRoleMemberMigrationPlanService =
        organizationProvisioningRoleMemberMigrationPlanService;
    this.vipMembershipRefundReconcileScanner = vipMembershipRefundReconcileScanner;
    this.wechatPayPublicConfigService = wechatPayPublicConfigService;
    this.refundQueryRequestFactory = refundQueryRequestFactory;
    this.refundCreateRequestFactory = refundCreateRequestFactory;
    this.refundRemoteService = refundRemoteService;
    this.refundWriteBackService = refundWriteBackService;
    this.entitlementRollbackPreviewService = entitlementRollbackPreviewService;
  }

  public Map<String, Object> run(String jobName, Map<String, String> parameters, boolean execute) {
    if ("organizationProvisioningJob".equals(jobName)) {
      return runOrganizationProvisioningJob(parameters, execute);
    }
    if ("vipMembershipRefundReconcileJob".equals(jobName)) {
      return runVipMembershipRefundReconcileJob(parameters, execute);
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("jobName", jobName);
    result.put("execute", execute);
    result.put("customerId", parameters.getOrDefault("customerId", ""));
    result.put("status", execute ? "accepted" : "dry-run");
    result.put("triggeredAt", Instant.now().toString());

    LOGGER.info("XXL-Job placeholder triggered: {}", result);
    return result;
  }

  private Map<String, Object> runOrganizationProvisioningJob(
      Map<String, String> parameters, boolean execute) {
    Map<String, Object> scan =
        organizationProvisioningJobScanner.scanCandidates(limit(parameters.get("limit")));
    boolean claimRequested = enabled(parameters.get("claim"));
    boolean heartbeatRequested = enabled(parameters.get("heartbeat"));
    boolean markRebuildingDatabaseRequested = enabled(parameters.get("markRebuildingDatabase"));
    boolean markCloningSchemaRequested = enabled(parameters.get("markCloningSchema"));
    boolean markSeedingBaseDataRequested = enabled(parameters.get("markSeedingBaseData"));
    boolean executeSuperPermissionClosureRequested =
        enabled(parameters.get("executeSuperPermissionClosure"));
    boolean previewSuperPermissionClosureRequested =
        enabled(parameters.get("previewSuperPermissionClosure"));
    boolean executeBaseDataTablesRequested = enabled(parameters.get("executeBaseDataTables"));
    boolean migrateOrganizationRolesAndMembersRequested =
        enabled(parameters.get("migrateOrganizationRolesAndMembers"));
    boolean executeOrganizationRolesAndMembersRequested =
        enabled(parameters.get("executeOrganizationRolesAndMembers"));
    boolean executeOrganizationMembersRequested =
        enabled(parameters.get("executeOrganizationMembers"));
    boolean executeOrganizationUserScopedDataRequested =
        enabled(parameters.get("executeOrganizationUserScopedData"));
    boolean writeTenantProvisioningRoleSnapshotRequested =
        enabled(parameters.get("writeTenantProvisioningRoleSnapshot"));
    boolean switchCenterUserToTargetRequested =
        enabled(parameters.get("switchCenterUserToTarget"));
    boolean completeTenantProvisioningJobRequested =
        enabled(parameters.get("completeTenantProvisioningJob"));
    boolean markTenantProvisioningJobFailedRequested =
        enabled(parameters.get("markTenantProvisioningJobFailed"));
    boolean previewBaseDataTablesRequested = enabled(parameters.get("previewBaseDataTables"));
    boolean previewSchemaCloneRequested = enabled(parameters.get("previewSchemaClone"));
    boolean executeSchemaCloneRequested = enabled(parameters.get("executeSchemaClone"));
    boolean previewRebuildDatabaseRequested = enabled(parameters.get("previewRebuildDatabase"));
    boolean executeRebuildDatabaseRequested = enabled(parameters.get("executeRebuildDatabase"));
    boolean preflightRequested = enabled(parameters.get("preflight"));
    boolean claimEnabled = execute && claimRequested;
    boolean heartbeatEnabled = execute && heartbeatRequested;
    boolean markRebuildingDatabaseEnabled = execute && markRebuildingDatabaseRequested;
    boolean markCloningSchemaEnabled = execute && markCloningSchemaRequested;
    boolean markSeedingBaseDataEnabled = execute && markSeedingBaseDataRequested;
    boolean executeSuperPermissionClosureEnabled =
        execute && executeSuperPermissionClosureRequested;
    boolean previewSuperPermissionClosureEnabled =
        execute && previewSuperPermissionClosureRequested;
    boolean executeBaseDataTablesEnabled = execute && executeBaseDataTablesRequested;
    boolean migrateOrganizationRolesAndMembersEnabled =
        execute && migrateOrganizationRolesAndMembersRequested;
    boolean executeOrganizationRolesAndMembersEnabled =
        execute && executeOrganizationRolesAndMembersRequested;
    boolean executeOrganizationMembersEnabled = execute && executeOrganizationMembersRequested;
    boolean executeOrganizationUserScopedDataEnabled =
        execute && executeOrganizationUserScopedDataRequested;
    boolean writeTenantProvisioningRoleSnapshotEnabled =
        execute && writeTenantProvisioningRoleSnapshotRequested;
    boolean switchCenterUserToTargetEnabled = execute && switchCenterUserToTargetRequested;
    boolean completeTenantProvisioningJobEnabled =
        execute && completeTenantProvisioningJobRequested;
    boolean markTenantProvisioningJobFailedEnabled =
        execute && markTenantProvisioningJobFailedRequested;
    boolean previewBaseDataTablesEnabled = execute && previewBaseDataTablesRequested;
    boolean previewSchemaCloneEnabled = execute && previewSchemaCloneRequested;
    boolean executeSchemaCloneEnabled = execute && executeSchemaCloneRequested;
    boolean previewRebuildDatabaseEnabled = execute && previewRebuildDatabaseRequested;
    boolean executeRebuildDatabaseEnabled = execute && executeRebuildDatabaseRequested;
    boolean preflightEnabled = execute && preflightRequested;
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("jobName", "organizationProvisioningJob");
    result.put("execute", execute);
    result.put("customerId", parameters.getOrDefault("customerId", ""));
    result.put("executionSupported", false);
    result.put("claimSupported", true);
    result.put("claimRequested", claimRequested);
    result.put("claimEnabled", claimEnabled);
    result.put("heartbeatSupported", true);
    result.put("heartbeatRequested", heartbeatRequested);
    result.put("heartbeatEnabled", heartbeatEnabled);
    result.put("markRebuildingDatabaseSupported", true);
    result.put("markRebuildingDatabaseRequested", markRebuildingDatabaseRequested);
    result.put("markRebuildingDatabaseEnabled", markRebuildingDatabaseEnabled);
    result.put("markCloningSchemaSupported", true);
    result.put("markCloningSchemaRequested", markCloningSchemaRequested);
    result.put("markCloningSchemaEnabled", markCloningSchemaEnabled);
    result.put("markSeedingBaseDataSupported", true);
    result.put("markSeedingBaseDataRequested", markSeedingBaseDataRequested);
    result.put("markSeedingBaseDataEnabled", markSeedingBaseDataEnabled);
    result.put("executeSuperPermissionClosureSupported", true);
    result.put("executeSuperPermissionClosureRequested", executeSuperPermissionClosureRequested);
    result.put("executeSuperPermissionClosureEnabled", executeSuperPermissionClosureEnabled);
    result.put("previewSuperPermissionClosureSupported", true);
    result.put("previewSuperPermissionClosureRequested", previewSuperPermissionClosureRequested);
    result.put("previewSuperPermissionClosureEnabled", previewSuperPermissionClosureEnabled);
    result.put("executeBaseDataTablesSupported", true);
    result.put("executeBaseDataTablesRequested", executeBaseDataTablesRequested);
    result.put("executeBaseDataTablesEnabled", executeBaseDataTablesEnabled);
    result.put("migrateOrganizationRolesAndMembersSupported", true);
    result.put(
        "migrateOrganizationRolesAndMembersRequested",
        migrateOrganizationRolesAndMembersRequested);
    result.put(
        "migrateOrganizationRolesAndMembersEnabled",
        migrateOrganizationRolesAndMembersEnabled);
    result.put("executeOrganizationRolesAndMembersSupported", true);
    result.put(
        "executeOrganizationRolesAndMembersRequested",
        executeOrganizationRolesAndMembersRequested);
    result.put(
        "executeOrganizationRolesAndMembersEnabled",
        executeOrganizationRolesAndMembersEnabled);
    result.put("executeOrganizationMembersSupported", true);
    result.put("executeOrganizationMembersRequested", executeOrganizationMembersRequested);
    result.put("executeOrganizationMembersEnabled", executeOrganizationMembersEnabled);
    result.put("executeOrganizationUserScopedDataSupported", true);
    result.put(
        "executeOrganizationUserScopedDataRequested",
        executeOrganizationUserScopedDataRequested);
    result.put(
        "executeOrganizationUserScopedDataEnabled",
        executeOrganizationUserScopedDataEnabled);
    result.put("writeTenantProvisioningRoleSnapshotSupported", true);
    result.put(
        "writeTenantProvisioningRoleSnapshotRequested",
        writeTenantProvisioningRoleSnapshotRequested);
    result.put(
        "writeTenantProvisioningRoleSnapshotEnabled",
        writeTenantProvisioningRoleSnapshotEnabled);
    result.put("switchCenterUserToTargetSupported", true);
    result.put("switchCenterUserToTargetRequested", switchCenterUserToTargetRequested);
    result.put("switchCenterUserToTargetEnabled", switchCenterUserToTargetEnabled);
    result.put("completeTenantProvisioningJobSupported", true);
    result.put("completeTenantProvisioningJobRequested", completeTenantProvisioningJobRequested);
    result.put("completeTenantProvisioningJobEnabled", completeTenantProvisioningJobEnabled);
    result.put("markTenantProvisioningJobFailedSupported", true);
    result.put("markTenantProvisioningJobFailedRequested", markTenantProvisioningJobFailedRequested);
    result.put("markTenantProvisioningJobFailedEnabled", markTenantProvisioningJobFailedEnabled);
    result.put("previewBaseDataTablesSupported", true);
    result.put("previewBaseDataTablesRequested", previewBaseDataTablesRequested);
    result.put("previewBaseDataTablesEnabled", previewBaseDataTablesEnabled);
    result.put("previewSchemaCloneSupported", true);
    result.put("previewSchemaCloneRequested", previewSchemaCloneRequested);
    result.put("previewSchemaCloneEnabled", previewSchemaCloneEnabled);
    result.put("executeSchemaCloneSupported", true);
    result.put("executeSchemaCloneRequested", executeSchemaCloneRequested);
    result.put("executeSchemaCloneEnabled", executeSchemaCloneEnabled);
    result.put("previewRebuildDatabaseSupported", true);
    result.put("previewRebuildDatabaseRequested", previewRebuildDatabaseRequested);
    result.put("previewRebuildDatabaseEnabled", previewRebuildDatabaseEnabled);
    result.put("executeRebuildDatabaseSupported", true);
    result.put("executeRebuildDatabaseRequested", executeRebuildDatabaseRequested);
    result.put("executeRebuildDatabaseEnabled", executeRebuildDatabaseEnabled);
    result.put("preflightSupported", true);
    result.put("preflightRequested", preflightRequested);
    result.put("preflightEnabled", preflightEnabled);
    result.put(
        "status",
        organizationProvisioningStatus(
            execute,
            claimEnabled,
            heartbeatEnabled,
            markRebuildingDatabaseEnabled,
            markCloningSchemaEnabled,
            markSeedingBaseDataEnabled,
            executeSuperPermissionClosureEnabled,
            previewSuperPermissionClosureEnabled,
            executeBaseDataTablesEnabled,
            migrateOrganizationRolesAndMembersEnabled,
            executeOrganizationRolesAndMembersEnabled,
            executeOrganizationMembersEnabled,
            executeOrganizationUserScopedDataEnabled,
            writeTenantProvisioningRoleSnapshotEnabled,
            switchCenterUserToTargetEnabled,
            completeTenantProvisioningJobEnabled,
            markTenantProvisioningJobFailedEnabled,
            previewBaseDataTablesEnabled,
            previewSchemaCloneEnabled,
            executeSchemaCloneEnabled,
            previewRebuildDatabaseEnabled,
            executeRebuildDatabaseEnabled,
            preflightEnabled));
    result.put("triggeredAt", Instant.now().toString());
    result.putAll(scan);
    if (claimEnabled) {
      result.put(
          "claimResult",
          organizationProvisioningJobClaimService.claimCandidates(
              limit(parameters.get("limit")),
              parameters.get("workerId"),
              longValue(parameters.get("staleAfterMs")),
              intValue(parameters.get("maxRetry")),
              Instant.now()));
    }
    if (heartbeatEnabled) {
      result.put(
          "heartbeatResult",
          organizationProvisioningJobHeartbeatService.refreshHeartbeat(
              longValue(parameters.get("jobId")), parameters.get("workerId"), Instant.now()));
    }
    if (markRebuildingDatabaseEnabled) {
      result.put(
          "markRebuildingDatabaseResult",
          organizationProvisioningJobStepService.markRebuildingDatabase(
              longValue(parameters.get("jobId")), parameters.get("workerId"), Instant.now()));
    }
    if (markCloningSchemaEnabled) {
      result.put(
          "markCloningSchemaResult",
          organizationProvisioningJobStepService.markCloningSchema(
              longValue(parameters.get("jobId")), parameters.get("workerId"), Instant.now()));
    }
    if (markSeedingBaseDataEnabled) {
      result.put(
          "markSeedingBaseDataResult",
          organizationProvisioningJobStepService.markSeedingBaseData(
              longValue(parameters.get("jobId")), parameters.get("workerId"), Instant.now()));
    }
    if (previewSuperPermissionClosureEnabled) {
      result.put(
          "previewSuperPermissionClosureResult",
          organizationProvisioningSuperPermissionClosurePlanService.previewSuperPermissionClosure(
              longValue(parameters.get("jobId")), parameters.get("workerId"), Instant.now()));
    }
    if (executeSuperPermissionClosureEnabled) {
      result.put(
          "executeSuperPermissionClosureResult",
          organizationProvisioningSuperPermissionClosurePlanService.executeSuperPermissionClosure(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (previewBaseDataTablesEnabled) {
      result.put(
          "previewBaseDataTablesResult",
          organizationProvisioningBaseDataCopyPlanService.previewBaseDataTables(
              longValue(parameters.get("jobId")), parameters.get("workerId"), Instant.now()));
    }
    if (executeBaseDataTablesEnabled) {
      result.put(
          "executeBaseDataTablesResult",
          organizationProvisioningBaseDataCopyPlanService.executeBaseDataTables(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (migrateOrganizationRolesAndMembersEnabled) {
      result.put(
          "migrateOrganizationRolesAndMembersResult",
          organizationProvisioningRoleMemberMigrationPlanService.previewMigration(
              longValue(parameters.get("jobId")), parameters.get("workerId"), Instant.now()));
    }
    if (executeOrganizationRolesAndMembersEnabled) {
      result.put(
          "executeOrganizationRolesAndMembersResult",
          organizationProvisioningRoleMemberMigrationPlanService.executeOrganizationRolesAndMembers(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (executeOrganizationMembersEnabled) {
      result.put(
          "executeOrganizationMembersResult",
          organizationProvisioningRoleMemberMigrationPlanService.executeOrganizationMembers(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (executeOrganizationUserScopedDataEnabled) {
      result.put(
          "executeOrganizationUserScopedDataResult",
          organizationProvisioningRoleMemberMigrationPlanService.executeOrganizationUserScopedData(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (writeTenantProvisioningRoleSnapshotEnabled) {
      result.put(
          "writeTenantProvisioningRoleSnapshotResult",
          organizationProvisioningRoleMemberMigrationPlanService.writeTenantProvisioningRoleSnapshot(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (switchCenterUserToTargetEnabled) {
      result.put(
          "switchCenterUserToTargetResult",
          organizationProvisioningRoleMemberMigrationPlanService.switchCenterUserToTarget(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (completeTenantProvisioningJobEnabled) {
      result.put(
          "completeTenantProvisioningJobResult",
          organizationProvisioningJobCompletionService.completeTenantProvisioningJob(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (markTenantProvisioningJobFailedEnabled) {
      result.put(
          "markTenantProvisioningJobFailedResult",
          organizationProvisioningJobFailureService.markTenantProvisioningJobFailed(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("failureReason"),
              intValue(parameters.get("maxRetry")),
              Instant.now()));
    }
    if (previewSchemaCloneEnabled) {
      result.put(
          "previewSchemaCloneResult",
          organizationProvisioningSchemaClonePlanService.previewSchemaClone(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              intValue(parameters.get("schemaTableLimit")),
              Instant.now()));
    }
    if (executeSchemaCloneEnabled) {
      result.put(
          "executeSchemaCloneResult",
          organizationProvisioningSchemaClonePlanService.executeSchemaClone(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              intValue(parameters.get("schemaTableLimit")),
              Instant.now()));
    }
    if (previewRebuildDatabaseEnabled) {
      result.put(
          "previewRebuildDatabaseResult",
          organizationProvisioningDatabaseRebuildPlanService.previewRebuildDatabase(
              longValue(parameters.get("jobId")), parameters.get("workerId"), Instant.now()));
    }
    if (executeRebuildDatabaseEnabled) {
      result.put(
          "executeRebuildDatabaseResult",
          organizationProvisioningDatabaseRebuildPlanService.executeRebuildDatabase(
              longValue(parameters.get("jobId")),
              parameters.get("workerId"),
              parameters.get("confirmTargetDbName"),
              Instant.now()));
    }
    if (preflightEnabled) {
      long jobId = longValue(parameters.get("jobId"));
      result.put(
          "preflightResult",
          organizationProvisioningJobPreflightService.preflightClaimedJobs(
              limit(parameters.get("limit")),
              parameters.get("workerId"),
              jobId > 0 ? jobId : null,
              Instant.now()));
    }
    LOGGER.info("Organization provisioning job scanned candidates: {}", result);
    return result;
  }

  private String organizationProvisioningStatus(
      boolean execute,
      boolean claimEnabled,
      boolean heartbeatEnabled,
      boolean markRebuildingDatabaseEnabled,
      boolean markCloningSchemaEnabled,
      boolean markSeedingBaseDataEnabled,
      boolean executeSuperPermissionClosureEnabled,
      boolean previewSuperPermissionClosureEnabled,
      boolean executeBaseDataTablesEnabled,
      boolean migrateOrganizationRolesAndMembersEnabled,
      boolean executeOrganizationRolesAndMembersEnabled,
      boolean executeOrganizationMembersEnabled,
      boolean executeOrganizationUserScopedDataEnabled,
      boolean writeTenantProvisioningRoleSnapshotEnabled,
      boolean switchCenterUserToTargetEnabled,
      boolean completeTenantProvisioningJobEnabled,
      boolean markTenantProvisioningJobFailedEnabled,
      boolean previewBaseDataTablesEnabled,
      boolean previewSchemaCloneEnabled,
      boolean executeSchemaCloneEnabled,
      boolean previewRebuildDatabaseEnabled,
      boolean executeRebuildDatabaseEnabled,
      boolean preflightEnabled) {
    if (!execute) {
      return "dry-run";
    }
    List<String> enabledSteps = new ArrayList<>();
    if (claimEnabled) {
      enabledSteps.add("claim");
    }
    if (heartbeatEnabled) {
      enabledSteps.add("heartbeat");
    }
    if (markRebuildingDatabaseEnabled) {
      enabledSteps.add("mark-rebuilding-database");
    }
    if (markCloningSchemaEnabled) {
      enabledSteps.add("mark-cloning-schema");
    }
    if (markSeedingBaseDataEnabled) {
      enabledSteps.add("mark-seeding-base-data");
    }
    if (executeSuperPermissionClosureEnabled) {
      enabledSteps.add("execute-super-permission-closure");
    }
    if (previewSuperPermissionClosureEnabled) {
      enabledSteps.add("preview-super-permission-closure");
    }
    if (executeBaseDataTablesEnabled) {
      enabledSteps.add("execute-base-data-tables");
    }
    if (migrateOrganizationRolesAndMembersEnabled) {
      enabledSteps.add("migrate-organization-roles-and-members-preview");
    }
    if (executeOrganizationRolesAndMembersEnabled) {
      enabledSteps.add("execute-organization-roles-and-members");
    }
    if (executeOrganizationMembersEnabled) {
      enabledSteps.add("execute-organization-members");
    }
    if (executeOrganizationUserScopedDataEnabled) {
      enabledSteps.add("execute-organization-user-scoped-data");
    }
    if (writeTenantProvisioningRoleSnapshotEnabled) {
      enabledSteps.add("write-tenant-provisioning-role-snapshot");
    }
    if (switchCenterUserToTargetEnabled) {
      enabledSteps.add("switch-center-user-to-target");
    }
    if (completeTenantProvisioningJobEnabled) {
      enabledSteps.add("complete-tenant-provisioning-job");
    }
    if (markTenantProvisioningJobFailedEnabled) {
      enabledSteps.add("mark-tenant-provisioning-job-failed");
    }
    if (previewBaseDataTablesEnabled) {
      enabledSteps.add("preview-base-data-tables");
    }
    if (previewSchemaCloneEnabled) {
      enabledSteps.add("preview-schema-clone");
    }
    if (executeSchemaCloneEnabled) {
      enabledSteps.add("execute-schema-clone");
    }
    if (previewRebuildDatabaseEnabled) {
      enabledSteps.add("preview-rebuild-database");
    }
    if (executeRebuildDatabaseEnabled) {
      enabledSteps.add("execute-rebuild-database");
    }
    if (preflightEnabled) {
      enabledSteps.add("preflight");
    }
    if (enabledSteps.isEmpty()) {
      return "scan-only";
    }
    String status = String.join("-", enabledSteps);
    return enabledSteps.size() == 1 ? status + "-only" : status;
  }

  private Map<String, Object> runVipMembershipRefundReconcileJob(
      Map<String, String> parameters, boolean execute) {
    Map<String, Object> scan =
        vipMembershipRefundReconcileScanner.scanCandidates(limit(parameters.get("limit")));
    boolean remoteQueryRequested = enabled(parameters.get("remoteQuery"));
    boolean writeBackRequested = enabled(parameters.get("writeBack"));
    boolean entitlementRollbackPreviewRequested = enabled(parameters.get("entitlementRollbackPreview"));
    boolean entitlementRollbackRequested = enabled(parameters.get("entitlementRollback"));
    Map<String, Object> wechatPayConfigStatus = wechatPayPublicConfigService.getAppConfigStatus();
    boolean wechatPayConfigured = Boolean.TRUE.equals(wechatPayConfigStatus.get("configured"));
    Object wechatPayMissing = wechatPayConfigStatus.get("missing");
    boolean remoteQueryEnabled = execute && remoteQueryRequested && wechatPayConfigured;
    boolean writeBackEnabled = remoteQueryEnabled && writeBackRequested;
    boolean entitlementRollbackPreviewEnabled =
        remoteQueryEnabled && entitlementRollbackPreviewRequested;
    boolean entitlementRollbackEnabled = writeBackEnabled && entitlementRollbackRequested;
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("jobName", "vipMembershipRefundReconcileJob");
    result.put("execute", execute);
    result.put("customerId", parameters.getOrDefault("customerId", ""));
    result.put("executionSupported", false);
    result.put("remoteQuerySupported", true);
    result.put("remoteQueryRequested", remoteQueryRequested);
    result.put("remoteQueryEnabled", remoteQueryEnabled);
    result.put("writeBackSupported", true);
    result.put("writeBackRequested", writeBackRequested);
    result.put("writeBackEnabled", writeBackEnabled);
    result.put("entitlementRollbackPreviewSupported", true);
    result.put("entitlementRollbackPreviewRequested", entitlementRollbackPreviewRequested);
    result.put("entitlementRollbackPreviewEnabled", entitlementRollbackPreviewEnabled);
    result.put("entitlementRollbackSupported", true);
    result.put("entitlementRollbackRequested", entitlementRollbackRequested);
    result.put("entitlementRollbackEnabled", entitlementRollbackEnabled);
    result.put(
        "status",
        writeBackEnabled ? "remote-query-writeback" : remoteQueryEnabled ? "remote-query-only" : execute ? "scan-only" : "dry-run");
    result.put("triggeredAt", Instant.now().toString());
    result.put("wechatPayConfigured", wechatPayConfigured);
    result.put("wechatPayMissing", wechatPayMissing);
    result.putAll(scan);
    result.put(
        "items",
        executionPlanItems(
            scan.get("items"),
            wechatPayConfigured,
            wechatPayMissing,
            remoteQueryEnabled,
            writeBackEnabled,
            entitlementRollbackPreviewEnabled,
            entitlementRollbackEnabled));
    LOGGER.info("VIP membership refund reconcile job scanned candidates: {}", result);
    return result;
  }

  @SuppressWarnings("unchecked")
  private Object executionPlanItems(
      Object rawItems,
      boolean wechatPayConfigured,
      Object wechatPayMissing,
      boolean remoteQueryEnabled,
      boolean writeBackEnabled,
      boolean entitlementRollbackPreviewEnabled,
      boolean entitlementRollbackEnabled) {
    if (!(rawItems instanceof List<?> items)) {
      return rawItems;
    }
    return items.stream()
        .map(
            item -> {
              if (!(item instanceof Map<?, ?> map)) {
                return item;
              }
              Map<String, Object> planned = new LinkedHashMap<>();
              map.forEach((key, value) -> planned.put(String.valueOf(key), value));
              String blockedReason = String.valueOf(planned.getOrDefault("blockedReason", ""));
              boolean ready = Boolean.TRUE.equals(planned.get("ready"));
              if (!ready) {
                planned.put(
                    "executionBlockedReason",
                    StringUtils.hasText(blockedReason) ? blockedReason : "候选退款未通过预检");
              } else if (!wechatPayConfigured) {
                planned.put("ready", false);
                planned.put("executionBlockedReason", "微信支付配置不完整");
                planned.put("wechatPayMissing", wechatPayMissing);
              } else {
                planned.put("executionBlockedReason", "");
                attachRefundRequestPreviews(planned);
                if (remoteQueryEnabled && Boolean.TRUE.equals(planned.get("ready"))) {
                  attachRemoteRefundQuery(
                      planned,
                      writeBackEnabled,
                      entitlementRollbackPreviewEnabled,
                      entitlementRollbackEnabled);
                }
              }
              planned.putIfAbsent("plannedAction", "query_then_create_wechat_refund");
              return planned;
            })
        .toList();
  }

  /**
   * 给退款对账 dry-run 输出脱敏请求预览。
   *
   * <p>这里会生成签名请求材料，但不会返回 Authorization 原文，也不会发起真实 HTTP 请求。
   */
  private void attachRefundRequestPreviews(Map<String, Object> planned) {
    try {
      String action = String.valueOf(planned.getOrDefault("plannedAction", "query_then_create_wechat_refund"));
      Map<String, Object> queryPreview =
          requestPreview(refundQueryRequestFactory.build(requiredString(planned, "outRefundNo")));
      if ("query_wechat_refund".equals(action)) {
        planned.put("requestPreviews", List.of(queryPreview));
        return;
      }
      planned.put(
          "requestPreviews",
          List.of(
              queryPreview,
              requestPreview(
                  refundCreateRequestFactory.build(
                      new WechatPayRefundCreateRequestFactory.WechatPayRefundCreateCommand(
                          string(planned.get("outTradeNo")),
                          string(planned.get("transactionId")),
                          requiredString(planned, "outRefundNo"),
                          integer(planned.get("refundAmount")),
                          integer(planned.get("amountTotal")),
                          string(planned.get("reason")),
                          "",
                          "")))));
    } catch (BusinessException error) {
      planned.put("ready", false);
      planned.put("executionBlockedReason", error.getMessage());
    }
  }

  /**
   * 显式执行微信退款远程查单。
   *
   * <p>这里只调用微信退款查询接口并回填本次 Job 的返回值，不更新 `vip_membership_refund`，也不会自动创建退款。
   */
  private void attachRemoteRefundQuery(
      Map<String, Object> planned,
      boolean writeBackEnabled,
      boolean entitlementRollbackPreviewEnabled,
      boolean entitlementRollbackEnabled) {
    planned.put("remoteQueryAttempted", true);
    try {
      WechatPayRefundRemoteService.WechatPayRefundRemoteResult result =
          refundRemoteService.queryRefund(requiredString(planned, "outRefundNo"));
      planned.put("remoteQueryStatus", "success");
      planned.put("remoteQueryResult", remoteQueryResult(result));
      Map<String, Object> preview = localWriteBackPreview(planned, result, writeBackEnabled);
      planned.put("localWriteBackPreview", preview);
      if (writeBackEnabled) {
        attachLocalWriteBackResult(planned, result, preview, entitlementRollbackEnabled);
      }
      if (entitlementRollbackPreviewEnabled && "SUCCESS".equals(result.refund().localStatus())) {
        attachEntitlementRollbackPreview(planned, result);
      }
    } catch (BusinessException error) {
      planned.put("remoteQueryStatus", "failed");
      planned.put("remoteQueryError", error.getMessage());
    } catch (RuntimeException error) {
      planned.put("remoteQueryStatus", "failed");
      planned.put("remoteQueryError", "微信支付退款远程查询失败");
    }
  }

  /**
   * 预览退款成功后的会员权益回滚动作。
   *
   * <p>本批只读取支付单、权益流水和会员汇总，不更新 `vip_membership_entitlement`，
   * 不同步 `vip_membership`，也不写 outbox。
   */
  private void attachEntitlementRollbackPreview(
      Map<String, Object> planned, WechatPayRefundRemoteService.WechatPayRefundRemoteResult result) {
    try {
      VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackPreview preview =
          entitlementRollbackPreviewService.preview(
              requiredString(planned, "outTradeNo"), result.refund().outRefundNo(), Instant.now());
      planned.put("entitlementRollbackPreview", entitlementRollbackPreview(preview));
    } catch (BusinessException error) {
      planned.put("entitlementRollbackPreviewStatus", "failed");
      planned.put("entitlementRollbackPreviewError", error.getMessage());
    } catch (RuntimeException error) {
      planned.put("entitlementRollbackPreviewStatus", "failed");
      planned.put("entitlementRollbackPreviewError", "会员权益回滚预览失败");
    }
  }

  private void attachLocalWriteBackResult(
      Map<String, Object> planned,
      WechatPayRefundRemoteService.WechatPayRefundRemoteResult result,
      Map<String, Object> preview,
      boolean entitlementRollbackEnabled) {
    if (!Boolean.TRUE.equals(preview.get("writeBackReady"))) {
      planned.put("localWriteBackStatus", "skipped");
      planned.put("localWriteBackError", String.valueOf(preview.get("blockedReason")));
      return;
    }
    try {
      VipMembershipRefundWriteBackService.VipMembershipRefundWriteBackResult writeBackResult =
          refundWriteBackService.writeBack(
              requiredString(planned, "outRefundNo"), result.refund(), Instant.now());
      planned.put("localWriteBackStatus", "success");
      planned.put("localWriteBackResult", writeBackResult(writeBackResult));
      if (entitlementRollbackEnabled && writeBackResult.entitlementRevokeRequired()) {
        attachEntitlementRollbackResult(planned, result, writeBackResult);
      }
    } catch (BusinessException error) {
      planned.put("localWriteBackStatus", "failed");
      planned.put("localWriteBackError", error.getMessage());
    } catch (RuntimeException error) {
      planned.put("localWriteBackStatus", "failed");
      planned.put("localWriteBackError", "会员退款本地状态写回失败");
    }
  }

  /**
   * 执行退款成功后的会员权益回滚。
   *
   * <p>必须先完成本地退款写回；即使开关打开，若退款写回没有更新行，也不会继续撤销权益。
   */
  private void attachEntitlementRollbackResult(
      Map<String, Object> planned,
      WechatPayRefundRemoteService.WechatPayRefundRemoteResult result,
      VipMembershipRefundWriteBackService.VipMembershipRefundWriteBackResult writeBackResult) {
    if (writeBackResult.updatedRows() <= 0) {
      planned.put("entitlementRollbackStatus", "skipped");
      planned.put("entitlementRollbackSkippedReason", "本地退款状态未写回成功，跳过会员权益回滚");
      return;
    }
    try {
      VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackResult rollbackResult =
          entitlementRollbackPreviewService.rollback(
              requiredString(planned, "outTradeNo"), result.refund().outRefundNo(), Instant.now());
      planned.put("entitlementRollbackStatus", "success");
      planned.put("entitlementRollbackResult", entitlementRollbackResult(rollbackResult));
    } catch (BusinessException error) {
      planned.put("entitlementRollbackStatus", "failed");
      planned.put("entitlementRollbackError", error.getMessage());
    } catch (RuntimeException error) {
      planned.put("entitlementRollbackStatus", "failed");
      planned.put("entitlementRollbackError", "会员权益回滚执行失败");
    }
  }

  private Map<String, Object> remoteQueryResult(
      WechatPayRefundRemoteService.WechatPayRefundRemoteResult result) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("method", result.method());
    map.put("path", result.path());
    map.put("httpStatus", result.httpStatus());
    map.put("verification", verificationSummary(result.verification()));
    map.put("refund", refundSummary(result.refund()));
    return map;
  }

  /**
   * 生成本地退款状态写回预案。
   *
   * <p>本批只输出下一批会写入 `vip_membership_refund` 的字段决策，不执行 SQL，不撤销权益。
   */
  private Map<String, Object> localWriteBackPreview(
      Map<String, Object> planned,
      WechatPayRefundRemoteService.WechatPayRefundRemoteResult result,
      boolean writeBackEnabled) {
    cn.yizuw.magic.backend.integration.wechat.WechatPayRefundResponseMapper.WechatPayRefundResponse refund =
        result.refund();
    String plannedOutRefundNo = string(planned.get("outRefundNo"));
    boolean outRefundNoMatches = Objects.equals(plannedOutRefundNo, refund.outRefundNo());
    String status = refund.localStatus();
    boolean terminal = terminalRefundStatus(status);
    boolean success = "SUCCESS".equals(status);
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("writeEnabled", writeBackEnabled);
    preview.put("writeBackReady", outRefundNoMatches);
    preview.put("targetTable", "vip_membership_refund");
    preview.put("where", Map.of("out_refund_no", plannedOutRefundNo));
    preview.put("remoteOutRefundNo", refund.outRefundNo());
    preview.put("outRefundNoMatches", outRefundNoMatches);
    preview.put("providerStatus", refund.providerStatus());
    preview.put("localStatus", status);
    preview.put("terminal", terminal);
    preview.put("wouldRevokeEntitlement", success);
    preview.put("followUp", success ? "revoke_vip_membership_for_refund" : "none");
    preview.put("blockedReason", outRefundNoMatches ? "" : "微信返回 outRefundNo 与本地候选退款单不一致");
    preview.put("updateColumns", writeBackColumns(refund, terminal, success));
    return preview;
  }

  private Map<String, Object> writeBackResult(
      VipMembershipRefundWriteBackService.VipMembershipRefundWriteBackResult result) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("checkedAt", result.checkedAt());
    map.put("entitlementRevokeExecuted", result.entitlementRevokeExecuted());
    map.put("entitlementRevokeRequired", result.entitlementRevokeRequired());
    map.put("followUp", result.followUp());
    map.put("nextCheckAt", result.nextCheckAt());
    map.put("outRefundNo", result.outRefundNo());
    map.put("status", result.status());
    map.put("successAt", result.successAt());
    map.put("terminal", result.terminal());
    map.put("updatedRows", result.updatedRows());
    return map;
  }

  private Map<String, Object> entitlementRollbackPreview(
      VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackPreview preview) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("alreadyRevoked", preview.alreadyRevoked());
    map.put("blockedReason", preview.blockedReason());
    map.put("customerId", preview.customerId());
    map.put("entitlementUpdate", preview.entitlementUpdate());
    map.put("executionLock", preview.executionLock());
    map.put("latestRemainingEntitlement", preview.latestRemainingEntitlement());
    map.put("membershipSummaryUpdate", preview.membershipSummaryUpdate());
    map.put("outRefundNo", preview.outRefundNo());
    map.put("outTradeNo", preview.outTradeNo());
    map.put("paymentUpdate", preview.paymentUpdate());
    map.put("previewedAt", preview.previewedAt());
    map.put("rollbackReady", preview.rollbackReady());
    map.put("tableReady", preview.tableReady());
    map.put("tableStatus", preview.tableStatus());
    map.put("writeEnabled", preview.writeEnabled());
    return map;
  }

  private Map<String, Object> entitlementRollbackResult(
      VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackResult result) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("alreadyRevoked", result.alreadyRevoked());
    map.put("customerId", result.customerId());
    map.put("entitlementUpdatedRows", result.entitlementUpdatedRows());
    map.put("executedAt", result.executedAt());
    map.put("latestRemainingEntitlement", result.latestRemainingEntitlement());
    map.put("membershipSummary", result.membershipSummary());
    map.put("membershipSummarySource", result.membershipSummarySource());
    map.put("membershipSummaryUpdatedRows", result.membershipSummaryUpdatedRows());
    map.put("outRefundNo", result.outRefundNo());
    map.put("outTradeNo", result.outTradeNo());
    map.put("paymentUpdatedRows", result.paymentUpdatedRows());
    map.put("rollbackExecuted", result.rollbackExecuted());
    map.put("skippedReason", result.skippedReason());
    return map;
  }

  private Map<String, Object> writeBackColumns(
      cn.yizuw.magic.backend.integration.wechat.WechatPayRefundResponseMapper.WechatPayRefundResponse refund,
      boolean terminal,
      boolean success) {
    Map<String, Object> columns = new LinkedHashMap<>();
    columns.put("refund_id", StringUtils.hasText(refund.refundId()) ? refund.refundId() : "[keep-existing]");
    columns.put("status", refund.localStatus());
    columns.put("success_at", success ? successAtPreview(refund.successTime()) : null);
    columns.put("last_checked_at", "[now]");
    columns.put("next_check_at", terminal ? null : "[now+60s]");
    columns.put("next_check_delay_seconds", terminal ? 0 : REFUND_RECHECK_DELAY_SECONDS);
    columns.put("provider_raw", "[remote-refund-response]");
    columns.put("update_time", "[now]");
    return columns;
  }

  private Object successAtPreview(String successTime) {
    return StringUtils.hasText(successTime) ? successTime : "[now]";
  }

  private boolean terminalRefundStatus(String status) {
    return List.of("ABNORMAL", "CLOSED", "SUCCESS").contains(string(status).toUpperCase(java.util.Locale.ROOT));
  }

  private Map<String, Object> verificationSummary(
      cn.yizuw.magic.backend.integration.wechat.WechatPayHttpResponseVerificationService
              .WechatPayHttpResponseVerification
          verification) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("verified", verification.verified());
    map.put("httpStatus", verification.statusCode());
    map.put("serial", verification.serial());
    return map;
  }

  private Map<String, Object> refundSummary(
      cn.yizuw.magic.backend.integration.wechat.WechatPayRefundResponseMapper.WechatPayRefundResponse
          refund) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("outRefundNo", refund.outRefundNo());
    map.put("refundId", refund.refundId());
    map.put("outTradeNo", refund.outTradeNo());
    map.put("transactionId", refund.transactionId());
    map.put("providerStatus", refund.providerStatus());
    map.put("localStatus", refund.localStatus());
    map.put("successTime", refund.successTime());
    map.put("refundAmount", refund.refundAmount());
    map.put("totalAmount", refund.totalAmount());
    map.put("currency", refund.currency());
    return map;
  }

  private Map<String, Object> requestPreview(
      WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest request) {
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("method", request.method());
    preview.put("path", request.path());
    preview.put("body", request.body());
    preview.put("headers", redactedHeaders(request.headers()));
    preview.put("authorizationRedacted", true);
    return preview;
  }

  private Map<String, Object> requestPreview(
      WechatPayRefundCreateRequestFactory.WechatPayRefundCreateRequest request) {
    Map<String, Object> preview = new LinkedHashMap<>();
    preview.put("method", request.method());
    preview.put("path", request.path());
    preview.put("body", request.body());
    preview.put("headers", redactedHeaders(request.headers()));
    preview.put("authorizationRedacted", true);
    return preview;
  }

  private Map<String, Object> redactedHeaders(Map<String, String> headers) {
    Map<String, Object> redacted = new LinkedHashMap<>();
    headers.forEach((key, value) -> redacted.put(key, "Authorization".equals(key) ? "[redacted]" : value));
    return redacted;
  }

  private String requiredString(Map<String, Object> item, String name) {
    String value = string(item.get(name));
    if (!StringUtils.hasText(value)) {
      throw new BusinessException(org.springframework.http.HttpStatus.BAD_REQUEST, "缺少退款对账请求参数 " + name);
    }
    return value.trim();
  }

  private Integer integer(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    String text = string(value);
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      return Integer.parseInt(text.trim());
    } catch (NumberFormatException error) {
      throw new BusinessException(org.springframework.http.HttpStatus.BAD_REQUEST, "退款对账金额不是合法整数");
    }
  }

  private String string(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private int limit(String value) {
    try {
      return value == null ? 20 : Integer.parseInt(value);
    } catch (NumberFormatException error) {
      return 20;
    }
  }

  private long longValue(String value) {
    try {
      return value == null ? 0L : Long.parseLong(value);
    } catch (NumberFormatException error) {
      return 0L;
    }
  }

  private int intValue(String value) {
    try {
      return value == null ? 0 : Integer.parseInt(value);
    } catch (NumberFormatException error) {
      return 0;
    }
  }

  private boolean enabled(String value) {
    return List.of("1", "true", "yes", "on").contains(string(value).trim().toLowerCase(java.util.Locale.ROOT));
  }
}
