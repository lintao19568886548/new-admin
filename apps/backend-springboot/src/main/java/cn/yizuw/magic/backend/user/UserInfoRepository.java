package cn.yizuw.magic.backend.user;

import cn.yizuw.magic.backend.auth.TenantUserInfo;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UserInfoRepository {

  public TenantUserInfo findTenantUserInfo(JdbcTemplate jdbcTemplate, long userId) {
    TenantUserBase tenantUser = findTenantUserById(jdbcTemplate, userId);
    if (tenantUser == null || tenantUser.status() != null && tenantUser.status() != 1) {
      return null;
    }

    List<RoleProjection> roles = findTenantRoles(jdbcTemplate, tenantUser.id());
    List<String> roleNames =
        roles.stream()
            .map(RoleProjection::name)
            .filter(name -> name != null && !name.isBlank())
            .distinct()
            .toList();
    List<String> codes = findTenantCodes(jdbcTemplate, tenantUser.id());
    List<Map<String, Object>> parks = findTenantParks(jdbcTemplate, tenantUser.id(), roleNames);
    int reimbursementAuth =
        roles.stream()
            .map(RoleProjection::reimbursementAuth)
            .filter(value -> value != null && value > 0)
            .max(Integer::compareTo)
            .orElse(0);
    int rates =
        roles.stream()
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
        roleNames,
        tenantUser.username());
  }

  private TenantUserBase findTenantUserById(JdbcTemplate jdbcTemplate, long userId) {
    List<TenantUserBase> rows =
        jdbcTemplate.query(
            """
            SELECT id, username, real_name, phone, home_path, status
            FROM user
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> mapTenantUserBase(rs),
            userId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<RoleProjection> findTenantRoles(JdbcTemplate jdbcTemplate, long userId) {
    return jdbcTemplate.query(
        """
        SELECT r.name, r.reimbursement_auth, r.rates
        FROM user_role ur
        INNER JOIN role r ON r.role_id = ur.role_id
        WHERE ur.user_id = ?
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

  private record RoleProjection(String name, Integer rates, Integer reimbursementAuth) {}

  private record TenantUserBase(
      Long id, String homePath, String phone, String realName, Integer status, String username) {}
}
