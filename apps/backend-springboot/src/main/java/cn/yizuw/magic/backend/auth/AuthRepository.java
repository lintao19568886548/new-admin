package cn.yizuw.magic.backend.auth;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class AuthRepository {

  private final JdbcTemplate centerJdbcTemplate;

  public AuthRepository(JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  public CenterUserRecord findCenterUserForLogin(String username) {
    List<CenterUserRecord> rows =
        centerJdbcTemplate.query(
            """
            SELECT u.id, u.username, u.password, u.customer_type, u.status, u.token_version,
                   c.db_name, c.status AS customer_status
            FROM user u
            LEFT JOIN customer c ON c.customer_id = u.customer_type
            WHERE u.username = ?
            LIMIT 1
            """,
            (rs, rowNum) -> mapCenterUser(rs),
            username);
    if (!rows.isEmpty()) {
      return rows.get(0);
    }
    if (!username.matches("\\d{11}")) {
      return null;
    }
    rows =
        centerJdbcTemplate.query(
            """
            SELECT u.id, u.username, u.password, u.customer_type, u.status, u.token_version,
                   c.db_name, c.status AS customer_status
            FROM user u
            LEFT JOIN customer c ON c.customer_id = u.customer_type
            WHERE u.phone = ?
            LIMIT 1
            """,
            (rs, rowNum) -> mapCenterUser(rs),
            username);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public CenterUserRecord findActiveCenterUserById(long id) {
    List<CenterUserRecord> rows =
        centerJdbcTemplate.query(
            """
            SELECT u.id, u.username, u.password, u.customer_type, u.status, u.token_version,
                   c.db_name, c.status AS customer_status
            FROM user u
            LEFT JOIN customer c ON c.customer_id = u.customer_type
            WHERE u.id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> mapCenterUser(rs),
            id);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public Long findMappedTenantUserId(long centerUserId, String customerId) {
    List<Long> rows =
        centerJdbcTemplate.query(
            """
            SELECT customer_user_id
            FROM user_tenant_mapping
            WHERE center_user_id = ? AND customer_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("customer_user_id"),
            centerUserId,
            customerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public void createTenantUserMapping(
      long centerUserId, String customerId, long tenantUserId, String dbName) {
    centerJdbcTemplate.update(
        """
        INSERT IGNORE INTO user_tenant_mapping
          (center_user_id, customer_id, customer_user_id, db_name)
        VALUES (?, ?, ?, ?)
        """,
        centerUserId,
        customerId,
        tenantUserId,
        dbName);
  }

  /** 短信登录缺失账号时创建中心用户，保持旧端 username/phone/realName 均为手机号的兼容策略。 */
  public long createCenterPhoneUser(String phoneNumber, String passwordHash, String customerId) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    centerJdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO user (
                    real_name, username, password, customer_type, status,
                    token_version, phone, create_time, update_time
                  ) VALUES (
                    ?, ?, ?, ?, 1, 1, ?, NOW(), NOW()
                  )
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, phoneNumber);
          statement.setString(2, phoneNumber);
          statement.setString(3, passwordHash);
          statement.setString(4, customerId);
          statement.setString(5, phoneNumber);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Unable to read created center user id");
    }
    return key.longValue();
  }

  /** 短信登录自动补齐租户用户；仅写 user 与 user_role，不触发组织或开通副作用。 */
  public long upsertTenantPhoneUser(JdbcTemplate tenantJdbcTemplate, String phoneNumber, String passwordHash, String customerId) {
    TenantUserBase existing = findTenantUserByUsername(tenantJdbcTemplate, phoneNumber);
    if (existing != null) {
      tenantJdbcTemplate.update(
          """
          UPDATE user
          SET phone = ?, real_name = ?, password = ?, customer_type = ?, status = 1, update_time = NOW()
          WHERE id = ?
          """,
          phoneNumber,
          phoneNumber,
          passwordHash,
          customerId,
          existing.id());
      ensureTenantRole(tenantJdbcTemplate, existing.id(), 1);
      return existing.id();
    }

    KeyHolder keyHolder = new GeneratedKeyHolder();
    tenantJdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO user (
                    real_name, username, password, customer_type, status,
                    token_version, phone, create_time, update_time
                  ) VALUES (
                    ?, ?, ?, ?, 1, 1, ?, NOW(), NOW()
                  )
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, phoneNumber);
          statement.setString(2, phoneNumber);
          statement.setString(3, passwordHash);
          statement.setString(4, customerId);
          statement.setString(5, phoneNumber);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Unable to read created tenant user id");
    }
    long tenantUserId = key.longValue();
    ensureTenantRole(tenantJdbcTemplate, tenantUserId, 1);
    return tenantUserId;
  }

  private void ensureTenantRole(JdbcTemplate tenantJdbcTemplate, long tenantUserId, int roleId) {
    Long count =
        tenantJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM user_role
            WHERE user_id = ? AND role_id = ?
            """,
            Long.class,
            tenantUserId,
            roleId);
    if (count != null && count > 0) {
      return;
    }
    tenantJdbcTemplate.update(
        """
        INSERT INTO user_role (user_id, role_id, create_time, update_time)
        VALUES (?, ?, NOW(), NOW())
        """,
        tenantUserId,
        roleId);
  }

  public void persistRefreshToken(
      String jti, String tokenHash, OffsetDateTime expiresAt, long userId) {
    centerJdbcTemplate.update(
        """
        INSERT INTO refresh_token (jti, token_hash, expires_at, user_id)
        VALUES (?, ?, ?, ?)
        """,
        jti,
        tokenHash,
        java.sql.Timestamp.from(expiresAt.toInstant()),
        userId);
  }

  public RefreshTokenRecord findRefreshToken(String jti) {
    List<RefreshTokenRecord> rows =
        centerJdbcTemplate.query(
            """
            SELECT jti, token_hash, expires_at, revoked_at, user_id
            FROM refresh_token
            WHERE jti = ?
            LIMIT 1
            """,
            (rs, rowNum) ->
                new RefreshTokenRecord(
                    toOffsetDateTime(rs, "expires_at"),
                    rs.getString("jti"),
                    toOffsetDateTime(rs, "revoked_at"),
                    rs.getString("token_hash"),
                    rs.getLong("user_id")),
            jti);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public void revokeRefreshToken(String jti, String replacedByJti) {
    centerJdbcTemplate.update(
        """
        UPDATE refresh_token
        SET revoked_at = NOW(), replaced_by_jti = ?, update_time = NOW()
        WHERE jti = ?
        """,
        replacedByJti,
        jti);
  }

  public void revokeRefreshToken(String jti) {
    centerJdbcTemplate.update(
        """
        UPDATE refresh_token
        SET revoked_at = NOW(), update_time = NOW()
        WHERE jti = ?
        """,
        jti);
  }

  public void revokeAllUserRefreshTokensAndBumpVersion(long userId) {
    centerJdbcTemplate.update(
        """
        UPDATE refresh_token
        SET revoked_at = NOW(), update_time = NOW()
        WHERE user_id = ? AND revoked_at IS NULL
        """,
        userId);
    centerJdbcTemplate.update(
        """
        UPDATE user
        SET token_version = token_version + 1, update_time = NOW()
        WHERE id = ?
        """,
        userId);
  }

  /** 在中心库事务中更新密码、递增 tokenVersion，并撤销该用户所有仍有效的刷新令牌。 */
  public void updatePasswordAndRevokeRefreshTokens(long userId, String passwordHash) {
    DataSource dataSource = centerJdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("Center DataSource is not available");
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    transactionTemplate.executeWithoutResult(
        ignored -> {
          centerJdbcTemplate.update(
              """
              UPDATE user
              SET password = ?, token_version = token_version + 1, update_time = NOW()
              WHERE id = ?
              """,
              passwordHash,
              userId);
          centerJdbcTemplate.update(
              """
              UPDATE refresh_token
              SET revoked_at = NOW(), update_time = NOW()
              WHERE user_id = ? AND revoked_at IS NULL
              """,
              userId);
        });
  }

  public TenantUserInfo resolveTenantUserInfo(
      JdbcTemplate tenantJdbcTemplate,
      long centerUserId,
      String customerId,
      String dbName,
      String username) {
    Long mappedUserId = findMappedTenantUserId(centerUserId, customerId);
    TenantUserBase tenantUser =
        mappedUserId == null
            ? findTenantUserByUsername(tenantJdbcTemplate, username)
            : findTenantUserById(tenantJdbcTemplate, mappedUserId);
    if (tenantUser == null || tenantUser.status() != null && tenantUser.status() != 1) {
      return null;
    }
    if (mappedUserId == null) {
      createTenantUserMapping(centerUserId, customerId, tenantUser.id(), dbName);
    }

    List<RoleProjection> roleRows = findTenantRoles(tenantJdbcTemplate, tenantUser.id());
    List<String> roles =
        roleRows.stream()
            .map(RoleProjection::name)
            .filter(name -> name != null && !name.isBlank())
            .distinct()
            .toList();
    List<String> codes = findTenantCodes(tenantJdbcTemplate, tenantUser.id());
    List<Map<String, Object>> parks = findTenantParks(tenantJdbcTemplate, tenantUser.id(), roles);
    int reimbursementAuth =
        roleRows.stream()
            .map(RoleProjection::reimbursementAuth)
            .filter(value -> value != null && value > 0)
            .max(Integer::compareTo)
            .orElse(0);
    int rates =
        roleRows.stream()
            .filter(role -> role.reimbursementAuth() != null && role.reimbursementAuth() == reimbursementAuth)
            .map(RoleProjection::rates)
            .filter(value -> value != null && value > 0)
            .findFirst()
            .orElse(0);

    return new TenantUserInfo(
        codes,
        tenantUser.homePath(),
        tenantUser.id(),
        parks,
        resolvePhone(tenantUser.username(), tenantUser.phone()),
        rates,
        tenantUser.realName(),
        reimbursementAuth,
        roles,
        tenantUser.username());
  }

  /** 只读解析当前租户用户手机号，供页面验证码等低副作用接口使用。 */
  public String findTenantUserPhone(
      JdbcTemplate tenantJdbcTemplate, Long tenantUserId, String username) {
    TenantUserBase tenantUser = null;
    if (tenantUserId != null && tenantUserId > 0) {
      tenantUser = findTenantUserById(tenantJdbcTemplate, tenantUserId);
    }
    if (tenantUser == null && username != null && !username.isBlank()) {
      tenantUser = findTenantUserByUsername(tenantJdbcTemplate, username);
    }
    return tenantUser == null ? null : resolvePhone(tenantUser.username(), tenantUser.phone());
  }

  private TenantUserBase findTenantUserByUsername(JdbcTemplate jdbcTemplate, String username) {
    List<TenantUserBase> rows =
        jdbcTemplate.query(
            """
            SELECT id, username, real_name, phone, home_path, status
            FROM user
            WHERE username = ?
            LIMIT 1
            """,
            (rs, rowNum) -> mapTenantUserBase(rs),
            username);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private TenantUserBase findTenantUserById(JdbcTemplate jdbcTemplate, long id) {
    List<TenantUserBase> rows =
        jdbcTemplate.query(
            """
            SELECT id, username, real_name, phone, home_path, status
            FROM user
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> mapTenantUserBase(rs),
            id);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<String> findTenantRoleNames(JdbcTemplate jdbcTemplate, long userId) {
    return jdbcTemplate.query(
        """
        SELECT r.name
        FROM user_role ur
        INNER JOIN role r ON r.role_id = ur.role_id
        WHERE ur.user_id = ? AND r.name IS NOT NULL
        ORDER BY r.role_id ASC
        """,
        (rs, rowNum) -> rs.getString("name"),
        userId);
  }

  private List<RoleProjection> findTenantRoles(JdbcTemplate jdbcTemplate, long userId) {
    return jdbcTemplate.query(
        """
        SELECT r.name, r.reimbursement_auth, r.rates
        FROM user_role ur
        INNER JOIN role r ON r.role_id = ur.role_id
        WHERE ur.user_id = ? AND r.name IS NOT NULL
        ORDER BY r.role_id ASC
        """,
        (rs, rowNum) ->
            new RoleProjection(
                rs.getString("name"),
                rs.getObject("rates", Integer.class),
                rs.getObject("reimbursement_auth", Integer.class)),
        userId);
  }

  private List<String> findTenantCodes(JdbcTemplate jdbcTemplate, long userId) {
    return jdbcTemplate.query(
        """
        SELECT DISTINCT c.code
        FROM user_role ur
        INNER JOIN role_code rc ON rc.role_id = ur.role_id
        INNER JOIN code c ON c.code_id = rc.code_id
        WHERE ur.user_id = ?
          AND c.code IS NOT NULL
          AND c.template_deleted_at IS NULL
        ORDER BY c.code ASC
        """,
        (rs, rowNum) -> rs.getString("code"),
        userId);
  }

  private List<Map<String, Object>> findTenantParks(
      JdbcTemplate jdbcTemplate, long userId, List<String> roles) {
    if (roles.contains("Super")) {
      return jdbcTemplate.query(
          """
          SELECT park_id, park_name
          FROM park
          WHERE is_deleted = false
          ORDER BY park_id ASC
          """,
          (rs, rowNum) -> parkMap(rs));
    }

    List<Map<String, Object>> directParks =
        jdbcTemplate.query(
            """
            SELECT p.park_id, p.park_name
            FROM user_park up
            INNER JOIN park p ON p.park_id = up.park_id
            WHERE up.user_id = ?
              AND up.is_deleted = false
              AND p.is_deleted = false
            ORDER BY p.park_id ASC
            """,
            (rs, rowNum) -> parkMap(rs),
            userId);
    if (!directParks.isEmpty()) {
      return directParks;
    }

    List<Map<String, Object>> legacyParks =
        jdbcTemplate.query(
            """
            SELECT p.park_id, p.park_name
            FROM user u
            INNER JOIN park p ON p.park_id = u.park_id
            WHERE u.id = ? AND p.is_deleted = false
            ORDER BY p.park_id ASC
            """,
            (rs, rowNum) -> parkMap(rs),
            userId);
    if (!legacyParks.isEmpty()) {
      return legacyParks;
    }

    return jdbcTemplate.query(
        """
        SELECT DISTINCT p.park_id, p.park_name
        FROM user_role ur
        INNER JOIN role_park rp ON rp.role_id = ur.role_id AND rp.is_deleted = false
        INNER JOIN park p ON p.park_id = rp.park_id AND p.is_deleted = false
        WHERE ur.user_id = ?
        ORDER BY p.park_id ASC
        """,
        (rs, rowNum) -> parkMap(rs),
        userId);
  }

  private CenterUserRecord mapCenterUser(ResultSet rs) throws SQLException {
    return new CenterUserRecord(
        rs.getString("customer_type"),
        rs.getObject("customer_status", Integer.class),
        rs.getString("db_name"),
        rs.getLong("id"),
        rs.getString("password"),
        rs.getObject("status", Integer.class),
        rs.getLong("token_version"),
        rs.getString("username"));
  }

  private TenantUserBase mapTenantUserBase(ResultSet rs) throws SQLException {
    return new TenantUserBase(
        rs.getLong("id"),
        rs.getString("home_path"),
        rs.getString("phone"),
        rs.getString("real_name"),
        rs.getObject("status", Integer.class),
        rs.getString("username"));
  }

  private Map<String, Object> parkMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("parkId", rs.getLong("park_id"));
    map.put("parkName", rs.getString("park_name"));
    return map;
  }

  private String resolvePhone(String username, String phone) {
    if (username != null && username.matches("\\d{11}")) {
      return username;
    }
    if (phone != null && phone.matches("\\d{11}")) {
      return phone;
    }
    return null;
  }

  private OffsetDateTime toOffsetDateTime(ResultSet rs, String columnName) throws SQLException {
    var timestamp = rs.getTimestamp(columnName);
    if (timestamp == null) {
      return null;
    }
    return timestamp.toInstant().atZone(ZoneId.systemDefault()).toOffsetDateTime();
  }

  private record TenantUserBase(
      Long id, String homePath, String phone, String realName, Integer status, String username) {}

  private record RoleProjection(String name, Integer rates, Integer reimbursementAuth) {}
}
