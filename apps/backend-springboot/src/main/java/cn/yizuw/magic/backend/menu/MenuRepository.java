package cn.yizuw.magic.backend.menu;

import cn.yizuw.magic.backend.common.BusinessException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class MenuRepository {

  public List<MenuRow> findAllMenus(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.query(baseMenuSql() + " ORDER BY COALESCE(mm.`order`, 1) ASC, m.menu_id ASC", this::mapRow);
  }

  public List<MenuRow> findRouteMenusForRoleNames(JdbcTemplate jdbcTemplate, List<String> roleNames) {
    if (roleNames.contains("Super")) {
      return jdbcTemplate.query(
          baseMenuSql()
              + """
              WHERE m.status = 1
                AND m.type <> 'button'
              ORDER BY COALESCE(mm.`order`, 1) ASC, m.menu_id ASC
              """,
          this::mapRow);
    }

    List<Integer> menuIds = findMenuIdsForRoleNames(jdbcTemplate, roleNames);
    if (menuIds.isEmpty()) {
      return List.of();
    }
    return findMenusByIds(
        jdbcTemplate,
        menuIds,
        """
        AND m.status = 1
        AND m.type <> 'button'
        """);
  }

  public List<String> findRoleNamesByUserId(JdbcTemplate jdbcTemplate, Long userId) {
    if (userId == null || userId <= 0) {
      return List.of();
    }
    return jdbcTemplate.query(
        """
        SELECT DISTINCT r.name
        FROM user_role ur
        INNER JOIN role r ON r.role_id = ur.role_id
        WHERE ur.user_id = ?
          AND r.name IS NOT NULL
        ORDER BY r.role_id ASC
        """,
        (rs, rowNum) -> rs.getString("name"),
        userId);
  }

  public List<MenuRow> findMenusForParentRole(JdbcTemplate jdbcTemplate, Integer parentRoleId) {
    if (parentRoleId == null) {
      return findAllMenus(jdbcTemplate);
    }
    List<Integer> menuIds =
        jdbcTemplate.query(
            """
            SELECT DISTINCT menu_id
            FROM role_menu
            WHERE role_id = ? AND is_deleted = false
            ORDER BY menu_id ASC
            """,
            (rs, rowNum) -> rs.getInt("menu_id"),
            parentRoleId);
    if (menuIds.isEmpty()) {
      return List.of();
    }
    return findMenusByIds(jdbcTemplate, menuIds, "");
  }

  public boolean existsByName(JdbcTemplate jdbcTemplate, String name, Integer excludeMenuId) {
    if (!org.springframework.util.StringUtils.hasText(name)) {
      return false;
    }
    if (excludeMenuId == null) {
      Integer count =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM menu WHERE name = ?", Integer.class, name.trim());
      return count != null && count > 0;
    }
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM menu WHERE name = ? AND menu_id <> ?",
            Integer.class,
            name.trim(),
            excludeMenuId);
    return count != null && count > 0;
  }

  public boolean existsByPath(JdbcTemplate jdbcTemplate, String path, Integer excludeMenuId) {
    if (!org.springframework.util.StringUtils.hasText(path)) {
      return false;
    }
    if (excludeMenuId == null) {
      Integer count =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM menu WHERE path = ?", Integer.class, path.trim());
      return count != null && count > 0;
    }
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM menu WHERE path = ? AND menu_id <> ?",
            Integer.class,
            path.trim(),
            excludeMenuId);
    return count != null && count > 0;
  }

  /** 新增系统菜单和 meta；字段白名单与更新接口保持一致。 */
  public MenuRow createMenu(JdbcTemplate jdbcTemplate, MenuUpdateRequest request) {
    Set<String> menuColumns = columnSet(jdbcTemplate, "menu");
    List<String> insertColumns = new ArrayList<>();
    List<Object> insertArgs = new ArrayList<>();
    appendStringValue(insertColumns, insertArgs, menuColumns, "name", request == null ? null : request.name());
    appendStringValue(insertColumns, insertArgs, menuColumns, "type", request == null ? null : request.type());
    appendIntegerValue(insertColumns, insertArgs, menuColumns, "status", request == null ? null : request.status());
    appendStringValue(insertColumns, insertArgs, menuColumns, "path", request == null ? null : request.path());
    appendStringValue(
        insertColumns, insertArgs, menuColumns, "active_path", request == null ? null : request.activePath());
    appendStringValue(
        insertColumns, insertArgs, menuColumns, "redirect", request == null ? null : request.redirect());
    appendStringValue(
        insertColumns, insertArgs, menuColumns, "component", request == null ? null : request.component());
    appendIntegerValue(insertColumns, insertArgs, menuColumns, "pid", request == null ? null : request.pid());
    appendStringValue(
        insertColumns, insertArgs, menuColumns, "auth_code", request == null ? null : request.authCode());
    appendBooleanValue(
        insertColumns,
        insertArgs,
        menuColumns,
        "template_managed",
        request == null ? null : request.templateManaged());
    appendBooleanValue(
        insertColumns,
        insertArgs,
        menuColumns,
        "template_internal_only",
        request == null ? null : request.templateInternalOnly());
    if (insertColumns.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供需要新增的数据");
    }

    int menuId = insertAndReturnId(jdbcTemplate, "menu", "menu_id", insertColumns, insertArgs);
    insertMenuMeta(jdbcTemplate, menuId, request == null ? null : request.meta());
    insertButtonCode(jdbcTemplate, menuId, request);
    return findMenuById(jdbcTemplate, menuId);
  }

  /** 更新系统菜单和 meta；仅写白名单字段，避免旧端整包 body 透传误写。 */
  public MenuRow updateMenu(JdbcTemplate jdbcTemplate, int menuId, MenuUpdateRequest request) {
    ensureMenuExists(jdbcTemplate, menuId);
    Set<String> menuColumns = columnSet(jdbcTemplate, "menu");
    List<String> menuAssignments = new ArrayList<>();
    List<Object> menuArgs = new ArrayList<>();
    appendString(menuAssignments, menuArgs, menuColumns, "name", request == null ? null : request.name());
    appendString(menuAssignments, menuArgs, menuColumns, "type", request == null ? null : request.type());
    appendInteger(menuAssignments, menuArgs, menuColumns, "status", request == null ? null : request.status());
    appendString(menuAssignments, menuArgs, menuColumns, "path", request == null ? null : request.path());
    appendString(
        menuAssignments, menuArgs, menuColumns, "active_path", request == null ? null : request.activePath());
    appendString(menuAssignments, menuArgs, menuColumns, "redirect", request == null ? null : request.redirect());
    appendString(menuAssignments, menuArgs, menuColumns, "component", request == null ? null : request.component());
    appendInteger(menuAssignments, menuArgs, menuColumns, "pid", request == null ? null : request.pid());
    appendString(menuAssignments, menuArgs, menuColumns, "auth_code", request == null ? null : request.authCode());
    appendBoolean(
        menuAssignments,
        menuArgs,
        menuColumns,
        "template_managed",
        request == null ? null : request.templateManaged());
    appendBoolean(
        menuAssignments,
        menuArgs,
        menuColumns,
        "template_internal_only",
        request == null ? null : request.templateInternalOnly());
    if (!menuAssignments.isEmpty()) {
      menuArgs.add(menuId);
      jdbcTemplate.update(
          "UPDATE menu SET " + String.join(", ", menuAssignments) + " WHERE menu_id = ?",
          menuArgs.toArray());
    }

    updateMenuMeta(jdbcTemplate, menuId, request == null ? null : request.meta());
    updateCodeTemplateFlags(jdbcTemplate, menuId, request);
    return findMenuById(jdbcTemplate, menuId);
  }

  /** 删除系统菜单，button 类型同步删除对应 code，其他级联关系交给数据库。 */
  public void deleteMenu(JdbcTemplate jdbcTemplate, int menuId) {
    List<MenuDeleteRow> rows =
        jdbcTemplate.query(
            "SELECT type, auth_code FROM menu WHERE menu_id = ? LIMIT 1",
            (rs, rowNum) -> new MenuDeleteRow(rs.getString("type"), rs.getString("auth_code")),
            menuId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "menuId错误");
    }
    MenuDeleteRow row = rows.get(0);
    if ("button".equals(row.type()) && StringUtils.hasText(row.authCode())) {
      jdbcTemplate.update("DELETE FROM code WHERE code = ? AND menu_id = ?", row.authCode(), menuId);
    }
    jdbcTemplate.update("DELETE FROM menu WHERE menu_id = ?", menuId);
  }

  private List<Integer> findMenuIdsForRoleNames(JdbcTemplate jdbcTemplate, List<String> roleNames) {
    if (roleNames.isEmpty()) {
      return List.of();
    }
    String placeholders = String.join(",", Collections.nCopies(roleNames.size(), "?"));
    List<Object> args = new ArrayList<>(roleNames);
    return jdbcTemplate.query(
        """
        SELECT DISTINCT rm.menu_id
        FROM role r
        INNER JOIN role_menu rm ON rm.role_id = r.role_id
        WHERE r.name IN (
        """
            + placeholders
            + """
        )
          AND rm.is_deleted = false
        ORDER BY rm.menu_id ASC
        """,
        (rs, rowNum) -> rs.getInt("menu_id"),
        args.toArray());
  }

  private void updateMenuMeta(JdbcTemplate jdbcTemplate, int menuId, MenuMetaUpdateRequest meta) {
    if (meta == null) {
      return;
    }
    Set<String> columns = columnSet(jdbcTemplate, "menu_meta");
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendString(assignments, args, columns, "title", meta.title());
    appendString(assignments, args, columns, "icon", meta.icon());
    appendInteger(assignments, args, columns, "order", meta.order());
    appendString(assignments, args, columns, "color", meta.color());
    appendString(assignments, args, columns, "active_icon", meta.activeIcon());
    appendString(assignments, args, columns, "active_path", meta.activePath());
    appendBoolean(assignments, args, columns, "affix_tab", meta.affixTab());
    appendInteger(assignments, args, columns, "affix_tab_order", meta.affixTabOrder());
    appendString(assignments, args, columns, "badge_content", meta.badge());
    appendString(assignments, args, columns, "badge_type", meta.badgeType());
    appendString(assignments, args, columns, "badge_variants", meta.badgeVariants());
    appendBoolean(assignments, args, columns, "hide_children_in_menu", meta.hideChildrenInMenu());
    appendBoolean(assignments, args, columns, "hide_in_breadcrumb", meta.hideInBreadcrumb());
    appendBoolean(assignments, args, columns, "hide_in_menu", meta.hideInMenu());
    appendBoolean(assignments, args, columns, "hide_in_tab", meta.hideInTab());
    appendString(assignments, args, columns, "iframe_src", meta.iframeSrc());
    appendBoolean(assignments, args, columns, "keep_alive", meta.keepAlive());
    appendString(assignments, args, columns, "link", meta.link());
    appendBoolean(assignments, args, columns, "is_app", meta.isApp());
    appendInteger(assignments, args, columns, "max_num_of_open_tab", meta.maxNumOfOpenTab());
    appendBoolean(assignments, args, columns, "no_basic_layout", meta.noBasicLayout());
    appendBoolean(assignments, args, columns, "open_in_new_window", meta.openInNewWindow());
    if (assignments.isEmpty()) {
      return;
    }
    args.add(menuId);
    int updated =
        jdbcTemplate.update(
            "UPDATE menu_meta SET " + String.join(", ", assignments) + " WHERE menu_id = ?",
            args.toArray());
    if (updated == 0) {
      List<String> insertColumns = new ArrayList<>(List.of("menu_id"));
      List<Object> insertArgs = new ArrayList<>(List.of(menuId));
      for (int index = 0; index < assignments.size(); index++) {
        String column = assignments.get(index).split(" = ", 2)[0];
        insertColumns.add(column);
        insertArgs.add(args.get(index));
      }
      jdbcTemplate.update(
          "INSERT INTO menu_meta ("
              + String.join(", ", insertColumns)
              + ") VALUES ("
              + String.join(",", Collections.nCopies(insertColumns.size(), "?"))
              + ")",
          insertArgs.toArray());
    }
  }

  private void insertMenuMeta(JdbcTemplate jdbcTemplate, int menuId, MenuMetaUpdateRequest meta) {
    if (meta == null) {
      return;
    }
    Set<String> columns = columnSet(jdbcTemplate, "menu_meta");
    List<String> insertColumns = new ArrayList<>();
    List<Object> insertArgs = new ArrayList<>();
    appendIntegerValue(insertColumns, insertArgs, columns, "menu_id", menuId);
    appendStringValue(insertColumns, insertArgs, columns, "title", meta.title());
    appendStringValue(insertColumns, insertArgs, columns, "icon", meta.icon());
    appendIntegerValue(insertColumns, insertArgs, columns, "order", meta.order());
    appendStringValue(insertColumns, insertArgs, columns, "color", meta.color());
    appendStringValue(insertColumns, insertArgs, columns, "active_icon", meta.activeIcon());
    appendStringValue(insertColumns, insertArgs, columns, "active_path", meta.activePath());
    appendBooleanValue(insertColumns, insertArgs, columns, "affix_tab", meta.affixTab());
    appendIntegerValue(insertColumns, insertArgs, columns, "affix_tab_order", meta.affixTabOrder());
    appendStringValue(insertColumns, insertArgs, columns, "badge_content", meta.badge());
    appendStringValue(insertColumns, insertArgs, columns, "badge_type", meta.badgeType());
    appendStringValue(insertColumns, insertArgs, columns, "badge_variants", meta.badgeVariants());
    appendBooleanValue(
        insertColumns, insertArgs, columns, "hide_children_in_menu", meta.hideChildrenInMenu());
    appendBooleanValue(insertColumns, insertArgs, columns, "hide_in_breadcrumb", meta.hideInBreadcrumb());
    appendBooleanValue(insertColumns, insertArgs, columns, "hide_in_menu", meta.hideInMenu());
    appendBooleanValue(insertColumns, insertArgs, columns, "hide_in_tab", meta.hideInTab());
    appendStringValue(insertColumns, insertArgs, columns, "iframe_src", meta.iframeSrc());
    appendBooleanValue(insertColumns, insertArgs, columns, "keep_alive", meta.keepAlive());
    appendStringValue(insertColumns, insertArgs, columns, "link", meta.link());
    appendBooleanValue(insertColumns, insertArgs, columns, "is_app", meta.isApp());
    appendIntegerValue(
        insertColumns, insertArgs, columns, "max_num_of_open_tab", meta.maxNumOfOpenTab());
    appendBooleanValue(insertColumns, insertArgs, columns, "no_basic_layout", meta.noBasicLayout());
    appendBooleanValue(
        insertColumns, insertArgs, columns, "open_in_new_window", meta.openInNewWindow());
    if (insertColumns.size() > 1) {
      insertAndReturnId(jdbcTemplate, "menu_meta", "meta_id", insertColumns, insertArgs);
    }
  }

  private void insertButtonCode(JdbcTemplate jdbcTemplate, int menuId, MenuUpdateRequest request) {
    if (request == null
        || !"button".equals(textOrNull(request.type()))
        || !StringUtils.hasText(textOrNull(request.authCode()))) {
      return;
    }
    Set<String> columns = columnSet(jdbcTemplate, "code");
    List<String> insertColumns = new ArrayList<>();
    List<Object> insertArgs = new ArrayList<>();
    String title = request.meta() == null ? null : textOrNull(request.meta().title());
    appendStringValue(insertColumns, insertArgs, columns, "code", request.authCode());
    appendStringValue(insertColumns, insertArgs, columns, "name", title);
    appendStringValue(insertColumns, insertArgs, columns, "content", title);
    appendIntegerValue(insertColumns, insertArgs, columns, "menu_id", menuId);
    appendBooleanValue(insertColumns, insertArgs, columns, "template_managed", request.templateManaged());
    appendBooleanValue(
        insertColumns, insertArgs, columns, "template_internal_only", request.templateInternalOnly());
    if (!insertColumns.isEmpty()) {
      insertAndReturnId(jdbcTemplate, "code", "code_id", insertColumns, insertArgs);
    }
  }

  private void updateCodeTemplateFlags(JdbcTemplate jdbcTemplate, int menuId, MenuUpdateRequest request) {
    if (request == null || request.templateManaged() == null && request.templateInternalOnly() == null) {
      return;
    }
    Set<String> columns = columnSet(jdbcTemplate, "code");
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendBoolean(assignments, args, columns, "template_managed", request.templateManaged());
    appendBoolean(assignments, args, columns, "template_internal_only", request.templateInternalOnly());
    if (assignments.isEmpty()) {
      return;
    }
    args.add(menuId);
    jdbcTemplate.update(
        "UPDATE code SET " + String.join(", ", assignments) + " WHERE menu_id = ?",
        args.toArray());
  }

  private MenuRow findMenuById(JdbcTemplate jdbcTemplate, int menuId) {
    List<MenuRow> rows =
        jdbcTemplate.query(
            baseMenuSql() + " WHERE m.menu_id = ? LIMIT 1",
            this::mapRow,
            menuId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "menuId错误");
    }
    return rows.get(0);
  }

  private void ensureMenuExists(JdbcTemplate jdbcTemplate, int menuId) {
    Integer count =
        jdbcTemplate.queryForObject("SELECT COUNT(*) FROM menu WHERE menu_id = ?", Integer.class, menuId);
    if (count == null || count == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "menuId错误");
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
        .collect(Collectors.toUnmodifiableSet());
  }

  private void appendString(
      List<String> assignments, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(quote(columnName) + " = ?");
      args.add(blankToNull(value));
    }
  }

  private void appendInteger(
      List<String> assignments, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(quote(columnName) + " = ?");
      args.add(toInteger(value, columnName + "参数错误"));
    }
  }

  private void appendBoolean(
      List<String> assignments, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(quote(columnName) + " = ?");
      args.add(toBoolean(value, columnName + "参数错误"));
    }
  }

  private void appendStringValue(
      List<String> insertColumns, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(quote(columnName));
      args.add(blankToNull(value));
    }
  }

  private void appendIntegerValue(
      List<String> insertColumns, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(quote(columnName));
      args.add(toInteger(value, columnName + "参数错误"));
    }
  }

  private void appendBooleanValue(
      List<String> insertColumns, List<Object> args, Set<String> columns, String columnName, Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(quote(columnName));
      args.add(toBoolean(value, columnName + "参数错误"));
    }
  }

  private int insertAndReturnId(
      JdbcTemplate jdbcTemplate,
      String tableName,
      String idColumn,
      List<String> insertColumns,
      List<Object> args) {
    String sql =
        "INSERT INTO "
            + tableName
            + " ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + String.join(",", Collections.nCopies(insertColumns.size(), "?"))
            + ")";
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
          for (int index = 0; index < args.size(); index++) {
            statement.setObject(index + 1, args.get(index));
          }
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key != null) {
      return key.intValue();
    }
    Integer fallbackId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (fallbackId == null || fallbackId <= 0) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, idColumn + "生成失败");
    }
    return fallbackId;
  }

  private String quote(String columnName) {
    return "`" + columnName.replace("`", "``") + "`";
  }

  private Object blankToNull(Object value) {
    String text = String.valueOf(value).trim();
    return StringUtils.hasText(text) ? text : null;
  }

  private String textOrNull(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return StringUtils.hasText(text) ? text : null;
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
      return number.intValue() != 0;
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

  private List<MenuRow> findMenusByIds(JdbcTemplate jdbcTemplate, List<Integer> menuIds, String extraWhere) {
    if (menuIds.isEmpty()) {
      return List.of();
    }
    String placeholders = String.join(",", Collections.nCopies(menuIds.size(), "?"));
    List<Object> args = new ArrayList<>(menuIds);
    return jdbcTemplate.query(
        baseMenuSql()
            + """
            WHERE m.menu_id IN (
            """
            + placeholders
            + """
            )
            """
            + extraWhere
            + """
            ORDER BY COALESCE(mm.`order`, 1) ASC, m.menu_id ASC
            """,
        this::mapRow,
        args.toArray());
  }

  private String baseMenuSql() {
    return """
        SELECT
          m.menu_id,
          m.name,
          m.type,
          m.status,
          m.path,
          m.active_path,
          m.redirect,
          m.component,
          m.pid,
          m.auth_code,
          m.template_key,
          m.template_parent_key,
          m.template_version,
          m.template_managed,
          m.template_internal_only,
          m.template_deleted_at,
          mm.title,
          mm.icon,
          mm.`order`,
          mm.color,
          mm.active_icon,
          mm.active_path AS meta_active_path,
          mm.affix_tab,
          mm.affix_tab_order,
          mm.badge_content,
          mm.badge_type,
          mm.badge_variants,
          mm.hide_children_in_menu,
          mm.hide_in_breadcrumb,
          mm.hide_in_menu,
          mm.hide_in_tab,
          mm.iframe_src,
          mm.keep_alive,
          mm.link,
          mm.is_app,
          mm.max_num_of_open_tab,
          mm.no_basic_layout,
          mm.open_in_new_window,
          c.code,
          c.name AS code_name
        FROM menu m
        LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
        LEFT JOIN code c ON c.menu_id = m.menu_id
        """;
  }

  private MenuRow mapRow(ResultSet rs, int rowNum) throws SQLException {
    return new MenuRow(
        rs.getString("active_icon"),
        rs.getString("active_path"),
        getBoolean(rs, "affix_tab"),
        rs.getObject("affix_tab_order", Integer.class),
        rs.getString("auth_code"),
        rs.getString("badge_content"),
        rs.getString("badge_type"),
        rs.getString("badge_variants"),
        rs.getString("code"),
        rs.getString("code_name"),
        rs.getString("color"),
        rs.getString("component"),
        getBoolean(rs, "hide_children_in_menu"),
        getBoolean(rs, "hide_in_breadcrumb"),
        getBoolean(rs, "hide_in_menu"),
        getBoolean(rs, "hide_in_tab"),
        rs.getString("icon"),
        rs.getString("iframe_src"),
        getBoolean(rs, "is_app"),
        getBoolean(rs, "keep_alive"),
        rs.getString("link"),
        rs.getString("meta_active_path"),
        rs.getObject("max_num_of_open_tab", Integer.class),
        rs.getObject("menu_id", Integer.class),
        rs.getString("name"),
        getBoolean(rs, "no_basic_layout"),
        getBoolean(rs, "open_in_new_window"),
        rs.getObject("order", Integer.class),
        rs.getString("path"),
        rs.getObject("pid", Integer.class),
        rs.getString("redirect"),
        rs.getObject("status", Integer.class),
        rs.getObject("template_deleted_at", LocalDateTime.class),
        getBoolean(rs, "template_internal_only"),
        rs.getString("template_key"),
        getBoolean(rs, "template_managed"),
        rs.getString("template_parent_key"),
        rs.getObject("template_version", Integer.class),
        rs.getString("title"),
        rs.getString("type"));
  }

  private Boolean getBoolean(ResultSet rs, String columnName) throws SQLException {
    Object value = rs.getObject(columnName);
    if (value == null) {
      return null;
    }
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    return Boolean.valueOf(String.valueOf(value));
  }

  private record MenuDeleteRow(String type, String authCode) {}
}
