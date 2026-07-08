package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.config.DatabaseUrl;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.IntSupplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/** JDBC 版组织成员迁移；只写目标租户库 user/user_role/user_code。 */
@Component
public class JdbcOrganizationProvisioningMemberMigrationClient
    implements OrganizationProvisioningMemberMigrationClient {

  @Override
  public MemberMigrationResult migrateOrganizationMembers(
      String sourceJdbcUrl,
      String targetJdbcUrl,
      long sourceOrgId,
      String targetCustomerId,
      List<MemberMigrationCommand> members,
      IntSupplier heartbeatAfterEachMember) {
    JdbcTemplate sourceJdbcTemplate = new JdbcTemplate(dataSource(sourceJdbcUrl));
    DriverManagerDataSource targetDataSource = dataSource(targetJdbcUrl);
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(targetDataSource);
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(targetDataSource));

    MemberMigrationResult result =
        transactionTemplate.execute(
            ignored ->
                migrateMembersInTargetTransaction(
                    sourceJdbcTemplate,
                    targetJdbcTemplate,
                    sourceOrgId,
                    targetCustomerId,
                    members,
                    heartbeatAfterEachMember));
    if (result == null) {
      throw new IllegalStateException("组织成员迁移事务未返回结果");
    }
    return result;
  }

  private MemberMigrationResult migrateMembersInTargetTransaction(
      JdbcTemplate sourceJdbcTemplate,
      JdbcTemplate targetJdbcTemplate,
      long sourceOrgId,
      String targetCustomerId,
      List<MemberMigrationCommand> members,
      IntSupplier heartbeatAfterEachMember) {
    List<MemberMigrationItem> migratedMembers = new ArrayList<>();
    long targetUsersUpserted = 0L;
    long userCodeRowsInserted = 0L;
    long userRoleRowsInserted = 0L;

    for (MemberMigrationCommand member : members) {
      SourceUserRow sourceUser = findSourceUser(sourceJdbcTemplate, member);
      long targetUserId = upsertTargetTenantUser(targetJdbcTemplate, member, sourceUser, targetCustomerId);
      targetUsersUpserted++;

      List<Long> targetRoleIds =
          "owner".equals(member.memberRole())
              ? List.of(findSuperRoleId(targetJdbcTemplate))
              : sourceOrganizationRoleIds(sourceJdbcTemplate, sourceUser.id(), sourceOrgId);
      if (!"owner".equals(member.memberRole()) && targetRoleIds.isEmpty()) {
        throw new IllegalStateException("组织普通成员缺少可迁移角色: centerUserId=" + member.centerUserId());
      }
      assertTargetRolesExist(targetJdbcTemplate, targetRoleIds, member.centerUserId());

      targetJdbcTemplate.update("DELETE FROM user_role WHERE user_id = ?", targetUserId);
      if (hasColumns(targetJdbcTemplate, "user_code", "user_id")) {
        targetJdbcTemplate.update("DELETE FROM user_code WHERE user_id = ?", targetUserId);
      }

      long roleRows = insertUserRoles(targetJdbcTemplate, targetUserId, targetRoleIds);
      List<RoleCodeRow> roleCodes = targetRoleCodes(targetJdbcTemplate, targetRoleIds);
      long codeRows = insertUserCodes(targetJdbcTemplate, targetUserId, roleCodes);

      userRoleRowsInserted += roleRows;
      userCodeRowsInserted += codeRows;
      migratedMembers.add(
          new MemberMigrationItem(
              member.centerUserId(),
              member.memberRole(),
              roleCodes.stream().map(RoleCodeRow::code).filter(StringUtils::hasText).distinct().toList(),
              sourceUser.id(),
              sourceUser.username(),
              targetUserId,
              targetRoleIds,
              codeRows,
              roleRows));
      heartbeat(heartbeatAfterEachMember);
    }

    return new MemberMigrationResult(
        List.copyOf(migratedMembers),
        migratedMembers.size(),
        targetUsersUpserted,
        userCodeRowsInserted,
        userRoleRowsInserted);
  }

  private SourceUserRow findSourceUser(JdbcTemplate sourceJdbcTemplate, MemberMigrationCommand member) {
    List<SourceUserRow> rows =
        member.sourceUserId() == null
            ? sourceJdbcTemplate.query(
                """
                SELECT id, username, real_name, password, status, phone, home_path
                FROM `user`
                WHERE username = ?
                LIMIT 1
                """,
                (rs, rowNum) -> sourceUser(rs),
                member.centerUsername())
            : sourceJdbcTemplate.query(
                """
                SELECT id, username, real_name, password, status, phone, home_path
                FROM `user`
                WHERE id = ?
                LIMIT 1
                """,
                (rs, rowNum) -> sourceUser(rs),
                member.sourceUserId());
    if (rows.isEmpty()) {
      throw new IllegalStateException("未找到组织成员源租户用户: centerUserId=" + member.centerUserId());
    }
    return rows.get(0);
  }

  private SourceUserRow sourceUser(ResultSet rs) throws SQLException {
    return new SourceUserRow(
        rs.getLong("id"),
        rs.getString("username"),
        rs.getString("real_name"),
        rs.getString("password"),
        nullableInt(rs, "status"),
        rs.getString("phone"),
        rs.getString("home_path"));
  }

  private long upsertTargetTenantUser(
      JdbcTemplate targetJdbcTemplate,
      MemberMigrationCommand member,
      SourceUserRow sourceUser,
      String targetCustomerId) {
    String username = required(member.centerUsername(), "组织成员中心用户名为空: centerUserId=" + member.centerUserId());
    String realName = firstText(member.centerRealName(), sourceUser.realName(), username);
    String password = firstText(member.centerPassword(), sourceUser.password());
    if (!StringUtils.hasText(password)) {
      throw new IllegalStateException("组织成员缺少可迁移密码: centerUserId=" + member.centerUserId());
    }
    targetJdbcTemplate.update(
        """
        INSERT INTO `user`
          (username, real_name, password, customer_type, status, token_version, phone, home_path, park_id, create_time, update_time)
        VALUES (?, ?, ?, ?, 1, 1, ?, ?, NULL, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          real_name = VALUES(real_name),
          password = VALUES(password),
          customer_type = VALUES(customer_type),
          status = 1,
          phone = VALUES(phone),
          home_path = VALUES(home_path),
          update_time = NOW()
        """,
        username,
        realName,
        password,
        targetCustomerId,
        blankToNull(firstText(member.centerPhone(), sourceUser.phone())),
        blankToNull(firstText(member.centerHomePath(), sourceUser.homePath())));

    Long targetUserId =
        targetJdbcTemplate.queryForObject(
            "SELECT id FROM `user` WHERE username = ? LIMIT 1", Long.class, username);
    if (targetUserId == null || targetUserId <= 0) {
      throw new IllegalStateException("目标租户用户创建失败: username=" + username);
    }
    return targetUserId;
  }

  private long findSuperRoleId(JdbcTemplate targetJdbcTemplate) {
    List<Long> rows =
        targetJdbcTemplate.query(
            "SELECT role_id FROM `role` WHERE name = 'Super' ORDER BY role_id ASC LIMIT 1",
            (rs, rowNum) -> rs.getLong("role_id"));
    if (rows.isEmpty()) {
      throw new IllegalStateException("目标租户缺少 Super 角色，无法分配组织 owner 权限");
    }
    return rows.get(0);
  }

  private List<Long> sourceOrganizationRoleIds(
      JdbcTemplate sourceJdbcTemplate, long sourceUserId, long sourceOrgId) {
    return sourceJdbcTemplate.query(
        """
        SELECT DISTINCT user_role.role_id AS role_id
        FROM user_role
        INNER JOIN `role`
          ON `role`.role_id = user_role.role_id
        WHERE user_role.user_id = ?
          AND `role`.scope = 'organization'
          AND `role`.organization_id = ?
        ORDER BY user_role.role_id ASC
        """,
        (rs, rowNum) -> rs.getLong("role_id"),
        sourceUserId,
        sourceOrgId);
  }

  private void assertTargetRolesExist(
      JdbcTemplate targetJdbcTemplate, List<Long> roleIds, long centerUserId) {
    if (roleIds.isEmpty()) {
      return;
    }
    List<Long> existingRoleIds =
        targetJdbcTemplate.query(
            "SELECT role_id FROM `role` WHERE role_id IN ("
                + placeholders(roleIds.size())
                + ") ORDER BY role_id ASC",
            (rs, rowNum) -> rs.getLong("role_id"),
            roleIds.toArray());
    if (new LinkedHashSet<>(existingRoleIds).size() != new LinkedHashSet<>(roleIds).size()) {
      throw new IllegalStateException("目标租户缺少已复制的组织角色: centerUserId=" + centerUserId);
    }
  }

  private long insertUserRoles(
      JdbcTemplate targetJdbcTemplate, long targetUserId, List<Long> targetRoleIds) {
    long insertedRows = 0L;
    for (Long roleId : targetRoleIds) {
      targetJdbcTemplate.update(
          """
          INSERT INTO user_role (user_id, role_id, create_time, update_time)
          VALUES (?, ?, NOW(), NOW())
          """,
          targetUserId,
          roleId);
      insertedRows++;
    }
    return insertedRows;
  }

  private List<RoleCodeRow> targetRoleCodes(JdbcTemplate targetJdbcTemplate, List<Long> roleIds) {
    if (roleIds.isEmpty()) {
      return List.of();
    }
    String deletedFilter =
        tableColumns(targetJdbcTemplate, "code").contains("template_deleted_at")
            ? " AND code.template_deleted_at IS NULL"
            : "";
    return targetJdbcTemplate.query(
        """
        SELECT DISTINCT code.code_id, code.code
        FROM role_code
        INNER JOIN code
          ON code.code_id = role_code.code_id
        WHERE role_code.role_id IN (
        """
            + placeholders(roleIds.size())
            + """
            )
          AND code.code IS NOT NULL
        """
            + deletedFilter
            + """
        ORDER BY code.code ASC
        """,
        (rs, rowNum) -> new RoleCodeRow(rs.getLong("code_id"), rs.getString("code")),
        roleIds.toArray());
  }

  private long insertUserCodes(
      JdbcTemplate targetJdbcTemplate, long targetUserId, List<RoleCodeRow> roleCodes) {
    if (roleCodes.isEmpty()) {
      return 0L;
    }
    Set<String> columns = tableColumns(targetJdbcTemplate, "user_code");
    if (!columns.contains("user_id")) {
      return 0L;
    }
    if (columns.contains("code")) {
      return insertUserCodeValues(targetJdbcTemplate, targetUserId, roleCodes, true);
    }
    if (columns.contains("code_id")) {
      return insertUserCodeValues(targetJdbcTemplate, targetUserId, roleCodes, false);
    }
    return 0L;
  }

  private long insertUserCodeValues(
      JdbcTemplate targetJdbcTemplate,
      long targetUserId,
      List<RoleCodeRow> roleCodes,
      boolean useCodeValue) {
    Set<String> columns = tableColumns(targetJdbcTemplate, "user_code");
    List<String> insertColumns = new ArrayList<>(List.of("user_id", useCodeValue ? "code" : "code_id"));
    if (columns.contains("create_time")) {
      insertColumns.add("create_time");
    }
    if (columns.contains("update_time")) {
      insertColumns.add("update_time");
    }

    String valueSql =
        insertColumns.stream()
            .map(column -> "create_time".equals(column) || "update_time".equals(column) ? "NOW()" : "?")
            .collect(java.util.stream.Collectors.joining(", "));
    String sql =
        "INSERT INTO user_code ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + valueSql
            + ")";

    long insertedRows = 0L;
    Set<Object> insertedValues = new LinkedHashSet<>();
    for (RoleCodeRow roleCode : roleCodes) {
      Object codeValue = useCodeValue ? roleCode.code() : roleCode.codeId();
      if (codeValue == null || (codeValue instanceof String text && !StringUtils.hasText(text))) {
        continue;
      }
      if (!insertedValues.add(codeValue)) {
        continue;
      }
      targetJdbcTemplate.update(sql, targetUserId, codeValue);
      insertedRows++;
    }
    return insertedRows;
  }

  private Set<String> tableColumns(JdbcTemplate jdbcTemplate, String tableName) {
    return new LinkedHashSet<>(
        jdbcTemplate.query(
            """
            SELECT COLUMN_NAME
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = ?
            ORDER BY ORDINAL_POSITION ASC
            """,
            (rs, rowNum) -> rs.getString("COLUMN_NAME"),
            tableName));
  }

  private boolean hasColumns(JdbcTemplate jdbcTemplate, String tableName, String... columnNames) {
    Set<String> existingColumns = tableColumns(jdbcTemplate, tableName);
    for (String columnName : columnNames) {
      if (!existingColumns.contains(columnName)) {
        return false;
      }
    }
    return true;
  }

  private Integer nullableInt(ResultSet rs, String column) throws SQLException {
    int value = rs.getInt(column);
    return rs.wasNull() ? null : value;
  }

  private String required(String value, String message) {
    if (!StringUtils.hasText(value)) {
      throw new IllegalStateException(message);
    }
    return value.trim();
  }

  private String firstText(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value.trim();
      }
    }
    return "";
  }

  private String blankToNull(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private void heartbeat(IntSupplier heartbeatAfterEachMember) {
    if (heartbeatAfterEachMember != null) {
      heartbeatAfterEachMember.getAsInt();
    }
  }

  private String placeholders(int count) {
    return String.join(", ", java.util.Collections.nCopies(count, "?"));
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

  private record SourceUserRow(
      long id,
      String username,
      String realName,
      String password,
      Integer status,
      String phone,
      String homePath) {}

  private record RoleCodeRow(long codeId, String code) {}
}
