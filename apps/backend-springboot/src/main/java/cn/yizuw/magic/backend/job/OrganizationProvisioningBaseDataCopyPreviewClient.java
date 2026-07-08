package cn.yizuw.magic.backend.job;

import java.util.List;

/** 预览组织空间开通基础数据复制计划；只读源库和目标库，不执行写入。 */
public interface OrganizationProvisioningBaseDataCopyPreviewClient {

  BaseDataCopyInspection inspect(String sourceJdbcUrl, String targetJdbcUrl, List<String> tableNames);

  record BaseDataCopyInspection(
      List<String> missingSourceTables,
      List<String> missingTargetTables,
      List<BaseDataTablePlan> tablePlans) {}

  record BaseDataTablePlan(String tableName, long sourceRowsToCopy, long targetExistingRows) {}
}
