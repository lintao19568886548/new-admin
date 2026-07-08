package cn.yizuw.magic.backend.job;

import java.util.List;

/** 组织角色与成员迁移预览客户端；只读取源/目标租户库，不写目标库。 */
public interface OrganizationProvisioningRoleMemberMigrationPreviewClient {

  RoleMemberMigrationInspection inspect(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      long sourceOrgId,
      List<SourceUserLookup> sourceUserLookups);

  /** 中心库成员解析到 public/源租户用户时使用的查找条件。 */
  record SourceUserLookup(
      long centerUserId,
      String username,
      Long explicitSourceUserId,
      Long mappedSourceUserId,
      String memberRole) {

    public Long effectiveSourceUserId() {
      return explicitSourceUserId != null ? explicitSourceUserId : mappedSourceUserId;
    }
  }

  /** 组织角色迁移预览聚合结果。 */
  record RoleMemberMigrationInspection(
      List<String> missingSourceTables,
      List<String> missingTargetTables,
      List<OrganizationRolePlan> organizationRoles,
      List<Long> invalidParentRoleIds,
      long roleCodeRows,
      long roleCodeDistinctCodes,
      long roleParkRows,
      long roleParkDistinctParks,
      List<MemberSourceUserPlan> memberSourceUsers) {}

  /** 源租户库中符合迁移范围的组织角色。 */
  record OrganizationRolePlan(long roleId, Long parentId, String roleName) {}

  /** 每个组织成员在源租户库中的用户解析和组织角色绑定预览。 */
  record MemberSourceUserPlan(
      long centerUserId,
      String memberRole,
      String lookupMode,
      String lookupValue,
      boolean resolved,
      Long sourceUserId,
      String sourceUsername,
      Integer sourceStatus,
      long organizationRoleCount) {}
}
