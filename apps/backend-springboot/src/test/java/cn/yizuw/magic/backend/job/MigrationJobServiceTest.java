package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.integration.wechat.WechatPayHttpResponseVerificationService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayPublicConfigService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundCreateRequestFactory;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundQueryRequestFactory;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundRemoteService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundResponseMapper;
import cn.yizuw.magic.backend.integration.wechat.WechatPaySigningService;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.env.MockEnvironment;

/** XXL-Job 迁移服务测试；只验证任务路由和安全边界，不执行真实 worker。 */
class MigrationJobServiceTest {

  @Test
  void organizationProvisioningJobScansCandidatesWithoutExecutingWorker() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    OrganizationProvisioningJobFailureService failureService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobFailureService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(5))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("id", 31, "ready", true, "status", "pending")),
                "readyCount",
                1L,
                "requestedLimit",
                5,
                "tableReady",
                true,
                "total",
                1));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of("customerId", "default", "execute", "true", "limit", "5"),
                true);

    assertThat(result)
        .containsEntry("customerId", "default")
        .containsEntry("execute", true)
        .containsEntry("executionSupported", false)
        .containsEntry("claimSupported", true)
        .containsEntry("claimRequested", false)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatSupported", true)
        .containsEntry("heartbeatRequested", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markRebuildingDatabaseSupported", true)
        .containsEntry("markRebuildingDatabaseRequested", false)
        .containsEntry("markRebuildingDatabaseEnabled", false)
        .containsEntry("markCloningSchemaSupported", true)
        .containsEntry("markCloningSchemaRequested", false)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("markSeedingBaseDataSupported", true)
        .containsEntry("markSeedingBaseDataRequested", false)
        .containsEntry("markSeedingBaseDataEnabled", false)
        .containsEntry("executeSuperPermissionClosureSupported", true)
        .containsEntry("executeSuperPermissionClosureRequested", false)
        .containsEntry("executeSuperPermissionClosureEnabled", false)
        .containsEntry("previewSuperPermissionClosureSupported", true)
        .containsEntry("previewSuperPermissionClosureRequested", false)
        .containsEntry("previewSuperPermissionClosureEnabled", false)
        .containsEntry("executeBaseDataTablesSupported", true)
        .containsEntry("executeBaseDataTablesRequested", false)
        .containsEntry("executeBaseDataTablesEnabled", false)
        .containsEntry("migrateOrganizationRolesAndMembersSupported", true)
        .containsEntry("migrateOrganizationRolesAndMembersRequested", false)
        .containsEntry("migrateOrganizationRolesAndMembersEnabled", false)
        .containsEntry("executeOrganizationRolesAndMembersSupported", true)
        .containsEntry("executeOrganizationRolesAndMembersRequested", false)
        .containsEntry("executeOrganizationRolesAndMembersEnabled", false)
        .containsEntry("executeOrganizationMembersSupported", true)
        .containsEntry("executeOrganizationMembersRequested", false)
        .containsEntry("executeOrganizationMembersEnabled", false)
        .containsEntry("executeOrganizationUserScopedDataSupported", true)
        .containsEntry("executeOrganizationUserScopedDataRequested", false)
        .containsEntry("executeOrganizationUserScopedDataEnabled", false)
        .containsEntry("writeTenantProvisioningRoleSnapshotSupported", true)
        .containsEntry("writeTenantProvisioningRoleSnapshotRequested", false)
        .containsEntry("writeTenantProvisioningRoleSnapshotEnabled", false)
        .containsEntry("switchCenterUserToTargetSupported", true)
        .containsEntry("switchCenterUserToTargetRequested", false)
        .containsEntry("switchCenterUserToTargetEnabled", false)
        .containsEntry("completeTenantProvisioningJobSupported", true)
        .containsEntry("completeTenantProvisioningJobRequested", false)
        .containsEntry("completeTenantProvisioningJobEnabled", false)
        .containsEntry("markTenantProvisioningJobFailedSupported", true)
        .containsEntry("markTenantProvisioningJobFailedRequested", false)
        .containsEntry("markTenantProvisioningJobFailedEnabled", false)
        .containsEntry("previewBaseDataTablesSupported", true)
        .containsEntry("previewBaseDataTablesRequested", false)
        .containsEntry("previewBaseDataTablesEnabled", false)
        .containsEntry("previewSchemaCloneSupported", true)
        .containsEntry("previewSchemaCloneRequested", false)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneSupported", true)
        .containsEntry("executeSchemaCloneRequested", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("previewRebuildDatabaseSupported", true)
        .containsEntry("previewRebuildDatabaseRequested", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseSupported", true)
        .containsEntry("executeRebuildDatabaseRequested", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightSupported", true)
        .containsEntry("preflightRequested", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("jobName", "organizationProvisioningJob")
        .containsEntry("readyCount", 1L)
        .containsEntry("requestedLimit", 5)
        .containsEntry("status", "scan-only")
        .containsEntry("tableReady", true)
        .containsEntry("total", 1);
    verify(scanner).scanCandidates(5);
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markRebuildingDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markCloningSchema(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markSeedingBaseData(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(superPermissionClosurePlanService, never())
        .previewSuperPermissionClosure(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(superPermissionClosurePlanService, never())
        .executeSuperPermissionClosure(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .previewBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .previewMigration(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationRolesAndMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationUserScopedData(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .writeTenantProvisioningRoleSnapshot(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .switchCenterUserToTarget(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .previewRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .executeRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .previewSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .executeSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobClaimsOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(2))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("id", 31, "ready", true, "status", "pending")),
                "readyCount",
                1L,
                "requestedLimit",
                2,
                "tableReady",
                true,
                "total",
                1));
    when(
            claimService.claimCandidates(
                org.mockito.ArgumentMatchers.eq(2),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq(60000L),
                org.mockito.ArgumentMatchers.eq(5),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "claimedCount",
                1L,
                "items",
                List.of(Map.of("id", 31L, "claimed", true, "claimStatus", "claimed")),
                "tableReady",
                true,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "claim",
                    "true",
                    "limit",
                    "2",
                    "maxRetry",
                    "5",
                    "staleAfterMs",
                    "60000",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimRequested", true)
        .containsEntry("claimEnabled", true)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markRebuildingDatabaseEnabled", false)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "claim-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> claimResult = (Map<String, Object>) result.get("claimResult");
    assertThat(claimResult).containsEntry("claimedCount", 1L).containsEntry("workerId", "worker-a");
    verify(claimService)
        .claimCandidates(
            org.mockito.ArgumentMatchers.eq(2),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq(60000L),
            org.mockito.ArgumentMatchers.eq(5),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markRebuildingDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobPreflightsClaimedJobsOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            preflightService.preflightClaimedJobs(
                org.mockito.ArgumentMatchers.eq(1),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "id",
                        31L,
                        "plannedSteps",
                        List.of("validate_lease", "stop_before_database_rebuild"),
                        "ready",
                        true)),
                "preflightedCount",
                1,
                "readyCount",
                1L,
                "tableReady",
                true));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of("jobId", "31", "limit", "1", "preflight", "true", "workerId", "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markRebuildingDatabaseEnabled", false)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightRequested", true)
        .containsEntry("preflightEnabled", true)
        .containsEntry("status", "preflight-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> preflightResult = (Map<String, Object>) result.get("preflightResult");
    assertThat(preflightResult).containsEntry("preflightedCount", 1).containsEntry("readyCount", 1L);
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService)
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.eq(1),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markRebuildingDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobHeartbeatsOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            heartbeatService.refreshHeartbeat(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "heartbeatStatus",
                "success",
                "jobId",
                31L,
                "leaseValid",
                true,
                "tableReady",
                true,
                "updatedRows",
                1,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of("heartbeat", "true", "jobId", "31", "limit", "1", "workerId", "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatRequested", true)
        .containsEntry("heartbeatEnabled", true)
        .containsEntry("markRebuildingDatabaseEnabled", false)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "heartbeat-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> heartbeatResult = (Map<String, Object>) result.get("heartbeatResult");
    assertThat(heartbeatResult)
        .containsEntry("heartbeatStatus", "success")
        .containsEntry("jobId", 31L)
        .containsEntry("updatedRows", 1);
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService)
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markRebuildingDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobMarksRebuildingDatabaseOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            stepService.markRebuildingDatabase(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "fromStep",
                "claimed",
                "jobId",
                31L,
                "leaseValid",
                true,
                "stepStatus",
                "success",
                "tableReady",
                true,
                "targetStep",
                "rebuilding_database",
                "updatedRows",
                1,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "markRebuildingDatabase",
                    "true",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markRebuildingDatabaseRequested", true)
        .containsEntry("markRebuildingDatabaseEnabled", true)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "mark-rebuilding-database-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> stepResult =
        (Map<String, Object>) result.get("markRebuildingDatabaseResult");
    assertThat(stepResult)
        .containsEntry("fromStep", "claimed")
        .containsEntry("jobId", 31L)
        .containsEntry("stepStatus", "success")
        .containsEntry("targetStep", "rebuilding_database")
        .containsEntry("updatedRows", 1);
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService)
        .markRebuildingDatabase(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobMarksCloningSchemaOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            stepService.markCloningSchema(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "fromStep",
                "rebuilding_database",
                "jobId",
                31L,
                "leaseValid",
                true,
                "stepStatus",
                "success",
                "tableReady",
                true,
                "targetStep",
                "cloning_schema",
                "updatedRows",
                1,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "markCloningSchema",
                    "true",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markRebuildingDatabaseEnabled", false)
        .containsEntry("markCloningSchemaRequested", true)
        .containsEntry("markCloningSchemaEnabled", true)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "mark-cloning-schema-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> stepResult = (Map<String, Object>) result.get("markCloningSchemaResult");
    assertThat(stepResult)
        .containsEntry("fromStep", "rebuilding_database")
        .containsEntry("jobId", 31L)
        .containsEntry("stepStatus", "success")
        .containsEntry("targetStep", "cloning_schema")
        .containsEntry("updatedRows", 1);
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markRebuildingDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService)
        .markCloningSchema(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobMarksSeedingBaseDataOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            stepService.markSeedingBaseData(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "fromStep",
                "cloning_schema",
                "jobId",
                31L,
                "leaseValid",
                true,
                "stepStatus",
                "success",
                "tableReady",
                true,
                "targetStep",
                "seeding_base_data",
                "updatedRows",
                1,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "markSeedingBaseData",
                    "true",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markRebuildingDatabaseEnabled", false)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("markSeedingBaseDataRequested", true)
        .containsEntry("markSeedingBaseDataEnabled", true)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "mark-seeding-base-data-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> stepResult =
        (Map<String, Object>) result.get("markSeedingBaseDataResult");
    assertThat(stepResult)
        .containsEntry("fromStep", "cloning_schema")
        .containsEntry("jobId", 31L)
        .containsEntry("stepStatus", "success")
        .containsEntry("targetStep", "seeding_base_data")
        .containsEntry("updatedRows", 1);
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markRebuildingDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markCloningSchema(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService)
        .markSeedingBaseData(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .previewRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .executeRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .previewSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .executeSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobPreviewsSuperPermissionClosureOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            superPermissionClosurePlanService.previewSuperPermissionClosure(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "executeCopy",
                false,
                "jobId",
                31L,
                "plannedCopyTables",
                List.of("menu", "menu_meta", "role", "code", "role_menu", "role_code"),
                "superPermissionClosureStatus",
                "ready",
                "targetWriteExecuted",
                false,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "previewSuperPermissionClosure",
                    "true",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markSeedingBaseDataEnabled", false)
        .containsEntry("previewSuperPermissionClosureRequested", true)
        .containsEntry("previewSuperPermissionClosureEnabled", true)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "preview-super-permission-closure-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> previewResult =
        (Map<String, Object>) result.get("previewSuperPermissionClosureResult");
    assertThat(previewResult)
        .containsEntry("executeCopy", false)
        .containsEntry("jobId", 31L)
        .containsEntry("superPermissionClosureStatus", "ready")
        .containsEntry("targetWriteExecuted", false);
    assertThat(previewResult.get("plannedCopyTables"))
        .isEqualTo(List.of("menu", "menu_meta", "role", "code", "role_menu", "role_code"));
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markSeedingBaseData(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .previewRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .previewSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(superPermissionClosurePlanService)
        .previewSuperPermissionClosure(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobExecutesSuperPermissionClosureOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            superPermissionClosurePlanService.executeSuperPermissionClosure(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "executeCopy",
                true,
                "heartbeatUpdatedRows",
                6,
                "jobId",
                31L,
                "superPermissionClosureCopied",
                true,
                "superPermissionClosureStatus",
                "success",
                "targetWriteExecuted",
                true,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "executeSuperPermissionClosure",
                    "true",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("executeSuperPermissionClosureRequested", true)
        .containsEntry("executeSuperPermissionClosureEnabled", true)
        .containsEntry("previewSuperPermissionClosureEnabled", false)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("status", "execute-super-permission-closure-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("executeSuperPermissionClosureResult");
    assertThat(executeResult)
        .containsEntry("executeCopy", true)
        .containsEntry("heartbeatUpdatedRows", 6)
        .containsEntry("jobId", 31L)
        .containsEntry("superPermissionClosureCopied", true)
        .containsEntry("superPermissionClosureStatus", "success")
        .containsEntry("targetWriteExecuted", true);
    verify(superPermissionClosurePlanService, never())
        .previewSuperPermissionClosure(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(superPermissionClosurePlanService)
        .executeSuperPermissionClosure(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markSeedingBaseData(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .executeRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .executeSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobPreviewsBaseDataTablesOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            baseDataCopyPlanService.previewBaseDataTables(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "baseDataCopyStatus",
                "ready",
                "executeCopy",
                false,
                "jobId",
                31L,
                "plannedCopyTables",
                List.of("app_versions"),
                "targetWriteExecuted",
                false,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "previewBaseDataTables",
                    "true",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markSeedingBaseDataEnabled", false)
        .containsEntry("previewSuperPermissionClosureEnabled", false)
        .containsEntry("executeSuperPermissionClosureEnabled", false)
        .containsEntry("previewBaseDataTablesRequested", true)
        .containsEntry("previewBaseDataTablesEnabled", true)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "preview-base-data-tables-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> previewResult =
        (Map<String, Object>) result.get("previewBaseDataTablesResult");
    assertThat(previewResult)
        .containsEntry("baseDataCopyStatus", "ready")
        .containsEntry("executeCopy", false)
        .containsEntry("jobId", 31L)
        .containsEntry("targetWriteExecuted", false);
    assertThat(previewResult.get("plannedCopyTables")).isEqualTo(List.of("app_versions"));
    verify(baseDataCopyPlanService)
        .previewBaseDataTables(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.any());
    verify(superPermissionClosurePlanService, never())
        .previewSuperPermissionClosure(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(superPermissionClosurePlanService, never())
        .executeSuperPermissionClosure(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markSeedingBaseData(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .previewRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .previewSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobExecutesBaseDataTablesOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            baseDataCopyPlanService.executeBaseDataTables(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "baseDataCopyStatus",
                "success",
                "baseDataTablesCopied",
                true,
                "executeCopy",
                true,
                "heartbeatUpdatedRows",
                1,
                "jobId",
                31L,
                "targetWriteExecuted",
                true,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "executeBaseDataTables",
                    "true",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("executeSuperPermissionClosureEnabled", false)
        .containsEntry("previewSuperPermissionClosureEnabled", false)
        .containsEntry("executeBaseDataTablesRequested", true)
        .containsEntry("executeBaseDataTablesEnabled", true)
        .containsEntry("previewBaseDataTablesEnabled", false)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("status", "execute-base-data-tables-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("executeBaseDataTablesResult");
    assertThat(executeResult)
        .containsEntry("baseDataCopyStatus", "success")
        .containsEntry("baseDataTablesCopied", true)
        .containsEntry("executeCopy", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("jobId", 31L)
        .containsEntry("targetWriteExecuted", true);
    verify(baseDataCopyPlanService, never())
        .previewBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService)
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
    verify(superPermissionClosurePlanService, never())
        .previewSuperPermissionClosure(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(superPermissionClosurePlanService, never())
        .executeSuperPermissionClosure(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markSeedingBaseData(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .executeSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobPreviewsRoleMemberMigrationOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            roleMemberMigrationPlanService.previewMigration(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "executeMigration",
                false,
                "jobId",
                31L,
                "migrationPreviewOnly",
                true,
                "roleMemberMigrationStatus",
                "ready",
                "targetWriteExecuted",
                false,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "migrateOrganizationRolesAndMembers",
                    "true",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("executeBaseDataTablesEnabled", false)
        .containsEntry("migrateOrganizationRolesAndMembersRequested", true)
        .containsEntry("migrateOrganizationRolesAndMembersEnabled", true)
        .containsEntry("executeOrganizationRolesAndMembersEnabled", false)
        .containsEntry("executeOrganizationMembersEnabled", false)
        .containsEntry("previewBaseDataTablesEnabled", false)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("status", "migrate-organization-roles-and-members-preview-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> previewResult =
        (Map<String, Object>) result.get("migrateOrganizationRolesAndMembersResult");
    assertThat(previewResult)
        .containsEntry("executeMigration", false)
        .containsEntry("jobId", 31L)
        .containsEntry("migrationPreviewOnly", true)
        .containsEntry("roleMemberMigrationStatus", "ready")
        .containsEntry("targetWriteExecuted", false);
    verify(roleMemberMigrationPlanService)
        .previewMigration(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .executeSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobExecutesRoleSnapshotCopyOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            roleMemberMigrationPlanService.executeOrganizationRolesAndMembers(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "executeMigration",
                true,
                "heartbeatUpdatedRows",
                1,
                "jobId",
                31L,
                "migrationPreviewOnly",
                false,
                "nextExplicitSwitch",
                "executeOrganizationMembers",
                "organizationMembersMigrated",
                false,
                "roleMemberMigrationStatus",
                "success",
                "roleSnapshotCopied",
                true,
                "targetWriteExecuted",
                true,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "executeOrganizationRolesAndMembers",
                    "true",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("executeBaseDataTablesEnabled", false)
        .containsEntry("migrateOrganizationRolesAndMembersEnabled", false)
        .containsEntry("executeOrganizationRolesAndMembersRequested", true)
        .containsEntry("executeOrganizationRolesAndMembersEnabled", true)
        .containsEntry("executeOrganizationMembersEnabled", false)
        .containsEntry("previewBaseDataTablesEnabled", false)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("status", "execute-organization-roles-and-members-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("executeOrganizationRolesAndMembersResult");
    assertThat(executeResult)
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("jobId", 31L)
        .containsEntry("migrationPreviewOnly", false)
        .containsEntry("nextExplicitSwitch", "executeOrganizationMembers")
        .containsEntry("organizationMembersMigrated", false)
        .containsEntry("roleMemberMigrationStatus", "success")
        .containsEntry("roleSnapshotCopied", true)
        .containsEntry("targetWriteExecuted", true);
    verify(roleMemberMigrationPlanService, never())
        .previewMigration(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService)
        .executeOrganizationRolesAndMembers(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService, never())
        .executeSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobExecutesOrganizationMembersOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    Map<String, Object> memberExecutionResult = new LinkedHashMap<>();
    memberExecutionResult.put("executeMigration", true);
    memberExecutionResult.put("heartbeatUpdatedRows", 2);
    memberExecutionResult.put("jobId", 31L);
    memberExecutionResult.put("memberMigrationExecuted", true);
    memberExecutionResult.put("migrationPreviewOnly", false);
    memberExecutionResult.put("nextExplicitSwitch", "executeOrganizationUserScopedData");
    memberExecutionResult.put("organizationMembersMigrated", true);
    memberExecutionResult.put("roleMemberMigrationStatus", "success");
    memberExecutionResult.put("targetUsersUpserted", 2L);
    memberExecutionResult.put("targetWriteExecuted", true);
    memberExecutionResult.put("userCodeRowsInserted", 2L);
    memberExecutionResult.put("userRoleRowsInserted", 2L);
    memberExecutionResult.put("workerId", "worker-a");
    when(
            roleMemberMigrationPlanService.executeOrganizationMembers(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(memberExecutionResult);

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "executeOrganizationMembers",
                    "true",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("executeBaseDataTablesEnabled", false)
        .containsEntry("migrateOrganizationRolesAndMembersEnabled", false)
        .containsEntry("executeOrganizationRolesAndMembersEnabled", false)
        .containsEntry("executeOrganizationMembersRequested", true)
        .containsEntry("executeOrganizationMembersEnabled", true)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("executeSchemaCloneEnabled", false)
        .containsEntry("status", "execute-organization-members-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("executeOrganizationMembersResult");
    assertThat(executeResult)
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 2)
        .containsEntry("jobId", 31L)
        .containsEntry("memberMigrationExecuted", true)
        .containsEntry("migrationPreviewOnly", false)
        .containsEntry("nextExplicitSwitch", "executeOrganizationUserScopedData")
        .containsEntry("organizationMembersMigrated", true)
        .containsEntry("targetUsersUpserted", 2L)
        .containsEntry("targetWriteExecuted", true)
        .containsEntry("userCodeRowsInserted", 2L)
        .containsEntry("userRoleRowsInserted", 2L);
    verify(roleMemberMigrationPlanService, never())
        .previewMigration(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationRolesAndMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService)
        .executeOrganizationMembers(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobExecutesOrganizationUserScopedDataOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    Map<String, Object> executionResult = new LinkedHashMap<>();
    executionResult.put("executeMigration", true);
    executionResult.put("heartbeatUpdatedRows", 2);
    executionResult.put("jobId", 31L);
    executionResult.put("migrationPreviewOnly", false);
    executionResult.put("nextExplicitSwitch", "writeTenantProvisioningRoleSnapshot");
    executionResult.put("roleMemberMigrationStatus", "success");
    executionResult.put("targetWriteExecuted", true);
    executionResult.put("userScopedDataMigrated", true);
    executionResult.put("userScopedDataMigrationExecuted", true);
    executionResult.put("userScopedRowsCopied", 6L);
    executionResult.put("workerId", "worker-a");
    when(
            roleMemberMigrationPlanService.executeOrganizationUserScopedData(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(executionResult);

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "executeOrganizationUserScopedData",
                    "true",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("executeOrganizationRolesAndMembersEnabled", false)
        .containsEntry("executeOrganizationMembersEnabled", false)
        .containsEntry("executeOrganizationUserScopedDataRequested", true)
        .containsEntry("executeOrganizationUserScopedDataEnabled", true)
        .containsEntry("status", "execute-organization-user-scoped-data-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("executeOrganizationUserScopedDataResult");
    assertThat(executeResult)
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 2)
        .containsEntry("jobId", 31L)
        .containsEntry("nextExplicitSwitch", "writeTenantProvisioningRoleSnapshot")
        .containsEntry("targetWriteExecuted", true)
        .containsEntry("userScopedDataMigrated", true)
        .containsEntry("userScopedDataMigrationExecuted", true)
        .containsEntry("userScopedRowsCopied", 6L);
    verify(roleMemberMigrationPlanService, never())
        .previewMigration(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationRolesAndMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService)
        .executeOrganizationUserScopedData(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobWritesTenantProvisioningRoleSnapshotOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    Map<String, Object> executionResult = new LinkedHashMap<>();
    executionResult.put("centerWriteExecuted", true);
    executionResult.put("executeMigration", true);
    executionResult.put("heartbeatUpdatedRows", 1);
    executionResult.put("jobId", 31L);
    executionResult.put("migrationPreviewOnly", false);
    executionResult.put("nextExplicitSwitch", "switchCenterUserToTarget");
    executionResult.put("roleMemberMigrationStatus", "success");
    executionResult.put("roleSnapshotCenterWriteExecuted", true);
    executionResult.put("roleSnapshotRowsDeleted", 1L);
    executionResult.put("roleSnapshotRowsInserted", 2L);
    executionResult.put("targetWriteExecuted", false);
    executionResult.put("tenantProvisioningRoleSnapshotWritten", true);
    executionResult.put("workerId", "worker-a");
    when(
            roleMemberMigrationPlanService.writeTenantProvisioningRoleSnapshot(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(executionResult);

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "workerId",
                    "worker-a",
                    "writeTenantProvisioningRoleSnapshot",
                    "true"),
                true);

    assertThat(result)
        .containsEntry("executeOrganizationUserScopedDataEnabled", false)
        .containsEntry("writeTenantProvisioningRoleSnapshotRequested", true)
        .containsEntry("writeTenantProvisioningRoleSnapshotEnabled", true)
        .containsEntry("status", "write-tenant-provisioning-role-snapshot-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("writeTenantProvisioningRoleSnapshotResult");
    assertThat(executeResult)
        .containsEntry("centerWriteExecuted", true)
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("jobId", 31L)
        .containsEntry("nextExplicitSwitch", "switchCenterUserToTarget")
        .containsEntry("roleSnapshotCenterWriteExecuted", true)
        .containsEntry("roleSnapshotRowsInserted", 2L)
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("tenantProvisioningRoleSnapshotWritten", true);
    verify(roleMemberMigrationPlanService, never())
        .previewMigration(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationRolesAndMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationUserScopedData(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService)
        .writeTenantProvisioningRoleSnapshot(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobSwitchesCenterUserToTargetOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    Map<String, Object> executionResult = new LinkedHashMap<>();
    executionResult.put("centerSwitchExecuted", true);
    executionResult.put("centerUsersSwitched", 2L);
    executionResult.put("executeMigration", true);
    executionResult.put("heartbeatUpdatedRows", 1);
    executionResult.put("jobId", 31L);
    executionResult.put("migrationPreviewOnly", false);
    executionResult.put("nextExplicitSwitch", "completeTenantProvisioningJob");
    executionResult.put("refreshTokenRowsRevoked", 2L);
    executionResult.put("roleMemberMigrationStatus", "success");
    executionResult.put("targetWriteExecuted", false);
    executionResult.put("tenantProvisioningCompleted", false);
    executionResult.put("userTenantMappingRowsAffected", 2L);
    executionResult.put("workerId", "worker-a");
    when(
            roleMemberMigrationPlanService.switchCenterUserToTarget(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(executionResult);

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "switchCenterUserToTarget",
                    "true",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("writeTenantProvisioningRoleSnapshotEnabled", false)
        .containsEntry("switchCenterUserToTargetRequested", true)
        .containsEntry("switchCenterUserToTargetEnabled", true)
        .containsEntry("status", "switch-center-user-to-target-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("switchCenterUserToTargetResult");
    assertThat(executeResult)
        .containsEntry("centerSwitchExecuted", true)
        .containsEntry("centerUsersSwitched", 2L)
        .containsEntry("executeMigration", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("jobId", 31L)
        .containsEntry("nextExplicitSwitch", "completeTenantProvisioningJob")
        .containsEntry("targetWriteExecuted", false)
        .containsEntry("tenantProvisioningCompleted", false)
        .containsEntry("userTenantMappingRowsAffected", 2L);
    verify(roleMemberMigrationPlanService, never())
        .previewMigration(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationRolesAndMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationMembers(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .executeOrganizationUserScopedData(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .writeTenantProvisioningRoleSnapshot(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService)
        .switchCenterUserToTarget(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobCompletesTenantProvisioningOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningJobCompletionService completionService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobCompletionService.class);
    OrganizationProvisioningJobFailureService failureService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobFailureService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    Map<String, Object> completionResult = new LinkedHashMap<>();
    completionResult.put("completionStatus", "success");
    completionResult.put("jobId", 31L);
    completionResult.put("outboxEventQueued", true);
    completionResult.put("outboxEventId", "evt_completed_1");
    completionResult.put("status", "active");
    completionResult.put("step", "completed");
    completionResult.put("targetDbName", "tenant_org001");
    completionResult.put("tenantProvisioningCompleted", true);
    completionResult.put("updatedRows", 1);
    completionResult.put("workerId", "worker-a");
    when(
            completionService.completeTenantProvisioningJob(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(completionResult);

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                completionService,
                failureService,
                refundScanner,
                wechatPayPublicConfigService,
                org.mockito.Mockito.mock(WechatPayRefundRemoteService.class),
                org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class),
                org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class))
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "completeTenantProvisioningJob",
                    "true",
                    "confirmTargetDbName",
                    "tenant_org001",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("completeTenantProvisioningJobRequested", true)
        .containsEntry("completeTenantProvisioningJobEnabled", true)
        .containsEntry("switchCenterUserToTargetEnabled", false)
        .containsEntry("status", "complete-tenant-provisioning-job-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("completeTenantProvisioningJobResult");
    assertThat(executeResult)
        .containsEntry("completionStatus", "success")
        .containsEntry("outboxEventQueued", true)
        .containsEntry("outboxEventId", "evt_completed_1")
        .containsEntry("status", "active")
        .containsEntry("step", "completed")
        .containsEntry("tenantProvisioningCompleted", true)
        .containsEntry("updatedRows", 1);
    verify(completionService)
        .completeTenantProvisioningJob(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .switchCenterUserToTarget(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .writeTenantProvisioningRoleSnapshot(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(failureService, never())
        .markTenantProvisioningJobFailed(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(baseDataCopyPlanService, never())
        .executeBaseDataTables(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobMarksTenantProvisioningFailedOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningJobCompletionService completionService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobCompletionService.class);
    OrganizationProvisioningJobFailureService failureService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobFailureService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class);
    OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class);
    OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    Map<String, Object> failureResult = new LinkedHashMap<>();
    failureResult.put("failedManual", false);
    failureResult.put("failureStatus", "success");
    failureResult.put("jobId", 31L);
    failureResult.put("retryable", true);
    failureResult.put("retryCount", 2);
    failureResult.put("status", "failed_retryable");
    failureResult.put("step", "retry_waiting");
    failureResult.put("tenantProvisioningFailed", true);
    failureResult.put("updatedRows", 1);
    when(
            failureService.markTenantProvisioningJobFailed(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("copy failed"),
                org.mockito.ArgumentMatchers.eq(5),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(failureResult);

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                superPermissionClosurePlanService,
                baseDataCopyPlanService,
                roleMemberMigrationPlanService,
                completionService,
                failureService,
                refundScanner,
                wechatPayPublicConfigService,
                org.mockito.Mockito.mock(WechatPayRefundRemoteService.class),
                org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class),
                org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class))
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "failureReason",
                    "copy failed",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "markTenantProvisioningJobFailed",
                    "true",
                    "maxRetry",
                    "5",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("markTenantProvisioningJobFailedRequested", true)
        .containsEntry("markTenantProvisioningJobFailedEnabled", true)
        .containsEntry("completeTenantProvisioningJobEnabled", false)
        .containsEntry("status", "mark-tenant-provisioning-job-failed-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("markTenantProvisioningJobFailedResult");
    assertThat(executeResult)
        .containsEntry("failedManual", false)
        .containsEntry("failureStatus", "success")
        .containsEntry("retryable", true)
        .containsEntry("retryCount", 2)
        .containsEntry("status", "failed_retryable")
        .containsEntry("step", "retry_waiting")
        .containsEntry("tenantProvisioningFailed", true);
    verify(failureService)
        .markTenantProvisioningJobFailed(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("copy failed"),
            org.mockito.ArgumentMatchers.eq(5),
            org.mockito.ArgumentMatchers.any());
    verify(completionService, never())
        .completeTenantProvisioningJob(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(roleMemberMigrationPlanService, never())
        .switchCenterUserToTarget(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobPreviewsSchemaCloneOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            schemaClonePlanService.previewSchemaClone(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq(2),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "executeDdl",
                false,
                "jobId",
                31L,
                "previewedTableCount",
                2,
                "schemaCloneStatus",
                "ready",
                "targetDdlExecuted",
                false,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "previewSchemaClone",
                    "true",
                    "schemaTableLimit",
                    "2",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("previewSchemaCloneRequested", true)
        .containsEntry("previewSchemaCloneEnabled", true)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "preview-schema-clone-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> previewResult =
        (Map<String, Object>) result.get("previewSchemaCloneResult");
    assertThat(previewResult)
        .containsEntry("executeDdl", false)
        .containsEntry("jobId", 31L)
        .containsEntry("previewedTableCount", 2)
        .containsEntry("schemaCloneStatus", "ready")
        .containsEntry("targetDdlExecuted", false);
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markCloningSchema(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .previewRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .executeRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService)
        .previewSchemaClone(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq(2),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobExecutesSchemaCloneOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    OrganizationProvisioningSchemaClonePlanService schemaClonePlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            schemaClonePlanService.executeSchemaClone(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.eq(20),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "executeDdl",
                true,
                "heartbeatUpdatedRows",
                2,
                "jobId",
                31L,
                "schemaCloneExecuted",
                true,
                "schemaCloneStatus",
                "success",
                "targetDdlExecuted",
                true,
                "targetDdlExecutedCount",
                2,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
                schemaClonePlanService,
                refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "executeSchemaClone",
                    "true",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "schemaTableLimit",
                    "20",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("executeSchemaCloneRequested", true)
        .containsEntry("executeSchemaCloneEnabled", true)
        .containsEntry("previewSchemaCloneEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("status", "execute-schema-clone-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("executeSchemaCloneResult");
    assertThat(executeResult)
        .containsEntry("executeDdl", true)
        .containsEntry("heartbeatUpdatedRows", 2)
        .containsEntry("jobId", 31L)
        .containsEntry("schemaCloneExecuted", true)
        .containsEntry("schemaCloneStatus", "success")
        .containsEntry("targetDdlExecuted", true)
        .containsEntry("targetDdlExecutedCount", 2);
    verify(schemaClonePlanService, never())
        .previewSchemaClone(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(schemaClonePlanService)
        .executeSchemaClone(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.eq(20),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .executeRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobPreviewsRebuildDatabaseOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            rebuildPlanService.previewRebuildDatabase(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "ddlPreview",
                List.of(
                    "DROP DATABASE IF EXISTS `tenant_org001`",
                    "CREATE DATABASE `tenant_org001` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"),
                "executeDdl",
                false,
                "jobId",
                31L,
                "planStatus",
                "ready",
                "ready",
                true,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "previewRebuildDatabase",
                    "true",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markRebuildingDatabaseEnabled", false)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("previewRebuildDatabaseRequested", true)
        .containsEntry("previewRebuildDatabaseEnabled", true)
        .containsEntry("executeRebuildDatabaseEnabled", false)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "preview-rebuild-database-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> previewResult =
        (Map<String, Object>) result.get("previewRebuildDatabaseResult");
    assertThat(previewResult)
        .containsEntry("executeDdl", false)
        .containsEntry("jobId", 31L)
        .containsEntry("planStatus", "ready")
        .containsEntry("ready", true);
    assertThat(previewResult.get("ddlPreview"))
        .isEqualTo(
            List.of(
            "DROP DATABASE IF EXISTS `tenant_org001`",
            "CREATE DATABASE `tenant_org001` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"));
    verify(claimService, never())
        .claimCandidates(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    verify(heartbeatService, never())
        .refreshHeartbeat(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(preflightService, never())
        .preflightClaimedJobs(
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(stepService, never())
        .markRebuildingDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService)
        .previewRebuildDatabase(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService, never())
        .executeRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void organizationProvisioningJobExecutesRebuildDatabaseOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    OrganizationProvisioningJobClaimService claimService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class);
    OrganizationProvisioningJobPreflightService preflightService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class);
    OrganizationProvisioningJobHeartbeatService heartbeatService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class);
    OrganizationProvisioningJobStepService stepService =
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class);
    OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService =
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(scanner.scanCandidates(1))
        .thenReturn(
            Map.of(
                "items",
                List.of(),
                "readyCount",
                0L,
                "requestedLimit",
                1,
                "tableReady",
                true,
                "total",
                0));
    when(
            rebuildPlanService.executeRebuildDatabase(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq("worker-a"),
                org.mockito.ArgumentMatchers.eq("tenant_org001"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "ddlExecuted",
                List.of(
                    "DROP DATABASE IF EXISTS `tenant_org001`",
                    "CREATE DATABASE `tenant_org001` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"),
                "executeDdl",
                true,
                "heartbeatUpdatedRows",
                1,
                "jobId",
                31L,
                "rebuildStatus",
                "success",
                "schemaCloneStarted",
                false,
                "workerId",
                "worker-a"));

    Map<String, Object> result =
        newService(
                scanner,
                claimService,
                preflightService,
                heartbeatService,
                stepService,
                rebuildPlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
                wechatPayPublicConfigService)
            .run(
                "organizationProvisioningJob",
                Map.of(
                    "confirmTargetDbName",
                    "tenant_org001",
                    "executeRebuildDatabase",
                    "true",
                    "jobId",
                    "31",
                    "limit",
                    "1",
                    "workerId",
                    "worker-a"),
                true);

    assertThat(result)
        .containsEntry("claimEnabled", false)
        .containsEntry("heartbeatEnabled", false)
        .containsEntry("markRebuildingDatabaseEnabled", false)
        .containsEntry("markCloningSchemaEnabled", false)
        .containsEntry("previewRebuildDatabaseEnabled", false)
        .containsEntry("executeRebuildDatabaseRequested", true)
        .containsEntry("executeRebuildDatabaseEnabled", true)
        .containsEntry("preflightEnabled", false)
        .containsEntry("status", "execute-rebuild-database-only");
    @SuppressWarnings("unchecked")
    Map<String, Object> executeResult =
        (Map<String, Object>) result.get("executeRebuildDatabaseResult");
    assertThat(executeResult)
        .containsEntry("executeDdl", true)
        .containsEntry("heartbeatUpdatedRows", 1)
        .containsEntry("jobId", 31L)
        .containsEntry("rebuildStatus", "success")
        .containsEntry("schemaCloneStarted", false);
    verify(rebuildPlanService, never())
        .previewRebuildDatabase(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(rebuildPlanService)
        .executeRebuildDatabase(
            org.mockito.ArgumentMatchers.eq(31L),
            org.mockito.ArgumentMatchers.eq("worker-a"),
            org.mockito.ArgumentMatchers.eq("tenant_org001"),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void vipMembershipRefundReconcileJobScansCandidatesWithoutExecutingWorker() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    when(refundScanner.scanCandidates(3))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "blockedReason",
                        "",
                        "outRefundNo",
                        "vip_refund_wxapp_1",
                        "plannedAction",
                        "query_then_create_wechat_refund",
                        "ready",
                        true)),
                "readyCount",
                1L,
                "requestedLimit",
                3,
                "tableReady",
                true,
                "total",
                1));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", false, "missing", List.of("WECHAT_PAY_API_V3_KEY")));

    Map<String, Object> result =
        newService(scanner, refundScanner, wechatPayPublicConfigService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of("customerId", "default", "execute", "true", "limit", "3"),
                true);

    assertThat(result)
        .containsEntry("customerId", "default")
        .containsEntry("execute", true)
        .containsEntry("executionSupported", false)
        .containsEntry("jobName", "vipMembershipRefundReconcileJob")
        .containsEntry("readyCount", 1L)
        .containsEntry("requestedLimit", 3)
        .containsEntry("status", "scan-only")
        .containsEntry("tableReady", true)
        .containsEntry("total", 1)
        .containsEntry("wechatPayConfigured", false);
    assertThat(result.get("wechatPayMissing")).isEqualTo(List.of("WECHAT_PAY_API_V3_KEY"));
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("ready", false)
        .containsEntry("executionBlockedReason", "微信支付配置不完整")
        .containsEntry("plannedAction", "query_then_create_wechat_refund")
        .containsEntry("wechatPayMissing", List.of("WECHAT_PAY_API_V3_KEY"));
    verify(refundScanner).scanCandidates(3);
    verify(wechatPayPublicConfigService).getAppConfigStatus();
  }

  @Test
  void vipMembershipRefundReconcileJobAddsRedactedRequestPreviewWhenConfigured() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    VipMembershipRefundWriteBackService refundWriteBackService =
        org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class);
    when(refundScanner.scanCandidates(3))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "amountTotal",
                        300,
                        "blockedReason",
                        "",
                        "outRefundNo",
                        "vip_refund_wxapp_1",
                        "outTradeNo",
                        "wxapp_order_1",
                        "plannedAction",
                        "query_then_create_wechat_refund",
                        "ready",
                        true,
                        "reason",
                        "membership refund",
                        "refundAmount",
                        100,
                        "transactionId",
                        "4200000000000000001")),
                "readyCount",
                1L,
                "requestedLimit",
                3,
                "tableReady",
                true,
                "total",
                1));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));

    Map<String, Object> result =
        newService(
                scanner, refundScanner, wechatPayPublicConfigService, refundRemoteService, refundWriteBackService)
            .run("vipMembershipRefundReconcileJob", Map.of("limit", "3"), true);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> previews = (List<Map<String, Object>>) items.get(0).get("requestPreviews");
    assertThat(items.get(0))
        .containsEntry("ready", true)
        .containsEntry("executionBlockedReason", "");
    assertThat(previews).hasSize(2);
    assertThat(previews.get(0))
        .containsEntry("method", "GET")
        .containsEntry("path", "/v3/refund/domestic/refunds/vip_refund_wxapp_1")
        .containsEntry("authorizationRedacted", true);
    assertThat(previews.get(1))
        .containsEntry("method", "POST")
        .containsEntry("path", "/v3/refund/domestic/refunds")
        .containsEntry("authorizationRedacted", true);
    assertThat(String.valueOf(previews.get(1).get("body"))).contains("\"out_refund_no\":\"vip_refund_wxapp_1\"");
    assertThat(previews.toString()).doesNotContain("WECHATPAY2-SHA256-RSA2048");
    assertThat(result)
        .containsEntry("remoteQueryRequested", false)
        .containsEntry("remoteQueryEnabled", false)
        .containsEntry("writeBackRequested", false)
        .containsEntry("writeBackEnabled", false)
        .containsEntry("entitlementRollbackPreviewRequested", false)
        .containsEntry("entitlementRollbackPreviewEnabled", false)
        .containsEntry("entitlementRollbackRequested", false)
        .containsEntry("entitlementRollbackEnabled", false)
        .containsEntry("status", "scan-only");
    verify(refundRemoteService, never()).queryRefund(anyString());
    verify(refundWriteBackService, never())
        .writeBack(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void vipMembershipRefundReconcileJobRunsRemoteQueryOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    VipMembershipRefundWriteBackService refundWriteBackService =
        org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class);
    when(refundScanner.scanCandidates(3)).thenReturn(refundScanWithReadyItem("query_then_create_wechat_refund"));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));
    when(refundRemoteService.queryRefund("vip_refund_wxapp_1"))
        .thenReturn(remoteResult("vip_refund_wxapp_1", "SUCCESS"));

    Map<String, Object> result =
        newService(
                scanner, refundScanner, wechatPayPublicConfigService, refundRemoteService, refundWriteBackService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of("limit", "3", "remoteQuery", "true"),
                true);

    assertThat(result)
        .containsEntry("remoteQueryRequested", true)
        .containsEntry("remoteQueryEnabled", true)
        .containsEntry("remoteQuerySupported", true)
        .containsEntry("writeBackRequested", false)
        .containsEntry("writeBackEnabled", false)
        .containsEntry("entitlementRollbackPreviewRequested", false)
        .containsEntry("entitlementRollbackPreviewEnabled", false)
        .containsEntry("entitlementRollbackRequested", false)
        .containsEntry("entitlementRollbackEnabled", false)
        .containsEntry("status", "remote-query-only");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("remoteQueryAttempted", true)
        .containsEntry("remoteQueryStatus", "success");
    @SuppressWarnings("unchecked")
    Map<String, Object> remoteQueryResult = (Map<String, Object>) items.get(0).get("remoteQueryResult");
    assertThat(remoteQueryResult)
        .containsEntry("method", "GET")
        .containsEntry("path", "/v3/refund/domestic/refunds/vip_refund_wxapp_1")
        .containsEntry("httpStatus", 200);
    @SuppressWarnings("unchecked")
    Map<String, Object> refund = (Map<String, Object>) remoteQueryResult.get("refund");
    assertThat(refund)
        .containsEntry("outRefundNo", "vip_refund_wxapp_1")
        .containsEntry("localStatus", "SUCCESS");
    @SuppressWarnings("unchecked")
    Map<String, Object> writeBackPreview = (Map<String, Object>) items.get(0).get("localWriteBackPreview");
    @SuppressWarnings("unchecked")
    Map<String, Object> updateColumns = (Map<String, Object>) writeBackPreview.get("updateColumns");
    assertThat(writeBackPreview)
        .containsEntry("writeEnabled", false)
        .containsEntry("writeBackReady", true)
        .containsEntry("targetTable", "vip_membership_refund")
        .containsEntry("localStatus", "SUCCESS")
        .containsEntry("terminal", true)
        .containsEntry("wouldRevokeEntitlement", true)
        .containsEntry("followUp", "revoke_vip_membership_for_refund");
    assertThat(updateColumns)
        .containsEntry("status", "SUCCESS")
        .containsEntry("success_at", "2026-07-02T08:00:00+08:00")
        .containsEntry("last_checked_at", "[now]")
        .containsEntry("next_check_at", null)
        .containsEntry("next_check_delay_seconds", 0L);
    assertThat(remoteQueryResult.toString()).doesNotContain("WECHATPAY2-SHA256-RSA2048");
    assertThat(remoteQueryResult.toString()).doesNotContain("message-body");
    assertThat(writeBackPreview.toString()).doesNotContain("WECHATPAY2-SHA256-RSA2048");
    verify(refundRemoteService).queryRefund("vip_refund_wxapp_1");
    verify(refundWriteBackService, never())
        .writeBack(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void vipMembershipRefundReconcileJobPreviewsEntitlementRollbackOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    VipMembershipRefundWriteBackService refundWriteBackService =
        org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class);
    VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService =
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class);
    when(refundScanner.scanCandidates(3)).thenReturn(refundScanWithReadyItem("query_wechat_refund"));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));
    when(refundRemoteService.queryRefund("vip_refund_wxapp_1"))
        .thenReturn(remoteResult("vip_refund_wxapp_1", "SUCCESS"));
    when(
            entitlementRollbackPreviewService.preview(
                org.mockito.ArgumentMatchers.eq("wxapp_order_1"),
                org.mockito.ArgumentMatchers.eq("vip_refund_wxapp_1"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            new VipMembershipEntitlementRollbackPreviewService
                .VipMembershipEntitlementRollbackPreview(
                "wxapp_order_1",
                "vip_refund_wxapp_1",
                "customer_1",
                Map.of(
                    "customer",
                    true,
                    "vip_membership",
                    true,
                    "vip_membership_entitlement",
                    true,
                    "vip_membership_payment",
                    true),
                true,
                false,
                true,
                false,
                "",
                Map.of("targetTable", "customer", "writeEnabled", false),
                Map.of("targetTable", "vip_membership_payment", "writeEnabled", false),
                Map.of("targetTable", "vip_membership_entitlement", "writeEnabled", false),
                Map.of("targetTable", "vip_membership", "writeEnabled", false),
                null,
                "2026-07-02T08:10:00Z"));

    Map<String, Object> result =
        newService(
                scanner,
                refundScanner,
                wechatPayPublicConfigService,
                refundRemoteService,
                refundWriteBackService,
                entitlementRollbackPreviewService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of("limit", "3", "remoteQuery", "true", "entitlementRollbackPreview", "true"),
                true);

    assertThat(result)
        .containsEntry("entitlementRollbackPreviewRequested", true)
        .containsEntry("entitlementRollbackPreviewEnabled", true)
        .containsEntry("status", "remote-query-only");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    @SuppressWarnings("unchecked")
    Map<String, Object> preview = (Map<String, Object>) items.get(0).get("entitlementRollbackPreview");
    assertThat(preview)
        .containsEntry("outTradeNo", "wxapp_order_1")
        .containsEntry("outRefundNo", "vip_refund_wxapp_1")
        .containsEntry("rollbackReady", true)
        .containsEntry("writeEnabled", false);
    verify(entitlementRollbackPreviewService)
        .preview(
            org.mockito.ArgumentMatchers.eq("wxapp_order_1"),
            org.mockito.ArgumentMatchers.eq("vip_refund_wxapp_1"),
            org.mockito.ArgumentMatchers.any());
    verify(refundWriteBackService, never())
        .writeBack(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void vipMembershipRefundReconcileJobDoesNotPreviewEntitlementRollbackForProcessingRefund() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService =
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class);
    when(refundScanner.scanCandidates(3)).thenReturn(refundScanWithReadyItem("query_wechat_refund"));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));
    when(refundRemoteService.queryRefund("vip_refund_wxapp_1"))
        .thenReturn(remoteResult("vip_refund_wxapp_1", "PROCESSING"));

    Map<String, Object> result =
        newService(
                scanner,
                refundScanner,
                wechatPayPublicConfigService,
                refundRemoteService,
                org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class),
                entitlementRollbackPreviewService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of("limit", "3", "remoteQuery", "true", "entitlementRollbackPreview", "true"),
                true);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0)).doesNotContainKey("entitlementRollbackPreview");
    verify(entitlementRollbackPreviewService, never())
        .preview(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void vipMembershipRefundReconcileJobExecutesEntitlementRollbackOnlyAfterWriteBackSuccess() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    VipMembershipRefundWriteBackService refundWriteBackService =
        org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class);
    VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService =
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class);
    when(refundScanner.scanCandidates(3)).thenReturn(refundScanWithReadyItem("query_wechat_refund"));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));
    when(refundRemoteService.queryRefund("vip_refund_wxapp_1"))
        .thenReturn(remoteResult("vip_refund_wxapp_1", "SUCCESS"));
    when(
            refundWriteBackService.writeBack(
                org.mockito.ArgumentMatchers.eq("vip_refund_wxapp_1"),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            new VipMembershipRefundWriteBackService.VipMembershipRefundWriteBackResult(
                "vip_refund_wxapp_1",
                1,
                "SUCCESS",
                true,
                true,
                "2026-07-02T00:00:00Z",
                "2026-07-02T08:00:00Z",
                null,
                "revoke_vip_membership_for_refund",
                false));
    when(
            entitlementRollbackPreviewService.rollback(
                org.mockito.ArgumentMatchers.eq("wxapp_order_1"),
                org.mockito.ArgumentMatchers.eq("vip_refund_wxapp_1"),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            new VipMembershipEntitlementRollbackPreviewService.VipMembershipEntitlementRollbackResult(
                "wxapp_order_1",
                "vip_refund_wxapp_1",
                "customer_1",
                true,
                false,
                1,
                1,
                2,
                "",
                "latest_active_entitlement_after_refund",
                Map.of("targetTable", "vip_membership", "writeEnabled", true),
                Map.of("outTradeNo", "wxapp_order_previous"),
                "2026-07-02T08:10:00Z"));

    Map<String, Object> result =
        newService(
                scanner,
                refundScanner,
                wechatPayPublicConfigService,
                refundRemoteService,
                refundWriteBackService,
                entitlementRollbackPreviewService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of(
                    "limit",
                    "3",
                    "remoteQuery",
                    "true",
                    "writeBack",
                    "true",
                    "entitlementRollback",
                    "true"),
                true);

    assertThat(result)
        .containsEntry("entitlementRollbackRequested", true)
        .containsEntry("entitlementRollbackEnabled", true)
        .containsEntry("status", "remote-query-writeback");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0)).containsEntry("entitlementRollbackStatus", "success");
    @SuppressWarnings("unchecked")
    Map<String, Object> rollbackResult =
        (Map<String, Object>) items.get(0).get("entitlementRollbackResult");
    assertThat(rollbackResult)
        .containsEntry("rollbackExecuted", true)
        .containsEntry("paymentUpdatedRows", 1)
        .containsEntry("entitlementUpdatedRows", 1)
        .containsEntry("membershipSummaryUpdatedRows", 2);
    verify(entitlementRollbackPreviewService)
        .rollback(
            org.mockito.ArgumentMatchers.eq("wxapp_order_1"),
            org.mockito.ArgumentMatchers.eq("vip_refund_wxapp_1"),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void vipMembershipRefundReconcileJobSkipsEntitlementRollbackWhenWriteBackIsNotEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService =
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class);
    when(refundScanner.scanCandidates(3)).thenReturn(refundScanWithReadyItem("query_wechat_refund"));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));
    when(refundRemoteService.queryRefund("vip_refund_wxapp_1"))
        .thenReturn(remoteResult("vip_refund_wxapp_1", "SUCCESS"));

    Map<String, Object> result =
        newService(
                scanner,
                refundScanner,
                wechatPayPublicConfigService,
                refundRemoteService,
                org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class),
                entitlementRollbackPreviewService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of("limit", "3", "remoteQuery", "true", "entitlementRollback", "true"),
                true);

    assertThat(result)
        .containsEntry("entitlementRollbackRequested", true)
        .containsEntry("entitlementRollbackEnabled", false);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0)).doesNotContainKey("entitlementRollbackResult");
    verify(entitlementRollbackPreviewService, never())
        .rollback(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void vipMembershipRefundReconcileJobWritesBackOnlyWhenExplicitlyEnabled() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    VipMembershipRefundWriteBackService refundWriteBackService =
        org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class);
    when(refundScanner.scanCandidates(3)).thenReturn(refundScanWithReadyItem("query_wechat_refund"));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));
    when(refundRemoteService.queryRefund("vip_refund_wxapp_1"))
        .thenReturn(remoteResult("vip_refund_wxapp_1", "SUCCESS"));
    when(
            refundWriteBackService.writeBack(
                org.mockito.ArgumentMatchers.eq("vip_refund_wxapp_1"),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            new VipMembershipRefundWriteBackService.VipMembershipRefundWriteBackResult(
                "vip_refund_wxapp_1",
                1,
                "SUCCESS",
                true,
                true,
                "2026-07-02T00:00:00Z",
                "2026-07-02T08:00:00Z",
                null,
                "revoke_vip_membership_for_refund",
                false));

    Map<String, Object> result =
        newService(
                scanner, refundScanner, wechatPayPublicConfigService, refundRemoteService, refundWriteBackService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of("limit", "3", "remoteQuery", "true", "writeBack", "true"),
                true);

    assertThat(result)
        .containsEntry("remoteQueryEnabled", true)
        .containsEntry("writeBackRequested", true)
        .containsEntry("writeBackEnabled", true)
        .containsEntry("status", "remote-query-writeback");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    @SuppressWarnings("unchecked")
    Map<String, Object> writeBackPreview =
        (Map<String, Object>) items.get(0).get("localWriteBackPreview");
    @SuppressWarnings("unchecked")
    Map<String, Object> writeBackResult =
        (Map<String, Object>) items.get(0).get("localWriteBackResult");
    assertThat(writeBackPreview).containsEntry("writeEnabled", true);
    assertThat(items.get(0)).containsEntry("localWriteBackStatus", "success");
    assertThat(writeBackResult)
        .containsEntry("updatedRows", 1)
        .containsEntry("status", "SUCCESS")
        .containsEntry("entitlementRevokeRequired", true)
        .containsEntry("entitlementRevokeExecuted", false);
    verify(refundRemoteService).queryRefund("vip_refund_wxapp_1");
    verify(refundWriteBackService)
        .writeBack(
            org.mockito.ArgumentMatchers.eq("vip_refund_wxapp_1"),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void vipMembershipRefundReconcileJobPreviewsRecheckForProcessingRefund() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    when(refundScanner.scanCandidates(3)).thenReturn(refundScanWithReadyItem("query_wechat_refund"));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));
    when(refundRemoteService.queryRefund("vip_refund_wxapp_1"))
        .thenReturn(remoteResult("vip_refund_wxapp_1", "PROCESSING"));

    Map<String, Object> result =
        newService(scanner, refundScanner, wechatPayPublicConfigService, refundRemoteService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of("limit", "3", "remoteQuery", "true"),
                true);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    @SuppressWarnings("unchecked")
    Map<String, Object> writeBackPreview =
        (Map<String, Object>) items.get(0).get("localWriteBackPreview");
    @SuppressWarnings("unchecked")
    Map<String, Object> updateColumns = (Map<String, Object>) writeBackPreview.get("updateColumns");
    assertThat(writeBackPreview)
        .containsEntry("writeEnabled", false)
        .containsEntry("writeBackReady", true)
        .containsEntry("localStatus", "PROCESSING")
        .containsEntry("terminal", false)
        .containsEntry("wouldRevokeEntitlement", false)
        .containsEntry("followUp", "none");
    assertThat(updateColumns)
        .containsEntry("status", "PROCESSING")
        .containsEntry("success_at", null)
        .containsEntry("last_checked_at", "[now]")
        .containsEntry("next_check_at", "[now+60s]")
        .containsEntry("next_check_delay_seconds", 60L);
    verify(refundRemoteService).queryRefund("vip_refund_wxapp_1");
  }

  @Test
  void vipMembershipRefundReconcileJobRecordsRemoteQueryFailureWithoutStoppingScan() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    WechatPayRefundRemoteService refundRemoteService =
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class);
    when(refundScanner.scanCandidates(3)).thenReturn(refundScanWithReadyItem("query_wechat_refund"));
    when(wechatPayPublicConfigService.getAppConfigStatus())
        .thenReturn(Map.of("configured", true, "missing", List.of()));
    when(refundRemoteService.queryRefund("vip_refund_wxapp_1"))
        .thenThrow(new BusinessException(HttpStatus.BAD_GATEWAY, "微信支付退款远程调用失败，HTTP 状态码：404"));

    Map<String, Object> result =
        newService(scanner, refundScanner, wechatPayPublicConfigService, refundRemoteService)
            .run(
                "vipMembershipRefundReconcileJob",
                Map.of("limit", "3", "remoteQuery", "true"),
                true);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
    assertThat(items.get(0))
        .containsEntry("remoteQueryAttempted", true)
        .containsEntry("remoteQueryStatus", "failed")
        .containsEntry("remoteQueryError", "微信支付退款远程调用失败，HTTP 状态码：404");
    verify(refundRemoteService).queryRefund("vip_refund_wxapp_1");
  }

  @Test
  void unknownJobKeepsPlaceholderBehavior() {
    OrganizationProvisioningJobScanner scanner =
        org.mockito.Mockito.mock(OrganizationProvisioningJobScanner.class);
    VipMembershipRefundReconcileScanner refundScanner =
        org.mockito.Mockito.mock(VipMembershipRefundReconcileScanner.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);

    Map<String, Object> result =
        newService(scanner, refundScanner, wechatPayPublicConfigService)
            .run("menuTemplateSyncJob", Map.of(), false);

    assertThat(result)
        .containsEntry("execute", false)
        .containsEntry("jobName", "menuTemplateSyncJob")
        .containsEntry("status", "dry-run");
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        claimService,
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class),
        refundScanner,
        wechatPayPublicConfigService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService,
      OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        baseDataCopyPlanService,
        roleMemberMigrationPlanService,
        refundScanner,
        wechatPayPublicConfigService,
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        baseDataCopyPlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        org.mockito.Mockito.mock(WechatPayRefundRemoteService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        baseDataCopyPlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        baseDataCopyPlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService,
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService,
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService,
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService) {
    return newService(
        scanner,
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService) {
    return newService(
        scanner,
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService,
      VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService) {
    return newService(
        scanner,
        org.mockito.Mockito.mock(OrganizationProvisioningJobClaimService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService,
        entitlementRollbackPreviewService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService) {
    return newService(
        scanner,
        claimService,
        org.mockito.Mockito.mock(OrganizationProvisioningJobPreflightService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobHeartbeatService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobStepService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningDatabaseRebuildPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningSchemaClonePlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService,
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService,
      VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningSuperPermissionClosurePlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService,
        entitlementRollbackPreviewService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService,
      OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        baseDataCopyPlanService,
        roleMemberMigrationPlanService,
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        org.mockito.Mockito.mock(VipMembershipRefundWriteBackService.class),
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService,
      OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        baseDataCopyPlanService,
        roleMemberMigrationPlanService,
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService,
        org.mockito.Mockito.mock(VipMembershipEntitlementRollbackPreviewService.class));
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService,
      OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService,
      VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService) {
    WechatPaySigningService signingService =
        new WechatPaySigningService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
                .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
                .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(rsaKeyPair())));
    return new MigrationJobService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        org.mockito.Mockito.mock(OrganizationProvisioningJobCompletionService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningJobFailureService.class),
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        baseDataCopyPlanService,
        roleMemberMigrationPlanService,
        refundScanner,
        wechatPayPublicConfigService,
        new WechatPayRefundQueryRequestFactory(signingService),
        new WechatPayRefundCreateRequestFactory(signingService),
        refundRemoteService,
        refundWriteBackService,
        entitlementRollbackPreviewService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      OrganizationProvisioningBaseDataCopyPlanService baseDataCopyPlanService,
      OrganizationProvisioningRoleMemberMigrationPlanService roleMemberMigrationPlanService,
      OrganizationProvisioningJobCompletionService completionService,
      OrganizationProvisioningJobFailureService failureService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService,
      VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService) {
    WechatPaySigningService signingService =
        new WechatPaySigningService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
                .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
                .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(rsaKeyPair())));
    return new MigrationJobService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        completionService,
        failureService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        baseDataCopyPlanService,
        roleMemberMigrationPlanService,
        refundScanner,
        wechatPayPublicConfigService,
        new WechatPayRefundQueryRequestFactory(signingService),
        new WechatPayRefundCreateRequestFactory(signingService),
        refundRemoteService,
        refundWriteBackService,
        entitlementRollbackPreviewService);
  }

  private MigrationJobService newService(
      OrganizationProvisioningJobScanner scanner,
      OrganizationProvisioningJobClaimService claimService,
      OrganizationProvisioningJobPreflightService preflightService,
      OrganizationProvisioningJobHeartbeatService heartbeatService,
      OrganizationProvisioningJobStepService stepService,
      OrganizationProvisioningDatabaseRebuildPlanService rebuildPlanService,
      OrganizationProvisioningSchemaClonePlanService schemaClonePlanService,
      OrganizationProvisioningSuperPermissionClosurePlanService superPermissionClosurePlanService,
      VipMembershipRefundReconcileScanner refundScanner,
      WechatPayPublicConfigService wechatPayPublicConfigService,
      WechatPayRefundRemoteService refundRemoteService,
      VipMembershipRefundWriteBackService refundWriteBackService,
      VipMembershipEntitlementRollbackPreviewService entitlementRollbackPreviewService) {
    return newService(
        scanner,
        claimService,
        preflightService,
        heartbeatService,
        stepService,
        rebuildPlanService,
        schemaClonePlanService,
        superPermissionClosurePlanService,
        org.mockito.Mockito.mock(OrganizationProvisioningBaseDataCopyPlanService.class),
        org.mockito.Mockito.mock(OrganizationProvisioningRoleMemberMigrationPlanService.class),
        refundScanner,
        wechatPayPublicConfigService,
        refundRemoteService,
        refundWriteBackService,
        entitlementRollbackPreviewService);
  }

  private Map<String, Object> refundScanWithReadyItem(String plannedAction) {
    return Map.of(
        "items",
        List.of(
            Map.of(
                "amountTotal",
                300,
                "blockedReason",
                "",
                "outRefundNo",
                "vip_refund_wxapp_1",
                "outTradeNo",
                "wxapp_order_1",
                "plannedAction",
                plannedAction,
                "ready",
                true,
                "reason",
                "membership refund",
                "refundAmount",
                100,
                "transactionId",
                "4200000000000000001")),
        "readyCount",
        1L,
        "requestedLimit",
        3,
        "tableReady",
        true,
        "total",
        1);
  }

  private WechatPayRefundRemoteService.WechatPayRefundRemoteResult remoteResult(
      String outRefundNo, String status) {
    return new WechatPayRefundRemoteService.WechatPayRefundRemoteResult(
        "GET",
        "/v3/refund/domestic/refunds/" + outRefundNo,
        200,
        new WechatPayHttpResponseVerificationService.WechatPayHttpResponseVerification(
            true, 200, "message-body", "PUB_KEY_ID_1"),
        new WechatPayRefundResponseMapper.WechatPayRefundResponse(
            outRefundNo,
            "5000001",
            "wxapp_order_1",
            "4200000000000000001",
            status,
            status,
            "SUCCESS".equals(status) ? "2026-07-02T08:00:00+08:00" : null,
            100,
            300,
            "CNY"));
  }

  private KeyPair rsaKeyPair() {
    try {
      KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
      generator.initialize(2048);
      return generator.generateKeyPair();
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  private String privateKeyPem(KeyPair keyPair) {
    return pem("PRIVATE KEY", keyPair.getPrivate().getEncoded());
  }

  private String pem(String type, byte[] content) {
    return "-----BEGIN "
        + type
        + "-----\n"
        + Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
            .encodeToString(content)
        + "\n-----END "
        + type
        + "-----\n";
  }
}
