package cn.yizuw.magic.backend.job;

import java.util.List;
import java.util.function.IntSupplier;

/** 切换组织开通中心用户租户归属；调用方负责租约校验、目标库确认和灰度开关。 */
public interface OrganizationProvisioningCenterUserSwitchClient {

  CenterUserSwitchResult switchCenterUsersToTarget(
      String targetJdbcUrl, CenterUserSwitchCommand command, IntSupplier heartbeatAfterCenterSwitch);

  /** 中心用户切换所需的任务、目标租户和组织成员资料。 */
  record CenterUserSwitchCommand(
      long jobId,
      String lockOwner,
      long sourceOrgId,
      String sourceCustomerId,
      String targetCustomerId,
      String targetDbName,
      String targetCity,
      String targetCompanyShortName,
      String customerName,
      List<CenterUserSwitchMemberCommand> members) {}

  /** 单个组织成员的中心用户和目标租户用户名。 */
  record CenterUserSwitchMemberCommand(long centerUserId, String centerUsername) {}

  /** 单个中心用户切换结果；不包含 token 或密码等敏感信息。 */
  record CenterUserSwitchMemberResult(
      long centerUserId,
      String centerUsername,
      long targetUserId,
      String previousCustomerType,
      boolean centerUserSwitched,
      int userTenantMappingRowsAffected,
      int refreshTokenRowsRevoked) {}

  /** 中心用户切换整体结果；统计本批中心库写入行数。 */
  record CenterUserSwitchResult(
      long jobId,
      String targetCustomerId,
      String targetDbName,
      int customerRowsAffected,
      int organizationTenantMappingRowsAffected,
      List<CenterUserSwitchMemberResult> members) {

    public long memberCount() {
      return members.size();
    }

    public long centerUsersSwitched() {
      return members.stream().filter(CenterUserSwitchMemberResult::centerUserSwitched).count();
    }

    public long refreshTokenRowsRevoked() {
      return members.stream().mapToLong(CenterUserSwitchMemberResult::refreshTokenRowsRevoked).sum();
    }

    public long userTenantMappingRowsAffected() {
      return members.stream().mapToLong(CenterUserSwitchMemberResult::userTenantMappingRowsAffected).sum();
    }
  }
}
