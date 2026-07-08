package cn.yizuw.magic.backend.system.user;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class SystemUserRepository {

  public PageResult<Map<String, Object>> findUsers(
      JdbcTemplate tenantJdbcTemplate, SystemUserQuery query, String customerId) {
    List<Object> args = new ArrayList<>();
    String where = buildUserWhere(query, customerId, args);
    Long total =
        tenantJdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM user u " + where, Long.class, args.toArray());
    int currentPage = query.currentPage() == null ? 1 : query.currentPage();
    int pageSize = query.pageSize() == null ? 20 : query.pageSize();
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    List<Map<String, Object>> items =
        tenantJdbcTemplate.query(
            """
            SELECT u.id, u.username, u.real_name, u.phone, u.park_id, u.status,
                   u.token_version, u.customer_type, u.create_time, u.update_time
            FROM user u
            """
                + where
                + """
                ORDER BY u.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> userMap(rs),
            pageArgs.toArray());
    return new PageResult<>(items, total == null ? 0 : total, currentPage, pageSize);
  }

  public Map<Integer, List<Map<String, Object>>> findUserRoles(
      JdbcTemplate tenantJdbcTemplate, List<Integer> userIds) {
    if (userIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(userIds.size(), "?"));
    Map<Integer, List<Map<String, Object>>> result = new LinkedHashMap<>();
    tenantJdbcTemplate.query(
        """
        SELECT ur.user_id, ur.role_id, r.name
        FROM user_role ur
        LEFT JOIN role r ON r.role_id = ur.role_id
        WHERE ur.user_id IN (
        """
            + placeholders
            + """
        )
        ORDER BY ur.user_id ASC, ur.role_id ASC
        """,
        rs -> {
          int userId = rs.getInt("user_id");
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("roleId", rs.getInt("role_id"));
          row.put("name", rs.getString("name"));
          result.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(row);
        },
        userIds.toArray());
    return result;
  }

  public Map<Integer, List<Map<String, Object>>> findUserDirectParks(
      JdbcTemplate tenantJdbcTemplate, List<Integer> userIds) {
    if (userIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(userIds.size(), "?"));
    Map<Integer, List<Map<String, Object>>> result = new LinkedHashMap<>();
    tenantJdbcTemplate.query(
        """
        SELECT up.user_id, p.park_id, p.park_name
        FROM user_park up
        INNER JOIN park p ON p.park_id = up.park_id
        WHERE up.user_id IN (
        """
            + placeholders
            + """
        )
          AND up.is_deleted = false
          AND p.is_deleted = false
        ORDER BY up.user_id ASC, p.park_id ASC
        """,
        rs -> {
          int userId = rs.getInt("user_id");
          result.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(parkMap(rs));
        },
        userIds.toArray());
    return result;
  }

  public Map<Integer, List<Map<String, Object>>> findLegacyUserParks(
      JdbcTemplate tenantJdbcTemplate, List<Integer> userIds) {
    if (userIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(userIds.size(), "?"));
    Map<Integer, List<Map<String, Object>>> result = new LinkedHashMap<>();
    tenantJdbcTemplate.query(
        """
        SELECT u.id AS user_id, p.park_id, p.park_name
        FROM user u
        INNER JOIN park p ON p.park_id = u.park_id
        WHERE u.id IN (
        """
            + placeholders
            + """
        )
          AND p.is_deleted = false
        ORDER BY u.id ASC, p.park_id ASC
        """,
        rs -> {
          int userId = rs.getInt("user_id");
          result.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(parkMap(rs));
        },
        userIds.toArray());
    return result;
  }

  public Map<Integer, Integer> findCenterUserIds(
      JdbcTemplate centerJdbcTemplate, String customerId, List<Integer> tenantUserIds) {
    if (tenantUserIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(tenantUserIds.size(), "?"));
    List<Object> args = new ArrayList<>();
    args.add(customerId);
    args.addAll(tenantUserIds);
    Map<Integer, Integer> result = new LinkedHashMap<>();
    centerJdbcTemplate.query(
        """
        SELECT center_user_id, customer_user_id
        FROM user_tenant_mapping
        WHERE customer_id = ?
          AND customer_user_id IN (
        """
            + placeholders
            + """
        )
        """,
        (org.springframework.jdbc.core.RowCallbackHandler)
            rs -> result.put(rs.getInt("customer_user_id"), rs.getInt("center_user_id")),
        args.toArray());
    return result;
  }

  public Map<Integer, Map<String, Object>> findCenterUsers(
      JdbcTemplate centerJdbcTemplate, List<Integer> centerUserIds) {
    if (centerUserIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(centerUserIds.size(), "?"));
    Map<Integer, Map<String, Object>> result = new LinkedHashMap<>();
    centerJdbcTemplate.query(
        """
        SELECT id, status, token_version, create_time, update_time
        FROM user
        WHERE id IN (
        """
            + placeholders
            + """
        )
        """,
        rs -> {
          Map<String, Object> row = new LinkedHashMap<>();
          int id = rs.getInt("id");
          row.put("id", id);
          row.put("status", rs.getObject("status", Integer.class));
          row.put("tokenVersion", rs.getObject("token_version", Integer.class));
          row.put("createTime", toIso(rs.getTimestamp("create_time")));
          row.put("updateTime", toIso(rs.getTimestamp("update_time")));
          result.put(id, row);
        },
        centerUserIds.toArray());
    return result;
  }

  /** 写接口需要的新用户表字段；灰度库未 db push 时返回业务错误而不是 SQL 500。 */
  public void assertWritableUserSchema(JdbcTemplate tenantJdbcTemplate) {
    if (!hasColumns(
        tenantJdbcTemplate,
        "user",
        "id",
        "username",
        "password",
        "real_name",
        "customer_type",
        "status",
        "token_version")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "用户表结构未初始化，请先执行租户库 db push");
    }
  }

  /** 校验当前客户空间可用。 */
  public void assertCustomerAvailable(JdbcTemplate centerJdbcTemplate, String customerId) {
    Integer count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM customer
            WHERE customer_id = ?
              AND status <> 0
            """,
            Integer.class,
            customerId);
    if (count == null || count == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "当前租户不可用，无法创建账号");
    }
  }

  /** 旧端新增账号要求租户库 username 唯一。 */
  public void assertTenantUsernameAvailable(JdbcTemplate jdbcTemplate, String username) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM user WHERE username = ?", Integer.class, username);
    if (count != null && count > 0) {
      throw new BusinessException(HttpStatus.CONFLICT, "租户库账号已存在");
    }
  }

  public Map<String, Object> findTenantUserById(JdbcTemplate jdbcTemplate, long id) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT id, username, password, real_name, phone, status, token_version
            FROM user
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("id", rs.getLong("id"));
              row.put("username", rs.getString("username"));
              row.put("password", rs.getString("password"));
              row.put("realName", rs.getString("real_name"));
              row.put("phone", rs.getString("phone"));
              row.put("status", rs.getObject("status", Integer.class));
              row.put("tokenVersion", rs.getObject("token_version", Integer.class));
              return row;
            },
            id);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public Map<String, Object> findCenterUserByUsername(
      JdbcTemplate centerJdbcTemplate, String username) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, username, password, customer_type, status, token_version, phone, real_name
            FROM user
            WHERE username = ?
            LIMIT 1
            """,
            (rs, rowNum) -> centerUserMap(rs),
            username);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public Map<String, Object> resolveCenterUser(
      JdbcTemplate centerJdbcTemplate, String customerId, long tenantUserId, String username) {
    List<Map<String, Object>> mapped =
        centerJdbcTemplate.query(
            """
            SELECT u.id, u.username, u.password, u.customer_type, u.status, u.token_version, u.phone, u.real_name
            FROM user_tenant_mapping m
            INNER JOIN user u ON u.id = m.center_user_id
            WHERE m.customer_id = ?
              AND m.customer_user_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> centerUserMap(rs),
            customerId,
            tenantUserId);
    if (!mapped.isEmpty()) {
      return mapped.get(0);
    }
    return findCenterUserByUsername(centerJdbcTemplate, username);
  }

  public long insertTenantUser(
      JdbcTemplate jdbcTemplate,
      String customerId,
      String passwordHash,
      String phone,
      String realName,
      int status,
      String username) {
    Set<String> tableColumns = tableColumns(jdbcTemplate, "user");
    List<String> columns = new ArrayList<>();
    List<Object> values = new ArrayList<>();
    addValue(columns, values, "username", username);
    addValue(columns, values, "real_name", realName);
    addValue(columns, values, "password", passwordHash);
    addValue(columns, values, "customer_type", customerId);
    addValue(columns, values, "status", status);
    addValue(columns, values, "token_version", 1);
    if (tableColumns.contains("phone")) {
      addValue(columns, values, "phone", blankToNull(phone));
    }
    if (tableColumns.contains("home_path")) {
      addValue(columns, values, "home_path", null);
    }
    if (tableColumns.contains("create_time")) {
      addRaw(columns, values, "create_time", "NOW()");
    }
    if (tableColumns.contains("update_time")) {
      addRaw(columns, values, "update_time", "NOW()");
    }

    StringBuilder valueSql = new StringBuilder();
    List<Object> finalArgs = new ArrayList<>();
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) {
        valueSql.append(", ");
      }
      Object value = values.get(i);
      if (value instanceof RawSql rawSql) {
        valueSql.append(rawSql.expression());
      } else {
        valueSql.append("?");
        finalArgs.add(value);
      }
    }
    String sql =
        "INSERT INTO user ("
            + String.join(", ", columns)
            + ") VALUES ("
            + valueSql
            + ")";
    KeyHolder keyHolder = new GeneratedKeyHolder();
    try {
      jdbcTemplate.update(
          connection -> {
            java.sql.PreparedStatement ps =
                connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < finalArgs.size(); i++) {
              ps.setObject(i + 1, finalArgs.get(i));
            }
            return ps;
          },
          keyHolder);
    } catch (DuplicateKeyException error) {
      throw new BusinessException(HttpStatus.CONFLICT, "租户库账号已存在");
    }
    Number key = keyHolder.getKey();
    if (key != null) {
      return key.longValue();
    }
    Long id = jdbcTemplate.queryForObject("SELECT id FROM user WHERE username = ? LIMIT 1", Long.class, username);
    return id == null ? 0 : id;
  }

  public void updateTenantUser(
      JdbcTemplate jdbcTemplate,
      long id,
      String passwordHash,
      String phone,
      String realName,
      int status) {
    Set<String> columns = tableColumns(jdbcTemplate, "user");
    List<String> sets = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    sets.add("real_name = ?");
    args.add(realName);
    sets.add("status = ?");
    args.add(status);
    if (passwordHash != null) {
      sets.add("password = ?");
      args.add(passwordHash);
    }
    if (columns.contains("phone")) {
      sets.add("phone = ?");
      args.add(blankToNull(phone));
    }
    if (columns.contains("update_time")) {
      sets.add("update_time = NOW()");
    }
    args.add(id);
    jdbcTemplate.update("UPDATE user SET " + String.join(", ", sets) + " WHERE id = ?", args.toArray());
  }

  public void replaceUserRoles(JdbcTemplate jdbcTemplate, long userId, List<Integer> roleIds) {
    jdbcTemplate.update("DELETE FROM user_role WHERE user_id = ?", userId);
    if (roleIds == null || roleIds.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(roleIds.size(), "?"));
    Set<Integer> existingIds =
        new HashSet<>(
            jdbcTemplate.query(
                "SELECT role_id FROM role WHERE role_id IN (" + placeholders + ")",
                (rs, rowNum) -> rs.getInt("role_id"),
                roleIds.toArray()));
    for (Integer roleId : roleIds) {
      if (existingIds.contains(roleId)) {
        insertUserRole(jdbcTemplate, userId, roleId);
      }
    }
  }

  public void syncUserParks(
      JdbcTemplate jdbcTemplate, long userId, List<Integer> parkIds, boolean updateLegacyParkId) {
    List<Integer> safeParkIds = parkIds == null ? List.of() : parkIds;
    if (!hasColumns(jdbcTemplate, "user_park", "user_id", "park_id", "is_deleted")) {
      if (updateLegacyParkId && !safeParkIds.isEmpty() && hasColumns(jdbcTemplate, "user", "park_id")) {
        jdbcTemplate.update("UPDATE user SET park_id = ? WHERE id = ?", safeParkIds.get(0), userId);
      }
      return;
    }
    assertParksExist(jdbcTemplate, safeParkIds);
    if (safeParkIds.isEmpty()) {
      jdbcTemplate.update("UPDATE user_park SET is_deleted = true WHERE user_id = ?", userId);
      if (updateLegacyParkId && hasColumns(jdbcTemplate, "user", "park_id")) {
        jdbcTemplate.update("UPDATE user SET park_id = NULL WHERE id = ?", userId);
      }
      return;
    }

    String placeholders = String.join(",", Collections.nCopies(safeParkIds.size(), "?"));
    List<Object> args = new ArrayList<>();
    args.add(userId);
    args.addAll(safeParkIds);
    jdbcTemplate.update(
        "UPDATE user_park SET is_deleted = true WHERE user_id = ? AND park_id NOT IN ("
            + placeholders
            + ")",
        args.toArray());
    jdbcTemplate.update(
        "UPDATE user_park SET is_deleted = false WHERE user_id = ? AND park_id IN ("
            + placeholders
            + ")",
        args.toArray());
    Set<Integer> existingIds =
        new HashSet<>(
            jdbcTemplate.query(
                "SELECT park_id FROM user_park WHERE user_id = ? AND park_id IN ("
                    + placeholders
                    + ")",
                (rs, rowNum) -> rs.getInt("park_id"),
                args.toArray()));
    for (Integer parkId : safeParkIds) {
      if (!existingIds.contains(parkId)) {
        insertUserPark(jdbcTemplate, userId, parkId);
      }
    }
    if (updateLegacyParkId && hasColumns(jdbcTemplate, "user", "park_id")) {
      jdbcTemplate.update("UPDATE user SET park_id = ? WHERE id = ?", safeParkIds.get(0), userId);
    }
  }

  public Long upsertCenterUserForTenant(
      JdbcTemplate centerJdbcTemplate,
      String customerId,
      String dbName,
      Map<String, Object> existingCenterUser,
      String passwordHash,
      String phone,
      String realName,
      int status,
      long tenantUserId,
      String username,
      boolean bumpTokenVersion) {
    Long centerUserId =
        existingCenterUser == null ? null : ((Number) existingCenterUser.get("id")).longValue();
    if (centerUserId == null) {
      centerUserId =
          insertCenterUser(
              centerJdbcTemplate, customerId, passwordHash, phone, realName, status, username);
    } else {
      updateCenterUser(
          centerJdbcTemplate,
          centerUserId,
          customerId,
          passwordHash,
          phone,
          realName,
          status,
          bumpTokenVersion);
    }
    upsertTenantMapping(centerJdbcTemplate, centerUserId, customerId, tenantUserId, dbName);
    if (bumpTokenVersion) {
      revokeRefreshTokens(centerJdbcTemplate, centerUserId);
    }
    return centerUserId;
  }

  public void detachEmployees(JdbcTemplate jdbcTemplate, long userId) {
    if (hasColumns(jdbcTemplate, "employee", "user_id")) {
      jdbcTemplate.update("UPDATE employee SET user_id = NULL WHERE user_id = ?", userId);
    }
  }

  public void softDeleteTenantUser(JdbcTemplate jdbcTemplate, long userId) {
    jdbcTemplate.update(
        """
        UPDATE user
        SET status = 2,
            token_version = token_version + 1,
            update_time = NOW()
        WHERE id = ?
        """,
        userId);
  }

  public void deleteUserRolesAndCodes(JdbcTemplate jdbcTemplate, long userId) {
    jdbcTemplate.update("DELETE FROM user_role WHERE user_id = ?", userId);
    if (hasColumns(jdbcTemplate, "user_code", "user_id")) {
      jdbcTemplate.update("DELETE FROM user_code WHERE user_id = ?", userId);
    }
  }

  public void softDeleteUserParks(JdbcTemplate jdbcTemplate, long userId) {
    if (hasColumns(jdbcTemplate, "user_park", "user_id", "is_deleted")) {
      jdbcTemplate.update("UPDATE user_park SET is_deleted = true WHERE user_id = ?", userId);
    }
  }

  public void deleteTenantMapping(
      JdbcTemplate centerJdbcTemplate, long centerUserId, String customerId, long tenantUserId) {
    centerJdbcTemplate.update(
        """
        DELETE FROM user_tenant_mapping
        WHERE center_user_id = ?
          AND customer_id = ?
          AND customer_user_id = ?
        """,
        centerUserId,
        customerId,
        tenantUserId);
  }

  public boolean hasAnyTenantMapping(JdbcTemplate centerJdbcTemplate, long centerUserId) {
    Integer count =
        centerJdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM user_tenant_mapping WHERE center_user_id = ?",
            Integer.class,
            centerUserId);
    return count != null && count > 0;
  }

  public void softDeleteCenterUserAndRevokeTokens(JdbcTemplate centerJdbcTemplate, long centerUserId) {
    centerJdbcTemplate.update(
        """
        UPDATE user
        SET status = 2,
            token_version = token_version + 1,
            update_time = NOW()
        WHERE id = ?
        """,
        centerUserId);
    revokeRefreshTokens(centerJdbcTemplate, centerUserId);
  }

  /** 中心库同步失败时清理本批刚创建的租户账号，避免半成品账号留在租户库。 */
  public void cleanupCreatedTenantUser(JdbcTemplate jdbcTemplate, long tenantUserId) {
    deleteUserRolesAndCodes(jdbcTemplate, tenantUserId);
    softDeleteUserParks(jdbcTemplate, tenantUserId);
    jdbcTemplate.update("DELETE FROM user WHERE id = ?", tenantUserId);
  }

  private String buildUserWhere(SystemUserQuery query, String customerId, List<Object> args) {
    StringJoiner where = new StringJoiner(" AND ", "WHERE ", "");
    where.add("u.customer_type = ?");
    args.add(customerId);
    where.add("u.status <> 2");
    if (StringUtils.hasText(query.username())) {
      where.add("u.username LIKE ?");
      args.add("%" + query.username().trim() + "%");
    }
    if (StringUtils.hasText(query.realName())) {
      where.add("u.real_name LIKE ?");
      args.add("%" + query.realName().trim() + "%");
    }
    if (StringUtils.hasText(query.phone())) {
      where.add("u.phone LIKE ?");
      args.add("%" + query.phone().trim() + "%");
    }
    if (query.status() != null) {
      where.add("u.status = ?");
      args.add(query.status());
    }
    return where.toString();
  }

  private Map<String, Object> userMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", rs.getInt("id"));
    map.put("tenantUserId", rs.getInt("id"));
    map.put("customerUserId", rs.getInt("id"));
    map.put("username", rs.getString("username"));
    map.put("realName", rs.getString("real_name"));
    map.put("phone", rs.getString("phone") == null ? "" : rs.getString("phone"));
    map.put("parkId", rs.getObject("park_id", Integer.class));
    map.put("status", rs.getObject("status", Integer.class));
    map.put("tokenVersion", rs.getObject("token_version", Integer.class));
    map.put("customerType", rs.getString("customer_type"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    return map;
  }

  private Map<String, Object> parkMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("parkId", rs.getInt("park_id"));
    map.put("parkName", rs.getString("park_name"));
    return map;
  }

  private static String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private long insertCenterUser(
      JdbcTemplate jdbcTemplate,
      String customerId,
      String passwordHash,
      String phone,
      String realName,
      int status,
      String username) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          java.sql.PreparedStatement ps =
              connection.prepareStatement(
                  """
                  INSERT INTO user
                    (username, real_name, password, customer_type, phone, status, token_version, create_time, update_time)
                  VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          ps.setString(1, username);
          ps.setString(2, realName);
          ps.setString(3, passwordHash);
          ps.setString(4, customerId);
          ps.setString(5, blankToNull(phone));
          ps.setInt(6, status);
          return ps;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key != null) {
      return key.longValue();
    }
    Long id =
        jdbcTemplate.queryForObject(
            "SELECT id FROM user WHERE username = ? LIMIT 1", Long.class, username);
    if (id == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "中心库账号创建失败");
    }
    return id;
  }

  private void updateCenterUser(
      JdbcTemplate jdbcTemplate,
      long centerUserId,
      String customerId,
      String passwordHash,
      String phone,
      String realName,
      int status,
      boolean bumpTokenVersion) {
    List<String> sets = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    sets.add("customer_type = ?");
    args.add(customerId);
    sets.add("phone = ?");
    args.add(blankToNull(phone));
    sets.add("real_name = ?");
    args.add(realName);
    sets.add("status = ?");
    args.add(status);
    if (passwordHash != null) {
      sets.add("password = ?");
      args.add(passwordHash);
    }
    if (bumpTokenVersion) {
      sets.add("token_version = token_version + 1");
    }
    sets.add("update_time = NOW()");
    args.add(centerUserId);
    jdbcTemplate.update(
        "UPDATE user SET " + String.join(", ", sets) + " WHERE id = ?", args.toArray());
  }

  private void upsertTenantMapping(
      JdbcTemplate jdbcTemplate,
      long centerUserId,
      String customerId,
      long tenantUserId,
      String dbName) {
    jdbcTemplate.update(
        """
        INSERT INTO user_tenant_mapping
          (center_user_id, customer_id, customer_user_id, db_name, create_time, update_time)
        VALUES (?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          customer_user_id = VALUES(customer_user_id),
          db_name = VALUES(db_name),
          update_time = NOW()
        """,
        centerUserId,
        customerId,
        tenantUserId,
        dbName);
  }

  private void revokeRefreshTokens(JdbcTemplate jdbcTemplate, long centerUserId) {
    jdbcTemplate.update(
        """
        UPDATE refresh_token
        SET revoked_at = NOW(), update_time = NOW()
        WHERE user_id = ?
          AND revoked_at IS NULL
        """,
        centerUserId);
  }

  private void assertParksExist(JdbcTemplate jdbcTemplate, List<Integer> parkIds) {
    if (parkIds == null || parkIds.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(parkIds.size(), "?"));
    Set<Integer> existingIds =
        new HashSet<>(
            jdbcTemplate.query(
                "SELECT park_id FROM park WHERE is_deleted = false AND park_id IN ("
                    + placeholders
                    + ")",
                (rs, rowNum) -> rs.getInt("park_id"),
                parkIds.toArray()));
    List<Integer> missing = parkIds.stream().filter(parkId -> !existingIds.contains(parkId)).toList();
    if (!missing.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "园区不存在或已停用：" + joinIds(missing));
    }
  }

  private void insertUserRole(JdbcTemplate jdbcTemplate, long userId, int roleId) {
    Set<String> columns = tableColumns(jdbcTemplate, "user_role");
    List<String> insertColumns = new ArrayList<>();
    List<Object> values = new ArrayList<>();
    addValue(insertColumns, values, "user_id", userId);
    addValue(insertColumns, values, "role_id", roleId);
    if (columns.contains("create_time")) {
      addRaw(insertColumns, values, "create_time", "NOW()");
    }
    if (columns.contains("update_time")) {
      addRaw(insertColumns, values, "update_time", "NOW()");
    }
    executeInsert(jdbcTemplate, "user_role", insertColumns, values);
  }

  private void insertUserPark(JdbcTemplate jdbcTemplate, long userId, int parkId) {
    Set<String> columns = tableColumns(jdbcTemplate, "user_park");
    List<String> insertColumns = new ArrayList<>();
    List<Object> values = new ArrayList<>();
    addValue(insertColumns, values, "user_id", userId);
    addValue(insertColumns, values, "park_id", parkId);
    addValue(insertColumns, values, "is_deleted", false);
    if (columns.contains("create_time")) {
      addRaw(insertColumns, values, "create_time", "NOW()");
    }
    if (columns.contains("update_time")) {
      addRaw(insertColumns, values, "update_time", "NOW()");
    }
    executeInsert(jdbcTemplate, "user_park", insertColumns, values);
  }

  private void executeInsert(
      JdbcTemplate jdbcTemplate, String tableName, List<String> columns, List<Object> values) {
    StringBuilder valueSql = new StringBuilder();
    List<Object> args = new ArrayList<>();
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) {
        valueSql.append(", ");
      }
      Object value = values.get(i);
      if (value instanceof RawSql rawSql) {
        valueSql.append(rawSql.expression());
      } else {
        valueSql.append("?");
        args.add(value);
      }
    }
    jdbcTemplate.update(
        "INSERT INTO "
            + tableName
            + " ("
            + String.join(", ", columns)
            + ") VALUES ("
            + valueSql
            + ")",
        args.toArray());
  }

  private Map<String, Object> centerUserMap(ResultSet rs) throws SQLException {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", rs.getLong("id"));
    row.put("username", rs.getString("username"));
    row.put("password", rs.getString("password"));
    row.put("customerType", rs.getString("customer_type"));
    row.put("status", rs.getObject("status", Integer.class));
    row.put("tokenVersion", rs.getObject("token_version", Integer.class));
    row.put("phone", rs.getString("phone"));
    row.put("realName", rs.getString("real_name"));
    return row;
  }

  private Set<String> tableColumns(JdbcTemplate jdbcTemplate, String tableName) {
    return new HashSet<>(
        jdbcTemplate.query(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            (rs, rowNum) -> rs.getString("column_name").toLowerCase(),
            tableName));
  }

  private boolean hasColumns(JdbcTemplate jdbcTemplate, String tableName, String... columns) {
    Set<String> existing = tableColumns(jdbcTemplate, tableName);
    if (existing.isEmpty()) {
      return false;
    }
    for (String column : columns) {
      if (!existing.contains(column.toLowerCase())) {
        return false;
      }
    }
    return true;
  }

  private void addValue(List<String> columns, List<Object> values, String column, Object value) {
    columns.add(column);
    values.add(value);
  }

  private void addRaw(List<String> columns, List<Object> values, String column, String expression) {
    columns.add(column);
    values.add(new RawSql(expression));
  }

  private String blankToNull(String value) {
    return StringUtils.hasText(value) ? value : null;
  }

  private String joinIds(List<Integer> ids) {
    return ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(", "));
  }

  private record RawSql(String expression) {}
}
