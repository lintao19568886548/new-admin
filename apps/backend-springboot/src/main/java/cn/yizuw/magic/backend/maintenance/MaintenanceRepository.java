package cn.yizuw.magic.backend.maintenance;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageResult;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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
 * 维保模块数据访问层。
 *
 * <p>迁移期真实业务表位于租户库，因此所有查询都由 Service 显式传入租户 {@link JdbcTemplate}。
 * 对 magic.sql 快照和 Prisma schema 的字段差异做运行时检测，避免灰度环境因为个别字段缺失直接 500。
 */
@Repository
public class MaintenanceRepository {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /** 查询升降机列表，并按当前用户授权园区过滤。 */
  public PageResult<Map<String, Object>> findElevatorPage(
      JdbcTemplate jdbcTemplate, MaintenanceListQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "elevator");
    if (!readableTable(columns, "elevator_id")) {
      return emptyPage(query);
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where =
        new StringBuilder(buildParkWhere("e", query.parkId(), query.currentPark(), authorizedParkIds, args));
    appendIntegerEquals(where, args, columns, "e", "factory_id", query.factoryId());
    appendLike(where, args, columns, "e", "name", query.name());
    appendLike(where, args, columns, "e", "status", query.status());
    appendLike(where, args, columns, "e", "area", query.area());
    appendDecimalLike(where, args, columns, "e", "load_capacity", query.loadCapacity());
    appendLike(where, args, columns, "e", "brand", query.brand());
    appendLike(where, args, columns, "e", "checker", query.checker());
    appendLike(where, args, columns, "e", "size", query.size());
    appendDateRange(
        where, args, columns, "e", "production_date", query.productionDateStart(), query.productionDateEnd());
    appendDateRange(where, args, columns, "e", "check_time", query.checkTimeStart(), query.checkTimeEnd());

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM elevator e " + where, Long.class, args.toArray());
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT e.*, f.factory_name, p.park_name
            FROM elevator e
            LEFT JOIN factory f ON f.factory_id = e.factory_id
            LEFT JOIN park p ON p.park_id = e.park_id
            """
                + where
                + """
                ORDER BY e.check_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> elevatorMap(rs),
            pageArgs(args, query).toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询升降机详情；旧接口未做详情权限校验，这里补齐园区边界。 */
  public Map<String, Object> findElevatorDetail(
      JdbcTemplate jdbcTemplate, int elevatorId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "elevator");
    if (!readableTable(columns, "elevator_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "elevatorId错误");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT e.*, f.factory_name, p.park_name
            FROM elevator e
            LEFT JOIN factory f ON f.factory_id = e.factory_id
            LEFT JOIN park p ON p.park_id = e.park_id
            WHERE e.elevator_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> elevatorMap(rs),
            elevatorId);
    return authorizedDetail(rows, authorizedParkIds, "elevatorId错误");
  }

  /** 新增升降机记录；旧端直接透传 body，这里收敛到主表字段白名单。 */
  public Map<String, Object> createElevator(
      JdbcTemplate jdbcTemplate,
      MaintenanceElevatorUpdateRequest request,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "elevator");
    if (!readableTable(columns, "elevator_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "升降机表不可用");
    }
    List<Object> args = new ArrayList<>();
    List<String> insertColumns = new ArrayList<>();

    appendStringValue(insertColumns, args, columns, "name", request == null ? null : request.name());
    appendStringValue(insertColumns, args, columns, "status", request == null ? null : request.status());
    appendStringValue(insertColumns, args, columns, "size", request == null ? null : request.size());
    appendStringValue(insertColumns, args, columns, "area", request == null ? null : request.area());
    appendStringValue(insertColumns, args, columns, "brand", request == null ? null : request.brand());
    appendStringValue(insertColumns, args, columns, "checker", request == null ? null : request.checker());
    appendStringValue(insertColumns, args, columns, "remark", request == null ? null : request.remark());
    appendDecimalValue(
        insertColumns, args, columns, "load_capacity", request == null ? null : request.loadCapacity());
    appendTimestampValue(
        insertColumns, args, columns, "production_date", request == null ? null : request.productionDate());
    appendTimestampValue(
        insertColumns, args, columns, "check_time", request == null ? null : request.checkTime());
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    int elevatorId = insertAndReturnId(jdbcTemplate, "elevator", "elevator_id", insertColumns, args);
    return findElevatorDetail(jdbcTemplate, elevatorId, authorizedParkIds);
  }

  /** 更新升降机记录；字段白名单减少旧端整包 body 透传风险。 */
  public Map<String, Object> updateElevator(
      JdbcTemplate jdbcTemplate,
      int elevatorId,
      MaintenanceElevatorUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findElevatorDetail(jdbcTemplate, elevatorId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "elevator");
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();

    appendStringAssignment(assignments, args, columns, "name", request == null ? null : request.name());
    appendStringAssignment(assignments, args, columns, "status", request == null ? null : request.status());
    appendStringAssignment(assignments, args, columns, "size", request == null ? null : request.size());
    appendStringAssignment(assignments, args, columns, "area", request == null ? null : request.area());
    appendStringAssignment(assignments, args, columns, "brand", request == null ? null : request.brand());
    appendStringAssignment(assignments, args, columns, "checker", request == null ? null : request.checker());
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendDecimalAssignment(
        assignments, args, columns, "load_capacity", request == null ? null : request.loadCapacity());
    appendTimestampAssignment(
        assignments, args, columns, "production_date", request == null ? null : request.productionDate());
    appendTimestampAssignment(
        assignments, args, columns, "check_time", request == null ? null : request.checkTime());
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    updateById(jdbcTemplate, "elevator", "elevator_id", elevatorId, columns, assignments, args);
    return findElevatorDetail(jdbcTemplate, elevatorId, authorizedParkIds);
  }

  /** 删除升降机记录，返回删除前快照以兼容旧 Prisma delete 返回值。 */
  public Map<String, Object> deleteElevator(
      JdbcTemplate jdbcTemplate, int elevatorId, List<Integer> authorizedParkIds) {
    Map<String, Object> detail = findElevatorDetail(jdbcTemplate, elevatorId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM elevator WHERE elevator_id = ?", elevatorId);
    return detail;
  }

  /** 查询消防设施列表，兼容旧接口的状态、厂房和检查时间筛选。 */
  public PageResult<Map<String, Object>> findFirefightingPage(
      JdbcTemplate jdbcTemplate, MaintenanceListQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "firefighting");
    if (!readableTable(columns, "firefighting_id")) {
      return emptyPage(query);
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where =
        new StringBuilder(buildParkWhere("ff", query.parkId(), query.currentPark(), authorizedParkIds, args));
    appendIntegerEquals(where, args, columns, "ff", "factory_id", query.factoryId());
    appendLike(where, args, columns, "ff", "firefighting_name", query.firefightingName());
    appendLike(where, args, columns, "ff", "address", query.address());
    appendEquals(where, args, columns, "ff", "extinguisher", query.extinguisher());
    appendEquals(where, args, columns, "ff", "hydrant", query.hydrant());
    appendEquals(where, args, columns, "ff", "fire_exit", query.fireExit());
    appendLike(where, args, columns, "ff", "checker", query.checker());
    appendDateRange(where, args, columns, "ff", "check_time", query.checkTimeStart(), query.checkTimeEnd());

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM firefighting ff " + where, Long.class, args.toArray());
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT ff.*, f.factory_name, p.park_name
            FROM firefighting ff
            LEFT JOIN factory f ON f.factory_id = ff.factory_id
            LEFT JOIN park p ON p.park_id = ff.park_id
            """
                + where
                + """
                ORDER BY ff.check_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> firefightingMap(rs),
            pageArgs(args, query).toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询消防设施详情；详情同样需要当前用户具备对应园区权限。 */
  public Map<String, Object> findFirefightingDetail(
      JdbcTemplate jdbcTemplate, int firefightingId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "firefighting");
    if (!readableTable(columns, "firefighting_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "firefightingId错误");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT ff.*, f.factory_name, p.park_name
            FROM firefighting ff
            LEFT JOIN factory f ON f.factory_id = ff.factory_id
            LEFT JOIN park p ON p.park_id = ff.park_id
            WHERE ff.firefighting_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> firefightingMap(rs),
            firefightingId);
    return authorizedDetail(rows, authorizedParkIds, "firefightingId错误");
  }

  /** 新增消防设施记录；只处理 firefighting 主表字段，不写 firefighting_image。 */
  public Map<String, Object> createFirefighting(
      JdbcTemplate jdbcTemplate,
      MaintenanceFirefightingUpdateRequest request,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "firefighting");
    if (!readableTable(columns, "firefighting_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "消防设施表不可用");
    }
    List<Object> args = new ArrayList<>();
    List<String> insertColumns = new ArrayList<>();

    appendStringValue(insertColumns, args, columns, "address", request == null ? null : request.address());
    appendStringValue(
        insertColumns, args, columns, "firefighting_name", request == null ? null : request.firefightingName());
    appendStringValue(
        insertColumns, args, columns, "extinguisher", request == null ? null : request.extinguisher());
    appendStringValue(insertColumns, args, columns, "hydrant", request == null ? null : request.hydrant());
    appendStringValue(insertColumns, args, columns, "fire_exit", request == null ? null : request.fireExit());
    appendStringValue(insertColumns, args, columns, "checker", request == null ? null : request.checker());
    appendStringValue(insertColumns, args, columns, "remark", request == null ? null : request.remark());
    appendStringValue(insertColumns, args, columns, "img_url", request == null ? null : request.imgUrl());
    appendTimestampValue(
        insertColumns, args, columns, "check_time", request == null ? null : request.checkTime());
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    int firefightingId =
        insertAndReturnId(jdbcTemplate, "firefighting", "firefighting_id", insertColumns, args);
    return findFirefightingDetail(jdbcTemplate, firefightingId, authorizedParkIds);
  }

  /** 更新消防设施记录；图片关联仍保留旧后端处理，本批只写主表字段。 */
  public Map<String, Object> updateFirefighting(
      JdbcTemplate jdbcTemplate,
      int firefightingId,
      MaintenanceFirefightingUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findFirefightingDetail(jdbcTemplate, firefightingId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "firefighting");
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();

    appendStringAssignment(assignments, args, columns, "address", request == null ? null : request.address());
    appendStringAssignment(
        assignments, args, columns, "firefighting_name", request == null ? null : request.firefightingName());
    appendStringAssignment(
        assignments, args, columns, "extinguisher", request == null ? null : request.extinguisher());
    appendStringAssignment(assignments, args, columns, "hydrant", request == null ? null : request.hydrant());
    appendStringAssignment(assignments, args, columns, "fire_exit", request == null ? null : request.fireExit());
    appendStringAssignment(assignments, args, columns, "checker", request == null ? null : request.checker());
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendStringAssignment(assignments, args, columns, "img_url", request == null ? null : request.imgUrl());
    appendTimestampAssignment(
        assignments, args, columns, "check_time", request == null ? null : request.checkTime());
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    updateById(
        jdbcTemplate, "firefighting", "firefighting_id", firefightingId, columns, assignments, args);
    return findFirefightingDetail(jdbcTemplate, firefightingId, authorizedParkIds);
  }

  /** 删除消防设施记录，返回删除前快照以兼容旧 Prisma delete 返回值。 */
  public Map<String, Object> deleteFirefighting(
      JdbcTemplate jdbcTemplate, int firefightingId, List<Integer> authorizedParkIds) {
    Map<String, Object> detail =
        findFirefightingDetail(jdbcTemplate, firefightingId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM firefighting WHERE firefighting_id = ?", firefightingId);
    return detail;
  }

  /** 查询变压器列表；checker 字段在旧 SQL 快照中可能不存在，会自动跳过该筛选。 */
  public PageResult<Map<String, Object>> findTransformerPage(
      JdbcTemplate jdbcTemplate, MaintenanceListQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "transformer");
    if (!readableTable(columns, "transformer_id")) {
      return emptyPage(query);
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where =
        new StringBuilder(buildParkWhere("t", query.parkId(), query.currentPark(), authorizedParkIds, args));
    appendIntegerEquals(where, args, columns, "t", "factory_id", query.factoryId());
    appendLike(where, args, columns, "t", "transformer_name", query.transformerName());
    appendLike(where, args, columns, "t", "address", query.address());
    appendLike(where, args, columns, "t", "checker", query.checker());
    appendEquals(where, args, columns, "t", "status", query.status());
    appendLike(where, args, columns, "t", "specifications", query.specifications());
    appendDateRange(where, args, columns, "t", "check_time", query.checkTimeStart(), query.checkTimeEnd());

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM transformer t " + where, Long.class, args.toArray());
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT t.*, f.factory_name, p.park_name
            FROM transformer t
            LEFT JOIN factory f ON f.factory_id = t.factory_id
            LEFT JOIN park p ON p.park_id = t.park_id
            """
                + where
                + """
                ORDER BY t.check_time DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> transformerMap(rs),
            pageArgs(args, query).toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询变压器详情，并补齐旧接口缺失的园区权限校验。 */
  public Map<String, Object> findTransformerDetail(
      JdbcTemplate jdbcTemplate, int transformerId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "transformer");
    if (!readableTable(columns, "transformer_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "transformerId错误");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT t.*, f.factory_name, p.park_name
            FROM transformer t
            LEFT JOIN factory f ON f.factory_id = t.factory_id
            LEFT JOIN park p ON p.park_id = t.park_id
            WHERE t.transformer_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> transformerMap(rs),
            transformerId);
    return authorizedDetail(rows, authorizedParkIds, "transformerId错误");
  }

  /** 新增变压器记录；不触发硬件同步或图片关系写入。 */
  public Map<String, Object> createTransformer(
      JdbcTemplate jdbcTemplate,
      MaintenanceTransformerUpdateRequest request,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "transformer");
    if (!readableTable(columns, "transformer_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "变压器表不可用");
    }
    List<Object> args = new ArrayList<>();
    List<String> insertColumns = new ArrayList<>();

    appendStringValue(
        insertColumns, args, columns, "transformer_name", request == null ? null : request.transformerName());
    appendStringValue(insertColumns, args, columns, "address", request == null ? null : request.address());
    appendStringValue(insertColumns, args, columns, "contact", request == null ? null : request.contact());
    appendStringValue(insertColumns, args, columns, "checker", request == null ? null : request.checker());
    appendStringValue(insertColumns, args, columns, "status", request == null ? null : request.status());
    appendStringValue(
        insertColumns, args, columns, "specifications", request == null ? null : request.specifications());
    appendStringValue(insertColumns, args, columns, "remark", request == null ? null : request.remark());
    appendStringValue(insertColumns, args, columns, "img_url", request == null ? null : request.imgUrl());
    appendTimestampValue(
        insertColumns, args, columns, "check_time", request == null ? null : request.checkTime());
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    int transformerId =
        insertAndReturnId(jdbcTemplate, "transformer", "transformer_id", insertColumns, args);
    return findTransformerDetail(jdbcTemplate, transformerId, authorizedParkIds);
  }

  /** 更新变压器记录；只处理 transformer 主表字段，不触发外部设备同步。 */
  public Map<String, Object> updateTransformer(
      JdbcTemplate jdbcTemplate,
      int transformerId,
      MaintenanceTransformerUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findTransformerDetail(jdbcTemplate, transformerId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "transformer");
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();

    appendStringAssignment(
        assignments, args, columns, "transformer_name", request == null ? null : request.transformerName());
    appendStringAssignment(assignments, args, columns, "address", request == null ? null : request.address());
    appendStringAssignment(assignments, args, columns, "contact", request == null ? null : request.contact());
    appendStringAssignment(assignments, args, columns, "checker", request == null ? null : request.checker());
    appendStringAssignment(assignments, args, columns, "status", request == null ? null : request.status());
    appendStringAssignment(
        assignments, args, columns, "specifications", request == null ? null : request.specifications());
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendStringAssignment(assignments, args, columns, "img_url", request == null ? null : request.imgUrl());
    appendTimestampAssignment(
        assignments, args, columns, "check_time", request == null ? null : request.checkTime());
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    updateById(jdbcTemplate, "transformer", "transformer_id", transformerId, columns, assignments, args);
    return findTransformerDetail(jdbcTemplate, transformerId, authorizedParkIds);
  }

  /** 删除变压器记录，返回删除前快照以兼容旧 Prisma delete 返回值。 */
  public Map<String, Object> deleteTransformer(
      JdbcTemplate jdbcTemplate, int transformerId, List<Integer> authorizedParkIds) {
    Map<String, Object> detail = findTransformerDetail(jdbcTemplate, transformerId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM transformer WHERE transformer_id = ?", transformerId);
    return detail;
  }

  /** 查询卫生检查列表，兼容旧接口的检查项目、结果、检查人和日期范围筛选。 */
  public PageResult<Map<String, Object>> findHygieneCheckPage(
      JdbcTemplate jdbcTemplate, MaintenanceListQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "hygiene_check");
    if (!readableTable(columns, "hygiene_check_id")) {
      return emptyPage(query);
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where =
        new StringBuilder(buildParkWhere("hc", query.parkId(), query.currentPark(), authorizedParkIds, args));
    appendIntegerEquals(where, args, columns, "hc", "factory_id", query.factoryId());
    appendLike(where, args, columns, "hc", "check_items", query.checkItems());
    appendEquals(where, args, columns, "hc", "check_result", query.checkResult());
    appendLike(where, args, columns, "hc", "checker", query.checker());
    appendDateRange(where, args, columns, "hc", "check_date", query.checkTimeStart(), query.checkTimeEnd());

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM hygiene_check hc " + where, Long.class, args.toArray());
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT hc.*, f.factory_name, p.park_name
            FROM hygiene_check hc
            LEFT JOIN factory f ON f.factory_id = hc.factory_id
            LEFT JOIN park p ON p.park_id = hc.park_id
            """
                + where
                + """
                ORDER BY hc.hygiene_check_id DESC
                LIMIT ?, ?
                """,
            (rs, rowNum) -> hygieneCheckMap(rs),
            pageArgs(args, query).toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询卫生检查详情，并按当前用户授权园区过滤。 */
  public Map<String, Object> findHygieneCheckDetail(
      JdbcTemplate jdbcTemplate, int hygieneCheckId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "hygiene_check");
    if (!readableTable(columns, "hygiene_check_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "hygieneCheckId错误");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT hc.*, f.factory_name, p.park_name
            FROM hygiene_check hc
            LEFT JOIN factory f ON f.factory_id = hc.factory_id
            LEFT JOIN park p ON p.park_id = hc.park_id
            WHERE hc.hygiene_check_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> hygieneCheckMap(rs),
            hygieneCheckId);
    return authorizedDetail(rows, authorizedParkIds, "hygieneCheckId错误");
  }

  /** 新增卫生检查记录；只处理 hygiene_check 主表字段。 */
  public Map<String, Object> createHygieneCheck(
      JdbcTemplate jdbcTemplate,
      MaintenanceHygieneCheckUpdateRequest request,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "hygiene_check");
    if (!readableTable(columns, "hygiene_check_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "卫生检查表不可用");
    }
    List<Object> args = new ArrayList<>();
    List<String> insertColumns = new ArrayList<>();

    appendStringValue(
        insertColumns, args, columns, "check_items", request == null ? null : request.checkItems());
    appendStringValue(insertColumns, args, columns, "checker", request == null ? null : request.checker());
    appendStringValue(
        insertColumns, args, columns, "check_result", request == null ? null : request.checkResult());
    appendStringValue(insertColumns, args, columns, "remark", request == null ? null : request.remark());
    appendTimestampValue(
        insertColumns, args, columns, "check_date", request == null ? null : request.checkDate());
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    int hygieneCheckId =
        insertAndReturnId(jdbcTemplate, "hygiene_check", "hygiene_check_id", insertColumns, args);
    return findHygieneCheckDetail(jdbcTemplate, hygieneCheckId, authorizedParkIds);
  }

  /** 更新卫生检查记录；字段白名单限定在 hygiene_check 主表。 */
  public Map<String, Object> updateHygieneCheck(
      JdbcTemplate jdbcTemplate,
      int hygieneCheckId,
      MaintenanceHygieneCheckUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findHygieneCheckDetail(jdbcTemplate, hygieneCheckId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "hygiene_check");
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();

    appendStringAssignment(
        assignments, args, columns, "check_items", request == null ? null : request.checkItems());
    appendStringAssignment(assignments, args, columns, "checker", request == null ? null : request.checker());
    appendStringAssignment(
        assignments, args, columns, "check_result", request == null ? null : request.checkResult());
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendTimestampAssignment(
        assignments, args, columns, "check_date", request == null ? null : request.checkDate());
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    updateById(
        jdbcTemplate, "hygiene_check", "hygiene_check_id", hygieneCheckId, columns, assignments, args);
    return findHygieneCheckDetail(jdbcTemplate, hygieneCheckId, authorizedParkIds);
  }

  /** 删除卫生检查记录，返回删除前快照以兼容旧 Prisma delete 返回值。 */
  public Map<String, Object> deleteHygieneCheck(
      JdbcTemplate jdbcTemplate, int hygieneCheckId, List<Integer> authorizedParkIds) {
    Map<String, Object> detail =
        findHygieneCheckDetail(jdbcTemplate, hygieneCheckId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM hygiene_check WHERE hygiene_check_id = ?", hygieneCheckId);
    return detail;
  }

  /** 查询厂房维护列表，兼容旧接口的项目、状态、负责人和维护时段筛选。 */
  public PageResult<Map<String, Object>> findFactoryMaintPage(
      JdbcTemplate jdbcTemplate, MaintenanceListQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "factory_maintenance");
    if (!readableTable(columns, "factory_maintenance_id")) {
      return emptyPage(query);
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where =
        new StringBuilder(buildParkWhere("fm", query.parkId(), query.currentPark(), authorizedParkIds, args));
    appendIntegerEquals(where, args, columns, "fm", "factory_id", query.factoryId());
    appendLike(where, args, columns, "fm", "maintenance_item", query.maintenanceItem());
    appendEquals(where, args, columns, "fm", "maintenance_status", query.maintenanceStatus());
    appendLike(where, args, columns, "fm", "person_in_charge", query.personInCharge());
    appendDateRange(where, args, columns, "fm", "start_time", query.checkTimeStart(), query.checkTimeEnd());

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM factory_maintenance fm " + where, Long.class, args.toArray());
    String orderBy =
        columns.contains("start_time")
            ? "ORDER BY fm.start_time DESC"
            : "ORDER BY fm.factory_maintenance_id DESC";
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT fm.*, f.factory_name, p.park_name
            FROM factory_maintenance fm
            LEFT JOIN factory f ON f.factory_id = fm.factory_id
            LEFT JOIN park p ON p.park_id = fm.park_id
            """
                + where
                + "\n"
                + orderBy
                + """
                LIMIT ?, ?
                """,
            (rs, rowNum) -> factoryMaintMap(rs),
            pageArgs(args, query).toArray());
    return new PageResult<>(items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询厂房维护详情，并按当前用户授权园区过滤。 */
  public Map<String, Object> findFactoryMaintDetail(
      JdbcTemplate jdbcTemplate, int factoryMaintenanceId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "factory_maintenance");
    if (!readableTable(columns, "factory_maintenance_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "factoryMaintenanceId错误");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT fm.*, f.factory_name, p.park_name
            FROM factory_maintenance fm
            LEFT JOIN factory f ON f.factory_id = fm.factory_id
            LEFT JOIN park p ON p.park_id = fm.park_id
            WHERE fm.factory_maintenance_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> factoryMaintMap(rs),
            factoryMaintenanceId);
    return authorizedDetail(rows, authorizedParkIds, "factoryMaintenanceId错误");
  }

  /** 新增厂房维护记录；只处理 factory_maintenance 主表字段。 */
  public Map<String, Object> createFactoryMaint(
      JdbcTemplate jdbcTemplate,
      MaintenanceFactoryMaintUpdateRequest request,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "factory_maintenance");
    if (!readableTable(columns, "factory_maintenance_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "厂房维护表不可用");
    }
    List<Object> args = new ArrayList<>();
    List<String> insertColumns = new ArrayList<>();

    appendStringValue(
        insertColumns, args, columns, "maintenance_item", request == null ? null : request.maintenanceItem());
    appendStringValue(
        insertColumns,
        args,
        columns,
        "maintenance_status",
        request == null ? null : request.maintenanceStatus());
    appendStringValue(
        insertColumns,
        args,
        columns,
        "person_in_charge",
        request == null ? null : request.personInCharge());
    appendStringValue(insertColumns, args, columns, "remark", request == null ? null : request.remark());
    appendTimestampValue(
        insertColumns, args, columns, "start_time", request == null ? null : request.startTime());
    appendTimestampValue(
        insertColumns, args, columns, "end_time", request == null ? null : request.endTime());
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerValue(
        insertColumns,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    int factoryMaintenanceId =
        insertAndReturnId(
            jdbcTemplate, "factory_maintenance", "factory_maintenance_id", insertColumns, args);
    return findFactoryMaintDetail(jdbcTemplate, factoryMaintenanceId, authorizedParkIds);
  }

  /** 更新厂房维护记录；字段白名单限定在 factory_maintenance 主表。 */
  public Map<String, Object> updateFactoryMaint(
      JdbcTemplate jdbcTemplate,
      int factoryMaintenanceId,
      MaintenanceFactoryMaintUpdateRequest request,
      List<Integer> authorizedParkIds) {
    findFactoryMaintDetail(jdbcTemplate, factoryMaintenanceId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "factory_maintenance");
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();

    appendStringAssignment(
        assignments, args, columns, "maintenance_item", request == null ? null : request.maintenanceItem());
    appendStringAssignment(
        assignments, args, columns, "maintenance_status", request == null ? null : request.maintenanceStatus());
    appendStringAssignment(
        assignments, args, columns, "person_in_charge", request == null ? null : request.personInCharge());
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    appendTimestampAssignment(
        assignments, args, columns, "start_time", request == null ? null : request.startTime());
    appendTimestampAssignment(
        assignments, args, columns, "end_time", request == null ? null : request.endTime());
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "factory_id",
        request == null ? null : request.factoryId(),
        null);
    appendIntegerAssignment(
        assignments,
        args,
        columns,
        "park_id",
        request == null ? null : request.parkId(),
        authorizedParkIds);

    updateById(
        jdbcTemplate,
        "factory_maintenance",
        "factory_maintenance_id",
        factoryMaintenanceId,
        columns,
        assignments,
        args);
    return findFactoryMaintDetail(jdbcTemplate, factoryMaintenanceId, authorizedParkIds);
  }

  /** 删除厂房维护记录，返回删除前快照以兼容旧 Prisma delete 返回值。 */
  public Map<String, Object> deleteFactoryMaint(
      JdbcTemplate jdbcTemplate, int factoryMaintenanceId, List<Integer> authorizedParkIds) {
    Map<String, Object> detail =
        findFactoryMaintDetail(jdbcTemplate, factoryMaintenanceId, authorizedParkIds);
    jdbcTemplate.update(
        "DELETE FROM factory_maintenance WHERE factory_maintenance_id = ?", factoryMaintenanceId);
    return detail;
  }

  /** 查询报修工单列表；严格对齐旧接口的园区、状态和提交时间筛选。 */
  public PageResult<Map<String, Object>> findRepairOrderPage(
      JdbcTemplate jdbcTemplate, MaintenanceRepairOrderQuery query, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "repair_order");
    if (!readableTable(columns, "repair_order_id")) {
      return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder(buildRepairOrderParkWhere("ro", query, authorizedParkIds, args));
    appendIntegerEquals(where, args, columns, "ro", "factory_id", query.factoryId());
    appendLike(where, args, columns, "ro", "tenant_name", query.tenantName());
    appendEquals(where, args, columns, "ro", "repair_type", query.repairType());
    appendEquals(where, args, columns, "ro", "status", query.status());
    appendEquals(where, args, columns, "ro", "priority", query.priority());
    appendLike(where, args, columns, "ro", "assignee", query.assignee());
    appendLike(where, args, columns, "ro", "order_no", query.orderNo());
    appendDateRange(where, args, columns, "ro", "create_time", query.startTime(), query.endTime());

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM repair_order ro " + where, Long.class, args.toArray());
    List<Object> pageArgs = repairOrderPageArgs(args, query);
    String orderBy =
        columns.contains("create_time") ? "ORDER BY ro.create_time DESC" : "ORDER BY ro.repair_order_id DESC";
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            """
            SELECT ro.*, f.factory_name, p.park_name
            FROM repair_order ro
            LEFT JOIN factory f ON f.factory_id = ro.factory_id
            LEFT JOIN park p ON p.park_id = ro.park_id
            """
                + where
                + "\n"
                + orderBy
                + """
                LIMIT ?, ?
                """,
            (rs, rowNum) -> repairOrderMap(rs),
            pageArgs.toArray());
    return new PageResult<>(
        items, total == null ? 0 : total, query.currentPage(), query.pageSize());
  }

  /** 查询报修工单详情；返回前按当前用户授权园区兜底校验。 */
  public Map<String, Object> findRepairOrderDetail(
      JdbcTemplate jdbcTemplate, int repairOrderId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "repair_order");
    if (!readableTable(columns, "repair_order_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报修工单不存在");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT ro.*, f.factory_name, p.park_name
            FROM repair_order ro
            LEFT JOIN factory f ON f.factory_id = ro.factory_id
            LEFT JOIN park p ON p.park_id = ro.park_id
            WHERE ro.repair_order_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> repairOrderMap(rs),
            repairOrderId);
    return authorizedDetail(rows, authorizedParkIds, "报修工单不存在");
  }

  /** 新增报修工单；只写 repair_order 主表，不触发短信、企微或派单 worker。 */
  public Map<String, Object> createRepairOrder(
      JdbcTemplate jdbcTemplate,
      MaintenanceRepairOrderRequest request,
      List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "repair_order");
    if (!readableTable(columns, "repair_order_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报修工单表不可用");
    }

    Integer parkId = resolveRepairOrderParkId(request, authorizedParkIds);
    List<Object> args = new ArrayList<>();
    List<String> insertColumns = new ArrayList<>();

    if (columns.contains("order_no")) {
      appendTextValue(
          insertColumns,
          args,
          columns,
          "order_no",
          textWithFallback(request == null ? null : request.orderNo(), nextRepairOrderNo(jdbcTemplate)));
    }
    appendTextValue(
        insertColumns,
        args,
        columns,
        "source",
        textWithFallback(request == null ? null : request.source(), "物业代报修"));
    appendOptionalIntegerValue(
        insertColumns, args, columns, "tenant_id", request == null ? null : request.tenantId());
    appendNullableTextValue(
        insertColumns, args, columns, "tenant_name", request == null ? null : request.tenantName());
    appendNullableTextValue(
        insertColumns, args, columns, "tenant_phone", request == null ? null : request.tenantPhone());
    appendTextValue(
        insertColumns,
        args,
        columns,
        "repair_type",
        textWithFallback(request == null ? null : request.repairType(), ""));
    appendTextValue(
        insertColumns,
        args,
        columns,
        "description",
        textWithFallback(request == null ? null : request.description(), ""));
    appendJsonTextValue(insertColumns, args, columns, "images", request == null ? null : request.images());
    appendTextValue(
        insertColumns,
        args,
        columns,
        "status",
        textWithFallback(request == null ? null : request.status(), "待接单"));
    appendTextValue(
        insertColumns,
        args,
        columns,
        "priority",
        textWithFallback(request == null ? null : request.priority(), "普通"));
    appendNullableTextValue(
        insertColumns, args, columns, "assignee", request == null ? null : request.assignee());
    appendNullableTextValue(
        insertColumns,
        args,
        columns,
        "assignee_phone",
        request == null ? null : request.assigneePhone());
    appendJsonTextValue(
        insertColumns, args, columns, "process_images", request == null ? null : request.processImages());
    appendNullableTextValue(
        insertColumns,
        args,
        columns,
        "process_remark",
        request == null ? null : request.processRemark());
    appendOptionalTimestampValue(
        insertColumns, args, columns, "accept_time", request == null ? null : request.acceptTime());
    appendOptionalTimestampValue(
        insertColumns, args, columns, "finish_time", request == null ? null : request.finishTime());
    appendOptionalTimestampValue(
        insertColumns, args, columns, "confirm_time", request == null ? null : request.confirmTime());
    appendOptionalIntegerValue(
        insertColumns, args, columns, "factory_id", request == null ? null : request.factoryId());
    appendTextValue(insertColumns, args, columns, "park_id", parkId);

    int repairOrderId =
        insertAndReturnId(jdbcTemplate, "repair_order", "repair_order_id", insertColumns, args);
    return findRepairOrderDetail(jdbcTemplate, repairOrderId, authorizedParkIds);
  }

  /** 更新报修工单；旧端直接透传 body，这里收敛为 repair_order 主表字段白名单。 */
  public Map<String, Object> updateRepairOrder(
      JdbcTemplate jdbcTemplate,
      int repairOrderId,
      MaintenanceRepairOrderRequest request,
      List<Integer> authorizedParkIds) {
    findRepairOrderWriteDetail(jdbcTemplate, repairOrderId, authorizedParkIds);
    Set<String> columns = columnSet(jdbcTemplate, "repair_order");
    List<Object> args = new ArrayList<>();
    List<String> assignments = new ArrayList<>();

    appendTextAssignment(assignments, args, columns, "order_no", request == null ? null : request.orderNo());
    appendTextAssignment(assignments, args, columns, "source", request == null ? null : request.source());
    appendNullableIntegerAssignment(
        assignments, args, columns, "tenant_id", request == null ? null : request.tenantId());
    appendNullableTextAssignment(
        assignments, args, columns, "tenant_name", request == null ? null : request.tenantName());
    appendNullableTextAssignment(
        assignments, args, columns, "tenant_phone", request == null ? null : request.tenantPhone());
    appendTextAssignment(
        assignments, args, columns, "repair_type", request == null ? null : request.repairType());
    appendTextAssignment(
        assignments, args, columns, "description", request == null ? null : request.description());
    appendJsonTextAssignment(assignments, args, columns, "images", request == null ? null : request.images());
    appendTextAssignment(assignments, args, columns, "status", request == null ? null : request.status());
    appendTextAssignment(assignments, args, columns, "priority", request == null ? null : request.priority());
    appendNullableTextAssignment(
        assignments, args, columns, "assignee", request == null ? null : request.assignee());
    appendNullableTextAssignment(
        assignments,
        args,
        columns,
        "assignee_phone",
        request == null ? null : request.assigneePhone());
    appendJsonTextAssignment(
        assignments, args, columns, "process_images", request == null ? null : request.processImages());
    appendNullableTextAssignment(
        assignments,
        args,
        columns,
        "process_remark",
        request == null ? null : request.processRemark());
    appendNullableTimestampAssignment(
        assignments, args, columns, "accept_time", request == null ? null : request.acceptTime());
    appendNullableTimestampAssignment(
        assignments, args, columns, "finish_time", request == null ? null : request.finishTime());
    appendNullableTimestampAssignment(
        assignments, args, columns, "confirm_time", request == null ? null : request.confirmTime());
    appendNullableIntegerAssignment(
        assignments, args, columns, "factory_id", request == null ? null : request.factoryId());
    appendWritableParkAssignment(
        assignments, args, columns, request == null ? null : request.parkId(), authorizedParkIds);

    updateById(jdbcTemplate, "repair_order", "repair_order_id", repairOrderId, columns, assignments, args);
    return findRepairOrderDetail(jdbcTemplate, repairOrderId, authorizedParkIds);
  }

  /** 删除报修工单，返回删除前快照以兼容旧 Prisma delete 返回值。 */
  public Map<String, Object> deleteRepairOrder(
      JdbcTemplate jdbcTemplate, int repairOrderId, List<Integer> authorizedParkIds) {
    Map<String, Object> detail = findRepairOrderWriteDetail(jdbcTemplate, repairOrderId, authorizedParkIds);
    jdbcTemplate.update("DELETE FROM repair_order WHERE repair_order_id = ?", repairOrderId);
    return detail;
  }

  private String buildRepairOrderParkWhere(
      String alias,
      MaintenanceRepairOrderQuery query,
      List<Integer> authorizedParkIds,
      List<Object> args) {
    // 旧 repair-order 列表在 parkId/currentPark 同传时以 currentPark 为准。
    return buildParkWhere(alias, query.currentPark(), query.parkId(), authorizedParkIds, args);
  }

  private Map<String, Object> findRepairOrderWriteDetail(
      JdbcTemplate jdbcTemplate, int repairOrderId, List<Integer> authorizedParkIds) {
    Set<String> columns = columnSet(jdbcTemplate, "repair_order");
    if (!readableTable(columns, "repair_order_id")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报修工单不存在");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT ro.*, f.factory_name, p.park_name
            FROM repair_order ro
            LEFT JOIN factory f ON f.factory_id = ro.factory_id
            LEFT JOIN park p ON p.park_id = ro.park_id
            WHERE ro.repair_order_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> repairOrderMap(rs),
            repairOrderId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "报修工单不存在");
    }
    Map<String, Object> row = rows.get(0);
    Object rawParkId = row.get("parkId");
    if (rawParkId instanceof Number number && !authorizedParkIds.contains(number.intValue())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    return row;
  }

  private List<Object> repairOrderPageArgs(List<Object> args, MaintenanceRepairOrderQuery query) {
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    return pageArgs;
  }

  private Integer resolveRepairOrderParkId(
      MaintenanceRepairOrderRequest request, List<Integer> authorizedParkIds) {
    Object rawParkId = request == null ? null : request.parkId();
    if (!hasTextValue(rawParkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    Integer parkId = toInteger(rawParkId, "park_id参数错误");
    if (!authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    return parkId;
  }

  private String nextRepairOrderNo(JdbcTemplate jdbcTemplate) {
    String prefix = "RO" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM repair_order WHERE order_no LIKE ?", Long.class, prefix + "%");
    int sequence = (count == null ? 0 : count.intValue()) + 1;
    return prefix + String.format("%04d", sequence);
  }

  private void appendTextValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(value);
    }
  }

  private void appendNullableTextValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(nullableText(value));
    }
  }

  private void appendJsonTextValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(toJsonText(value));
    }
  }

  private void appendTextAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
      args.add(textWithFallback(value, ""));
    }
  }

  private void appendNullableTextAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
      args.add(nullableText(value));
    }
  }

  private void appendJsonTextAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
      args.add(toJsonText(value));
    }
  }

  private void appendNullableIntegerAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(hasTextValue(value) ? toInteger(value, columnName + "参数错误") : null);
  }

  private void appendNullableTimestampAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value == null || !columns.contains(columnName)) {
      return;
    }
    assignments.add(columnName + " = ?");
    args.add(hasTextValue(value) ? toTimestamp(value, columnName + "参数错误") : null);
  }

  private void appendWritableParkAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      Object value,
      List<Integer> authorizedParkIds) {
    if (value == null || !hasTextValue(value) || !columns.contains("park_id")) {
      return;
    }
    Integer parkId = toInteger(value, "park_id参数错误");
    if (!authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
    assignments.add("park_id = ?");
    args.add(parkId);
  }

  private void appendOptionalIntegerValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (hasTextValue(value)) {
      appendIntegerValue(insertColumns, args, columns, columnName, value, null);
    }
  }

  private void appendOptionalTimestampValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (hasTextValue(value) && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(toTimestamp(value, columnName + "参数错误"));
    }
  }

  private boolean hasTextValue(Object value) {
    return value != null && StringUtils.hasText(String.valueOf(value));
  }

  private String nullableText(Object value) {
    String text = value == null ? "" : String.valueOf(value).trim();
    return StringUtils.hasText(text) ? text : null;
  }

  private String textWithFallback(Object value, String fallback) {
    String text = nullableText(value);
    return text == null ? fallback : text;
  }

  private String toJsonText(Object value) {
    if (value instanceof String text) {
      return nullableText(text);
    }
    try {
      return OBJECT_MAPPER.writeValueAsString(value);
    } catch (JsonProcessingException error) {
      return nullableText(value);
    }
  }

  private String buildParkWhere(
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

  private void appendStringAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
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

  private void appendDecimalAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
      args.add(toBigDecimal(value, columnName + "参数错误"));
    }
  }

  private void appendTimestampAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      assignments.add(columnName + " = ?");
      args.add(toTimestamp(value, columnName + "参数错误"));
    }
  }

  private void appendStringValue(
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

  private void appendIntegerValue(
      List<String> insertColumns,
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
    insertColumns.add(columnName);
    args.add(integerValue);
  }

  private void appendDecimalValue(
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

  private void appendTimestampValue(
      List<String> insertColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (value != null && columns.contains(columnName)) {
      insertColumns.add(columnName);
      args.add(toTimestamp(value, columnName + "参数错误"));
    }
  }

  private int insertAndReturnId(
      JdbcTemplate jdbcTemplate,
      String tableName,
      String idColumn,
      List<String> insertColumns,
      List<Object> args) {
    if (insertColumns.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供需要新增的数据");
    }
    KeyHolder keyHolder = new GeneratedKeyHolder();
    String sql =
        "INSERT INTO "
            + tableName
            + " ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")";
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
    Integer fallbackId =
        jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (fallbackId == null || fallbackId <= 0) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, idColumn + "生成失败");
    }
    return fallbackId;
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
    if (value instanceof BigDecimal number) {
      return number;
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

  private Timestamp toTimestamp(Object value, String message) {
    if (value instanceof Timestamp timestamp) {
      return timestamp;
    }
    if (value instanceof java.util.Date date) {
      return new Timestamp(date.getTime());
    }
    String text = String.valueOf(value).trim();
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (DateTimeParseException ignored) {
      // Continue with local date-time formats used by the old frontend.
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
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private void appendLike(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String alias,
      String column,
      String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND ").append(alias).append(".").append(column).append(" LIKE ?");
      args.add("%" + value.trim() + "%");
    }
  }

  private void appendEquals(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String alias,
      String column,
      String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND ").append(alias).append(".").append(column).append(" = ?");
      args.add(value.trim());
    }
  }

  private void appendIntegerEquals(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String alias,
      String column,
      Integer value) {
    if (columns.contains(column) && value != null && value > 0) {
      where.append(" AND ").append(alias).append(".").append(column).append(" = ?");
      args.add(value);
    }
  }

  private void appendDecimalLike(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String alias,
      String column,
      String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND CAST(").append(alias).append(".").append(column).append(" AS CHAR) LIKE ?");
      args.add("%" + value.trim() + "%");
    }
  }

  private void appendDateRange(
      StringBuilder where,
      List<Object> args,
      Set<String> columns,
      String alias,
      String column,
      String start,
      String end) {
    if (!columns.contains(column)) {
      return;
    }
    if (StringUtils.hasText(start)) {
      where.append(" AND ").append(alias).append(".").append(column).append(" >= ?");
      args.add(normalizeRangeBoundary(start, false));
    }
    if (StringUtils.hasText(end)) {
      where.append(" AND ").append(alias).append(".").append(column).append(" <= ?");
      args.add(normalizeRangeBoundary(end, true));
    }
  }

  private String normalizeRangeBoundary(String value, boolean endOfDay) {
    String trimmed = value.trim();
    if (trimmed.contains(" ") || trimmed.contains("T")) {
      return trimmed;
    }
    return trimmed + (endOfDay ? " 23:59:59" : " 00:00:00");
  }

  private List<Object> pageArgs(List<Object> args, MaintenanceListQuery query) {
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    return pageArgs;
  }

  private PageResult<Map<String, Object>> emptyPage(MaintenanceListQuery query) {
    return new PageResult<>(List.of(), 0, query.currentPage(), query.pageSize());
  }

  private boolean readableTable(Set<String> columns, String idColumn) {
    return columns.contains(idColumn) && columns.contains("park_id");
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

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private Map<String, Object> elevatorMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("elevatorId", rs.getInt("elevator_id"));
    map.put("name", safeString(rs, "name"));
    map.put("status", safeString(rs, "status"));
    map.put("area", safeObject(rs, "area"));
    map.put("brand", safeString(rs, "brand"));
    map.put("size", safeString(rs, "size"));
    map.put("loadCapacity", safeBigDecimal(rs, "load_capacity"));
    map.put("productionDate", toIso(safeTimestamp(rs, "production_date")));
    map.put("checker", defaultString(safeString(rs, "checker")));
    map.put("checkTime", toIso(safeTimestamp(rs, "check_time")));
    map.put("remark", safeString(rs, "remark"));
    appendCommonRelationFields(map, rs);
    return map;
  }

  private Map<String, Object> firefightingMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("firefightingId", rs.getInt("firefighting_id"));
    map.put("address", safeString(rs, "address"));
    map.put("firefightingName", safeString(rs, "firefighting_name"));
    map.put("extinguisher", safeString(rs, "extinguisher"));
    map.put("hydrant", safeString(rs, "hydrant"));
    map.put("fireExit", safeString(rs, "fire_exit"));
    map.put("checker", defaultString(safeString(rs, "checker")));
    map.put("checkTime", toIso(safeTimestamp(rs, "check_time")));
    map.put("remark", safeString(rs, "remark"));
    map.put("imgUrl", safeString(rs, "img_url"));
    appendCommonRelationFields(map, rs);
    return map;
  }

  private Map<String, Object> transformerMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    String transformerName = safeString(rs, "transformer_name");
    map.put("transformerId", rs.getInt("transformer_id"));
    map.put("transformerName", transformerName);
    map.put("title", transformerName);
    map.put("address", safeString(rs, "address"));
    map.put("contact", safeString(rs, "contact"));
    map.put("checker", defaultString(safeString(rs, "checker")));
    map.put("status", safeString(rs, "status"));
    map.put("specifications", safeString(rs, "specifications"));
    map.put("checkTime", toIso(safeTimestamp(rs, "check_time")));
    map.put("remark", safeString(rs, "remark"));
    map.put("imgUrl", safeString(rs, "img_url"));
    appendCommonRelationFields(map, rs);
    return map;
  }

  private Map<String, Object> hygieneCheckMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("hygieneCheckId", rs.getInt("hygiene_check_id"));
    map.put("checkItems", safeString(rs, "check_items"));
    map.put("checker", defaultString(safeString(rs, "checker")));
    map.put("checkDate", toIso(safeTimestamp(rs, "check_date")));
    map.put("checkResult", safeString(rs, "check_result"));
    map.put("remark", safeString(rs, "remark"));
    appendCommonRelationFields(map, rs);
    return map;
  }

  private Map<String, Object> factoryMaintMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("factoryMaintenanceId", rs.getInt("factory_maintenance_id"));
    map.put("maintenanceItem", safeString(rs, "maintenance_item"));
    map.put("maintenanceStatus", safeString(rs, "maintenance_status"));
    map.put("personInCharge", defaultString(safeString(rs, "person_in_charge")));
    map.put("startTime", toIso(safeTimestamp(rs, "start_time")));
    map.put("endTime", toIso(safeTimestamp(rs, "end_time")));
    map.put("remark", safeString(rs, "remark"));
    appendCommonRelationFields(map, rs);
    return map;
  }

  private Map<String, Object> repairOrderMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("repairOrderId", rs.getInt("repair_order_id"));
    map.put("orderNo", safeString(rs, "order_no"));
    map.put("source", safeString(rs, "source"));
    map.put("tenantId", safeInteger(rs, "tenant_id"));
    map.put("tenantName", safeString(rs, "tenant_name"));
    map.put("tenantPhone", safeString(rs, "tenant_phone"));
    map.put("repairType", safeString(rs, "repair_type"));
    map.put("description", safeString(rs, "description"));
    map.put("images", safeString(rs, "images"));
    map.put("status", safeString(rs, "status"));
    map.put("priority", safeString(rs, "priority"));
    map.put("assignee", safeString(rs, "assignee"));
    map.put("assigneePhone", safeString(rs, "assignee_phone"));
    map.put("processImages", safeString(rs, "process_images"));
    map.put("processRemark", safeString(rs, "process_remark"));
    map.put("acceptTime", toIso(safeTimestamp(rs, "accept_time")));
    map.put("finishTime", toIso(safeTimestamp(rs, "finish_time")));
    map.put("confirmTime", toIso(safeTimestamp(rs, "confirm_time")));
    appendCommonRelationFields(map, rs);
    return map;
  }

  private void appendCommonRelationFields(Map<String, Object> map, ResultSet rs) throws SQLException {
    String factoryName = defaultString(safeString(rs, "factory_name"));
    String parkName = defaultString(safeString(rs, "park_name"));
    map.put("factoryId", safeInteger(rs, "factory_id"));
    map.put("factory", factoryName);
    map.put("factoryName", factoryName);
    map.put("parkId", safeInteger(rs, "park_id"));
    map.put("park", parkName);
    map.put("parkName", parkName);
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
  }

  private Object safeObject(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getObject(columnName);
    } catch (SQLException error) {
      return null;
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

  private String defaultString(String value) {
    return value == null ? "" : value;
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
