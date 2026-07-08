package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** JDBC 版组织角色/成员迁移预览；只读源库和目标库。 */
@Component
public class JdbcOrganizationProvisioningRoleMemberMigrationPreviewClient
    implements OrganizationProvisioningRoleMemberMigrationPreviewClient {

  private static final List<String> SOURCE_TABLES =
      List.of("role", "role_code", "role_park", "user", "user_role");
  private static final List<String> TARGET_TABLES =
      List.of(
          "role",
          "code",
          "park",
          "role_menu",
          "role_park",
          "role_code",
          "user",
          "user_role",
          "user_code");

  @Override
  public RoleMemberMigrationInspection inspect(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      long sourceOrgId,
      List<SourceUserLookup> sourceUserLookups) {
    JdbcTemplate sourceJdbcTemplate = new JdbcTemplate(dataSource(sourceJdbcUrl));
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(dataSource(targetJdbcUrl));
    List<String> missingSourceTables = missingTables(sourceJdbcTemplate, SOURCE_TABLES);
    List<String> missingTargetTables = missingTables(targetJdbcTemplate, TARGET_TABLES);
    if (!missingSourceTables.isEmpty() || !missingTargetTables.isEmpty()) {
      return new RoleMemberMigrationInspection(
          missingSourceTables, missingTargetTables, List.of(), List.of(), 0, 0, 0, 0, List.of());
    }

    List<OrganizationRolePlan> roles = organizationRoles(sourceJdbcTemplate, sourceOrgId);
    List<Long> roleIds = roles.stream().map(OrganizationRolePlan::roleId).toList();
    Set<Long> roleIdSet = new LinkedHashSet<>(roleIds);
    List<Long> invalidParentRoleIds =
        roles.stream()
            .filter(role -> role.parentId() != null && !roleIdSet.contains(role.parentId()))
            .map(OrganizationRolePlan::roleId)
            .toList();

    List<MemberSourceUserPlan> sourceUsers =
        sourceUserLookups.stream()
            .map(lookup -> resolveSourceUser(sourceJdbcTemplate, sourceOrgId, lookup))
            .toList();

    return new RoleMemberMigrationInspection(
        missingSourceTables,
        missingTargetTables,
        roles,
        invalidParentRoleIds,
        countRoleRelationRows(sourceJdbcTemplate, "role_code", roleIds),
        countRoleRelationDistinct(sourceJdbcTemplate, "role_code", "code_id", roleIds),
        countRoleRelationRows(sourceJdbcTemplate, "role_park", roleIds),
        countRoleRelationDistinct(sourceJdbcTemplate, "role_park", "park_id", roleIds),
        sourceUsers);
  }

  private List<String> missingTables(JdbcTemplate jdbcTemplate, List<String> tableNames) {
    List<String> missing = new ArrayList<>();
    for (String tableName : tableNames) {
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

  private List<OrganizationRolePlan> organizationRoles(
      JdbcTemplate sourceJdbcTemplate, long sourceOrgId) {
    return sourceJdbcTemplate.query(
        """
        SELECT role_id, parent_id, name
        FROM `role`
        WHERE scope = 'organization'
          AND organization_id = ?
        ORDER BY role_id ASC
        """,
        (rs, rowNum) ->
            new OrganizationRolePlan(
                rs.getLong("role_id"), nullableLong(rs, "parent_id"), rs.getString("name")),
        sourceOrgId);
  }

  private MemberSourceUserPlan resolveSourceUser(
      JdbcTemplate sourceJdbcTemplate, long sourceOrgId, SourceUserLookup lookup) {
    Long sourceUserId = lookup.effectiveSourceUserId();
    List<SourceUserRow> rows =
        sourceUserId == null
            ? sourceJdbcTemplate.query(
                """
                SELECT id, username, status
                FROM `user`
                WHERE username = ?
                LIMIT 1
                """,
                (rs, rowNum) -> sourceUser(rs),
                lookup.username())
            : sourceJdbcTemplate.query(
                """
                SELECT id, username, status
                FROM `user`
                WHERE id = ?
                LIMIT 1
                """,
                (rs, rowNum) -> sourceUser(rs),
                sourceUserId);
    SourceUserRow row = rows.isEmpty() ? null : rows.get(0);
    if (row == null) {
      return new MemberSourceUserPlan(
          lookup.centerUserId(),
          lookup.memberRole(),
          sourceUserId == null ? "username" : "id",
          sourceUserId == null ? lookup.username() : String.valueOf(sourceUserId),
          false,
          null,
          null,
          null,
          0);
    }
    return new MemberSourceUserPlan(
        lookup.centerUserId(),
        lookup.memberRole(),
        sourceUserId == null ? "username" : "id",
        sourceUserId == null ? lookup.username() : String.valueOf(sourceUserId),
        true,
        row.id(),
        row.username(),
        row.status(),
        countOrganizationUserRoles(sourceJdbcTemplate, row.id(), sourceOrgId));
  }

  private SourceUserRow sourceUser(ResultSet rs) throws SQLException {
    return new SourceUserRow(rs.getLong("id"), rs.getString("username"), nullableInt(rs, "status"));
  }

  private long countOrganizationUserRoles(
      JdbcTemplate sourceJdbcTemplate, long sourceUserId, long sourceOrgId) {
    Long count =
        sourceJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) AS total
            FROM user_role
            INNER JOIN `role`
              ON `role`.role_id = user_role.role_id
            WHERE user_role.user_id = ?
              AND `role`.scope = 'organization'
              AND `role`.organization_id = ?
            """,
            Long.class,
            sourceUserId,
            sourceOrgId);
    return count == null ? 0L : count;
  }

  private long countRoleRelationRows(
      JdbcTemplate sourceJdbcTemplate, String tableName, List<Long> roleIds) {
    return countRoleRelation(sourceJdbcTemplate, "COUNT(*)", tableName, roleIds);
  }

  private long countRoleRelationDistinct(
      JdbcTemplate sourceJdbcTemplate, String tableName, String columnName, List<Long> roleIds) {
    return countRoleRelation(
        sourceJdbcTemplate, "COUNT(DISTINCT " + quoteIdentifier(columnName) + ")", tableName, roleIds);
  }

  private long countRoleRelation(
      JdbcTemplate sourceJdbcTemplate, String selectExpr, String tableName, List<Long> roleIds) {
    if (roleIds.isEmpty()) {
      return 0L;
    }
    String placeholders = String.join(", ", roleIds.stream().map(ignored -> "?").toList());
    Long count =
        sourceJdbcTemplate.queryForObject(
            "SELECT "
                + selectExpr
                + " FROM "
                + quoteIdentifier(tableName)
                + " WHERE role_id IN ("
                + placeholders
                + ")",
            Long.class,
            roleIds.toArray());
    return count == null ? 0L : count;
  }

  private Long nullableLong(ResultSet rs, String column) throws SQLException {
    long value = rs.getLong(column);
    return rs.wasNull() ? null : value;
  }

  private Integer nullableInt(ResultSet rs, String column) throws SQLException {
    int value = rs.getInt(column);
    return rs.wasNull() ? null : value;
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

  private record SourceUserRow(long id, String username, Integer status) {}
}
