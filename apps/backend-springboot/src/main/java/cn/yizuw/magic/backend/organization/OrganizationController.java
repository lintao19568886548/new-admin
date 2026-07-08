package cn.yizuw.magic.backend.organization;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 组织和组织空间开通相关接口；开通执行类高风险动作仍留给专项任务。 */
@RestController
public class OrganizationController {

  private final OrganizationService organizationService;

  public OrganizationController(OrganizationService organizationService) {
    this.organizationService = organizationService;
  }

  /** 公开试用空间账号创建或补齐自己的 source organization；不触发组织空间开通。 */
  @PostMapping("/organization/create")
  public ApiResponse<Map<String, Object>> createOrganization(
      @RequestBody(required = false) OrganizationCreateRequest request) {
    return ApiResponse.ok(organizationService.createOrganization(request));
  }

  /** 查询当前组织空间的邀请码列表，仅 Super 可访问。 */
  @GetMapping("/organization/invitation/list")
  public ApiResponse<Map<String, Object>> invitationList() {
    return ApiResponse.ok(organizationService.listInvitations());
  }

  /** 撤销当前组织空间的邀请码，仅 Super 可操作。 */
  @PostMapping("/organization/invitation/revoke")
  public ApiResponse<Map<String, Object>> revokeInvitation(
      @RequestBody(required = false) OrganizationInvitationRevokeRequest request) {
    return ApiResponse.ok(organizationService.revokeInvitation(request));
  }

  /** 创建当前组织空间的邀请码，仅 Super 可操作，不触发组织开通。 */
  @PostMapping("/organization/invitation/create")
  public ApiResponse<Map<String, Object>> createInvitation(
      @RequestBody(required = false) OrganizationInvitationCreateRequest request) {
    return ApiResponse.ok(organizationService.createInvitation(request));
  }

  /** 使用邀请码加入已有组织空间，只处理本地账号、映射、成员关系和审计日志。 */
  @PostMapping("/organization/invitation/join")
  public ApiResponse<Map<String, Object>> joinInvitation(
      @RequestBody(required = false) OrganizationInvitationJoinRequest request) {
    return ApiResponse.ok(organizationService.joinInvitation(request));
  }

  /** 查询当前账号组织空间开通状态。 */
  @GetMapping("/organization/provisioning/status")
  public ApiResponse<Map<String, Object>> provisioningStatus() {
    return ApiResponse.ok(organizationService.getProvisioningStatus());
  }

  /** 查询需要人工处理的组织空间开通任务，仅默认空间 Super 可访问。 */
  @GetMapping("/organization/provisioning/failed-manual")
  public ApiResponse<Map<String, Object>> failedManualJobs(
      @RequestParam(required = false) Integer limit) {
    return ApiResponse.ok(organizationService.listFailedManualJobs(limit));
  }

  /** 重排 failed_manual 开通任务；默认只预览，execute=true 且确认串匹配才重置为 pending。 */
  @PostMapping("/organization/provisioning/requeue-failed-manual")
  public ApiResponse<Map<String, Object>> requeueFailedManualJob(
      @RequestBody(required = false) OrganizationProvisioningRequeueRequest request) {
    return ApiResponse.ok(organizationService.requeueFailedManualJob(request));
  }
}
