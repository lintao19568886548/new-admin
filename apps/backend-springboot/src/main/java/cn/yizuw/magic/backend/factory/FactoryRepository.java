package cn.yizuw.magic.backend.factory;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/**
 * 厂房、厂房楼层和租赁园区的只读数据访问层。
 *
 * <p>迁移期租户库由 {@link JdbcTemplate} 调用方传入，避免 MyBatis-Plus 默认中心库误读租户业务表。
 */
@Repository
public class FactoryRepository {

  /**
   * 查询当前登录用户可见的厂房列表。
   *
   * <p>兼容旧接口：不传 {@code isOwn} 时返回用户授权园区内的自有厂房，加上公共入驻厂房。
   */
  public PageResult<Map<String, Object>> findFactoryPage(
      JdbcTemplate jdbcTemplate, FactoryQuery query, List<Integer> authorizedParkIds) {
    List<Object> args = new ArrayList<>();
    String where = buildFactoryWhere(jdbcTemplate, query, authorizedParkIds, args, true);
    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM factory f " + where, Long.class, args.toArray());
    List<Map<String, Object>> factories =
        findFactoryRows(jdbcTemplate, where, args, query.currentPage(), query.pageSize());
    return new PageResult<>(
        toFactoryListItems(jdbcTemplate, factories, false),
        total == null ? 0 : total,
        query.currentPage(),
        query.pageSize());
  }

  /**
   * 查询公开待租厂房列表。
   *
   * <p>旧 Nitro 将该接口列为公开接口，所以这里不强制登录；带 token 时由 Service 选择当前租户库。
   */
  public PageResult<Map<String, Object>> findAvailableFactoryPage(
      JdbcTemplate jdbcTemplate, FactoryQuery query) {
    List<Object> args = new ArrayList<>();
    String where = buildFactoryWhere(jdbcTemplate, query, List.of(), args, false);
    String statsJoin = floorStatsJoin();
    String availableWhere = " AND COALESCE(fs.total_area, 0) - COALESCE(fs.used_area, 0) > 0";
    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM factory f " + statsJoin + " " + where + availableWhere,
            Long.class,
            args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> factories =
        jdbcTemplate.query(
            """
            SELECT f.*, p.park_name, COALESCE(fs.total_area, 0) AS total_area,
                   COALESCE(fs.used_area, 0) AS used_area, fs.first_rent_price
            FROM factory f
            LEFT JOIN park p ON p.park_id = f.park_id
            """
                + statsJoin
                + " "
                + where
                + availableWhere
                + """
                ORDER BY f.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> factoryBaseMap(rs),
            pageArgs.toArray());
    return new PageResult<>(
        toFactoryListItems(jdbcTemplate, factories, true),
        total == null ? 0 : total,
        query.currentPage(),
        query.pageSize());
  }

  /** 查询厂房详情。旧接口详情页是公开读取，因此权限边界在 Service 中处理为“当前租户或默认租户”。 */
  public Map<String, Object> findFactoryDetail(JdbcTemplate jdbcTemplate, int factoryId) {
    List<Map<String, Object>> factories =
        jdbcTemplate.query(
            """
            SELECT f.*, p.park_name
            FROM factory f
            LEFT JOIN park p ON p.park_id = f.park_id
            WHERE f.factory_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> factoryBaseMap(rs),
            factoryId);
    if (factories.isEmpty()) {
      return null;
    }

    Map<String, Object> factory = factories.get(0);
    List<Map<String, Object>> floors = findFloors(jdbcTemplate, factoryId);
    addFactoryStats(factory, floors, false);
    factory.put("description", defaultString(factory.get("description")));
    factory.put("parkId", null);
    factory.put("parkName", "入驻厂房");
    factory.put("imgUrl", firstFloorMainImage(floors));
    factory.put("imageUrls", firstFloorImages(floors));
    factory.put("floors", floors);
    return factory;
  }

  /** 逻辑删除厂房，保持旧 `/factory/{id}` DELETE 只写 is_deleted 的语义。 */
  public Map<String, Object> softDeleteFactory(
      JdbcTemplate jdbcTemplate, int factoryId, List<Integer> authorizedParkIds) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM factory WHERE factory_id = ?", Integer.class, factoryId);
    if (count == null || count == 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到 ID 为 " + factoryId + " 的厂房");
    }
    if (hasColumn(jdbcTemplate, "factory", "park_id")) {
      Integer parkId =
          jdbcTemplate.queryForObject(
              "SELECT park_id FROM factory WHERE factory_id = ?", Integer.class, factoryId);
      if (parkId == null || !authorizedParkIds.contains(parkId)) {
        throw new BusinessException(HttpStatus.FORBIDDEN, "没有删除权限");
      }
    }
    if (!hasColumn(jdbcTemplate, "factory", "is_deleted")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "厂房表缺少删除标记字段");
    }
    jdbcTemplate.update("UPDATE factory SET is_deleted = true WHERE factory_id = ?", factoryId);
    Map<String, Object> detail = findFactoryDetail(jdbcTemplate, factoryId);
    if (detail == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "未找到 ID 为 " + factoryId + " 的厂房");
    }
    detail.put("isDeleted", true);
    return detail;
  }

  /** 按用户授权园区返回级联选择器需要的“园区-厂房”树。 */
  public List<Map<String, Object>> findFactoryTreeByParks(
      JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {
    if (authorizedParkIds.isEmpty()) {
      return List.of();
    }
    String placeholders = String.join(",", Collections.nCopies(authorizedParkIds.size(), "?"));
    List<Map<String, Object>> parks =
        jdbcTemplate.query(
            """
            SELECT p.park_id, p.park_name
            FROM park p
            WHERE p.is_deleted = false
              AND p.park_id IN (
            """
                + placeholders
                + """
              )
              AND EXISTS (
                SELECT 1
                FROM factory f
                WHERE f.park_id = p.park_id
                  AND f.is_deleted = false
              )
            ORDER BY p.park_id ASC
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("label", rs.getString("park_name"));
              row.put("value", rs.getInt("park_id"));
              row.put("children", findFactoryTreeChildren(jdbcTemplate, rs.getInt("park_id")));
              return row;
            },
            authorizedParkIds.toArray());
    return parks;
  }

  /** 查询租赁端园区卡片列表，只返回当前用户有权限的园区。 */
  public PageResult<Map<String, Object>> findRentalParkPage(
      JdbcTemplate jdbcTemplate,
      List<Integer> authorizedParkIds,
      Integer currentPage,
      Integer pageSize,
      String parkName,
      String address,
      String status) {
    if (authorizedParkIds.isEmpty()) {
      return new PageResult<>(List.of(), 0, currentPage, pageSize);
    }

    List<Object> args = new ArrayList<>(authorizedParkIds);
    StringBuilder where =
        new StringBuilder(
            """
            WHERE p.is_deleted = false
              AND p.park_id IN (
            """
                + String.join(",", Collections.nCopies(authorizedParkIds.size(), "?"))
                + """
              )
              AND p.park_name NOT IN ('宜租网络', '总部', '东莞光泰园区')
            """);
    if (StringUtils.hasText(parkName)) {
      where.append(" AND p.park_name LIKE ?");
      args.add("%" + parkName.trim() + "%");
    }
    if (StringUtils.hasText(address)) {
      where.append(" AND p.address LIKE ?");
      args.add("%" + address.trim() + "%");
    }
    if (StringUtils.hasText(status)) {
      where.append(" AND p.status = ?");
      args.add(status.trim());
    }

    Long total =
        jdbcTemplate.queryForObject("SELECT COUNT(*) FROM park p " + where, Long.class, args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    List<Map<String, Object>> parks =
        jdbcTemplate.query(
            """
            SELECT p.*, COALESCE(fc.factory_count, 0) AS factory_count,
                   COALESCE(dc.dormitory_count, 0) AS dormitory_count
            FROM park p
            LEFT JOIN (
              SELECT park_id, COUNT(*) AS factory_count
              FROM factory
              WHERE is_deleted = false
              GROUP BY park_id
            ) fc ON fc.park_id = p.park_id
            LEFT JOIN (
              SELECT park_id, COUNT(*) AS dormitory_count
              FROM dormitory
              WHERE is_deleted = false
              GROUP BY park_id
            ) dc ON dc.park_id = p.park_id
            """
                + where
                + """
                ORDER BY p.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> rentalParkMap(jdbcTemplate, rs),
            pageArgs.toArray());
    return new PageResult<>(parks, total == null ? 0 : total, currentPage, pageSize);
  }

  /** 查询租赁管理页厂房列表，路径兼容旧 `/rental/manage/list`。 */
  public PageResult<Map<String, Object>> findRentalManagePage(
      JdbcTemplate jdbcTemplate, RentalManageQuery query, List<Integer> authorizedParkIds) {
    if (authorizedParkIds.isEmpty()) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE f.is_deleted = false");
    Integer requestedParkId = query.currentPark();
    if (requestedParkId == null || requestedParkId == -1) {
      where.append(" AND f.park_id IN (").append(placeholders(authorizedParkIds.size())).append(")");
      args.addAll(authorizedParkIds);
    } else if (authorizedParkIds.contains(requestedParkId)) {
      where.append(" AND f.park_id = ?");
      args.add(requestedParkId);
    } else {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }

    if (StringUtils.hasText(query.factoryName())) {
      where.append(" AND f.factory_name LIKE ?");
      args.add("%" + query.factoryName().trim() + "%");
    }
    if (StringUtils.hasText(query.address())) {
      where.append(" AND f.address LIKE ?");
      args.add("%" + query.address().trim() + "%");
    }
    if (StringUtils.hasText(query.contact())) {
      where.append(" AND f.contact LIKE ?");
      args.add("%" + query.contact().trim() + "%");
    }
    if (StringUtils.hasText(query.description())) {
      where.append(" AND f.description LIKE ?");
      args.add("%" + query.description().trim() + "%");
    }

    String statsJoin = floorStatsJoin();
    appendRangeFilter(where, args, "COALESCE(fs.first_rent_price, 0)", query.rentPrice());
    appendRangeFilter(where, args, "COALESCE(fs.total_area, 0)", query.area());
    appendRangeFilter(
        where,
        args,
        "COALESCE(fs.total_area, 0) - COALESCE(fs.used_area, 0)",
        query.availableArea());

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM factory f " + statsJoin + " " + where,
            Long.class,
            args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> factories =
        jdbcTemplate.query(
            """
            SELECT f.*, p.park_name
            FROM factory f
            LEFT JOIN park p ON p.park_id = f.park_id
            """
                + statsJoin
                + " "
                + where
                + """
                ORDER BY f.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> factoryBaseMap(rs),
            pageArgs.toArray());
    return new PageResult<>(
        toFactoryListItems(jdbcTemplate, factories, false),
        total == null ? 0 : total,
        query.currentPage(),
        query.pageSize());
  }

  /** 查询租赁管理厂房详情，必须按当前用户授权园区校验。 */
  public Map<String, Object> findRentalManageDetail(
      JdbcTemplate jdbcTemplate, int factoryId, List<Integer> authorizedParkIds) {
    Map<String, Object> detail = findFactoryDetail(jdbcTemplate, factoryId);
    if (detail == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "factoryId错误");
    }

    List<Integer> parkIds =
        jdbcTemplate.query(
            "SELECT park_id FROM factory WHERE factory_id = ? LIMIT 1",
            (rs, rowNum) -> rs.getObject("park_id", Integer.class),
            factoryId);
    Integer parkId = parkIds.isEmpty() ? null : parkIds.get(0);
    if (parkId != null && !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    detail.put("parkId", parkId);
    return detail;
  }

  /** 更新租赁管理厂房主表字段；字段白名单避免旧接口整包 body 透传误写。 */
  public Map<String, Object> updateRentalManage(
      JdbcTemplate jdbcTemplate,
      int factoryId,
      RentalManageUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findRentalManageDetail(jdbcTemplate, factoryId, authorizedParkIds);
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();

    appendStringAssignment(
        assignments, args, jdbcTemplate, "factory_name", request == null ? null : request.factoryName());
    appendDateAssignment(assignments, args, jdbcTemplate, "build_time", request == null ? null : request.buildTime());
    appendStringAssignment(assignments, args, jdbcTemplate, "address", request == null ? null : request.address());
    appendStringAssignment(assignments, args, jdbcTemplate, "contact", request == null ? null : request.contact());
    appendStringAssignment(
        assignments, args, jdbcTemplate, "description", request == null ? null : request.description());
    appendBooleanAssignment(assignments, args, jdbcTemplate, "is_own", request == null ? null : request.isOwn());
    appendParkAssignment(
        assignments, args, jdbcTemplate, request == null ? null : request.parkId(), authorizedParkIds);
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供需要更新的数据");
    }
    if (hasColumn(jdbcTemplate, "factory", "update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(factoryId);
    jdbcTemplate.update(
        "UPDATE factory SET " + String.join(", ", assignments) + " WHERE factory_id = ?",
        args.toArray());
    return findRentalManageDetail(jdbcTemplate, factoryId, authorizedParkIds);
  }

  /** 删除租赁管理厂房，旧接口为物理删除；删除前复用详情权限校验。 */
  public void deleteRentalManage(
      JdbcTemplate jdbcTemplate, int factoryId, List<Integer> authorizedParkIds) {
    findRentalManageDetail(jdbcTemplate, factoryId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM factory WHERE factory_id = ?", factoryId);
  }

  /** 新增租赁管理厂房主表记录；只接受 factory 白名单字段，避免旧 body 透传误写未知列。 */
  public Map<String, Object> createRentalManage(
      JdbcTemplate jdbcTemplate,
      RentalManageCreateRequest request,
      List<Integer> authorizedParkIds) {
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的表单字段");
    }
    requireFactoryColumn(jdbcTemplate, "factory_id");
    requireFactoryColumn(jdbcTemplate, "factory_name");
    requireFactoryColumn(jdbcTemplate, "address");
    requireFactoryColumn(jdbcTemplate, "contact");

    List<String> columns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendRequiredStringValue(columns, args, jdbcTemplate, "factory_name", request.factoryName(), "厂房名称不能为空");
    appendRequiredStringValue(columns, args, jdbcTemplate, "address", request.address(), "厂房地址不能为空");
    appendRequiredStringValue(columns, args, jdbcTemplate, "contact", request.contact(), "联系人不能为空");
    appendDateValue(columns, args, jdbcTemplate, "build_time", request.buildTime());
    appendStringValue(columns, args, jdbcTemplate, "description", request.description());
    appendBooleanValue(columns, args, jdbcTemplate, "is_own", request.isOwn());
    appendParkValue(columns, args, jdbcTemplate, request.parkId(), authorizedParkIds);
    appendCurrentTimestampValue(columns, args, jdbcTemplate, "create_time");
    appendCurrentTimestampValue(columns, args, jdbcTemplate, "update_time");
    if (hasColumn(jdbcTemplate, "factory", "is_deleted")) {
      columns.add("is_deleted");
      args.add(false);
    }

    jdbcTemplate.update(
        "INSERT INTO factory ("
            + String.join(", ", columns)
            + ") VALUES ("
            + placeholders(columns.size())
            + ")",
        args.toArray());
    Integer factoryId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (factoryId == null || factoryId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建厂房失败");
    }
    return findRentalManageDetail(jdbcTemplate, factoryId, authorizedParkIds);
  }

  /** 新增旧厂房主表记录；复用 factory 白名单插入逻辑，不处理 floors 和楼层图片关系。 */
  public Map<String, Object> createFactory(
      JdbcTemplate jdbcTemplate,
      FactoryCreateRequest request,
      List<Integer> authorizedParkIds) {
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的表单字段");
    }
    return createRentalManage(
        jdbcTemplate,
        new RentalManageCreateRequest(
            request.address(),
            request.buildTime(),
            request.contact(),
            request.description(),
            request.factoryName(),
            request.isOwn(),
            request.parkId()),
        authorizedParkIds);
  }

  /** 更新旧厂房主表记录；复用租赁管理白名单更新逻辑，不处理 floors 和楼层图片关系。 */
  public Map<String, Object> updateFactory(
      JdbcTemplate jdbcTemplate,
      int factoryId,
      FactoryUpdateRequest request,
      List<Integer> authorizedParkIds) {
    return updateRentalManage(
        jdbcTemplate,
        factoryId,
        new RentalManageUpdateRequest(
            request == null ? null : request.address(),
            request == null ? null : request.buildTime(),
            request == null ? null : request.contact(),
            request == null ? null : request.description(),
            request == null ? null : request.factoryName(),
            request == null ? null : request.isOwn(),
            request == null ? null : request.parkId()),
        authorizedParkIds);
  }

  private List<Map<String, Object>> findFactoryRows(
      JdbcTemplate jdbcTemplate, String where, List<Object> args, int currentPage, int pageSize) {
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    return jdbcTemplate.query(
        """
        SELECT f.*, p.park_name
        FROM factory f
        LEFT JOIN park p ON p.park_id = f.park_id
        """
            + where
            + """
            ORDER BY f.create_time DESC
            LIMIT ?, ?
            """,
        (rs, rowNum) -> factoryBaseMap(rs),
        pageArgs.toArray());
  }

  private String buildFactoryWhere(
      JdbcTemplate jdbcTemplate,
      FactoryQuery query,
      List<Integer> authorizedParkIds,
      List<Object> args,
      boolean enforceAuthorizedScope) {
    StringBuilder where = new StringBuilder("WHERE f.is_deleted = false");
    // magic.sql 较旧，可能还没有 is_own 字段；运行时检测可以兼容旧库快照。
    boolean hasIsOwnColumn = hasColumn(jdbcTemplate, "factory", "is_own");

    if (enforceAuthorizedScope) {
      if (query.isOwn() == null) {
        appendAuthorizedFactoryScope(where, args, authorizedParkIds, hasIsOwnColumn);
      } else if (query.isOwn()) {
        where.append(" AND f.park_id IN (")
            .append(placeholders(authorizedParkIds.size()))
            .append(")");
        args.addAll(authorizedParkIds);
        if (hasIsOwnColumn) {
          where.append(" AND f.is_own = true");
        }
      } else if (hasIsOwnColumn) {
        where.append(" AND f.is_own = false AND f.park_id IS NULL");
      } else {
        where.append(" AND 1 = 0");
      }
    } else if (query.isOwn() != null && hasIsOwnColumn) {
      where.append(" AND f.is_own = ?");
      args.add(query.isOwn());
    }

    if (StringUtils.hasText(query.factoryName())) {
      where.append(" AND f.factory_name LIKE ?");
      args.add("%" + query.factoryName().trim() + "%");
    }
    if (StringUtils.hasText(query.address())) {
      where.append(" AND f.address LIKE ?");
      args.add("%" + query.address().trim() + "%");
    }
    if (query.parkId() != null && (!enforceAuthorizedScope || !Boolean.FALSE.equals(query.isOwn()))) {
      where.append(" AND f.park_id = ?");
      args.add(query.parkId());
    }
    return where.toString();
  }

  private void appendAuthorizedFactoryScope(
      StringBuilder where, List<Object> args, List<Integer> authorizedParkIds, boolean hasIsOwnColumn) {
    if (authorizedParkIds.isEmpty()) {
      if (hasIsOwnColumn) {
        where.append(" AND f.is_own = false AND f.park_id IS NULL");
        return;
      }
      where.append(" AND 1 = 0");
      return;
    }

    if (hasIsOwnColumn) {
      where.append(" AND ((f.is_own = true AND f.park_id IN (")
          .append(placeholders(authorizedParkIds.size()))
          .append(")) OR (f.is_own = false AND f.park_id IS NULL))");
      args.addAll(authorizedParkIds);
      return;
    }

    where.append(" AND f.park_id IN (").append(placeholders(authorizedParkIds.size())).append(")");
    args.addAll(authorizedParkIds);
  }

  private void appendRangeFilter(
      StringBuilder where, List<Object> args, String expression, String rawValue) {
    if (!StringUtils.hasText(rawValue)) {
      return;
    }
    String[] parts = rawValue.split(",");
    if (parts.length >= 2 && "equal".equals(parts[0])) {
      BigDecimal value = decimalText(parts[1]);
      if (value != null) {
        where.append(" AND ").append(expression).append(" = ?");
        args.add(value);
      }
    } else if (parts.length >= 3 && "between".equals(parts[0])) {
      BigDecimal min = decimalText(parts[1]);
      BigDecimal max = decimalText(parts[2]);
      if (min != null && max != null) {
        where.append(" AND ").append(expression).append(" BETWEEN ? AND ?");
        args.add(min);
        args.add(max);
      }
    }
  }

  private List<Map<String, Object>> toFactoryListItems(
      JdbcTemplate jdbcTemplate, List<Map<String, Object>> factories, boolean nullableParkName) {
    List<Map<String, Object>> items = new ArrayList<>();
    for (Map<String, Object> factory : factories) {
      List<Map<String, Object>> floors =
          findFloors(jdbcTemplate, Number.class.cast(factory.get("factoryId")).intValue());
      addFactoryStats(factory, floors, nullableParkName);
      items.add(factory);
    }
    return items;
  }

  private void addFactoryStats(
      Map<String, Object> factory, List<Map<String, Object>> floors, boolean nullableParkName) {
    BigDecimal totalArea = BigDecimal.ZERO;
    BigDecimal usedArea = BigDecimal.ZERO;
    for (Map<String, Object> floor : floors) {
      totalArea = totalArea.add(decimal(floor.get("totalArea")));
      usedArea = usedArea.add(decimal(floor.get("usedArea")));
    }
    BigDecimal availableArea = totalArea.subtract(usedArea);
    factory.put("id", factory.get("factoryId"));
    factory.put("title", factory.get("factoryName"));
    factory.put("description", defaultString(factory.get("description")));
    factory.put("area", totalArea);
    factory.put("availableArea", availableArea);
    factory.put("floorCount", floors.size());
    factory.put("rentPrice", floors.isEmpty() ? BigDecimal.ZERO : floors.get(0).get("rentPrice"));
    Boolean isOwn = (Boolean) factory.get("isOwn");
    factory.put("tag", Boolean.TRUE.equals(isOwn) ? "自有" : "入驻");
    Object parkName = factory.get("parkName");
    String defaultParkName = nullableParkName ? null : "入驻厂房";
    factory.put("group", parkName == null ? defaultParkName : parkName);
    factory.put("parkName", parkName == null ? defaultParkName : parkName);
    factory.put("imgUrl", firstFloorMainImage(floors));
    factory.put("imageUrls", firstFloorImages(floors));
    factory.put("content", factory.get("description"));
    factory.put("date", factory.get("createTime"));
  }

  private List<Map<String, Object>> findFloors(JdbcTemplate jdbcTemplate, int factoryId) {
    List<Map<String, Object>> floors =
        jdbcTemplate.query(
            """
            SELECT *
            FROM factory_floor
            WHERE factory_id = ?
              AND is_deleted = false
            ORDER BY floor_id ASC
            """,
            (rs, rowNum) -> floorMap(rs),
            factoryId);
    for (Map<String, Object> floor : floors) {
      Integer floorId = Number.class.cast(floor.get("floorId")).intValue();
      List<String> imageUrls = findFloorImageUrls(jdbcTemplate, floorId);
      floor.put("imgUrl", imageUrls.isEmpty() ? "" : imageUrls.get(0));
      floor.put("imageUrls", imageUrls);
    }
    return floors;
  }

  private List<String> findFloorImageUrls(JdbcTemplate jdbcTemplate, int floorId) {
    return jdbcTemplate.query(
        """
        SELECT i.img_url
        FROM factory_floor_image ffi
        LEFT JOIN image i ON i.img_id = ffi.img_id
        WHERE ffi.floor_id = ?
          AND i.img_url IS NOT NULL
          AND i.img_url <> ''
        ORDER BY ffi.id ASC
        """,
        (rs, rowNum) -> rs.getString("img_url"),
        floorId);
  }

  private List<String> findParkImageUrls(JdbcTemplate jdbcTemplate, int parkId) {
    return jdbcTemplate.query(
        """
        SELECT i.img_url
        FROM park_image pi
        LEFT JOIN image i ON i.img_id = pi.img_id
        WHERE pi.park_id = ?
          AND i.img_url IS NOT NULL
          AND i.img_url <> ''
        ORDER BY pi.create_time ASC, pi.id ASC
        """,
        (rs, rowNum) -> rs.getString("img_url"),
        parkId);
  }

  private List<Map<String, Object>> findFactoryTreeChildren(JdbcTemplate jdbcTemplate, int parkId) {
    return jdbcTemplate.query(
        """
        SELECT factory_id, factory_name
        FROM factory
        WHERE park_id = ?
          AND is_deleted = false
        ORDER BY factory_id ASC
        """,
        (rs, rowNum) -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("isLeaf", true);
          row.put("value", rs.getInt("factory_id"));
          row.put("label", rs.getString("factory_name"));
          return row;
        },
        parkId);
  }

  private String floorStatsJoin() {
    // 先在 SQL 中聚合面积，避免待租列表为了过滤 availableArea 拉全量楼层到 Java。
    return """
        LEFT JOIN (
          SELECT factory_id, SUM(total_area) AS total_area, SUM(used_area) AS used_area,
                 SUBSTRING_INDEX(GROUP_CONCAT(rent_price ORDER BY floor_id ASC), ',', 1) AS first_rent_price
          FROM factory_floor
          WHERE is_deleted = false
          GROUP BY factory_id
        ) fs ON fs.factory_id = f.factory_id
        """;
  }

  private Map<String, Object> factoryBaseMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("factoryId", rs.getInt("factory_id"));
    map.put("factoryName", rs.getString("factory_name"));
    map.put("parkId", rs.getObject("park_id", Integer.class));
    map.put("parkName", safeString(rs, "park_name"));
    map.put("buildTime", toIsoDate(rs.getDate("build_time")));
    map.put("address", rs.getString("address"));
    map.put("contact", rs.getString("contact"));
    map.put("description", rs.getString("description"));
    map.put("isOwn", hasColumn(rs, "is_own") ? getBoolean(rs, "is_own") : true);
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
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
    return map;
  }

  private Map<String, Object> rentalParkMap(JdbcTemplate jdbcTemplate, ResultSet rs)
      throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    int parkId = rs.getInt("park_id");
    map.put("parkId", parkId);
    map.put("parkName", rs.getString("park_name"));
    map.put("address", rs.getString("address"));
    map.put("area", rs.getBigDecimal("area"));
    map.put("description", rs.getString("description"));
    map.put("status", rs.getString("status"));
    map.put("manager", rs.getString("manager"));
    map.put("contact", rs.getString("contact"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("factoryCount", rs.getInt("factory_count"));
    map.put("dormitoryCount", rs.getInt("dormitory_count"));
    List<String> imageUrls = findParkImageUrls(jdbcTemplate, parkId);
    map.put("imgUrl", imageUrls.isEmpty() ? "" : imageUrls.get(0));
    map.put("imageUrls", imageUrls);
    return map;
  }

  private BigDecimal decimal(Object value) {
    if (value instanceof BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    return BigDecimal.ZERO;
  }

  private BigDecimal decimalText(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      return new BigDecimal(value.trim());
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private String firstFloorMainImage(List<Map<String, Object>> floors) {
    return floors.isEmpty() ? "" : String.valueOf(floors.get(0).get("imgUrl"));
  }

  @SuppressWarnings("unchecked")
  private List<String> firstFloorImages(List<Map<String, Object>> floors) {
    if (floors.isEmpty()) {
      return List.of();
    }
    Object value = floors.get(0).get("imageUrls");
    if (value instanceof List<?> list) {
      return (List<String>) list;
    }
    return List.of();
  }

  private String defaultString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private void appendRequiredStringValue(
      List<String> columns,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      String columnName,
      Object value,
      String message) {
    if (!hasColumn(jdbcTemplate, "factory", columnName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "厂房表结构不完整");
    }
    Object normalized = blankToNull(value);
    if (normalized == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    columns.add(columnName);
    args.add(normalized);
  }

  private void appendStringValue(
      List<String> columns,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      String columnName,
      Object value) {
    if (value == null || !hasColumn(jdbcTemplate, "factory", columnName)) {
      return;
    }
    columns.add(columnName);
    args.add(blankToNull(value));
  }

  private void appendDateValue(
      List<String> columns,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      String columnName,
      Object value) {
    if (value == null || !hasColumn(jdbcTemplate, "factory", columnName)) {
      return;
    }
    columns.add(columnName);
    args.add(toSqlDate(value, columnName + "参数错误"));
  }

  private void appendBooleanValue(
      List<String> columns,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      String columnName,
      Object value) {
    if (value == null || !hasColumn(jdbcTemplate, "factory", columnName)) {
      return;
    }
    columns.add(columnName);
    args.add(toBoolean(value, columnName + "参数错误"));
  }

  private void appendParkValue(
      List<String> columns,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      Object value,
      List<Integer> authorizedParkIds) {
    if (value == null || !hasColumn(jdbcTemplate, "factory", "park_id")) {
      return;
    }
    Integer parkId = toInteger(value, "parkId参数错误");
    if (!authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    columns.add("park_id");
    args.add(parkId);
  }

  private void appendCurrentTimestampValue(
      List<String> columns, List<Object> args, JdbcTemplate jdbcTemplate, String columnName) {
    if (!hasColumn(jdbcTemplate, "factory", columnName)) {
      return;
    }
    columns.add(columnName);
    args.add(new Timestamp(System.currentTimeMillis()));
  }

  private void requireFactoryColumn(JdbcTemplate jdbcTemplate, String columnName) {
    if (!hasColumn(jdbcTemplate, "factory", columnName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "厂房表结构不完整");
    }
  }

  private void appendStringAssignment(
      List<String> assignments,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      String columnName,
      Object value) {
    if (value == null || !hasColumn(jdbcTemplate, "factory", columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(blankToNull(value));
  }

  private void appendDateAssignment(
      List<String> assignments,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      String columnName,
      Object value) {
    if (value == null || !hasColumn(jdbcTemplate, "factory", columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(toSqlDate(value, columnName + "参数错误"));
  }

  private void appendBooleanAssignment(
      List<String> assignments,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      String columnName,
      Object value) {
    if (value == null || !hasColumn(jdbcTemplate, "factory", columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(toBoolean(value, columnName + "参数错误"));
  }

  private void appendParkAssignment(
      List<String> assignments,
      List<Object> args,
      JdbcTemplate jdbcTemplate,
      Object value,
      List<Integer> authorizedParkIds) {
    if (value == null || !hasColumn(jdbcTemplate, "factory", "park_id")) {
      return;
    }
    Integer parkId = toInteger(value, "parkId参数错误");
    if (!authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    assignments.add("park_id = ?");
    args.add(parkId);
  }

  private Object blankToNull(Object value) {
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

  private java.sql.Date toSqlDate(Object value, String message) {
    if (value instanceof java.sql.Date date) {
      return date;
    }
    if (value instanceof java.util.Date date) {
      return new java.sql.Date(date.getTime());
    }
    try {
      String text = String.valueOf(value).trim();
      if (!StringUtils.hasText(text)) {
        throw new IllegalArgumentException("empty date");
      }
      return java.sql.Date.valueOf(LocalDate.parse(text.length() >= 10 ? text.substring(0, 10) : text));
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
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

  private boolean hasColumn(ResultSet rs, String columnName) throws SQLException {
    try {
      rs.findColumn(columnName);
      return true;
    } catch (SQLException error) {
      return false;
    }
  }

  private String safeString(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getString(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private String placeholders(int count) {
    if (count <= 0) {
      return "NULL";
    }
    return String.join(",", Collections.nCopies(count, "?"));
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
