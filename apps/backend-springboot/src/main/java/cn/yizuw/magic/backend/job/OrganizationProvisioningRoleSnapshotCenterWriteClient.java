package cn.yizuw.magic.backend.job;

import java.util.List;
import java.util.function.IntSupplier;

/** 写入中心库组织开通角色快照；调用方负责租约校验、目标库确认和灰度开关。 */
public interface OrganizationProvisioningRoleSnapshotCenterWriteClient {

  RoleSnapshotCenterWriteResult writeRoleSnapshots(
      long jobId,
      long sourceOrgId,
      List<RoleSnapshotCenterWriteCommand> snapshots,
      IntSupplier heartbeatAfterCenterWrite);

  /** 单条 `tenant_provisioning_role_snapshot` 快照写入命令。 */
  record RoleSnapshotCenterWriteCommand(long sourceRoleId, long targetRoleId, String roleName) {}

  /** 中心库角色快照写入结果；先按 jobId 删除旧快照，再插入当前角色映射。 */
  record RoleSnapshotCenterWriteResult(
      long deletedRows,
      long insertedRows,
      long jobId,
      long sourceOrgId,
      List<RoleSnapshotCenterWriteCommand> snapshots) {

    public long snapshotCount() {
      return snapshots.size();
    }
  }
}
