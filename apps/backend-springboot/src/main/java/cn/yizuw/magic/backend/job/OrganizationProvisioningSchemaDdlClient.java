package cn.yizuw.magic.backend.job;

import java.util.List;
import java.util.function.IntSupplier;

/** 执行组织空间开通目标库 schema clone DDL；不复制任何业务数据。 */
public interface OrganizationProvisioningSchemaDdlClient {

  /**
   * 在目标库执行建表语句。
   *
   * <p>实现必须在执行建表前关闭外键检查，并在 finally 中恢复外键检查；每成功建一张表后调用
   * heartbeatAfterEachTable，保持 worker 租约新鲜。
   */
  List<String> createTables(
      String targetJdbcUrl, List<String> createTableStatements, IntSupplier heartbeatAfterEachTable);
}
