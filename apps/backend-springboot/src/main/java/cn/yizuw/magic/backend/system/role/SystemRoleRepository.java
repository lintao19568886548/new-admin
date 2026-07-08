package cn.yizuw.magic.backend.system.role;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.common.PageRequestParams;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class SystemRoleRepository {

  public PageResult<Map<String, Object>> findRolePage(
      JdbcTemplate jdbcTemplate,
      Integer page,
      Integer pageSize,
      String name,
      String remark,
      String status,
      String startTime,
      String endTime) {
    int currentPage = PageRequestParams.normalizePage(page, 1);
    int size = PageRequestParams.normalizePageSize(pageSize, 20);
    List<Object> args = new ArrayList<>();
    String where = buildWhere(args, name, remark, status, startTime, endTime, false);
    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM role r " + where, Long.class, args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * size);
    pageArgs.add(size);
    List<Map<String, Object>> roles =
        jdbcTemplate.query(
            """
            SELECT r.*
            FROM role r
            """
                + where
                + """
                ORDER BY r.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> roleMap(rs),
            pageArgs.toArray());
    enrichRoles(jdbcTemplate, roles);
    return new PageResult<>(roles, total == null ? 0 : total, currentPage, size);
  }

  public List<Map<String, Object>> findRoleTree(JdbcTemplate jdbcTemplate) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT r.*
            FROM role r
            WHERE (r.scope IS NULL OR r.scope = 'system')
            ORDER BY r.create_time ASC, r.role_id ASC
            """,
            (rs, rowNum) -> roleMap(rs));
    enrichRoles(jdbcTemplate, rows);
    return buildTree(rows);
  }

  public Map<String, Object> findRoleById(JdbcTemplate jdbcTemplate, int roleId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT r.*
            FROM role r
            WHERE r.role_id = ?
              AND (r.scope IS NULL OR r.scope = 'system')
            LIMIT 1
            """,
            (rs, rowNum) -> roleMap(rs),
            roleId);
    if (rows.isEmpty()) {
      return null;
    }
    enrichRoles(jdbcTemplate, rows);
    return rows.get(0);
  }

  /** 校验系统角色存在；组织角色范围后续随组织角色专项迁移。 */
  public void assertSystemRoleExists(JdbcTemplate jdbcTemplate, int roleId) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM role
            WHERE role_id = ?
              AND (scope IS NULL OR scope = 'system')
            """,
            Integer.class,
            roleId);
    if (count == null || count == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "角色不存在或无权操作");
    }
  }

  /** 校验权限码存在且没有被模板软删除。 */
  public void assertCodeExists(JdbcTemplate jdbcTemplate, int codeId) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM code
            WHERE code_id = ?
              AND (template_deleted_at IS NULL)
            """,
            Integer.class,
            codeId);
    if (count == null || count == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "权限码不存在");
    }
  }

  /** 校验菜单权限存在；旧端允许所有 menu 作为可配置权限。 */
  public void assertMenusExist(JdbcTemplate jdbcTemplate, List<Integer> menuIds) {
    if (menuIds.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(menuIds.size(), "?"));
    Set<Integer> existingIds =
        new HashSet<>(
            jdbcTemplate.query(
                "SELECT menu_id FROM menu WHERE menu_id IN (" + placeholders + ")",
                (rs, rowNum) -> rs.getInt("menu_id"),
                menuIds.toArray()));
    List<Integer> missing = menuIds.stream().filter(menuId -> !existingIds.contains(menuId)).toList();
    if (!missing.isEmpty()) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "权限项不存在或已不是可配置权限：" + joinIds(missing));
    }
  }

  /** 校验园区存在且未软删除，用于同步角色园区范围。 */
  public void assertParksExist(JdbcTemplate jdbcTemplate, List<Integer> parkIds) {
    if (parkIds.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(parkIds.size(), "?"));
    Set<Integer> existingIds =
        new HashSet<>(
            jdbcTemplate.query(
                "SELECT park_id FROM park WHERE is_deleted = false AND park_id IN (" + placeholders + ")",
                (rs, rowNum) -> rs.getInt("park_id"),
                parkIds.toArray()));
    List<Integer> missing = parkIds.stream().filter(parkId -> !existingIds.contains(parkId)).toList();
    if (!missing.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "园区不存在或已停用：" + joinIds(missing));
    }
  }

  /** 子角色权限不能超出父角色现有权限范围。 */
  public void assertPermissionsWithinParent(
      JdbcTemplate jdbcTemplate, Integer parentRoleId, List<Integer> menuIds) {
    if (parentRoleId == null || menuIds.isEmpty()) {
      return;
    }
    Set<Integer> parentMenuIds = new HashSet<>(findActiveMenuIdsByRoleId(jdbcTemplate, parentRoleId));
    List<Integer> invalid = menuIds.stream().filter(menuId -> !parentMenuIds.contains(menuId)).toList();
    if (!invalid.isEmpty()) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "子角色权限不能超出父角色范围，无效权限ID：" + joinIds(invalid));
    }
  }

  /** 添加权限时按旧端逻辑校验父角色范围，批量更新场景允许父角色也在本批次内。 */
  public void assertAddPermissionsWithinParent(
      JdbcTemplate jdbcTemplate, int roleId, List<Integer> menuIds, List<Integer> batchRoleIds) {
    Integer parentRoleId =
        jdbcTemplate.queryForObject(
            "SELECT parent_id FROM role WHERE role_id = ? LIMIT 1", Integer.class, roleId);
    if (parentRoleId == null || menuIds.isEmpty()) {
      return;
    }
    Set<Integer> parentMenuIds = new HashSet<>(findActiveMenuIdsByRoleId(jdbcTemplate, parentRoleId));
    if (batchRoleIds != null && batchRoleIds.contains(parentRoleId)) {
      parentMenuIds.addAll(menuIds);
    }
    List<Integer> invalid = menuIds.stream().filter(menuId -> !parentMenuIds.contains(menuId)).toList();
    if (!invalid.isEmpty()) {
      throw new BusinessException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "子角色权限不能超出父角色范围。无效的菜单ID: " + joinIds(invalid));
    }
  }

  /** 更新角色主表白名单字段，避免旧端 body 透传导致未知字段写库。 */
  public void updateRole(
      JdbcTemplate jdbcTemplate, int roleId, RoleUpdateRequest request, Integer parentRoleId) {
    Set<String> columns = columnSet(jdbcTemplate, "role");
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendString(assignments, args, columns, "name", request == null ? null : request.name());
    appendString(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendBoolean(assignments, args, columns, "status", request == null ? null : request.status());
    appendInteger(
        assignments,
        args,
        columns,
        "reimbursement_auth",
        request == null ? null : request.reimbursementAuth(),
        "报销权限参数错误");
    appendInteger(assignments, args, columns, "rates", request == null ? null : request.rates(), "提成参数错误");
    if (request != null && hasValue(request.parentId()) && columns.contains("parent_id")) {
      assignments.add("parent_id = ?");
      args.add(parentRoleId);
    }
    if (columns.contains("update_time") && !assignments.isEmpty()) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    if (!assignments.isEmpty()) {
      args.add(roleId);
      jdbcTemplate.update(
          "UPDATE role SET " + String.join(", ", assignments) + " WHERE role_id = ?",
          args.toArray());
    }
  }

  /** 创建系统角色主表记录，未知字段不写库，避免旧端 body 透传带来的 schema 风险。 */
  public Map<String, Object> createRole(
      JdbcTemplate jdbcTemplate, RoleCreateRequest request, Integer parentRoleId) {
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "角色名称不能为空");
    }
    Set<String> columns = columnSet(jdbcTemplate, "role");
    if (!columns.containsAll(Set.of("role_id", "name"))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "角色表结构不完整");
    }
    String name = cleanText(request.name());
    if (!StringUtils.hasText(name)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "角色名称不能为空");
    }

    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    insertColumns.add("name");
    args.add(name);
    appendStringInsert(insertColumns, args, columns, "remark", request.remark());
    if (columns.contains("status")) {
      insertColumns.add("status");
      args.add(request.status() == null ? true : toBoolean(request.status(), "角色状态只能是启用或禁用"));
    }
    appendIntegerInsert(
        insertColumns, args, columns, "reimbursement_auth", request.reimbursementAuth(), "报销权限参数错误");
    appendIntegerInsert(insertColumns, args, columns, "rates", request.rates(), "提成参数错误");
    if (columns.contains("parent_id") && parentRoleId != null) {
      insertColumns.add("parent_id");
      args.add(parentRoleId);
    }
    if (columns.contains("scope")) {
      insertColumns.add("scope");
      args.add("system");
    }
    if (columns.contains("create_time")) {
      insertColumns.add("create_time");
      args.add(Timestamp.from(java.time.Instant.now()));
    }
    if (columns.contains("update_time")) {
      insertColumns.add("update_time");
      args.add(Timestamp.from(java.time.Instant.now()));
    }

    jdbcTemplate.update(
        "INSERT INTO role ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer roleId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (roleId == null || roleId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建角色失败");
    }
    Map<String, Object> created = findRoleById(jdbcTemplate, roleId);
    if (created == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建角色失败");
    }
    return created;
  }

  /** 全量同步角色菜单权限，保留软删恢复语义。 */
  public void syncRoleMenus(JdbcTemplate jdbcTemplate, int roleId, List<Integer> nextMenuIds) {
    List<RoleRelationRow> rows = findRoleMenuRows(jdbcTemplate, roleId);
    Set<Integer> activeIds = new HashSet<>();
    Set<Integer> deletedIds = new HashSet<>();
    for (RoleRelationRow row : rows) {
      if (row.deleted()) {
        deletedIds.add(row.id());
      } else {
        activeIds.add(row.id());
      }
    }
    Set<Integer> nextIds = new HashSet<>(nextMenuIds);
    List<Integer> toDelete = activeIds.stream().filter(menuId -> !nextIds.contains(menuId)).toList();
    if (!toDelete.isEmpty()) {
      jdbcTemplate.update(
          "UPDATE role_menu SET is_deleted = true WHERE role_id = ? AND menu_id IN ("
              + placeholders(toDelete.size())
              + ")",
          merge(roleId, toDelete));
    }
    addRoleMenus(jdbcTemplate, roleId, nextMenuIds, deletedIds, activeIds);
  }

  /** 全量同步角色园区范围，保留软删恢复语义。 */
  public void syncRoleParks(JdbcTemplate jdbcTemplate, int roleId, List<Integer> nextParkIds) {
    List<RoleRelationRow> rows = findRoleParkRows(jdbcTemplate, roleId);
    Set<Integer> activeIds = new HashSet<>();
    Set<Integer> deletedIds = new HashSet<>();
    for (RoleRelationRow row : rows) {
      if (row.deleted()) {
        deletedIds.add(row.id());
      } else {
        activeIds.add(row.id());
      }
    }
    Set<Integer> nextIds = new HashSet<>(nextParkIds);
    List<Integer> toDelete = activeIds.stream().filter(parkId -> !nextIds.contains(parkId)).toList();
    if (!toDelete.isEmpty()) {
      jdbcTemplate.update(
          "UPDATE role_park SET is_deleted = true WHERE role_id = ? AND park_id IN ("
              + placeholders(toDelete.size())
              + ")",
          merge(roleId, toDelete));
    }
    List<Integer> toRecover = nextParkIds.stream().filter(deletedIds::contains).toList();
    if (!toRecover.isEmpty()) {
      jdbcTemplate.update(
          "UPDATE role_park SET is_deleted = false WHERE role_id = ? AND park_id IN ("
              + placeholders(toRecover.size())
              + ")",
          merge(roleId, toRecover));
    }
    List<Integer> toCreate =
        nextParkIds.stream()
            .filter(parkId -> !activeIds.contains(parkId) && !deletedIds.contains(parkId))
            .toList();
    for (Integer parkId : toCreate) {
      jdbcTemplate.update(
          "INSERT INTO role_park (role_id, park_id, is_deleted, create_time, update_time) VALUES (?, ?, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          roleId,
          parkId);
    }
  }

  /** 增量添加角色菜单权限，恢复已软删记录或创建新记录。 */
  public void addRoleMenus(JdbcTemplate jdbcTemplate, int roleId, List<Integer> menuIds) {
    List<RoleRelationRow> rows = findRoleMenuRows(jdbcTemplate, roleId);
    Set<Integer> activeIds = new HashSet<>();
    Set<Integer> deletedIds = new HashSet<>();
    for (RoleRelationRow row : rows) {
      if (row.deleted()) {
        deletedIds.add(row.id());
      } else {
        activeIds.add(row.id());
      }
    }
    addRoleMenus(jdbcTemplate, roleId, menuIds, deletedIds, activeIds);
  }

  /** 软删除角色菜单权限。 */
  public void softDeleteRoleMenus(JdbcTemplate jdbcTemplate, int roleId, List<Integer> menuIds) {
    jdbcTemplate.update(
        "UPDATE role_menu SET is_deleted = true WHERE role_id = ? AND menu_id IN ("
            + placeholders(menuIds.size())
            + ")",
        merge(roleId, menuIds));
  }

  /** 删除角色及本地关联；旧 Nitro 后端保留，便于稳定期回退。 */
  public void deleteRole(JdbcTemplate jdbcTemplate, int roleId) {
    jdbcTemplate.update("DELETE FROM role_code WHERE role_id = ?", roleId);
    jdbcTemplate.update("DELETE FROM role_menu WHERE role_id = ?", roleId);
    jdbcTemplate.update("DELETE FROM role_park WHERE role_id = ?", roleId);
    jdbcTemplate.update("DELETE FROM user_role WHERE role_id = ?", roleId);
    jdbcTemplate.update("DELETE FROM role WHERE role_id = ?", roleId);
  }

  /** 创建 role_code 关联，保持旧接口重复绑定错误语义。 */
  public Map<String, Object> createRoleCode(
      JdbcTemplate jdbcTemplate, int roleId, int codeId, String customerId) {
    Integer existing =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM role_code WHERE role_id = ? AND code_id = ?",
            Integer.class,
            roleId,
            codeId);
    if (existing != null && existing > 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "角色权限码关联已存在");
    }
    try {
      jdbcTemplate.update(
          "INSERT INTO role_code (role_id, code_id, create_time, update_time) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          roleId,
          codeId);
    } catch (DuplicateKeyException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "角色权限码关联已存在");
    }
    Map<String, Object> row = findRoleCode(jdbcTemplate, roleId, codeId);
    row.put("permissionCacheCustomerId", customerId);
    return row;
  }

  /** 删除 role_code 关联，返回 deletedCount。 */
  public Map<String, Object> deleteRoleCode(JdbcTemplate jdbcTemplate, int roleId, int codeId) {
    int deleted = jdbcTemplate.update("DELETE FROM role_code WHERE role_id = ? AND code_id = ?", roleId, codeId);
    if (deleted == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "未找到要删除的角色权限码关联记录");
    }
    return Map.of("deletedCount", deleted);
  }

  private List<Integer> findActiveMenuIdsByRoleId(JdbcTemplate jdbcTemplate, int roleId) {
    return jdbcTemplate.query(
        """
        SELECT menu_id
        FROM role_menu
        WHERE role_id = ?
          AND is_deleted = false
        ORDER BY menu_id ASC
        """,
        (rs, rowNum) -> rs.getInt("menu_id"),
        roleId);
  }

  private List<RoleRelationRow> findRoleMenuRows(JdbcTemplate jdbcTemplate, int roleId) {
    return jdbcTemplate.query(
        """
        SELECT menu_id, is_deleted
        FROM role_menu
        WHERE role_id = ?
        ORDER BY menu_id ASC
        """,
        (rs, rowNum) -> new RoleRelationRow(rs.getInt("menu_id"), boolValue(rs.getObject("is_deleted"))),
        roleId);
  }

  private List<RoleRelationRow> findRoleParkRows(JdbcTemplate jdbcTemplate, int roleId) {
    return jdbcTemplate.query(
        """
        SELECT park_id, is_deleted
        FROM role_park
        WHERE role_id = ?
        ORDER BY park_id ASC
        """,
        (rs, rowNum) -> new RoleRelationRow(rs.getInt("park_id"), boolValue(rs.getObject("is_deleted"))),
        roleId);
  }

  private void addRoleMenus(
      JdbcTemplate jdbcTemplate,
      int roleId,
      List<Integer> menuIds,
      Set<Integer> deletedIds,
      Set<Integer> activeIds) {
    List<Integer> toRecover = menuIds.stream().filter(deletedIds::contains).toList();
    if (!toRecover.isEmpty()) {
      jdbcTemplate.update(
          "UPDATE role_menu SET is_deleted = false WHERE role_id = ? AND menu_id IN ("
              + placeholders(toRecover.size())
              + ")",
          merge(roleId, toRecover));
    }
    List<Integer> toCreate =
        menuIds.stream()
            .filter(menuId -> !activeIds.contains(menuId) && !deletedIds.contains(menuId))
            .toList();
    for (Integer menuId : toCreate) {
      jdbcTemplate.update(
          "INSERT INTO role_menu (role_id, menu_id, is_deleted, create_time, update_time) VALUES (?, ?, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          roleId,
          menuId);
    }
  }

  private Set<String> columnSet(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate
        .queryForList(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            String.class,
            tableName)
        .stream()
        .map(String::toLowerCase)
        .collect(java.util.stream.Collectors.toUnmodifiableSet());
  }

  private void appendString(
      List<String> assignments, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (hasValue(value) && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
      args.add(String.valueOf(value).trim());
    }
  }

  private void appendInteger(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value,
      String message) {
    if (hasValue(value) && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
      args.add(toInteger(value, message));
    }
  }

  private void appendBoolean(
      List<String> assignments, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (hasValue(value) && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
      args.add(toBoolean(value, "角色状态只能是启用或禁用"));
    }
  }

  private boolean hasValue(Object value) {
    return value != null && !String.valueOf(value).isBlank();
  }

  private void appendStringInsert(
      List<String> columns, List<Object> args, Set<String> existingColumns, String columnName, Object value) {
    if (hasValue(value) && existingColumns.contains(columnName)) {
      columns.add(columnName);
      args.add(cleanText(value));
    }
  }

  private void appendIntegerInsert(
      List<String> columns,
      List<Object> args,
      Set<String> existingColumns,
      String columnName,
      Object value,
      String message) {
    if (hasValue(value) && existingColumns.contains(columnName)) {
      columns.add(columnName);
      args.add(toInteger(value, message));
    }
  }

  private String cleanText(Object value) {
    return value == null ? null : String.valueOf(value).trim();
  }

  private Integer toInteger(Object value, String message) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    try {
      return Integer.parseInt(String.valueOf(value).trim());
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private Boolean toBoolean(Object value, String message) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      if (number.intValue() == 1) {
        return true;
      }
      if (number.intValue() == 0) {
        return false;
      }
    }
    String normalized = String.valueOf(value).trim().toLowerCase(java.util.Locale.ROOT);
    if ("true".equals(normalized) || "1".equals(normalized)) {
      return true;
    }
    if ("false".equals(normalized) || "0".equals(normalized)) {
      return false;
    }
    throw new BusinessException(HttpStatus.BAD_REQUEST, message);
  }

  private boolean boolValue(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    return Boolean.parseBoolean(String.valueOf(value));
  }

  private Object[] merge(int first, List<Integer> rest) {
    List<Object> args = new ArrayList<>(rest.size() + 1);
    args.add(first);
    args.addAll(rest);
    return args.toArray();
  }

  private String placeholders(int size) {
    return String.join(",", Collections.nCopies(size, "?"));
  }

  private String joinIds(List<Integer> ids) {
    return ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(", "));
  }

  private String buildWhere(
      List<Object> args,
      String name,
      String remark,
      String status,
      String startTime,
      String endTime,
      boolean topLevelOnly) {
    StringJoiner where = new StringJoiner(" AND ", "WHERE ", "");
    where.add("(r.scope IS NULL OR r.scope = 'system')");
    if (topLevelOnly) {
      where.add("r.parent_id IS NULL");
    }
    if (StringUtils.hasText(name)) {
      where.add("r.name LIKE ?");
      args.add("%" + name.trim() + "%");
    }
    if (StringUtils.hasText(remark)) {
      where.add("r.remark LIKE ?");
      args.add("%" + remark.trim() + "%");
    }
    if (StringUtils.hasText(startTime)) {
      where.add("r.create_time >= ?");
      args.add(startTime.trim());
    }
    if (StringUtils.hasText(endTime)) {
      where.add("r.create_time <= ?");
      args.add(endTime.trim());
    }
    Integer normalizedStatus = normalizeStatus(status);
    if (normalizedStatus != null) {
      where.add("r.status = ?");
      args.add(normalizedStatus);
    }
    return where.toString();
  }

  private Map<String, Object> findRoleCode(JdbcTemplate jdbcTemplate, int roleId, int codeId) {
    return jdbcTemplate.queryForObject(
        """
        SELECT id, role_id, code_id, create_time, update_time
        FROM role_code
        WHERE role_id = ? AND code_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("id", rs.getInt("id"));
          map.put("roleId", rs.getInt("role_id"));
          map.put("codeId", rs.getInt("code_id"));
          map.put("createTime", toIso(rs.getTimestamp("create_time")));
          map.put("updateTime", toIso(rs.getTimestamp("update_time")));
          return map;
        },
        roleId,
        codeId);
  }

  private void enrichRoles(JdbcTemplate jdbcTemplate, List<Map<String, Object>> roles) {
    if (roles.isEmpty()) {
      return;
    }
    List<Integer> roleIds = roles.stream().map(row -> (Integer) row.get("roleId")).toList();
    Map<Integer, List<Integer>> permissions = findRoleMenuIds(jdbcTemplate, roleIds);
    Map<Integer, List<Integer>> parkIds = findRoleParkIds(jdbcTemplate, roleIds);
    Map<Integer, List<String>> codes = findRoleCodes(jdbcTemplate, roleIds);
    for (Map<String, Object> role : roles) {
      Integer roleId = (Integer) role.get("roleId");
      role.put("permissions", permissions.getOrDefault(roleId, List.of()));
      role.put("parkIds", parkIds.getOrDefault(roleId, List.of()));
      role.put("codes", codes.getOrDefault(roleId, List.of()));
    }
  }

  private Map<Integer, List<Integer>> findRoleMenuIds(JdbcTemplate jdbcTemplate, List<Integer> roleIds) {
    if (roleIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(roleIds.size(), "?"));
    Map<Integer, List<Integer>> result = new LinkedHashMap<>();
    jdbcTemplate.query(
        """
        SELECT role_id, menu_id
        FROM role_menu
        WHERE is_deleted = false
          AND role_id IN (
        """
            + placeholders
            + """
        )
        ORDER BY role_id ASC, menu_id ASC
        """,
        (org.springframework.jdbc.core.RowCallbackHandler)
            rs ->
            result
                .computeIfAbsent(rs.getInt("role_id"), ignored -> new ArrayList<>())
                .add(rs.getInt("menu_id")),
        roleIds.toArray());
    return result;
  }

  private Map<Integer, List<Integer>> findRoleParkIds(JdbcTemplate jdbcTemplate, List<Integer> roleIds) {
    if (roleIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(roleIds.size(), "?"));
    Map<Integer, List<Integer>> result = new LinkedHashMap<>();
    jdbcTemplate.query(
        """
        SELECT role_id, park_id
        FROM role_park
        WHERE is_deleted = false
          AND role_id IN (
        """
            + placeholders
            + """
        )
        ORDER BY role_id ASC, park_id ASC
        """,
        (org.springframework.jdbc.core.RowCallbackHandler)
            rs ->
            result
                .computeIfAbsent(rs.getInt("role_id"), ignored -> new ArrayList<>())
                .add(rs.getInt("park_id")),
        roleIds.toArray());
    return result;
  }

  private Map<Integer, List<String>> findRoleCodes(JdbcTemplate jdbcTemplate, List<Integer> roleIds) {
    if (roleIds.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(roleIds.size(), "?"));
    Map<Integer, List<String>> result = new LinkedHashMap<>();
    jdbcTemplate.query(
        """
        SELECT rc.role_id, c.code
        FROM role_code rc
        INNER JOIN code c ON c.code_id = rc.code_id
        WHERE rc.role_id IN (
        """
            + placeholders
            + """
        )
          AND c.code IS NOT NULL
          AND c.template_deleted_at IS NULL
        ORDER BY rc.role_id ASC, c.code ASC
        """,
        (org.springframework.jdbc.core.RowCallbackHandler)
            rs ->
            result
                .computeIfAbsent(rs.getInt("role_id"), ignored -> new ArrayList<>())
                .add(rs.getString("code")),
        roleIds.toArray());
    return result;
  }

  private List<Map<String, Object>> buildTree(List<Map<String, Object>> rows) {
    Map<Integer, Map<String, Object>> byId = new LinkedHashMap<>();
    for (Map<String, Object> row : rows) {
      row.put("children", new ArrayList<Map<String, Object>>());
      byId.put((Integer) row.get("roleId"), row);
    }
    List<Map<String, Object>> roots = new ArrayList<>();
    for (Map<String, Object> row : rows) {
      Integer parentId = (Integer) row.get("parentId");
      if (parentId == null || !byId.containsKey(parentId)) {
        roots.add(row);
      } else {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> children =
            (List<Map<String, Object>>) byId.get(parentId).get("children");
        children.add(row);
      }
    }
    return roots;
  }

  private Map<String, Object> roleMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("roleId", rs.getInt("role_id"));
    map.put("name", rs.getString("name"));
    map.put("remark", rs.getString("remark"));
    map.put("status", boolToInt(rs.getObject("status")));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("parentId", rs.getObject("parent_id", Integer.class));
    map.put("reimbursementAuth", rs.getObject("reimbursement_auth", Integer.class));
    map.put("rates", rs.getObject("rates", Integer.class));
    return map;
  }

  private Integer normalizeStatus(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    String normalized = value.trim().toLowerCase();
    if ("1".equals(normalized) || "true".equals(normalized)) {
      return 1;
    }
    if ("0".equals(normalized) || "false".equals(normalized)) {
      return 0;
    }
    return null;
  }

  private int boolToInt(Object value) {
    if (value instanceof Boolean bool) {
      return bool ? 1 : 0;
    }
    if (value instanceof Number number) {
      return number.intValue() == 0 ? 0 : 1;
    }
    return Boolean.parseBoolean(String.valueOf(value)) ? 1 : 0;
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private record RoleRelationRow(int id, boolean deleted) {}
}
