package cn.yizuw.magic.backend.park;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class ParkRepository {

  public PageResult<Map<String, Object>> findParkPage(
      JdbcTemplate jdbcTemplate, ParkQuery query, List<Integer> authorizedParkIds) {
    List<Object> args = new ArrayList<>();
    StringJoiner where = buildParkWhere(query, args);
    appendParkScopeWhere(where, args, authorizedParkIds);
    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM park p " + where, Long.class, args.toArray());
    int currentPage = query.currentPage() == null ? 1 : query.currentPage();
    int pageSize = query.pageSize() == null ? 20 : query.pageSize();
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT p.*
            FROM park p
            """
                + where
                + """
                ORDER BY p.park_id ASC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> parkMap(rs),
            pageArgs.toArray());
    return new PageResult<>(items, total == null ? 0 : total, currentPage, pageSize);
  }

  public Map<String, Object> findParkDetail(JdbcTemplate jdbcTemplate, int parkId) {
    List<Map<String, Object>> parks =
        jdbcTemplate.query(
            """
            SELECT *
            FROM park
            WHERE park_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> parkMap(rs),
            parkId);
    if (parks.isEmpty()) {
      return null;
    }

    Map<String, Object> park = parks.get(0);
    park.put("images", findParkImages(jdbcTemplate, parkId));
    List<Map<String, Object>> factories = findFactories(jdbcTemplate, parkId);
    for (Map<String, Object> factory : factories) {
      Integer factoryId = (Integer) factory.get("factoryId");
      factory.put("floors", factoryId == null ? List.of() : findFactoryFloors(jdbcTemplate, factoryId));
    }
    park.put("factories", factories);
    park.put("dormitories", findDormitories(jdbcTemplate, parkId));
    return park;
  }

  /** 新增旧 `/park` 园区主表记录；不写 park_image、factory 或 dormitory 关系。 */
  public Map<String, Object> createLegacyPark(
      JdbcTemplate jdbcTemplate, ParkCreateRequest request) {
    String parkName = normalizedText(request == null ? null : request.parkName());
    String address = normalizedText(request == null ? null : request.address());
    BigDecimal area = decimalValue(request == null ? null : request.area());
    if (!StringUtils.hasText(parkName) || !StringUtils.hasText(address) || area == null) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "parkName, address and area are required");
    }

    List<String> columns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendParkInsertValue(jdbcTemplate, columns, args, "park_name", parkName);
    appendParkInsertValue(jdbcTemplate, columns, args, "address", address);
    appendParkInsertValue(jdbcTemplate, columns, args, "area", area);
    appendParkInsertValue(
        jdbcTemplate, columns, args, "description", blankToNull(request == null ? null : request.description()));
    appendParkInsertValue(
        jdbcTemplate, columns, args, "status", blankToNull(request == null ? null : request.status()));
    appendParkInsertValue(
        jdbcTemplate, columns, args, "manager", blankToNull(request == null ? null : request.manager()));
    appendParkInsertValue(
        jdbcTemplate, columns, args, "contact", blankToNull(request == null ? null : request.contact()));
    Timestamp now = Timestamp.from(java.time.Instant.now());
    appendParkInsertValue(jdbcTemplate, columns, args, "create_time", now);
    appendParkInsertValue(jdbcTemplate, columns, args, "update_time", now);
    if (hasColumn(jdbcTemplate, "park", "is_deleted")) {
      columns.add("is_deleted");
      args.add(false);
    }

    jdbcTemplate.update(
        "INSERT INTO park ("
            + String.join(", ", columns)
            + ") VALUES ("
            + placeholders(columns.size())
            + ")",
        args.toArray());
    Integer parkId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (parkId == null || parkId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "插入数据失败");
    }
    Map<String, Object> created = findParkDetail(jdbcTemplate, parkId);
    if (created == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "插入数据失败");
    }
    return created;
  }

  /** 更新系统园区主表字段；只写旧接口明确传入的白名单字段。 */
  public Map<String, Object> updateSystemPark(
      JdbcTemplate jdbcTemplate, int parkId, ParkUpdateRequest request) {
    ensureParkExists(jdbcTemplate, parkId);
    String parkName = normalizedText(request == null ? null : request.parkName());
    String address = normalizedText(request == null ? null : request.address());
    BigDecimal area = decimalValue(request == null ? null : request.area());
    if (!StringUtils.hasText(parkName) || !StringUtils.hasText(address) || area == null) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "parkName, address and area are required");
    }

    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendParkAssignment(jdbcTemplate, assignments, args, "park_name", parkName);
    appendParkAssignment(jdbcTemplate, assignments, args, "address", address);
    appendParkAssignment(jdbcTemplate, assignments, args, "area", area);
    appendParkAssignment(
        jdbcTemplate,
        assignments,
        args,
        "description",
        blankToNull(request == null ? null : request.description()));
    appendParkAssignment(
        jdbcTemplate, assignments, args, "status", blankToNull(request == null ? null : request.status()));
    if (hasColumn(jdbcTemplate, "park", "update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(parkId);
    jdbcTemplate.update(
        "UPDATE park SET " + String.join(", ", assignments) + " WHERE park_id = ?",
        args.toArray());
    return findParkDetail(jdbcTemplate, parkId);
  }

  /** 逻辑删除系统园区，返回删除后的园区快照。 */
  public Map<String, Object> softDeleteSystemPark(JdbcTemplate jdbcTemplate, int parkId) {
    ensureParkExists(jdbcTemplate, parkId);
    if (!hasColumn(jdbcTemplate, "park", "is_deleted")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "园区表缺少删除标记字段");
    }
    jdbcTemplate.update("UPDATE park SET is_deleted = true WHERE park_id = ?", parkId);
    return findParkDetail(jdbcTemplate, parkId);
  }

  /** 查询旧租赁园区详情，并补齐前端详情页直接消费的 imgUrl/imageUrls 字段。 */
  public Map<String, Object> findRentalParkDetail(JdbcTemplate jdbcTemplate, int parkId) {
    Map<String, Object> detail = findParkDetail(jdbcTemplate, parkId);
    if (detail == null) {
      return null;
    }

    applyImageUrlFields(detail);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> factories =
        (List<Map<String, Object>>) detail.getOrDefault("factories", List.of());
    for (Map<String, Object> factory : factories) {
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> floors =
          (List<Map<String, Object>>) factory.getOrDefault("floors", List.of());
      for (Map<String, Object> floor : floors) {
        applyImageUrlFields(floor);
      }
      List<String> firstFloorImages =
          floors.isEmpty() ? List.of() : imageUrls(floors.get(0).get("images"));
      factory.put("imgUrl", firstFloorImages.isEmpty() ? "" : firstFloorImages.get(0));
      factory.put("imageUrls", firstFloorImages);
      factory.putIfAbsent("firefighting", List.of());
      factory.putIfAbsent("transformers", List.of());
      factory.putIfAbsent("elevators", List.of());
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> dormitories =
        (List<Map<String, Object>>) detail.getOrDefault("dormitories", List.of());
    for (Map<String, Object> dormitory : dormitories) {
      applyImageUrlFields(dormitory);
    }
    return detail;
  }

  public List<Map<String, Object>> findAllActiveParks(JdbcTemplate jdbcTemplate) {
    return jdbcTemplate.query(
        """
        SELECT park_id, park_name
        FROM park
        WHERE is_deleted = false
        ORDER BY park_id ASC
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("parkId", rs.getInt("park_id"));
          map.put("parkName", rs.getString("park_name"));
          return map;
        });
  }

  public List<Map<String, Object>> findDirectParks(JdbcTemplate jdbcTemplate, long userId) {
    return jdbcTemplate.query(
        """
        SELECT p.park_id, p.park_name
        FROM user_park up
        INNER JOIN park p ON p.park_id = up.park_id
        WHERE up.user_id = ?
          AND up.is_deleted = false
          AND p.is_deleted = false
        ORDER BY p.park_id ASC
        """,
        (rs, rowNum) -> parkScopeMap(rs),
        userId);
  }

  public List<Map<String, Object>> findLegacyUserPark(JdbcTemplate jdbcTemplate, long userId) {
    return jdbcTemplate.query(
        """
        SELECT p.park_id, p.park_name
        FROM user u
        INNER JOIN park p ON p.park_id = u.park_id
        WHERE u.id = ? AND p.is_deleted = false
        ORDER BY p.park_id ASC
        """,
        (rs, rowNum) -> parkScopeMap(rs),
        userId);
  }

  public List<Map<String, Object>> findRoleParks(JdbcTemplate jdbcTemplate, long userId) {
    return jdbcTemplate.query(
        """
        SELECT DISTINCT p.park_id, p.park_name
        FROM user_role ur
        INNER JOIN role_park rp ON rp.role_id = ur.role_id AND rp.is_deleted = false
        INNER JOIN park p ON p.park_id = rp.park_id AND p.is_deleted = false
        WHERE ur.user_id = ?
        ORDER BY p.park_id ASC
        """,
        (rs, rowNum) -> parkScopeMap(rs),
        userId);
  }

  /** 按授权园区汇总厂房楼层面积和出租情况，复刻旧 /park/dashboard-stats 的只读统计口径。 */
  public Map<String, Object> calculateRentalDashboardStats(
      JdbcTemplate jdbcTemplate, List<Integer> parkIds) {
    if (parkIds.isEmpty()) {
      return emptyDashboardStats();
    }
    List<Map<String, Object>> floors =
        jdbcTemplate.query(
            """
            SELECT ff.total_area, ff.used_area
            FROM factory_floor ff
            INNER JOIN factory f ON f.factory_id = ff.factory_id
            INNER JOIN park p ON p.park_id = f.park_id
            WHERE ff.is_deleted = false
              AND f.is_deleted = false
              AND p.is_deleted = false
              AND p.park_id IN (
            """
                + placeholders(parkIds.size())
                + """
                )
            """,
            (rs, rowNum) ->
                Map.of(
                    "totalArea",
                    defaultDecimal(rs.getBigDecimal("total_area")),
                    "usedArea",
                    defaultDecimal(rs.getBigDecimal("used_area"))),
            parkIds.toArray());
    BigDecimal totalArea = BigDecimal.ZERO;
    BigDecimal rentedArea = BigDecimal.ZERO;
    BigDecimal vacantArea = BigDecimal.ZERO;
    int rentedCount = 0;
    int vacantCount = 0;
    for (Map<String, Object> floor : floors) {
      BigDecimal floorTotalArea = nonNegative((BigDecimal) floor.get("totalArea"));
      BigDecimal floorUsedArea = nonNegative((BigDecimal) floor.get("usedArea"));
      BigDecimal floorVacantArea = floorTotalArea.subtract(floorUsedArea).max(BigDecimal.ZERO);
      totalArea = totalArea.add(floorTotalArea);
      rentedArea = rentedArea.add(floorUsedArea);
      vacantArea = vacantArea.add(floorVacantArea);
      if (floorVacantArea.compareTo(BigDecimal.ZERO) <= 0) {
        rentedCount++;
      } else {
        vacantCount++;
      }
    }
    BigDecimal rentalRate =
        totalArea.compareTo(BigDecimal.ZERO) > 0
            ? rentedArea.multiply(BigDecimal.valueOf(100)).divide(totalArea, 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
    return Map.of(
        "rentalRate", money(rentalRate),
        "rentedArea", money(rentedArea),
        "rentedCount", rentedCount,
        "totalArea", money(totalArea),
        "totalCount", floors.size(),
        "vacantArea", money(vacantArea),
        "vacantCount", vacantCount);
  }

  private StringJoiner buildParkWhere(ParkQuery query, List<Object> args) {
    StringJoiner where = new StringJoiner(" AND ", "WHERE ", "");
    where.add("p.is_deleted = false");
    where.add("p.park_name NOT IN ('宜租网络', '总部')");
    if (StringUtils.hasText(query.parkName())) {
      where.add("p.park_name LIKE ?");
      args.add("%" + query.parkName().trim() + "%");
    }
    if (StringUtils.hasText(query.address())) {
      where.add("p.address LIKE ?");
      args.add("%" + query.address().trim() + "%");
    }
    appendAreaWhere(query.area(), where, args);
    return where;
  }

  private void appendParkScopeWhere(
      StringJoiner where, List<Object> args, List<Integer> authorizedParkIds) {
    List<Integer> scopedParkIds =
        authorizedParkIds == null
            ? List.of()
            : authorizedParkIds.stream().filter(id -> id != null && id > 0).distinct().toList();
    if (scopedParkIds.isEmpty()) {
      where.add("1 = 0");
      return;
    }
    where.add("p.park_id IN (" + placeholders(scopedParkIds.size()) + ")");
    args.addAll(scopedParkIds);
  }

  private void appendAreaWhere(String area, StringJoiner where, List<Object> args) {
    if (!StringUtils.hasText(area)) {
      return;
    }
    String[] parts = area.split(",");
    if (parts.length >= 2 && "equal".equals(parts[0])) {
      BigDecimal value = parseDecimal(parts[1]);
      if (value != null) {
        where.add("p.area = ?");
        args.add(value);
      }
      return;
    }
    if (parts.length >= 1 && "between".equals(parts[0])) {
      if (parts.length >= 2) {
        BigDecimal min = parseDecimal(parts[1]);
        if (min != null) {
          where.add("p.area >= ?");
          args.add(min);
        }
      }
      if (parts.length >= 3) {
        BigDecimal max = parseDecimal(parts[2]);
        if (max != null) {
          where.add("p.area <= ?");
          args.add(max);
        }
      }
    }
  }

  private BigDecimal parseDecimal(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      return new BigDecimal(value.trim());
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private Map<String, Object> emptyDashboardStats() {
    return Map.of(
        "rentalRate", "0.00",
        "rentedArea", "0.00",
        "rentedCount", 0,
        "totalArea", "0.00",
        "totalCount", 0,
        "vacantArea", "0.00",
        "vacantCount", 0);
  }

  private BigDecimal defaultDecimal(BigDecimal value) {
    return value == null ? BigDecimal.ZERO : value;
  }

  private String money(BigDecimal value) {
    return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
  }

  private BigDecimal nonNegative(BigDecimal value) {
    return value == null ? BigDecimal.ZERO : value.max(BigDecimal.ZERO);
  }

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private void ensureParkExists(JdbcTemplate jdbcTemplate, int parkId) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM park WHERE park_id = ?", Integer.class, parkId);
    if (count == null || count == 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到ID为" + parkId + "的园区");
    }
  }

  private void appendParkAssignment(
      JdbcTemplate jdbcTemplate,
      List<String> assignments,
      List<Object> args,
      String columnName,
      Object value) {
    if (!hasColumn(jdbcTemplate, "park", columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(value);
  }

  private void appendParkInsertValue(
      JdbcTemplate jdbcTemplate,
      List<String> columns,
      List<Object> args,
      String columnName,
      Object value) {
    if (!hasColumn(jdbcTemplate, "park", columnName)) {
      return;
    }
    columns.add(columnName);
    args.add(value);
  }

  private boolean hasColumn(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = ?
              AND column_name = ?
            """,
            Integer.class,
            tableName,
            columnName);
    return count != null && count > 0;
  }

  private String normalizedText(Object value) {
    String text = value == null ? "" : String.valueOf(value).trim();
    return StringUtils.hasText(text) ? text : "";
  }

  private Object blankToNull(Object value) {
    String text = value == null ? "" : String.valueOf(value).trim();
    return StringUtils.hasText(text) ? text : null;
  }

  private BigDecimal decimalValue(Object value) {
    if (value instanceof BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    try {
      String text = value == null ? "" : String.valueOf(value).trim();
      return StringUtils.hasText(text) ? new BigDecimal(text) : null;
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private void applyImageUrlFields(Map<String, Object> owner) {
    List<String> urls = imageUrls(owner.get("images"));
    owner.put("imgUrl", urls.isEmpty() ? "" : urls.get(0));
    owner.put("imageUrls", urls);
  }

  private List<String> imageUrls(Object rawImages) {
    if (!(rawImages instanceof List<?> images) || images.isEmpty()) {
      return List.of();
    }
    return images.stream()
        .map(this::imageUrl)
        .filter(StringUtils::hasText)
        .toList();
  }

  private String imageUrl(Object image) {
    if (image instanceof ParkImageResponse response) {
      return response.url();
    }
    if (image instanceof Map<?, ?> map) {
      Object value = map.get("url");
      return value == null ? "" : String.valueOf(value);
    }
    return "";
  }

  private List<ParkImageResponse> findParkImages(JdbcTemplate jdbcTemplate, int parkId) {
    return jdbcTemplate.query(
        """
        SELECT pi.img_id, i.img_url
        FROM park_image pi
        LEFT JOIN image i ON i.img_id = pi.img_id
        WHERE pi.park_id = ?
        ORDER BY pi.id ASC
        """,
        (rs, rowNum) -> imageMap(rs),
        parkId);
  }

  private List<Map<String, Object>> findFactories(JdbcTemplate jdbcTemplate, int parkId) {
    return jdbcTemplate.query(
        """
        SELECT *
        FROM factory
        WHERE park_id = ? AND is_deleted = false
        ORDER BY factory_id ASC
        """,
        (rs, rowNum) -> factoryMap(rs),
        parkId);
  }

  private List<Map<String, Object>> findFactoryFloors(JdbcTemplate jdbcTemplate, int factoryId) {
    List<Map<String, Object>> floors =
        jdbcTemplate.query(
            """
            SELECT *
            FROM factory_floor
            WHERE factory_id = ? AND is_deleted = false
            ORDER BY floor_id ASC
            """,
            (rs, rowNum) -> floorMap(rs),
            factoryId);
    for (Map<String, Object> floor : floors) {
      Integer floorId = (Integer) floor.get("floorId");
      floor.put("images", floorId == null ? List.of() : findFloorImages(jdbcTemplate, floorId));
    }
    return floors;
  }

  private List<ParkImageResponse> findFloorImages(JdbcTemplate jdbcTemplate, int floorId) {
    return jdbcTemplate.query(
        """
        SELECT ffi.img_id, i.img_url
        FROM factory_floor_image ffi
        LEFT JOIN image i ON i.img_id = ffi.img_id
        WHERE ffi.floor_id = ?
        ORDER BY ffi.id ASC
        """,
        (rs, rowNum) -> imageMap(rs),
        floorId);
  }

  private List<Map<String, Object>> findDormitories(JdbcTemplate jdbcTemplate, int parkId) {
    List<Map<String, Object>> dormitories =
        jdbcTemplate.query(
            """
            SELECT *
            FROM dormitory
            WHERE park_id = ? AND is_deleted = false
            ORDER BY dormitory_id ASC
            """,
            (rs, rowNum) -> dormitoryMap(rs),
            parkId);
    for (Map<String, Object> dormitory : dormitories) {
      Integer dormitoryId = (Integer) dormitory.get("dormitoryId");
      dormitory.put(
          "images", dormitoryId == null ? List.of() : findDormitoryImages(jdbcTemplate, dormitoryId));
    }
    return dormitories;
  }

  private List<ParkImageResponse> findDormitoryImages(JdbcTemplate jdbcTemplate, int dormitoryId) {
    return jdbcTemplate.query(
        """
        SELECT di.img_id, i.img_url
        FROM dormitory_image di
        LEFT JOIN image i ON i.img_id = di.img_id
        WHERE di.dormitory_id = ?
        ORDER BY di.id ASC
        """,
        (rs, rowNum) -> imageMap(rs),
        dormitoryId);
  }

  private Map<String, Object> parkMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("parkId", rs.getInt("park_id"));
    map.put("parkName", rs.getString("park_name"));
    map.put("address", rs.getString("address"));
    map.put("area", rs.getBigDecimal("area"));
    map.put("description", rs.getString("description"));
    map.put("status", rs.getString("status"));
    map.put("manager", rs.getString("manager"));
    map.put("contact", rs.getString("contact"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("isDeleted", getBoolean(rs, "is_deleted"));
    return map;
  }

  private Map<String, Object> factoryMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("factoryId", rs.getInt("factory_id"));
    map.put("factoryName", rs.getString("factory_name"));
    map.put("parkId", rs.getObject("park_id", Integer.class));
    map.put("buildTime", toIsoDate(rs.getDate("build_time")));
    map.put("address", rs.getString("address"));
    map.put("contact", rs.getString("contact"));
    map.put("description", rs.getString("description"));
    map.put("isOwn", getBoolean(rs, "is_own"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("isDeleted", getBoolean(rs, "is_deleted"));
    return map;
  }

  private Map<String, Object> floorMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("floorId", rs.getInt("floor_id"));
    map.put("floorName", rs.getString("floor_name"));
    map.put("factoryId", rs.getInt("factory_id"));
    map.put("floorHeight", rs.getBigDecimal("floor_height"));
    map.put("loadBearing", rs.getBigDecimal("load_bearing"));
    map.put("rentPrice", rs.getBigDecimal("rent_price"));
    map.put("totalArea", rs.getBigDecimal("total_area"));
    map.put("usedArea", rs.getBigDecimal("used_area"));
    map.put("status", rs.getString("status"));
    map.put("description", rs.getString("description"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("isDeleted", getBoolean(rs, "is_deleted"));
    return map;
  }

  private Map<String, Object> dormitoryMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("dormitoryId", rs.getInt("dormitory_id"));
    map.put("dormitoryName", rs.getString("dormitory_name"));
    map.put("parkId", rs.getInt("park_id"));
    map.put("floorCount", rs.getInt("floor_count"));
    map.put("floorHeightFirst", rs.getBigDecimal("floor_height_first"));
    map.put("floorHeightOther", rs.getBigDecimal("floor_height_other"));
    map.put("roomArea", rs.getBigDecimal("room_area"));
    map.put("totalRooms", rs.getInt("total_rooms"));
    map.put("usedRoomsFirst", rs.getInt("used_rooms_first"));
    map.put("usedRoomsOther", rs.getInt("used_rooms_other"));
    map.put("rentPriceFirst", rs.getBigDecimal("rent_price_first"));
    map.put("rentPriceOther", rs.getBigDecimal("rent_price_other"));
    map.put("remark", rs.getString("remark"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("isDeleted", getBoolean(rs, "is_deleted"));
    return map;
  }

  private Map<String, Object> parkScopeMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("parkId", rs.getInt("park_id"));
    map.put("parkName", rs.getString("park_name"));
    return map;
  }

  private ParkImageResponse imageMap(ResultSet rs) throws SQLException {
    String url = rs.getString("img_url");
    return new ParkImageResponse(rs.getInt("img_id"), fileName(url), url == null ? "" : url);
  }

  private String fileName(String url) {
    if (!StringUtils.hasText(url)) {
      return "";
    }
    int slashIndex = url.lastIndexOf('/');
    return slashIndex >= 0 ? url.substring(slashIndex + 1) : url;
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

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private String toIsoDate(java.sql.Date date) {
    LocalDate localDate = date == null ? null : date.toLocalDate();
    return localDate == null ? null : localDate.toString();
  }
}
