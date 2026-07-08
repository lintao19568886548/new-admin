package cn.yizuw.magic.backend.dormitory;

import cn.yizuw.magic.backend.common.BusinessException;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/** 宿舍模块数据访问层，迁移期显式接收租户库 {@link JdbcTemplate}。 */
@Repository
public class DormitoryRepository {

  /** 查询宿舍详情，并按当前用户授权园区校验操作边界。 */
  public Map<String, Object> findDormitoryDetail(
      JdbcTemplate jdbcTemplate, int dormitoryId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "dormitory");
    if (!readableTable(columns, "dormitory_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的宿舍ID");
    }

    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT d.*, p.park_name
            FROM dormitory d
            LEFT JOIN park p ON p.park_id = d.park_id
            WHERE d.dormitory_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> dormitoryMap(rs),
            dormitoryId);
    Map<String, Object> detail = authorizedDetail(rows, authorizedParkIds);
    appendDormitoryImages(jdbcTemplate, detail);
    return detail;
  }

  /** 新增宿舍主表记录；只写 dormitory 白名单字段，图片关系留到后续专项迁移。 */
  public Map<String, Object> createDormitory(
      JdbcTemplate jdbcTemplate,
      DormitoryCreateRequest request,
      List<Integer> authorizedParkIds) {
    if (request == null || !StringUtils.hasText(request.dormitoryName())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "宿舍名称不能为空");
    }
    Set<String> columns = columnSet(jdbcTemplate, "dormitory");
    if (!readableTable(columns, "dormitory_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "宿舍表缺少必要字段");
    }
    Integer parkId = request.parkId() == null ? null : toInteger(request.parkId(), "parkId参数错误");
    if (parkId == null || !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }

    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    insertColumns.add("dormitory_name");
    args.add(blankToNull(request.dormitoryName()));
    insertColumns.add("park_id");
    args.add(parkId);
    appendIntegerInsertValue(insertColumns, args, columns, "floor_count", request.floorCount());
    appendDecimalInsertValue(insertColumns, args, columns, "floor_height_first", request.floorHeightFirst());
    appendDecimalInsertValue(insertColumns, args, columns, "floor_height_other", request.floorHeightOther());
    appendDecimalInsertValue(insertColumns, args, columns, "room_area", request.roomArea());
    appendIntegerInsertValue(insertColumns, args, columns, "total_rooms", request.totalRooms());
    appendIntegerInsertValue(insertColumns, args, columns, "used_rooms_first", request.usedRoomsFirst());
    appendIntegerInsertValue(insertColumns, args, columns, "used_rooms_other", request.usedRoomsOther());
    appendDecimalInsertValue(insertColumns, args, columns, "rent_price_first", request.rentPriceFirst());
    appendDecimalInsertValue(insertColumns, args, columns, "rent_price_other", request.rentPriceOther());
    appendStringInsertValue(insertColumns, args, columns, "remark", request.remark());
    if (columns.contains("is_deleted")) {
      insertColumns.add("is_deleted");
      args.add(false);
    }
    Timestamp now = Timestamp.from(java.time.Instant.now());
    appendTimestampInsertValue(insertColumns, args, columns, "create_time", now);
    appendTimestampInsertValue(insertColumns, args, columns, "update_time", now);

    jdbcTemplate.update(
        "INSERT INTO dormitory ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer dormitoryId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (dormitoryId == null || dormitoryId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建宿舍失败");
    }
    return findDormitoryDetail(jdbcTemplate, dormitoryId, authorizedParkIds);
  }

  /** 更新宿舍主表字段；图片关联重建不在本批范围内。 */
  public Map<String, Object> updateDormitory(
      JdbcTemplate jdbcTemplate,
      int dormitoryId,
      DormitoryUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findDormitoryDetail(jdbcTemplate, dormitoryId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "dormitory");
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();

    appendStringAssignment(assignments, args, columns, "dormitory_name", request == null ? null : request.dormitoryName());
    appendIntegerAssignment(assignments, args, columns, "floor_count", request == null ? null : request.floorCount(), null);
    appendDecimalAssignment(
        assignments, args, columns, "floor_height_first", request == null ? null : request.floorHeightFirst());
    appendDecimalAssignment(
        assignments, args, columns, "floor_height_other", request == null ? null : request.floorHeightOther());
    appendDecimalAssignment(assignments, args, columns, "room_area", request == null ? null : request.roomArea());
    appendIntegerAssignment(assignments, args, columns, "total_rooms", request == null ? null : request.totalRooms(), null);
    appendIntegerAssignment(
        assignments, args, columns, "used_rooms_first", request == null ? null : request.usedRoomsFirst(), null);
    appendIntegerAssignment(
        assignments, args, columns, "used_rooms_other", request == null ? null : request.usedRoomsOther(), null);
    appendDecimalAssignment(
        assignments, args, columns, "rent_price_first", request == null ? null : request.rentPriceFirst());
    appendDecimalAssignment(
        assignments, args, columns, "rent_price_other", request == null ? null : request.rentPriceOther());
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendIntegerAssignment(
        assignments, args, columns, "park_id", request == null ? null : request.parkId(), authorizedParkIds);

    updateById(jdbcTemplate, "dormitory", "dormitory_id", dormitoryId, columns, assignments, args);
    return findDormitoryDetail(jdbcTemplate, dormitoryId, authorizedParkIds);
  }

  /** 删除宿舍及图片关系，返回删除前快照。 */
  public Map<String, Object> deleteDormitory(
      JdbcTemplate jdbcTemplate, int dormitoryId, List<Integer> authorizedParkIds) {
    Map<String, Object> snapshot = findDormitoryDetail(jdbcTemplate, dormitoryId, authorizedParkIds);
    DataSource dataSource = jdbcTemplate.getDataSource();
    if (dataSource == null) {
      throw new IllegalStateException("Tenant DataSource is not available");
    }
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    transactionTemplate.executeWithoutResult(
        ignored -> {
          if (columnSet(jdbcTemplate, "dormitory_image").contains("dormitory_id")) {
            jdbcTemplate.update("DELETE FROM dormitory_image WHERE dormitory_id = ?", dormitoryId);
          }
          jdbcTemplate.update("DELETE FROM dormitory WHERE dormitory_id = ?", dormitoryId);
        });
    return snapshot;
  }

  private Map<String, Object> authorizedDetail(
      List<Map<String, Object>> rows, List<Integer> authorizedParkIds) {
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的宿舍ID");
    }
    Map<String, Object> row = rows.get(0);
    Object rawParkId = row.get("parkId");
    if (rawParkId instanceof Number number && !authorizedParkIds.contains(number.intValue())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    return row;
  }

  private void appendDormitoryImages(JdbcTemplate jdbcTemplate, Map<String, Object> dormitory) {
    Set<String> relationColumns = columnSet(jdbcTemplate, "dormitory_image");
    Set<String> imageColumns = columnSet(jdbcTemplate, "image");
    if (!relationColumns.containsAll(Set.of("dormitory_id", "img_id"))
        || !imageColumns.containsAll(Set.of("img_id", "img_url"))) {
      dormitory.put("images", List.of());
      dormitory.put("imgUrl", "");
      dormitory.put("imageUrls", List.of());
      return;
    }

    int dormitoryId = Number.class.cast(dormitory.get("dormitoryId")).intValue();
    List<Map<String, Object>> images =
        jdbcTemplate.query(
            """
            SELECT di.img_id, i.img_url
            FROM dormitory_image di
            LEFT JOIN image i ON i.img_id = di.img_id
            WHERE di.dormitory_id = ?
              AND i.img_url IS NOT NULL
              AND i.img_url <> ''
            ORDER BY di.id ASC
            """,
            (rs, rowNum) -> imageMap(rs),
            dormitoryId);
    dormitory.put("images", images);
    List<String> imageUrls = images.stream().map(image -> String.valueOf(image.get("url"))).toList();
    dormitory.put("imgUrl", imageUrls.isEmpty() ? "" : imageUrls.get(0));
    dormitory.put("imageUrls", imageUrls);
  }

  private void appendStringAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(blankToNull(value));
  }

  private void appendStringInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(blankToNull(value));
    }
  }

  private void appendIntegerAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value,
      List<Integer> writableParkIds) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    Integer integerValue = toInteger(value, columnName + "参数错误");
    if (writableParkIds != null && !writableParkIds.contains(integerValue)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    assignments.add(columnName + " = ?");
    args.add(integerValue);
  }

  private void appendIntegerInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(toInteger(value, columnName + "参数错误"));
    }
  }

  private void appendDecimalAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(toBigDecimal(value, columnName + "参数错误"));
  }

  private void appendDecimalInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(toBigDecimal(value, columnName + "参数错误"));
    }
  }

  private void appendTimestampInsertValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Timestamp value) {
    if (columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(value);
    }
  }

  private void updateById(
      JdbcTemplate jdbcTemplate,
      String tableName,
      String idColumn,
      int id,
      Set<String> columns,
      List<String> assignments,
      List<Object> args) {
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供需要更新的数据");
    }
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(id);
    jdbcTemplate.update(
        "UPDATE " + tableName + " SET " + String.join(", ", assignments) + " WHERE " + idColumn + " = ?",
        args.toArray());
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
        .map(name -> name.toLowerCase(Locale.ROOT))
        .collect(Collectors.toUnmodifiableSet());
  }

  private boolean readableTable(Set<String> columns, String idColumn) {
    return columns.contains(idColumn) && columns.contains("park_id");
  }

  private String placeholders(int count) {
    return String.join(",", java.util.Collections.nCopies(count, "?"));
  }

  private Map<String, Object> dormitoryMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("dormitoryId", rs.getInt("dormitory_id"));
    map.put("dormitoryName", safeString(rs, "dormitory_name"));
    map.put("parkId", safeInteger(rs, "park_id"));
    map.put("parkName", safeString(rs, "park_name"));
    map.put("floorCount", safeInteger(rs, "floor_count"));
    map.put("floorHeightFirst", safeBigDecimal(rs, "floor_height_first"));
    map.put("floorHeightOther", safeBigDecimal(rs, "floor_height_other"));
    map.put("roomArea", safeBigDecimal(rs, "room_area"));
    map.put("totalRooms", safeInteger(rs, "total_rooms"));
    map.put("usedRoomsFirst", safeInteger(rs, "used_rooms_first"));
    map.put("usedRoomsOther", safeInteger(rs, "used_rooms_other"));
    map.put("rentPriceFirst", safeBigDecimal(rs, "rent_price_first"));
    map.put("rentPriceOther", safeBigDecimal(rs, "rent_price_other"));
    map.put("remark", safeString(rs, "remark"));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    map.put("isDeleted", safeBoolean(rs, "is_deleted"));
    return map;
  }

  private Map<String, Object> imageMap(ResultSet rs) throws SQLException {
    String url = rs.getString("img_url");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("imgId", rs.getInt("img_id"));
    map.put("name", fileName(url));
    map.put("url", url == null ? "" : url);
    return map;
  }

  private String fileName(String url) {
    if (!StringUtils.hasText(url)) {
      return "";
    }
    int slashIndex = url.lastIndexOf('/');
    return slashIndex >= 0 ? url.substring(slashIndex + 1) : url;
  }

  private Object blankToNull(Object value) {
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

  private BigDecimal toBigDecimal(Object value, String message) {
    if (value instanceof BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    try {
      return new BigDecimal(String.valueOf(value).trim());
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
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

  private Boolean safeBoolean(ResultSet rs, String columnName) throws SQLException {
    try {
      Object value = rs.getObject(columnName);
      if (value instanceof Boolean bool) {
        return bool;
      }
      if (value instanceof Number number) {
        return number.intValue() != 0;
      }
      return value == null ? null : Boolean.valueOf(String.valueOf(value));
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
}
