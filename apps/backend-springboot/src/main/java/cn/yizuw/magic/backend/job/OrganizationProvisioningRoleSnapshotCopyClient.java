package cn.yizuw.magic.backend.job;

import java.util.List;
import java.util.function.IntSupplier;

/** 执行组织角色快照复制；调用方负责租约校验和目标库确认。 */
public interface OrganizationProvisioningRoleSnapshotCopyClient {

  RoleSnapshotCopyResult copyOrganizationRoleSnapshot(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      long sourceOrgId,
      IntSupplier heartbeatAfterEachCopiedChunk);

  record RoleSnapshotCopyResult(
      List<String> copiedTables,
      long codeRowsCopied,
      long copiedChunks,
      long parkRowsCopied,
      long roleCodeRowsCopied,
      long roleMenuRowsCopied,
      long roleParkRowsCopied,
      long roleRowsCopied,
      List<RoleSnapshotItem> roleSnapshots,
      long totalRowsCopied) {}

  record RoleSnapshotItem(long sourceRoleId, long targetRoleId, String roleName) {}
}
