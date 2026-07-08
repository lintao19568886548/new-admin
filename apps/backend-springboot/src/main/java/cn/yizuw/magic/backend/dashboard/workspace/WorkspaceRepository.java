package cn.yizuw.magic.backend.dashboard.workspace;

import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/**
 * 工作台访问日志数据访问层。
 *
 * <p>旧接口会按用户角色树过滤 api_log.username，并根据 referer_path 匹配菜单名称；这里保留同样的查询边界。
 */
@Repository
public class WorkspaceRepository {

  private static final Set<String> ADVANCED_ROLES = Set.of("Super", "董事长", "总经理");

  /** 查询访问日志列表，并补充 moduleName/moduleNameCN 字段。 */
  public PageResult<Map<String, Object>> findPage(
      JdbcTemplate jdbcTemplate, WorkspaceQuery query, UserTokenPayload payload) {
    if (!columnSet(jdbcTemplate, "api_log").contains("log_id")) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    appendUserScope(jdbcTemplate, where, args, payload);
    if (StringUtils.hasText(query.startTime()) && StringUtils.hasText(query.endTime())) {
      where.append(" AND a.request_time BETWEEN ? AND ?");
      args.add(query.startTime());
      args.add(query.endTime());
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM api_log a " + where, Long.class, args.toArray());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT a.*,
                   (
                     SELECT m.name
                     FROM menu m
                     WHERE m.path = a.referer_path
                     LIMIT 1
                   ) AS module_name,
                   (
                     SELECT mm.title
                     FROM menu m
                     LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
                     WHERE m.path = a.referer_path
                     LIMIT 1
                   ) AS module_name_cn
            FROM api_log a
            """
                + where
                + """
                ORDER BY a.request_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> apiLogMap(rs),
            pageArgs(args, query.currentPage(), query.pageSize()).toArray());
    return new PageResult<>(rows, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  private void appendUserScope(
      JdbcTemplate jdbcTemplate, StringBuilder where, List<Object> args, UserTokenPayload payload) {
    if (payload.roles() != null && payload.roles().stream().anyMatch(ADVANCED_ROLES::contains)) {
      where.append(" AND a.username IS NOT NULL AND a.username NOT IN ('vben', '')");
      return;
    }

    List<String> usernames = usernamesInCurrentRoleTree(jdbcTemplate, payload);
    if (usernames.isEmpty()) {
      where.append(" AND 1 = 0");
      return;
    }
    where.append(" AND a.username IN (").append(placeholders(usernames.size())).append(")");
    args.addAll(usernames);
  }

  private List<String> usernamesInCurrentRoleTree(
      JdbcTemplate jdbcTemplate, UserTokenPayload payload) {
    List<Integer> rootRoleIds =
        jdbcTemplate.queryForList(
            """
            SELECT ur.role_id
            FROM user_role ur
            INNER JOIN user u ON u.id = ur.user_id
            WHERE u.username = ?
            """,
            Integer.class,
            payload.username());
    Set<Integer> allRoleIds = allChildRoleIds(jdbcTemplate, rootRoleIds);
    if (allRoleIds.isEmpty()) {
      return List.of();
    }
    return jdbcTemplate
        .queryForList(
            """
            SELECT DISTINCT u.username
            FROM user u
            INNER JOIN user_role ur ON ur.user_id = u.id
            WHERE ur.role_id IN (
            """
                + placeholders(allRoleIds.size())
                + """
                )
              AND u.username IS NOT NULL
              AND u.username <> ''
            """,
            String.class,
            allRoleIds.toArray())
        .stream()
        .distinct()
        .toList();
  }

  private Set<Integer> allChildRoleIds(JdbcTemplate jdbcTemplate, List<Integer> rootRoleIds) {
    Set<Integer> allRoleIds = new LinkedHashSet<>(rootRoleIds);
    Queue<Integer> queue = new ArrayDeque<>(rootRoleIds);
    while (!queue.isEmpty()) {
      List<Integer> batch = new ArrayList<>();
      while (!queue.isEmpty() && batch.size() < 50) {
        batch.add(queue.poll());
      }
      List<Integer> children =
          jdbcTemplate.queryForList(
              "SELECT role_id FROM role WHERE parent_id IN (" + placeholders(batch.size()) + ")",
              Integer.class,
              batch.toArray());
      for (Integer childId : children) {
        if (childId != null && allRoleIds.add(childId)) {
          queue.add(childId);
        }
      }
    }
    return allRoleIds;
  }

  private Map<String, Object> apiLogMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("logId", rs.getInt("log_id"));
    map.put("method", safeString(rs, "method"));
    map.put("path", safeString(rs, "path"));
    map.put("refererPath", safeString(rs, "referer_path"));
    map.put("itemName", safeString(rs, "item_name"));
    map.put("username", safeString(rs, "username"));
    map.put("requestTime", toIso(safeTimestamp(rs, "request_time")));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    String moduleName = safeString(rs, "module_name");
    String moduleNameCn = safeString(rs, "module_name_cn");
    map.put("moduleName", StringUtils.hasText(moduleName) ? moduleName : "未知模块");
    map.put("moduleNameCN", StringUtils.hasText(moduleNameCn) ? moduleNameCn : "未知模块");
    return map;
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
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private List<Object> pageArgs(List<Object> args, int currentPage, int pageSize) {
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    return pageArgs;
  }

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private String safeString(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getString(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private Timestamp safeTimestamp(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getTimestamp(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
