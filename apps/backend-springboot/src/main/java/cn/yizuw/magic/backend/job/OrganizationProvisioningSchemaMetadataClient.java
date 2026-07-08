package cn.yizuw.magic.backend.job;

import java.util.List;

/** 读取组织空间开通 schema clone 所需的模板库表结构；只做元数据查询，不执行目标库 DDL。 */
public interface OrganizationProvisioningSchemaMetadataClient {

  /**
   * 读取模板库基础表和建表 SQL。
   *
   * <p>调用方通过 tableLimit 控制返回的 `SHOW CREATE TABLE` 数量，避免 XXL-Job 预览结果过大。
   */
  SchemaInspection inspectBaseTableSchema(String templateJdbcUrl, int tableLimit);

  record SchemaInspection(List<TableSchema> tables, int totalBaseTableCount, boolean limited) {}

  record TableSchema(String tableName, String createTableSql) {}
}
