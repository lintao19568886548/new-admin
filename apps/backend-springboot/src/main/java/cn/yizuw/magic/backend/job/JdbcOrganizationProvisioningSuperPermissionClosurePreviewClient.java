package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** JDBC 版 Super 权限闭包预览；不执行 DDL/DML，只读取必要的表和行数。 */
@Component
public class JdbcOrganizationProvisioningSuperPermissionClosurePreviewClient
    implements OrganizationProvisioningSuperPermissionClosurePreviewClient {

  private static final List<String> REQUIRED_TABLES =
      List.of("role", "menu", "menu_meta", "code", "role_menu", "role_code");
  private static final String SUPER_ROLE_NAME = "Super";

  @Override
  public SuperPermissionClosureInspection inspect(String sourceJdbcUrl, String targetJdbcUrl) {
    JdbcTemplate sourceJdbcTemplate = new JdbcTemplate(dataSource(sourceJdbcUrl));
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(dataSource(targetJdbcUrl));
    List<String> missingSourceTables = missingTables(sourceJdbcTemplate);
    List<String> missingTargetTables = missingTables(targetJdbcTemplate);
    SourceSuperPermissionClosure source =
        missingSourceTables.isEmpty() ? inspectSource(sourceJdbcTemplate) : emptySource();
    TargetSuperPermissionClosure target =
        missingTargetTables.isEmpty() ? inspectTarget(targetJdbcTemplate) : emptyTarget();
    return new SuperPermissionClosureInspection(
        missingSourceTables, missingTargetTables, source, target);
  }

  private SourceSuperPermissionClosure inspectSource(JdbcTemplate jdbcTemplate) {
    long superRoleId = roleIdByNameOrZero(jdbcTemplate);
    if (superRoleId <= 0) {
      return emptySource();
    }
    long codeRows =
        count(
            jdbcTemplate,
            """
            SELECT COUNT(*)
            FROM code
            WHERE code_id IN (
              SELECT DISTINCT code_id
              FROM role_code
              WHERE role_id = ?
            )
            """,
            superRoleId);
    long roleMenuRows = count(jdbcTemplate, "SELECT COUNT(*) FROM role_menu WHERE role_id = ?", superRoleId);
    long roleCodeRows = count(jdbcTemplate, "SELECT COUNT(*) FROM role_code WHERE role_id = ?", superRoleId);
    long uniqueCodeIds =
        count(jdbcTemplate, "SELECT COUNT(DISTINCT code_id) FROM role_code WHERE role_id = ?", superRoleId);
    return new SourceSuperPermissionClosure(
        codeRows,
        count(jdbcTemplate, "SELECT COUNT(*) FROM menu_meta"),
        count(jdbcTemplate, "SELECT COUNT(*) FROM menu"),
        roleCodeRows,
        roleMenuRows,
        superRoleId,
        uniqueCodeIds);
  }

  private TargetSuperPermissionClosure inspectTarget(JdbcTemplate jdbcTemplate) {
    long superRoleId = roleIdByNameOrZero(jdbcTemplate);
    return new TargetSuperPermissionClosure(
        count(jdbcTemplate, "SELECT COUNT(*) FROM code"),
        count(jdbcTemplate, "SELECT COUNT(*) FROM menu_meta"),
        count(jdbcTemplate, "SELECT COUNT(*) FROM menu"),
        superRoleId > 0
            ? count(jdbcTemplate, "SELECT COUNT(*) FROM role_code WHERE role_id = ?", superRoleId)
            : 0,
        superRoleId > 0
            ? count(jdbcTemplate, "SELECT COUNT(*) FROM role_menu WHERE role_id = ?", superRoleId)
            : 0,
        superRoleId > 0,
        superRoleId);
  }

  private List<String> missingTables(JdbcTemplate jdbcTemplate) {
    List<String> missing = new ArrayList<>();
    for (String tableName : REQUIRED_TABLES) {
      if (!tableExists(jdbcTemplate, tableName)) {
        missing.add(tableName);
      }
    }
    return missing;
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

  private long roleIdByNameOrZero(JdbcTemplate jdbcTemplate) {
    List<Long> rows =
        jdbcTemplate.query(
            "SELECT role_id FROM role WHERE name = ? LIMIT 1",
            (rs, rowNum) -> rs.getLong("role_id"),
            SUPER_ROLE_NAME);
    return rows.isEmpty() ? 0L : rows.get(0);
  }

  private long count(JdbcTemplate jdbcTemplate, String sql, Object... args) {
    Long count = jdbcTemplate.queryForObject(sql, Long.class, args);
    return count == null ? 0L : count;
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

  private SourceSuperPermissionClosure emptySource() {
    return new SourceSuperPermissionClosure(0, 0, 0, 0, 0, 0, 0);
  }

  private TargetSuperPermissionClosure emptyTarget() {
    return new TargetSuperPermissionClosure(0, 0, 0, 0, 0, false, 0);
  }
}
