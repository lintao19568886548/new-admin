package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** 基于 JDBC 读取模板库表结构；不连接目标库，也不执行 CREATE TABLE。 */
@Component
public class JdbcOrganizationProvisioningSchemaMetadataClient
    implements OrganizationProvisioningSchemaMetadataClient {

  @Override
  public SchemaInspection inspectBaseTableSchema(String templateJdbcUrl, int tableLimit) {
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource(templateJdbcUrl));
    List<String> tableNames = listBaseTables(jdbcTemplate);
    int normalizedLimit = tableLimit <= 0 ? 20 : Math.min(tableLimit, 200);
    List<TableSchema> tables =
        tableNames.stream()
            .limit(normalizedLimit)
            .map(tableName -> new TableSchema(tableName, showCreateTable(jdbcTemplate, tableName)))
            .toList();
    return new SchemaInspection(tables, tableNames.size(), tableNames.size() > tables.size());
  }

  private List<String> listBaseTables(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.queryForList("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'").stream()
        .map(row -> string(dynamicRowValue(row, "Tables_in_")).trim())
        .filter(StringUtils::hasText)
        .toList();
  }

  private String showCreateTable(JdbcTemplate jdbcTemplate, String tableName) {
    Map<String, Object> row =
        jdbcTemplate.queryForMap("SHOW CREATE TABLE " + quoteIdentifier(tableName));
    String createSql = string(row.get("Create Table"));
    if (!StringUtils.hasText(createSql)) {
      createSql = string(dynamicRowValue(row, "Create "));
    }
    if (!StringUtils.hasText(createSql)) {
      throw new IllegalStateException("无法读取表结构: " + tableName);
    }
    return createSql;
  }

  private Object dynamicRowValue(Map<String, Object> row, String keyPrefix) {
    String normalizedPrefix = keyPrefix.toLowerCase(java.util.Locale.ROOT);
    return row.entrySet().stream()
        .filter(entry -> entry.getKey().toLowerCase(java.util.Locale.ROOT).startsWith(normalizedPrefix))
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse(null);
  }

  private DriverManagerDataSource dataSource(String templateJdbcUrl) {
    DatabaseUrl parsed = DatabaseUrl.parse(templateJdbcUrl);
    DriverManagerDataSource dataSource = new DriverManagerDataSource();
    dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
    dataSource.setUrl(parsed.jdbcUrl());
    if (StringUtils.hasText(parsed.username())) {
      dataSource.setUsername(parsed.username());
    }
    if (parsed.password() != null) {
      dataSource.setPassword(parsed.password());
    }
    return dataSource;
  }

  private String quoteIdentifier(String value) {
    return "`" + value.replace("`", "``") + "`";
  }

  private String string(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}
