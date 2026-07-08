package cn.yizuw.magic.backend.job;

import java.util.List;

/** 组织空间开通目标库管理连接；生产实现会执行真实 DDL，测试使用 fake 实现。 */
public interface OrganizationProvisioningDatabaseAdminClient {

  /**
   * 使用不指定 database 的 admin 连接重建目标库。
   *
   * <p>调用方必须先完成租约、安全库名和确认参数校验；这里仅负责按顺序执行 DDL。
   */
  List<String> rebuildDatabase(String targetJdbcUrl, List<String> ddlStatements);
}
