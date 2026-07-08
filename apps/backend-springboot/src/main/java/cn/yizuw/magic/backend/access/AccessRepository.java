package cn.yizuw.magic.backend.access;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/**
 * 门禁模块数据访问层。
 *
 * <p>所有方法都接收调用方传入的租户库 {@link JdbcTemplate}，避免多租户场景下误用中心库连接。
 */
@Repository
public class AccessRepository {

  /** 查询门禁品牌分页，兼容旧接口 brandName/brandCode/protocolType/布尔筛选。 */
  public PageResult<Map<String, Object>> findBrandPage(
      JdbcTemplate jdbcTemplate,
      int currentPage,
      int pageSize,
      String brandName,
      String brandCode,
      String protocolType,
      Boolean enabled,
      Boolean isDefault) {
    List<Object> args = new ArrayList<>();
    String where = "WHERE 1 = 1";
    if (StringUtils.hasText(brandName)) {
      where += " AND brand_name LIKE ?";
      args.add("%" + brandName.trim() + "%");
    }
    if (StringUtils.hasText(brandCode)) {
      where += " AND brand_code LIKE ?";
      args.add("%" + brandCode.trim() + "%");
    }
    if (StringUtils.hasText(protocolType)) {
      where += " AND protocol_type LIKE ?";
      args.add("%" + protocolType.trim() + "%");
    }
    if (enabled != null) {
      where += " AND enabled = ?";
      args.add(enabled);
    }
    if (isDefault != null) {
      where += " AND is_default = ?";
      args.add(isDefault);
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM access_brand " + where, Long.class, args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((currentPage - 1) * pageSize);
    pageArgs.add(pageSize);
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            "SELECT * FROM access_brand "
                + where
                + " ORDER BY is_default DESC, access_brand_id DESC LIMIT ?, ?",
            (rs, rowNum) -> brandMap(rs),
            pageArgs.toArray());
    return new PageResult<>(items, total == null ? 0 : total, currentPage, pageSize);
  }

  /** 查询门禁品牌详情；旧接口允许不存在时 data 为 null。 */
  public Map<String, Object> findBrandDetail(JdbcTemplate jdbcTemplate, int accessBrandId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT *
            FROM access_brand
            WHERE access_brand_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> brandMap(rs),
            accessBrandId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 查询门禁品牌搜索候选；结果按旧端规则大小写去重。 */
  public List<Map<String, String>> findBrandOptions(
      JdbcTemplate jdbcTemplate, String field, String keyword) {
    String columnName = brandOptionColumn(field);
    List<Object> args = new ArrayList<>();
    String where = "";
    if (StringUtils.hasText(keyword)) {
      where = "WHERE " + columnName + " LIKE ?";
      args.add("%" + keyword.trim() + "%");
    }
    List<String> values =
        jdbcTemplate.query(
            "SELECT brand_name, brand_code, protocol_type FROM access_brand "
                + where
                + " ORDER BY is_default DESC, access_brand_id DESC LIMIT 200",
            (rs, rowNum) -> switch (field) {
              case "brandCode" -> rs.getString("brand_code");
              case "protocolType" -> rs.getString("protocol_type");
              default -> rs.getString("brand_name");
            },
            args.toArray());
    return toOptionList(values);
  }

  /** 新增门禁品牌；默认品牌单选和主表写入在同一租户库事务内完成。 */
  public Map<String, Object> createBrand(JdbcTemplate jdbcTemplate, Map<String, Object> data) {
    return transactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              if (Boolean.TRUE.equals(data.get("isDefault"))) {
                ensureSingleDefaultAccessBrand(jdbcTemplate, null);
              }
              KeyHolder keyHolder = new GeneratedKeyHolder();
              jdbcTemplate.update(
                  connection -> {
                    PreparedStatement statement =
                        connection.prepareStatement(
                            """
                            INSERT INTO access_brand (
                              api_endpoint, app_key, app_secret_ref, brand_code, brand_name,
                              enabled, is_default, protocol_type, remark, create_time, update_time
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                            """,
                            Statement.RETURN_GENERATED_KEYS);
                    statement.setObject(1, data.get("apiEndpoint"));
                    statement.setObject(2, data.get("appKey"));
                    statement.setObject(3, data.get("appSecretRef"));
                    statement.setObject(4, data.get("brandCode"));
                    statement.setObject(5, data.get("brandName"));
                    statement.setObject(6, data.get("enabled"));
                    statement.setObject(7, data.get("isDefault"));
                    statement.setObject(8, data.get("protocolType"));
                    statement.setObject(9, data.get("remark"));
                    return statement;
                  },
                  keyHolder);
              Number key = keyHolder.getKey();
              if (key == null) {
                throw new IllegalStateException("Failed to resolve inserted access brand id");
              }
              return findBrandDetail(jdbcTemplate, key.intValue());
            });
  }

  /** 更新门禁品牌；仅写白名单字段，避免旧端整包 body 误写。 */
  public Map<String, Object> updateBrand(
      JdbcTemplate jdbcTemplate, int accessBrandId, Map<String, Object> data) {
    if (findBrandDetail(jdbcTemplate, accessBrandId) == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "门禁品牌不存在");
    }
    return transactionTemplate(jdbcTemplate)
        .execute(
            ignored -> {
              if (Boolean.TRUE.equals(data.get("isDefault"))) {
                ensureSingleDefaultAccessBrand(jdbcTemplate, accessBrandId);
              }
              List<Object> args = new ArrayList<>();
              List<String> assignments = new ArrayList<>();
              appendBrandAssignment(assignments, args, data, "apiEndpoint", "api_endpoint");
              appendBrandAssignment(assignments, args, data, "appKey", "app_key");
              appendBrandAssignment(assignments, args, data, "appSecretRef", "app_secret_ref");
              appendBrandAssignment(assignments, args, data, "brandCode", "brand_code");
              appendBrandAssignment(assignments, args, data, "brandName", "brand_name");
              appendBrandAssignment(assignments, args, data, "enabled", "enabled");
              appendBrandAssignment(assignments, args, data, "isDefault", "is_default");
              appendBrandAssignment(assignments, args, data, "protocolType", "protocol_type");
              appendBrandAssignment(assignments, args, data, "remark", "remark");
              requireAssignments(assignments);
              assignments.add("update_time = CURRENT_TIMESTAMP");
              args.add(accessBrandId);
              jdbcTemplate.update(
                  "UPDATE access_brand SET "
                      + String.join(", ", assignments)
                      + " WHERE access_brand_id = ?",
                  args.toArray());
              return findBrandDetail(jdbcTemplate, accessBrandId);
            });
  }

  /** 删除门禁品牌并返回删除前快照，兼容旧 Prisma delete 返回值。 */
  public Map<String, Object> deleteBrand(JdbcTemplate jdbcTemplate, int accessBrandId) {
    Map<String, Object> current = findBrandDetail(jdbcTemplate, accessBrandId);
    if (current == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "门禁品牌不存在");
    }
    jdbcTemplate.update("DELETE FROM access_brand WHERE access_brand_id = ?", accessBrandId);
    return current;
  }

  /** 查询访客列表，兼容旧接口的 parkId/currentPark、registerTime 等参数。 */
  public PageResult<Map<String, Object>> findVisitorPage(
      JdbcTemplate jdbcTemplate, AccessListQuery query, List<Integer> authorizedParkIds) {
    List<Object> args = new ArrayList<>();
    String where = buildAccessWhere("v", query.parkId(), query.currentPark(), authorizedParkIds, args);
    if (StringUtils.hasText(query.visitorName())) {
      where += " AND v.visitor_name LIKE ?";
      args.add("%" + query.visitorName().trim() + "%");
    }
    if (StringUtils.hasText(query.phoneNumber())) {
      where += " AND v.phone_number LIKE ?";
      args.add("%" + query.phoneNumber().trim() + "%");
    }
    if (StringUtils.hasText(query.carNum())) {
      where += " AND v.car_num LIKE ?";
      args.add("%" + query.carNum().trim() + "%");
    }
    if (query.status() != null) {
      where += " AND v.status = ?";
      args.add(query.status());
    }
    where = appendRegisterTimeRange(where, "v.register_time", query.registerTime(), args);

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM access_visitor v " + where, Long.class, args.toArray());
    List<Object> pageArgs = pageArgs(args, query);
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT v.*, p.park_name
            FROM access_visitor v
            LEFT JOIN park p ON p.park_id = v.park_id
            """
                + where
                + """
                ORDER BY v.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> visitorMap(rs),
            pageArgs.toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询单个访客详情，并按当前用户园区范围校验访问权限。 */
  public Map<String, Object> findVisitorDetail(
      JdbcTemplate jdbcTemplate, int visitorId, List<Integer> authorizedParkIds) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT v.*, p.park_name
            FROM access_visitor v
            LEFT JOIN park p ON p.park_id = v.park_id
            WHERE v.visitor_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> visitorMap(rs),
            visitorId);
    return authorizedDetail(rows, authorizedParkIds, "visitorId错误");
  }

  /** 更新访客出入记录；白名单字段避免旧端整包 body 透传带来的误写。 */
  public Map<String, Object> updateVisitor(
      JdbcTemplate jdbcTemplate,
      int visitorId,
      AccessVisitorUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findVisitorDetail(jdbcTemplate, visitorId, authorizedParkIds);
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();
    if (request != null && StringUtils.hasText(request.visitorName())) {
      assignments.add("visitor_name = ?");
      args.add(request.visitorName().trim());
    }
    if (request != null && request.carNum() != null) {
      assignments.add("car_num = ?");
      args.add(blankToNull(request.carNum()));
    }
    if (request != null && StringUtils.hasText(request.phoneNumber())) {
      assignments.add("phone_number = ?");
      args.add(request.phoneNumber().trim());
    }
    if (request != null && request.status() != null) {
      assignments.add("status = ?");
      args.add(toInteger(request.status(), "status参数错误"));
    }
    if (request != null && StringUtils.hasText(request.registerTime())) {
      assignments.add("register_time = ?");
      args.add(toTimestamp(request.registerTime()));
    }
    if (request != null && request.remark() != null) {
      assignments.add("remark = ?");
      args.add(blankToNull(request.remark()));
    }
    if (request != null && request.parkId() != null) {
      Integer parkId = toInteger(request.parkId(), "parkId参数错误");
      assertWritablePark(parkId, authorizedParkIds);
      assignments.add("park_id = ?");
      args.add(parkId);
    }
    requireAssignments(assignments);
    assignments.add("update_time = CURRENT_TIMESTAMP");
    args.add(visitorId);
    jdbcTemplate.update(
        "UPDATE access_visitor SET "
            + String.join(", ", assignments)
            + " WHERE visitor_id = ?",
        args.toArray());
    return findVisitorDetail(jdbcTemplate, visitorId, authorizedParkIds);
  }

  /** 删除访客出入记录，先复用详情权限校验。 */
  public void deleteVisitor(
      JdbcTemplate jdbcTemplate, int visitorId, List<Integer> authorizedParkIds) {
    findVisitorDetail(jdbcTemplate, visitorId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM access_visitor WHERE visitor_id = ?", visitorId);
  }

  /** 新增访客出入记录，保持旧端 `POST /access/visitor` 写主表语义。 */
  public Map<String, Object> createVisitor(
      JdbcTemplate jdbcTemplate,
      String visitorName,
      String phoneNumber,
      String carNum,
      String remark,
      int status,
      Timestamp registerTime,
      int parkId) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO access_visitor
                    (visitor_name, phone_number, car_num, remark, status, register_time, park_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, visitorName);
          statement.setString(2, phoneNumber);
          statement.setString(3, carNum);
          statement.setString(4, remark);
          statement.setInt(5, status);
          statement.setTimestamp(6, registerTime);
          statement.setInt(7, parkId);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Failed to resolve inserted visitor id");
    }
    return findVisitorWithoutScope(jdbcTemplate, key.intValue());
  }

  /** 新增公开访客登记记录，返回旧前端可直接使用的访客字段。 */
  public Map<String, Object> createVisitorRegistration(
      JdbcTemplate jdbcTemplate,
      String visitorName,
      String phoneNumber,
      String carNum,
      String remark,
      int status,
      Timestamp registerTime) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO access_visitor
                    (visitor_name, phone_number, car_num, remark, status, register_time)
                  VALUES (?, ?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, visitorName);
          statement.setString(2, phoneNumber);
          statement.setString(3, carNum);
          statement.setString(4, remark);
          statement.setInt(5, status);
          statement.setTimestamp(6, registerTime);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Failed to resolve inserted visitor id");
    }
    return findVisitorWithoutScope(jdbcTemplate, key.intValue());
  }

  /** 查询车辆出入列表，兼容旧接口的 currentPark 和 registerTime 参数。 */
  public PageResult<Map<String, Object>> findCarPage(
      JdbcTemplate jdbcTemplate, AccessListQuery query, List<Integer> authorizedParkIds) {
    List<Object> args = new ArrayList<>();
    String where = buildAccessWhere("c", query.parkId(), query.currentPark(), authorizedParkIds, args);
    if (StringUtils.hasText(query.carNumber())) {
      where += " AND c.car_number LIKE ?";
      args.add("%" + query.carNumber().trim() + "%");
    }
    if (query.status() != null) {
      where += " AND c.status = ?";
      args.add(query.status());
    }
    where = appendRegisterTimeRange(where, "c.register_time", query.registerTime(), args);

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM access_car c " + where, Long.class, args.toArray());
    List<Object> pageArgs = pageArgs(args, query);
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT c.*, p.park_name
            FROM access_car c
            LEFT JOIN park p ON p.park_id = c.park_id
            """
                + where
                + """
                ORDER BY c.create_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> carMap(rs),
            pageArgs.toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询单个车辆详情，并按当前用户园区范围校验访问权限。 */
  public Map<String, Object> findCarDetail(
      JdbcTemplate jdbcTemplate, int carId, List<Integer> authorizedParkIds) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT c.*, p.park_name
            FROM access_car c
            LEFT JOIN park p ON p.park_id = c.park_id
            WHERE c.car_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> carMap(rs),
            carId);
    return authorizedDetail(rows, authorizedParkIds, "carId错误");
  }

  /** 更新车辆出入记录；白名单字段避免旧端整包 body 透传带来的误写。 */
  public Map<String, Object> updateCar(
      JdbcTemplate jdbcTemplate,
      int carId,
      AccessCarUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findCarDetail(jdbcTemplate, carId, authorizedParkIds);
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();
    if (request != null && StringUtils.hasText(request.carNumber())) {
      assignments.add("car_number = ?");
      args.add(request.carNumber().trim());
    }
    if (request != null && request.status() != null) {
      assignments.add("status = ?");
      args.add(toInteger(request.status(), "status参数错误"));
    }
    if (request != null && StringUtils.hasText(request.registerTime())) {
      assignments.add("register_time = ?");
      args.add(toTimestamp(request.registerTime()));
    }
    if (request != null && request.remark() != null) {
      assignments.add("remark = ?");
      args.add(blankToNull(request.remark()));
    }
    if (request != null && request.parkId() != null) {
      Integer parkId = toInteger(request.parkId(), "parkId参数错误");
      assertWritablePark(parkId, authorizedParkIds);
      assignments.add("park_id = ?");
      args.add(parkId);
    }
    requireAssignments(assignments);
    assignments.add("update_time = CURRENT_TIMESTAMP");
    args.add(carId);
    jdbcTemplate.update(
        "UPDATE access_car SET "
            + String.join(", ", assignments)
            + " WHERE car_id = ?",
        args.toArray());
    return findCarDetail(jdbcTemplate, carId, authorizedParkIds);
  }

  /** 删除车辆出入记录，先复用详情权限校验。 */
  public void deleteCar(JdbcTemplate jdbcTemplate, int carId, List<Integer> authorizedParkIds) {
    findCarDetail(jdbcTemplate, carId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM access_car WHERE car_id = ?", carId);
  }

  /** 新增车辆出入记录，保持旧端只写 access_car 主表的语义。 */
  public Map<String, Object> createCar(
      JdbcTemplate jdbcTemplate,
      String carNumber,
      int status,
      Timestamp registerTime,
      String remark,
      int parkId) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO access_car
                    (car_number, status, register_time, remark, park_id)
                  VALUES (?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, carNumber);
          statement.setInt(2, status);
          statement.setTimestamp(3, registerTime);
          statement.setString(4, remark);
          statement.setInt(5, parkId);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Failed to resolve inserted car id");
    }
    return findCarWithoutScope(jdbcTemplate, key.intValue());
  }

  /** 查询门禁设备列表，按当前用户园区范围过滤。 */
  public PageResult<Map<String, Object>> findDoorPage(
      JdbcTemplate jdbcTemplate, AccessListQuery query, List<Integer> authorizedParkIds) {
    List<Object> args = new ArrayList<>();
    String where = buildAccessWhere("d", query.parkId(), query.currentPark(), authorizedParkIds, args);
    if (StringUtils.hasText(query.deviceCode())) {
      where += " AND d.device_code LIKE ?";
      args.add("%" + query.deviceCode().trim() + "%");
    }
    if (StringUtils.hasText(query.deviceName())) {
      where += " AND d.device_name LIKE ?";
      args.add("%" + query.deviceName().trim() + "%");
    }
    if (StringUtils.hasText(query.location())) {
      where += " AND d.location LIKE ?";
      args.add("%" + query.location().trim() + "%");
    }
    if (query.status() != null) {
      where += " AND d.status = ?";
      args.add(query.status());
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM access_door d " + where, Long.class, args.toArray());
    List<Object> pageArgs = pageArgs(args, query);
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT d.*, p.park_name
            FROM access_door d
            LEFT JOIN park p ON p.park_id = d.park_id
            """
                + where
                + """
                ORDER BY d.device_id DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> doorMap(rs),
            pageArgs.toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 更新门禁设备启停状态；旧端只支持 status 字段。 */
  public Map<String, Object> updateDoorStatus(
      JdbcTemplate jdbcTemplate, int deviceId, int status, List<Integer> authorizedParkIds) {
    findDoorDetail(jdbcTemplate, deviceId, authorizedParkIds);
    jdbcTemplate.update(
        "UPDATE access_door SET status = ?, update_time = CURRENT_TIMESTAMP WHERE device_id = ?",
        status,
        deviceId);
    return findDoorDetail(jdbcTemplate, deviceId, authorizedParkIds);
  }

  /** 删除门禁设备；旧接口为物理删除，删除前先校验设备存在和园区权限。 */
  public void deleteDoor(JdbcTemplate jdbcTemplate, int deviceId, List<Integer> authorizedParkIds) {
    findDoorDetail(jdbcTemplate, deviceId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM access_door WHERE device_id = ?", deviceId);
  }

  /** 新增门禁设备；只校验本地表，不触发外部硬件平台同步。 */
  public Map<String, Object> createDoor(
      JdbcTemplate jdbcTemplate,
      String deviceCode,
      String deviceName,
      String location,
      int parkId,
      int status) {
    assertActiveParkExists(jdbcTemplate, parkId);
    if (doorCodeExists(jdbcTemplate, deviceCode)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "设备编号已存在");
    }
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO access_door
                    (device_code, device_name, location, park_id, status)
                  VALUES (?, ?, ?, ?, ?)
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, deviceCode);
          statement.setString(2, deviceName);
          statement.setString(3, location);
          statement.setInt(4, parkId);
          statement.setInt(5, status);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Failed to resolve inserted door id");
    }
    return findDoorWithoutScope(jdbcTemplate, key.intValue());
  }

  private String buildAccessWhere(
      String alias,
      Integer parkId,
      Integer currentPark,
      List<Integer> authorizedParkIds,
      List<Object> args) {
    if (authorizedParkIds.isEmpty()) {
      return "WHERE 1 = 0";
    }

    Integer requestedParkId = parkId == null ? currentPark : parkId;
    if (requestedParkId == null || requestedParkId == -1) {
      args.addAll(authorizedParkIds);
      return "WHERE " + alias + ".park_id IN (" + placeholders(authorizedParkIds.size()) + ")";
    }
    if (!authorizedParkIds.contains(requestedParkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    args.add(requestedParkId);
    return "WHERE " + alias + ".park_id = ?";
  }

  private String appendRegisterTimeRange(
      String where, String columnName, String registerTime, List<Object> args) {
    if (!StringUtils.hasText(registerTime)) {
      return where;
    }
    String[] parts = registerTime.split(",", 2);
    if (parts.length < 2 || !StringUtils.hasText(parts[0]) || !StringUtils.hasText(parts[1])) {
      return where;
    }
    args.add(parts[0].trim() + " 00:00:00");
    args.add(parts[1].trim() + " 23:59:59");
    return where + " AND " + columnName + " BETWEEN ? AND ?";
  }

  private Map<String, Object> authorizedDetail(
      List<Map<String, Object>> rows, List<Integer> authorizedParkIds, String emptyMessage) {
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, emptyMessage);
    }
    Map<String, Object> row = rows.get(0);
    Object rawParkId = row.get("parkId");
    if (rawParkId instanceof Number number && !authorizedParkIds.contains(number.intValue())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }
    return row;
  }

  private Map<String, Object> findVisitorWithoutScope(JdbcTemplate jdbcTemplate, int visitorId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT v.*, p.park_name
            FROM access_visitor v
            LEFT JOIN park p ON p.park_id = v.park_id
            WHERE v.visitor_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> visitorMap(rs),
            visitorId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "创建访客信息失败");
    }
    return rows.get(0);
  }

  private Map<String, Object> findCarWithoutScope(JdbcTemplate jdbcTemplate, int carId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT c.*, p.park_name
            FROM access_car c
            LEFT JOIN park p ON p.park_id = c.park_id
            WHERE c.car_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> carMap(rs),
            carId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "创建车辆信息失败");
    }
    return rows.get(0);
  }

  private Map<String, Object> findDoorDetail(
      JdbcTemplate jdbcTemplate, int deviceId, List<Integer> authorizedParkIds) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT d.*, p.park_name
            FROM access_door d
            LEFT JOIN park p ON p.park_id = d.park_id
            WHERE d.device_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> doorMap(rs),
            deviceId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "门禁设备不存在");
    }
    Map<String, Object> row = rows.get(0);
    Object rawParkId = row.get("parkId");
    if (rawParkId instanceof Number number && !authorizedParkIds.contains(number.intValue())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    return row;
  }

  private Map<String, Object> findDoorWithoutScope(JdbcTemplate jdbcTemplate, int deviceId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT d.*, p.park_name
            FROM access_door d
            LEFT JOIN park p ON p.park_id = d.park_id
            WHERE d.device_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> doorMap(rs),
            deviceId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "创建门禁设备失败");
    }
    return rows.get(0);
  }

  private void assertActiveParkExists(JdbcTemplate jdbcTemplate, int parkId) {
    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM park WHERE park_id = ? AND is_deleted = false",
            Long.class,
            parkId);
    if (total == null || total == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "园区不存在");
    }
  }

  private boolean doorCodeExists(JdbcTemplate jdbcTemplate, String deviceCode) {
    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM access_door WHERE device_code = ?",
            Long.class,
            deviceCode);
    return total != null && total > 0;
  }

  private void assertWritablePark(Integer parkId, List<Integer> authorizedParkIds) {
    if (parkId != null && !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
  }

  private void ensureSingleDefaultAccessBrand(JdbcTemplate jdbcTemplate, Integer excludeId) {
    if (excludeId == null) {
      jdbcTemplate.update("UPDATE access_brand SET is_default = false, update_time = CURRENT_TIMESTAMP");
      return;
    }
    jdbcTemplate.update(
        """
        UPDATE access_brand
        SET is_default = false, update_time = CURRENT_TIMESTAMP
        WHERE access_brand_id <> ?
        """,
        excludeId);
  }

  private void appendBrandAssignment(
      List<String> assignments,
      List<Object> args,
      Map<String, Object> data,
      String key,
      String columnName) {
    if (data.containsKey(key)) {
      assignments.add(columnName + " = ?");
      args.add(data.get(key));
    }
  }

  private String brandOptionColumn(String field) {
    return switch (field) {
      case "brandCode" -> "brand_code";
      case "protocolType" -> "protocol_type";
      default -> "brand_name";
    };
  }

  private List<Map<String, String>> toOptionList(List<String> values) {
    List<Map<String, String>> options = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (String rawValue : values) {
      String value = rawValue == null ? "" : rawValue.trim();
      if (!StringUtils.hasText(value)) {
        continue;
      }
      String mapKey = value.toLowerCase();
      if (seen.add(mapKey)) {
        options.add(Map.of("label", value, "value", value));
      }
      if (options.size() >= 100) {
        break;
      }
    }
    return options;
  }

  private TransactionTemplate transactionTemplate(JdbcTemplate jdbcTemplate) {
    if (jdbcTemplate.getDataSource() == null) {
      throw new IllegalStateException("Tenant DataSource is not available");
    }
    return new TransactionTemplate(new DataSourceTransactionManager(jdbcTemplate.getDataSource()));
  }

  private String blankToNull(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private void requireAssignments(List<String> assignments) {
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供需要更新的数据");
    }
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

  private Timestamp toTimestamp(String value) {
    String text = value == null ? "" : value.trim();
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "registerTime参数错误");
    }
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (DateTimeParseException ignored) {
      // Continue with legacy local date-time formats.
    }
    try {
      return Timestamp.from(OffsetDateTime.parse(text).toInstant());
    } catch (DateTimeParseException ignored) {
      // Continue with yyyy-MM-dd HH:mm:ss or yyyy-MM-ddTHH:mm:ss.
    }
    try {
      String normalized = text.replace('T', ' ');
      if (normalized.length() == 10) {
        normalized = normalized + " 00:00:00";
      }
      return Timestamp.valueOf(LocalDateTime.parse(normalized.replace(' ', 'T')));
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "registerTime参数错误");
    }
  }

  private List<Object> pageArgs(List<Object> args, AccessListQuery query) {
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    return pageArgs;
  }

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private Map<String, Object> visitorMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("visitorId", rs.getInt("visitor_id"));
    map.put("visitorName", rs.getString("visitor_name"));
    map.put("carNum", rs.getString("car_num"));
    map.put("phoneNumber", rs.getString("phone_number"));
    map.put("status", rs.getObject("status", Integer.class));
    map.put("registerTime", toIso(rs.getTimestamp("register_time")));
    map.put("remark", rs.getString("remark"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("parkId", rs.getObject("park_id", Integer.class));
    map.put("parkName", rs.getString("park_name") == null ? "未知园区" : rs.getString("park_name"));
    return map;
  }

  private Map<String, Object> carMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("carId", rs.getInt("car_id"));
    map.put("carNumber", rs.getString("car_number"));
    map.put("status", rs.getObject("status", Integer.class));
    map.put("registerTime", toIso(rs.getTimestamp("register_time")));
    map.put("remark", rs.getString("remark"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("parkId", rs.getObject("park_id", Integer.class));
    map.put("parkName", rs.getString("park_name") == null ? "未知园区" : rs.getString("park_name"));
    return map;
  }

  private Map<String, Object> doorMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("deviceId", rs.getInt("device_id"));
    map.put("deviceCode", rs.getString("device_code"));
    map.put("deviceName", rs.getString("device_name"));
    map.put("location", rs.getString("location"));
    map.put("status", rs.getObject("status", Integer.class));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("parkId", rs.getObject("park_id", Integer.class));
    map.put("parkName", rs.getString("park_name") == null ? "未知园区" : rs.getString("park_name"));
    return map;
  }

  private Map<String, Object> brandMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("accessBrandId", rs.getInt("access_brand_id"));
    map.put("apiEndpoint", rs.getString("api_endpoint"));
    map.put("appKey", rs.getString("app_key"));
    map.put("appSecretRef", rs.getString("app_secret_ref"));
    map.put("brandCode", rs.getString("brand_code"));
    map.put("brandName", rs.getString("brand_name"));
    map.put("enabled", toBoolean(rs.getObject("enabled")));
    map.put("isDefault", toBoolean(rs.getObject("is_default")));
    map.put("protocolType", rs.getString("protocol_type"));
    map.put("remark", rs.getString("remark"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    return map;
  }

  private Boolean toBoolean(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return "true".equalsIgnoreCase(text) || "1".equals(text);
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
