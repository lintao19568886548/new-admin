package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.IntSupplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/** JDBC 版组织角色快照复制；只复制角色权限闭包，不迁移成员或用户数据。 */
@Component
public class JdbcOrganizationProvisioningRoleSnapshotCopyClient
    implements OrganizationProvisioningRoleSnapshotCopyClient {

  private static final int COPY_CHUNK_SIZE = 200;

  @Override
  public RoleSnapshotCopyResult copyOrganizationRoleSnapshot(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      long sourceOrgId,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    JdbcTemplate sourceJdbcTemplate = new JdbcTemplate(dataSource(sourceJdbcUrl));
    DriverManagerDataSource targetDataSource = dataSource(targetJdbcUrl);
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(targetDataSource);
    List<SourceRoleRow> roles = organizationRoles(sourceJdbcTemplate, sourceOrgId);
    List<Long> roleIds = roles.stream().map(SourceRoleRow::roleId).toList();
    if (roleIds.isEmpty()) {
      throw new IllegalStateException("组织缺少可迁移角色，请先回填默认员工角色: sourceOrgId=" + sourceOrgId);
    }
    assertRoleTreeLocal(roles, sourceOrgId);

    List<Long> codeIds = distinctRelationIds(sourceJdbcTemplate, "role_code", "code_id", roleIds);
    List<Long> parkIds = distinctRelationIds(sourceJdbcTemplate, "role_park", "park_id", roleIds);
    // 旧 worker 在目标库事务内复制角色快照；这里保持同样的半批回滚边界。
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(targetDataSource));
    RoleSnapshotCopyResult result =
        transactionTemplate.execute(
            ignored ->
                copyRoleSnapshotRows(
                    sourceJdbcTemplate,
                    targetJdbcTemplate,
                    roles,
                    roleIds,
                    codeIds,
                    parkIds,
                    heartbeatAfterEachCopiedChunk));
    if (result == null) {
      throw new IllegalStateException("组织角色快照复制事务未返回结果");
    }
    return result;
  }

  private RoleSnapshotCopyResult copyRoleSnapshotRows(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      List<SourceRoleRow> roles,
      List<Long> roleIds,
      List<Long> codeIds,
      List<Long> parkIds,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    List<String> copiedTables = new ArrayList<>();
    long copiedChunks = 0L;

    CopyRowsResult roleRows =
        copyRows(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "role",
            "WHERE role_id IN (" + placeholders(roleIds.size()) + ") ORDER BY role_id ASC",
            new ArrayList<>(roleIds),
            roleTargetOverrides(),
            heartbeatAfterEachCopiedChunk);
    copiedChunks += roleRows.chunksCopied();
    copiedTables.add("role");

    CopyRowsResult codeRows =
        codeIds.isEmpty()
            ? CopyRowsResult.empty()
            : copyRows(
                sourceJdbcTemplate,
                targetJdbcTemplate,
                "code",
                "WHERE code_id IN (" + placeholders(codeIds.size()) + ") ORDER BY code_id ASC",
                new ArrayList<>(codeIds),
                Map.of(),
                heartbeatAfterEachCopiedChunk);
    copiedChunks += codeRows.chunksCopied();
    copiedTables.add("code");

    CopyRowsResult parkRows =
        parkIds.isEmpty()
            ? CopyRowsResult.empty()
            : copyRows(
                sourceJdbcTemplate,
                targetJdbcTemplate,
                "park",
                "WHERE park_id IN (" + placeholders(parkIds.size()) + ")",
                new ArrayList<>(parkIds),
                Map.of(),
                heartbeatAfterEachCopiedChunk);
    copiedChunks += parkRows.chunksCopied();
    copiedTables.add("park");

    String rawRoleWhere = "WHERE role_id IN (" + placeholders(roleIds.size()) + ")";
    CopyRowsResult roleMenuRows =
        copyRows(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "role_menu",
            rawRoleWhere,
            new ArrayList<>(roleIds),
            Map.of(),
            heartbeatAfterEachCopiedChunk);
    copiedChunks += roleMenuRows.chunksCopied();
    copiedTables.add("role_menu");

    CopyRowsResult roleParkRows =
        copyRows(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "role_park",
            rawRoleWhere,
            new ArrayList<>(roleIds),
            Map.of(),
            heartbeatAfterEachCopiedChunk);
    copiedChunks += roleParkRows.chunksCopied();
    copiedTables.add("role_park");

    CopyRowsResult roleCodeRows =
        copyRows(
            sourceJdbcTemplate,
            targetJdbcTemplate,
            "role_code",
            rawRoleWhere,
            new ArrayList<>(roleIds),
            Map.of(),
            heartbeatAfterEachCopiedChunk);
    copiedChunks += roleCodeRows.chunksCopied();
    copiedTables.add("role_code");

    long totalRows =
        roleRows.rowsCopied()
            + codeRows.rowsCopied()
            + parkRows.rowsCopied()
            + roleMenuRows.rowsCopied()
            + roleParkRows.rowsCopied()
            + roleCodeRows.rowsCopied();
    return new RoleSnapshotCopyResult(
        List.copyOf(copiedTables),
        codeRows.rowsCopied(),
        copiedChunks,
        parkRows.rowsCopied(),
        roleCodeRows.rowsCopied(),
        roleMenuRows.rowsCopied(),
        roleParkRows.rowsCopied(),
        roleRows.rowsCopied(),
        roleSnapshots(roles),
        totalRows);
  }

  private List<SourceRoleRow> organizationRoles(JdbcTemplate sourceJdbcTemplate, long sourceOrgId) {
    return sourceJdbcTemplate.query(
        """
        SELECT role_id, parent_id, name
        FROM `role`
        WHERE scope = 'organization'
          AND organization_id = ?
        ORDER BY role_id ASC
        """,
        (rs, rowNum) -> {
          long parentId = rs.getLong("parent_id");
          boolean parentNull = rs.wasNull();
          return new SourceRoleRow(rs.getLong("role_id"), parentNull ? null : parentId, rs.getString("name"));
        },
        sourceOrgId);
  }

  private Map<String, Object> roleTargetOverrides() {
    Map<String, Object> overrides = new java.util.LinkedHashMap<>();
    overrides.put("organization_id", null);
    overrides.put("scope", "system");
    return overrides;
  }

  private void assertRoleTreeLocal(List<SourceRoleRow> roles, long sourceOrgId) {
    Set<Long> roleIds = new LinkedHashSet<>(roles.stream().map(SourceRoleRow::roleId).toList());
    for (SourceRoleRow role : roles) {
      if (role.parentId() != null && !roleIds.contains(role.parentId())) {
        throw new IllegalStateException(
            "组织角色树存在跨组织父级: sourceOrgId="
                + sourceOrgId
                + ", roleId="
                + role.roleId());
      }
    }
  }

  private List<Long> distinctRelationIds(
      JdbcTemplate sourceJdbcTemplate, String tableName, String idColumn, List<Long> roleIds) {
    if (roleIds.isEmpty()) {
      return List.of();
    }
    return sourceJdbcTemplate.query(
        "SELECT DISTINCT "
            + quoteIdentifier(idColumn)
            + " FROM "
            + quoteIdentifier(tableName)
            + " WHERE role_id IN ("
            + placeholders(roleIds.size())
            + ") ORDER BY "
            + quoteIdentifier(idColumn)
            + " ASC",
        (rs, rowNum) -> rs.getLong(idColumn),
        roleIds.toArray());
  }

  private CopyRowsResult copyRows(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      String tableName,
      String whereSql,
      List<?> params,
      Map<String, Object> targetOverrides,
      IntSupplier heartbeatAfterEachCopiedChunk) {
    PreparedCopyRowsPlan plan = prepareCopyRowsPlan(sourceJdbcTemplate, targetJdbcTemplate, tableName);
    if (plan.columns().isEmpty()) {
      return CopyRowsResult.empty();
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
                values.add(targetOverrides.containsKey(column) ? targetOverrides.get(column) : rs.getObject(column));
              }
              return values;
            },
            params.toArray());
    if (rows.isEmpty()) {
      return CopyRowsResult.empty();
    }

    long copiedChunks = 0L;
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
      heartbeat(heartbeatAfterEachCopiedChunk);
      copiedChunks++;
    }
    return new CopyRowsResult(rows.size(), copiedChunks);
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

  private List<RoleSnapshotItem> roleSnapshots(List<SourceRoleRow> roles) {
    return roles.stream()
        .map(role -> new RoleSnapshotItem(role.roleId(), role.roleId(), role.name()))
        .toList();
  }

  private void heartbeat(IntSupplier heartbeatAfterEachCopiedChunk) {
    if (heartbeatAfterEachCopiedChunk != null) {
      heartbeatAfterEachCopiedChunk.getAsInt();
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

  private record SourceRoleRow(long roleId, Long parentId, String name) {}

  private record CopyRowsResult(long rowsCopied, long chunksCopied) {
    private static CopyRowsResult empty() {
      return new CopyRowsResult(0, 0);
    }
  }

  private record PreparedCopyRowsPlan(
      List<String> columns,
      String insertVerb,
      String onDuplicateSql,
      String quotedColumns,
      String valuePlaceholders) {}
}
