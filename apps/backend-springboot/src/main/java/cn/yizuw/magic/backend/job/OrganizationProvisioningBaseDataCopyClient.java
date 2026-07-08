package cn.yizuw.magic.backend.job;

import java.util.List;
import java.util.function.IntSupplier;

/** 执行组织空间开通基础数据复制；调用方负责租约校验和目标库确认。 */
public interface OrganizationProvisioningBaseDataCopyClient {

  BaseDataCopyResult copyBaseDataTables(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      List<String> tableNames,
      IntSupplier heartbeatAfterEachCopiedChunk);

  record BaseDataCopyResult(
      List<String> copiedTables,
      long appVersionRowsCopied,
      long copiedChunks,
      long totalRowsCopied) {}
}
