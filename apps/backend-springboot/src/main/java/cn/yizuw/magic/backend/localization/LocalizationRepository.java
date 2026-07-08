package cn.yizuw.magic.backend.localization;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/**
 * 打卡定位只读数据访问层。
 *
 * <p>Prisma 字段 username 实际映射为 user_name；这里通过 information_schema 兼容少量历史库字段漂移。
 */
@Repository
public class LocalizationRepository {

  /** 查询打卡定位分页列表，按旧接口规则应用 username 权限范围。 */
  public PageResult<Map<String, Object>> findPage(
      JdbcTemplate jdbcTemplate, LocalizationQuery query, UserTokenPayload payload) {
    Set<String> columns = columnSet(jdbcTemplate, "localization");
    String usernameColumn = usernameColumn(columns);
    if (!columns.contains("localization_id") || usernameColumn == null) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    boolean superUser = payload.roles() != null && payload.roles().contains("Super");
    if (StringUtils.hasText(query.username())) {
      if (superUser) {
        where.append(" AND l.").append(usernameColumn).append(" LIKE ?");
        args.add("%" + query.username().trim() + "%");
      } else {
        where.append(" AND l.").append(usernameColumn).append(" = ?");
        args.add(payload.username());
      }
    } else if (!superUser) {
      where.append(" AND l.").append(usernameColumn).append(" = ?");
      args.add(payload.username());
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM localization l " + where, Long.class, args.toArray());
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            "SELECT l.* FROM localization l "
                + where
                + " ORDER BY l.punch_time DESC LIMIT ?, ?",
            (rs, rowNum) -> localizationMap(rs, usernameColumn),
            pageArgs(args, query.currentPage(), query.pageSize()).toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询单条打卡定位记录；找不到时返回 null，由 Service 保持旧错误文案。 */
  public Map<String, Object> findDetail(JdbcTemplate jdbcTemplate, int id) {
    Set<String> columns = columnSet(jdbcTemplate, "localization");
    String usernameColumn = usernameColumn(columns);
    if (!columns.contains("localization_id") || usernameColumn == null) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT l.*
            FROM localization l
            WHERE l.localization_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> localizationMap(rs, usernameColumn),
            id);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 新增打卡定位记录；登录用户信息由 token 注入，不接受 body 中的 userId/username。 */
  public Map<String, Object> create(
      JdbcTemplate jdbcTemplate, LocalizationCreateRequest request, UserTokenPayload payload) {
    Set<String> columns = columnSet(jdbcTemplate, "localization");
    String usernameColumn = usernameColumn(columns);
    if (!columns.contains("localization_id") || usernameColumn == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "打卡记录表不可用");
    }

    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendValue(insertColumns, args, columns, "punch_time", toTimestamp(request.punchTime()));
    appendValue(insertColumns, args, columns, usernameColumn, payload.username());
    appendValue(insertColumns, args, columns, "status", toInteger(request.status()));
    appendValue(insertColumns, args, columns, "longitude", toBigDecimal(request.longitude()));
    appendValue(insertColumns, args, columns, "latitude", toBigDecimal(request.latitude()));
    appendValue(insertColumns, args, columns, "user_id", payload.id());

    int id = insertAndReturnId(jdbcTemplate, insertColumns, args);
    return findDetail(jdbcTemplate, id);
  }

  /** 更新打卡定位记录，字段白名单保持和旧接口一致。 */
  public Map<String, Object> update(
      JdbcTemplate jdbcTemplate, int id, LocalizationUpdateRequest request) {
    Set<String> columns = columnSet(jdbcTemplate, "localization");
    String usernameColumn = usernameColumn(columns);
    if (!columns.contains("localization_id") || usernameColumn == null) {
      return null;
    }

    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();
    if (request != null && request.punchTime() != null && columns.contains("punch_time")) {
      assignments.add("punch_time = ?");
      args.add(toTimestamp(request.punchTime()));
    }
    if (request != null && request.status() != null && columns.contains("status")) {
      assignments.add("status = ?");
      args.add(toInteger(request.status()));
    }
    if (request != null && request.longitude() != null && columns.contains("longitude")) {
      assignments.add("longitude = ?");
      args.add(toBigDecimal(request.longitude()));
    }
    if (request != null && request.latitude() != null && columns.contains("latitude")) {
      assignments.add("latitude = ?");
      args.add(toBigDecimal(request.latitude()));
    }
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供需要更新的数据");
    }
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(id);

    int updated =
        jdbcTemplate.update(
            "UPDATE localization SET "
                + String.join(", ", assignments)
                + " WHERE localization_id = ?",
            args.toArray());
    return updated == 0 ? null : findDetail(jdbcTemplate, id);
  }

  /** 物理删除打卡定位记录，返回受影响行数。 */
  public int delete(JdbcTemplate jdbcTemplate, int id) {
    Set<String> columns = columnSet(jdbcTemplate, "localization");
    if (!columns.contains("localization_id")) {
      return 0;
    }
    return jdbcTemplate.update("DELETE FROM localization WHERE localization_id = ?", id);
  }

  private Map<String, Object> localizationMap(ResultSet rs, String usernameColumn)
      throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("localizationId", rs.getInt("localization_id"));
    map.put("punchTime", toIso(safeTimestamp(rs, "punch_time")));
    map.put("username", safeString(rs, usernameColumn));
    map.put("status", safeInteger(rs, "status"));
    map.put("longitude", safeBigDecimal(rs, "longitude"));
    map.put("latitude", safeBigDecimal(rs, "latitude"));
    map.put("userId", safeInteger(rs, "user_id"));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
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

  private String usernameColumn(Set<String> columns) {
    if (columns.contains("user_name")) {
      return "user_name";
    }
    if (columns.contains("username")) {
      return "username";
    }
    return null;
  }

  private List<Object> pageArgs(List<Object> args, int currentPage, int pageSize) {
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    return pageArgs;
  }

  private void appendValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(value);
    }
  }

  private int insertAndReturnId(
      JdbcTemplate jdbcTemplate, List<String> insertColumns, List<Object> args) {
    if (insertColumns.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供需要新增的数据");
    }
    String placeholders = String.join(",", java.util.Collections.nCopies(insertColumns.size(), "?"));
    String sql =
        "INSERT INTO localization ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders
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
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "localizationId生成失败");
    }
    return fallbackId;
  }

  private Integer safeInteger(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getObject(columnName, Integer.class);
    } catch (SQLException error) {
      return null;
    }
  }

  private BigDecimal safeBigDecimal(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getBigDecimal(columnName);
    } catch (SQLException error) {
      return null;
    }
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

  private BigDecimal toBigDecimal(Object value) {
    if (value instanceof BigDecimal number) {
      return number;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    try {
      return new BigDecimal(String.valueOf(value).trim());
    } catch (NumberFormatException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "经纬度格式无效");
    }
  }

  private Integer toInteger(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    try {
      return Integer.parseInt(String.valueOf(value).trim());
    } catch (NumberFormatException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "状态格式无效");
    }
  }

  private Timestamp toTimestamp(Object value) {
    if (value instanceof Timestamp timestamp) {
      return timestamp;
    }
    if (value instanceof java.util.Date date) {
      return new Timestamp(date.getTime());
    }
    String text = String.valueOf(value).trim();
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "打卡时间格式无效");
    }
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (DateTimeParseException ignored) {
      // 继续兼容旧前端可能传入的无时区日期时间文本。
    }
    try {
      return Timestamp.from(OffsetDateTime.parse(text).toInstant());
    } catch (DateTimeParseException ignored) {
      // 继续尝试 yyyy-MM-dd HH:mm:ss 或 yyyy-MM-ddTHH:mm:ss。
    }
    try {
      String normalized = text.replace('T', ' ');
      if (normalized.length() == 10) {
        normalized = normalized + " 00:00:00";
      }
      return Timestamp.valueOf(LocalDateTime.parse(normalized.replace(' ', 'T')));
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "打卡时间格式无效");
    }
  }
}
