package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.ArrayList;
import java.util.List;
import java.util.function.IntSupplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** 基于 JDBC 在目标租户库执行 schema clone 建表 DDL。 */
@Component
public class JdbcOrganizationProvisioningSchemaDdlClient
    implements OrganizationProvisioningSchemaDdlClient {

  @Override
  public List<String> createTables(
      String targetJdbcUrl, List<String> createTableStatements, IntSupplier heartbeatAfterEachTable) {
    JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource(targetJdbcUrl));
    List<String> executed = new ArrayList<>();
    jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (String statement : createTableStatements) {
        jdbcTemplate.execute(statement);
        executed.add(statement);
        heartbeatAfterEachTable.getAsInt();
      }
      return executed;
    } finally {
      jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
    }
  }

  private DriverManagerDataSource dataSource(String targetJdbcUrl) {
    DatabaseUrl parsed = DatabaseUrl.parse(targetJdbcUrl);
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
