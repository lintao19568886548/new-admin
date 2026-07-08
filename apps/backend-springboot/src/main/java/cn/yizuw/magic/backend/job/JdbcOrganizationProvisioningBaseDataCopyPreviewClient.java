package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** JDBC 版基础数据复制预览；只检查表状态和行数，不复制数据。 */
@Component
public class JdbcOrganizationProvisioningBaseDataCopyPreviewClient
    implements OrganizationProvisioningBaseDataCopyPreviewClient {

  @Override
  public BaseDataCopyInspection inspect(
      String sourceJdbcUrl, String targetJdbcUrl, List<String> tableNames) {
    JdbcTemplate sourceJdbcTemplate = new JdbcTemplate(dataSource(sourceJdbcUrl));
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(dataSource(targetJdbcUrl));
    List<String> missingSourceTables = new ArrayList<>();
    List<String> missingTargetTables = new ArrayList<>();
    List<BaseDataTablePlan> tablePlans = new ArrayList<>();
    for (String tableName : tableNames) {
      boolean sourceReady = tableExists(sourceJdbcTemplate, tableName);
      boolean targetReady = tableExists(targetJdbcTemplate, tableName);
      if (!sourceReady) {
        missingSourceTables.add(tableName);
      }
      if (!targetReady) {
        missingTargetTables.add(tableName);
      }
      tablePlans.add(
          new BaseDataTablePlan(
              tableName,
              sourceReady ? countRows(sourceJdbcTemplate, tableName) : 0,
              targetReady ? countRows(targetJdbcTemplate, tableName) : 0));
    }
    return new BaseDataCopyInspection(missingSourceTables, missingTargetTables, tablePlans);
  }

  private boolean tableExists(JdbcTemplate jdbcTemplate, String tableName) {
    Long count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            Long.class,
            tableName);
    return count != null && count > 0;
  }

  private long countRows(JdbcTemplate jdbcTemplate, String tableName) {
    Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + quoteIdentifier(tableName), Long.class);
    return count == null ? 0L : count;
  }

  private String quoteIdentifier(String value) {
    return "`" + value.replace("`", "``") + "`";
  }

  private DriverManagerDataSource dataSource(String jdbcUrl) {
    DatabaseUrl parsed = DatabaseUrl.parse(jdbcUrl);
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
}
