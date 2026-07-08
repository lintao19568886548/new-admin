package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.IntSupplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** JDBC 版 Super 权限闭包复制；复制过程对齐旧 worker 的幂等 upsert 语义。 */
@Component
public class JdbcOrganizationProvisioningSuperPermissionClosureCopyClient
    implements OrganizationProvisioningSuperPermissionClosureCopyClient {

  private static final int COPY_CHUNK_SIZE = 200;
  private static final String SUPER_ROLE_NAME = "Super";

  @Override
  public SuperPermissionClosureCopyResult copySuperPermissionClosure(
      String sourceJdbcUrl, String targetJdbcUrl, IntSupplier heartbeatAfterEachCopiedTable) {
    JdbcTemplate sourceJdbcTemplate = new JdbcTemplate(dataSource(sourceJdbcUrl));
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(dataSource(targetJdbcUrl));
    long superRoleId = roleIdByName(sourceJdbcTemplate);
    List<Long> codeIds = superRoleCodeIds(sourceJdbcTemplate, superRoleId);
    List<String> copiedTables = new ArrayList<>();
    boolean foreignKeyChecksRestored = false;

    targetJdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
    try {
      long menuRows = copyRows(sourceJdbcTemplate, targetJdbcTemplate, "menu", "", List.of());
      heartbeat(heartbeatAfterEachCopiedTable);
      copiedTables.add("menu");
      long menuMetaRows = copyRows(sourceJdbcTemplate, targetJdbcTemplate, "menu_meta", "", List.of());
      heartbeat(heartbeatAfterEachCopiedTable);
      copiedTables.add("menu_meta");
      long roleRows =
          copyRows(
              sourceJdbcTemplate,
              targetJdbcTemplate,
              "role",
              "WHERE role_id = ?",
              List.of(superRoleId),
              Set.of("parent_id"));
      heartbeat(heartbeatAfterEachCopiedTable);
      copiedTables.add("role");
      long codeRows =
          codeIds.isEmpty()
              ? 0
              : copyRows(
                  sourceJdbcTemplate,
                  targetJdbcTemplate,
                  "code",
                  "WHERE code_id IN (" + placeholders(codeIds.size()) + ") ORDER BY code_id ASC",
                  new ArrayList<>(codeIds));
      heartbeat(heartbeatAfterEachCopiedTable);
      copiedTables.add("code");
      long roleMenuRows =
          copyRows(
              sourceJdbcTemplate,
              targetJdbcTemplate,
              "role_menu",
              "WHERE role_id = ?",
              List.of(superRoleId));
      heartbeat(heartbeatAfterEachCopiedTable);
      copiedTables.add("role_menu");
      long roleCodeRows =
          copyRows(
              sourceJdbcTemplate,
              targetJdbcTemplate,
              "role_code",
              "WHERE role_id = ?",
              List.of(superRoleId));
      heartbeat(heartbeatAfterEachCopiedTable);
      copiedTables.add("role_code");
      targetJdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
      foreignKeyChecksRestored = true;
      long totalRows =
          menuRows + menuMetaRows + roleRows + codeRows + roleMenuRows + roleCodeRows;
      return new SuperPermissionClosureCopyResult(
          List.copyOf(copiedTables),
          codeRows,
          true,
          true,
          menuMetaRows,
          menuRows,
          roleCodeRows,
          roleMenuRows,
          roleRows,
          superRoleId,
          totalRows);
    } finally {
      if (!foreignKeyChecksRestored) {
        targetJdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
      }
    }
  }

  private long copyRows(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String tableName,
      String whereSql,
      List<?> params) {
    return copyRows(sourceJdbcTemplate, targetJdbcTemplate, tableName, whereSql, params, Set.of());
  }

  private long copyRows(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String tableName,
      String whereSql,
      List<?> params,
      Set<String> nullColumns) {
    PreparedCopyRowsPlan plan = prepareCopyRowsPlan(sourceJdbcTemplate, targetJdbcTemplate, tableName);
    if (plan.columns().isEmpty()) {
      return 0L;
    }
    List<List<Object>> rows =
        sourceJdbcTemplate.query(
            "SELECT "
                + plan.quotedColumns()
                + " FROM "
                + quoteIdentifier(tableName)
                + (StringUtils.hasText(whereSql) ? " " + whereSql : ""),
            (rs, rowNum) -> {
              List<Object> values = new ArrayList<>(plan.columns().size());
              for (String column : plan.columns()) {
                values.add(nullColumns.contains(column) ? null : rs.getObject(column));
              }
              return values;
            },
            params.toArray());
    if (rows.isEmpty()) {
      return 0L;
    }
    for (int index = 0; index < rows.size(); index += COPY_CHUNK_SIZE) {
      List<List<Object>> chunk = rows.subList(index, Math.min(index + COPY_CHUNK_SIZE, rows.size()));
      String sql =
          plan.insertVerb()
              + " INTO "
              + quoteIdentifier(tableName)
              + " ("
              + plan.quotedColumns()
              + ") VALUES "
              + String.join(", ", java.util.Collections.nCopies(chunk.size(), plan.valuePlaceholders()))
              + plan.onDuplicateSql();
      Object[] values = chunk.stream().flatMap(List::stream).toArray();
      targetJdbcTemplate.update(sql, values);
    }
    return rows.size();
  }

  private PreparedCopyRowsPlan prepareCopyRowsPlan(
      JdbcTemplate sourceJdbcTemplate, JdbcTemplate targetJdbcTemplate, String tableName) {
    List<String> sourceColumns = tableColumns(sourceJdbcTemplate, tableName);
    Set<String> targetColumns = new LinkedHashSet<>(tableColumns(targetJdbcTemplate, tableName));
    List<String> columns = sourceColumns.stream().filter(targetColumns::contains).toList();
    Set<String> primaryColumns = new LinkedHashSet<>(primaryColumns(targetJdbcTemplate, tableName));
    List<String> updateColumns = columns.stream().filter(column -> !primaryColumns.contains(column)).toList();
    String onDuplicateSql =
        updateColumns.isEmpty()
            ? ""
            : " ON DUPLICATE KEY UPDATE "
                + updateColumns.stream()
                    .map(column -> quoteIdentifier(column) + " = VALUES(" + quoteIdentifier(column) + ")")
                    .collect(java.util.stream.Collectors.joining(", "));
    return new PreparedCopyRowsPlan(
        columns,
        updateColumns.isEmpty() ? "INSERT IGNORE" : "INSERT",
        onDuplicateSql,
        columns.stream().map(this::quoteIdentifier).collect(java.util.stream.Collectors.joining(", ")),
        "(" + String.join(", ", java.util.Collections.nCopies(columns.size(), "?")) + ")");
  }

  private List<String> tableColumns(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate.query(
        """
        SELECT COLUMN_NAME
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
        ORDER BY ORDINAL_POSITION ASC
        """,
        (rs, rowNum) -> rs.getString("COLUMN_NAME"),
        tableName);
  }

  private List<String> primaryColumns(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate.query(
        """
        SELECT COLUMN_NAME
        FROM information_schema.key_column_usage
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND constraint_name = 'PRIMARY'
        ORDER BY ORDINAL_POSITION ASC
        """,
        (rs, rowNum) -> rs.getString("COLUMN_NAME"),
        tableName);
  }

  private long roleIdByName(JdbcTemplate jdbcTemplate) {
    List<Long> rows =
        jdbcTemplate.query(
            "SELECT role_id FROM role WHERE name = ? LIMIT 1",
            (rs, rowNum) -> rs.getLong("role_id"),
            SUPER_ROLE_NAME);
    if (rows.isEmpty() || rows.get(0) <= 0) {
      throw new IllegalStateException("目标权限角色不存在: " + SUPER_ROLE_NAME);
    }
    return rows.get(0);
  }

  private List<Long> superRoleCodeIds(JdbcTemplate jdbcTemplate, long superRoleId) {
    return jdbcTemplate.query(
        "SELECT DISTINCT code_id FROM role_code WHERE role_id = ? ORDER BY code_id ASC",
        (rs, rowNum) -> rs.getLong("code_id"),
        superRoleId);
  }

  private void heartbeat(IntSupplier heartbeatAfterEachCopiedTable) {
    if (heartbeatAfterEachCopiedTable != null) {
      heartbeatAfterEachCopiedTable.getAsInt();
    }
  }

  private String placeholders(int count) {
    return String.join(", ", java.util.Collections.nCopies(count, "?"));
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

  private record PreparedCopyRowsPlan(
      List<String> columns,
      String insertVerb,
      String onDuplicateSql,
      String quotedColumns,
      String valuePlaceholders) {}
}
