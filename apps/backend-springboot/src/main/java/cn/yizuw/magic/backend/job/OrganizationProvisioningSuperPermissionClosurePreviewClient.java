package cn.yizuw.magic.backend.job;

import java.util.List;

/** 预览组织空间开通 Super 权限闭包复制计划；只读源库和目标库，不执行写入。 */
public interface OrganizationProvisioningSuperPermissionClosurePreviewClient {

  SuperPermissionClosureInspection inspect(String sourceJdbcUrl, String targetJdbcUrl);

  record SuperPermissionClosureInspection(
      List<String> missingSourceTables,
      List<String> missingTargetTables,
      SourceSuperPermissionClosure source,
      TargetSuperPermissionClosure target) {}

  record SourceSuperPermissionClosure(
      long codeRowsToCopy,
      long menuMetaRowsToCopy,
      long menuRowsToCopy,
      long roleCodeRowsToCopy,
      long roleMenuRowsToCopy,
      long superRoleId,
      long uniqueCodeIdsToCopy) {}

  record TargetSuperPermissionClosure(
      long existingCodeRows,
      long existingMenuMetaRows,
      long existingMenuRows,
      long existingRoleCodeRows,
      long existingRoleMenuRows,
      boolean superRoleExists,
      long superRoleId) {}
}
