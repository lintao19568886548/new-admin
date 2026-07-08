package cn.yizuw.magic.backend.job;

import java.util.List;
import java.util.function.IntSupplier;

/** 执行组织空间开通 Super 权限闭包复制；调用方负责租约校验和目标库确认。 */
public interface OrganizationProvisioningSuperPermissionClosureCopyClient {

  SuperPermissionClosureCopyResult copySuperPermissionClosure(
      String sourceJdbcUrl, String targetJdbcUrl, IntSupplier heartbeatAfterEachCopiedTable);

  record SuperPermissionClosureCopyResult(
      List<String> copiedTables,
      long codeRowsCopied,
      boolean foreignKeyChecksDisabled,
      boolean foreignKeyChecksRestored,
      long menuMetaRowsCopied,
      long menuRowsCopied,
      long roleCodeRowsCopied,
      long roleMenuRowsCopied,
      long roleRowsCopied,
      long superRoleId,
      long totalRowsCopied) {}
}
