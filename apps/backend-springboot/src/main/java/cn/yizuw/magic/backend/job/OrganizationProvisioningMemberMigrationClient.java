package cn.yizuw.magic.backend.job;

import java.util.List;
import java.util.function.IntSupplier;

/** 执行组织成员迁移；调用方负责租约校验、目标库确认和灰度开关。 */
public interface OrganizationProvisioningMemberMigrationClient {

  MemberMigrationResult migrateOrganizationMembers(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      long sourceOrgId,
      String targetCustomerId,
      List<MemberMigrationCommand> members,
      IntSupplier heartbeatAfterEachMember);

  /** 单个中心成员迁移到目标租户库所需的最小资料。 */
  record MemberMigrationCommand(
      long centerUserId,
      String centerUsername,
      String centerRealName,
      String centerPassword,
      String centerPhone,
      String centerHomePath,
      String memberRole,
      Long sourceUserId) {}

  /** 组织成员迁移执行结果；只统计本批写入 user/user_role/user_code 的数量。 */
  record MemberMigrationResult(
      List<MemberMigrationItem> members,
      long organizationMembersMigrated,
      long targetUsersUpserted,
      long userCodeRowsInserted,
      long userRoleRowsInserted) {

    public long totalRowsWritten() {
      return targetUsersUpserted + userCodeRowsInserted + userRoleRowsInserted;
    }
  }

  /** 单个成员在目标租户库中的落库摘要；不返回密码等敏感字段。 */
  record MemberMigrationItem(
      long centerUserId,
      String memberRole,
      List<String> permissionCodes,
      Long sourceUserId,
      String sourceUsername,
      long targetUserId,
      List<Long> targetRoleIds,
      long userCodeRowsInserted,
      long userRoleRowsInserted) {}
}
