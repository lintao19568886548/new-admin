package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** 基于 JDBC admin 连接执行目标库重建 DDL。 */
@Component
public class JdbcOrganizationProvisioningDatabaseAdminClient
    implements OrganizationProvisioningDatabaseAdminClient {

  /**
   * 执行旧 worker 中的 `DROP DATABASE IF EXISTS` 和 `CREATE DATABASE`。
   *
   * <p>这里会把目标 JDBC URL 的 database 去掉后再建连接，避免目标库不存在时连接失败。
   */
  @Override
  public List<String> rebuildDatabase(String targetJdbcUrl, List<String> ddlStatements) {
    JdbcTemplate jdbcTemplate = new JdbcTemplate(adminDataSource(targetJdbcUrl));
    List<String> executed = new ArrayList<>();
    for (String ddl : ddlStatements) {
      jdbcTemplate.execute(ddl);
      executed.add(ddl);
    }
    return executed;
  }

  private DriverManagerDataSource adminDataSource(String targetJdbcUrl) {
    DatabaseUrl parsed = DatabaseUrl.parse(withoutDatabase(targetJdbcUrl));
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

  private String withoutDatabase(String rawUrl) {
    java.net.URI uri = java.net.URI.create(stripJdbcPrefix(rawUrl));
    String raw = uri.toString();
    String path = uri.getRawPath();
    if (!StringUtils.hasText(path) || "/".equals(path)) {
      return rawUrl;
    }
    int pathIndex = raw.indexOf(path);
    String stripped = raw.substring(0, pathIndex) + "/" + raw.substring(pathIndex + path.length());
    return rawUrl.startsWith("jdbc:") ? "jdbc:" + stripped : stripped;
  }

  private String stripJdbcPrefix(String rawUrl) {
    return rawUrl.startsWith("jdbc:") ? rawUrl.substring("jdbc:".length()) : rawUrl;
  }
}
