package cn.yizuw.magic.backend.hrm;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.hrm.AttendanceCalculator.AttendanceSchedule;
import cn.yizuw.magic.backend.hrm.AttendanceCalculator.TimeRange;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/**
 * HRM 只读数据访问层。
 *
 * <p>员工和考勤配置表位于租户库，迁移期通过字段检测兼容真实库与 Prisma schema 漂移。
 */
@Repository
public class HrmRepository {

  /** 查询员工分页列表；旧接口默认排除逻辑删除记录。 */
  public EmployeePage findEmployeePage(JdbcTemplate jdbcTemplate, HrmEmployeeQuery query) {
    Set<String> columns = columnSet(jdbcTemplate, "employee");
    if (!columns.contains("employee_id")) {
      return new EmployeePage(List.of(), 0);
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    appendDeletedFilter(where, args, columns, query.isDeleted());
    appendBooleanFilter(where, args, columns, "is_resigned", query.isResigned());
    appendLike(where, args, columns, "name", query.name());
    appendLike(where, args, columns, "phone", query.phone());
    appendLike(where, args, columns, "department", query.department());
    appendLike(where, args, columns, "id_number", query.idNumber());
    appendEquals(where, args, columns, "gender", query.gender());
    appendEquals(where, args, columns, "education", query.education());
    appendHireDateRange(where, args, columns, query.hireDateStart(), query.hireDateEnd());

    Long total =
        jdbcTemplate.queryForObject("SELECT COUNT(*) FROM employee " + where, Long.class, args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> employees =
        jdbcTemplate.query(
            "SELECT * FROM employee "
                + where
                + " ORDER BY create_time DESC LIMIT ?, ?",
            (rs, rowNum) -> employeeMap(rs, columns),
            pageArgs.toArray());
    return new EmployeePage(employees, total == null ? 0 : total);
  }

  /** 查询员工详情。 */
  public Map<String, Object> findEmployeeById(JdbcTemplate jdbcTemplate, int employeeId) {
    Set<String> columns = columnSet(jdbcTemplate, "employee");
    if (!columns.contains("employee_id")) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT * FROM employee WHERE employee_id = ? LIMIT 1",
            (rs, rowNum) -> employeeMap(rs, columns),
            employeeId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 软删除员工；旧接口在 leaveDate 为空时写入当前时间。 */
  public Map<String, Object> softDeleteEmployee(JdbcTemplate jdbcTemplate, int employeeId) {
    Map<String, Object> existingEmployee = findEmployeeById(jdbcTemplate, employeeId);
    if (existingEmployee == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "员工不存在");
    }
    Set<String> columns = columnSet(jdbcTemplate, "employee");
    List<String> assignments = new ArrayList<>();
    if (columns.contains("is_deleted")) {
      assignments.add("is_deleted = true");
    }
    if (columns.contains("leave_date") && existingEmployee.get("leaveDate") == null) {
      assignments.add("leave_date = CURRENT_TIMESTAMP");
    }
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "员工表缺少删除标记字段");
    }
    jdbcTemplate.update(
        "UPDATE employee SET " + String.join(", ", assignments) + " WHERE employee_id = ?",
        employeeId);
    Map<String, Object> deletedEmployee = findEmployeeById(jdbcTemplate, employeeId);
    if (deletedEmployee == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "员工不存在");
    }
    return deletedEmployee;
  }

  /** 更新员工主表字段；不触发中心库账号生命周期、组织角色同步或考勤重算。 */
  public Map<String, Object> updateEmployee(
      JdbcTemplate jdbcTemplate,
      int employeeId,
      HrmEmployeeUpdateRequest request,
      String customerId) {
    Map<String, Object> existingEmployee = findEmployeeById(jdbcTemplate, employeeId);
    if (existingEmployee == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "员工不存在");
    }
    Set<String> columns = columnSet(jdbcTemplate, "employee");
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();

    Object nextIdNumber = request == null ? null : request.idNumber();
    if (nextIdNumber != null && columns.contains("id_number")) {
      String idNumber = blankToNull(nextIdNumber);
      if (StringUtils.hasText(idNumber)
          && !idNumber.equals(String.valueOf(existingEmployee.getOrDefault("idNumber", "")))
          && employeeIdNumberExists(jdbcTemplate, idNumber, employeeId)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "该身份证号已存在");
      }
      assignments.add("id_number = ?");
      args.add(idNumber);
    }

    if (request != null && request.userId() != null && columns.contains("user_id")) {
      Integer userId = normalizeEmployeeUserId(request.userId());
      ensureEmployeeBindingUserAvailable(jdbcTemplate, userId, employeeId, customerId);
      assignments.add("user_id = ?");
      args.add(userId);
    }

    appendStringAssignment(assignments, args, columns, "name", request == null ? null : request.name());
    appendStringAssignment(assignments, args, columns, "gender", request == null ? null : request.gender());
    appendStringAssignment(assignments, args, columns, "phone", request == null ? null : request.phone());
    appendIntegerAssignment(assignments, args, columns, "age", request == null ? null : request.age(), "age参数错误");
    appendStringAssignment(assignments, args, columns, "address", request == null ? null : request.address());
    appendStringAssignment(assignments, args, columns, "education", request == null ? null : request.education());
    appendStringAssignment(assignments, args, columns, "department", request == null ? null : request.department());
    appendTimestampAssignment(
        assignments, args, columns, "hire_date", request == null ? null : request.hireDate(), "hireDate参数错误");
    appendStringAssignment(assignments, args, columns, "remark", request == null ? null : request.remark());
    if (request != null && request.isResigned() != null && columns.contains("is_resigned")) {
      boolean resigned = booleanValue(request.isResigned());
      assignments.add("is_resigned = ?");
      args.add(resigned);
      if (columns.contains("leave_date")) {
        if (resigned && request.leaveDate() != null) {
          assignments.add("leave_date = ?");
          args.add(nullableTimestamp(request.leaveDate(), "leaveDate参数错误"));
        } else if (!resigned) {
          assignments.add("leave_date = ?");
          args.add(null);
        }
      }
    } else {
      appendTimestampAssignment(
          assignments, args, columns, "leave_date", request == null ? null : request.leaveDate(), "leaveDate参数错误");
    }
    appendTimeAssignment(
        assignments, args, columns, "check_in", request == null ? null : request.checkIn(), "checkIn参数错误");
    appendTimeAssignment(
        assignments, args, columns, "check_out", request == null ? null : request.checkOut(), "checkOut参数错误");

    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供要更新的字段");
    }
    if (columns.contains("update_time")) {
      assignments.add("update_time = CURRENT_TIMESTAMP");
    }
    args.add(employeeId);
    jdbcTemplate.update(
        "UPDATE employee SET " + String.join(", ", assignments) + " WHERE employee_id = ?",
        args.toArray());
    Map<String, Object> updated = findEmployeeById(jdbcTemplate, employeeId);
    if (updated == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "员工不存在");
    }
    return updated;
  }

  /** 新增员工主表记录；保持旧接口必填校验、年龄校验、身份证唯一性和账号绑定占用校验。 */
  public Map<String, Object> createEmployee(
      JdbcTemplate jdbcTemplate, HrmEmployeeCreateRequest request, String customerId) {
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "姓名、性别和电话是必填项");
    }
    Set<String> columns = columnSet(jdbcTemplate, "employee");
    if (!columns.containsAll(Set.of("employee_id", "name", "gender", "phone"))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "员工表结构不完整");
    }

    String name = blankToNull(request.name());
    String gender = blankToNull(request.gender());
    String phone = blankToNull(request.phone());
    if (!StringUtils.hasText(name) || !StringUtils.hasText(gender) || !StringUtils.hasText(phone)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "姓名、性别和电话是必填项");
    }

    Integer userId = normalizeEmployeeUserId(request.userId());
    ensureEmployeeBindingUserAvailable(jdbcTemplate, userId, 0, customerId);
    String idNumber = blankToNull(request.idNumber());
    if (StringUtils.hasText(idNumber) && employeeIdNumberExists(jdbcTemplate, idNumber, 0)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "该身份证号已存在");
    }

    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    insertColumns.add(quote("name"));
    args.add(name);
    insertColumns.add(quote("gender"));
    args.add(gender);
    insertColumns.add(quote("phone"));
    args.add(phone);
    appendIntegerValue(insertColumns, args, columns, "user_id", userId, "userId参数错误");
    appendStringValue(insertColumns, args, columns, "id_number", idNumber);
    appendStringValue(insertColumns, args, columns, "department", request.department());
    appendIntegerValue(insertColumns, args, columns, "age", request.age(), "年龄必须是一个有效的数字");
    appendStringValue(insertColumns, args, columns, "education", request.education());
    appendTimestampValue(insertColumns, args, columns, "hire_date", request.hireDate(), "hireDate参数错误");
    appendStringValue(insertColumns, args, columns, "address", request.address());
    appendStringValue(insertColumns, args, columns, "remark", request.remark());
    boolean resigned = booleanValue(request.isResigned());
    if (columns.contains("is_resigned")) {
      insertColumns.add(quote("is_resigned"));
      args.add(resigned);
    }
    if (columns.contains("is_deleted")) {
      insertColumns.add(quote("is_deleted"));
      args.add(request.isDeleted() == null ? false : booleanValue(request.isDeleted()));
    }
    if (columns.contains("leave_date")) {
      insertColumns.add(quote("leave_date"));
      args.add(resigned && request.leaveDate() != null ? nullableTimestamp(request.leaveDate(), "leaveDate参数错误") : null);
    }
    appendTimeValue(insertColumns, args, columns, "check_in", request.checkIn(), "checkIn参数错误");
    appendTimeValue(insertColumns, args, columns, "check_out", request.checkOut(), "checkOut参数错误");
    if (columns.contains("create_time")) {
      insertColumns.add(quote("create_time"));
      args.add(Timestamp.from(Instant.now()));
    }
    if (columns.contains("update_time")) {
      insertColumns.add(quote("update_time"));
      args.add(Timestamp.from(Instant.now()));
    }

    jdbcTemplate.update(
        "INSERT INTO employee ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer employeeId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (employeeId == null || employeeId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建员工失败");
    }
    Map<String, Object> created = findEmployeeById(jdbcTemplate, employeeId);
    if (created == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建员工失败");
    }
    return created;
  }

  /** 查询当前登录账号绑定的员工，用于考勤时间配置。 */
  public Map<String, Object> findEmployeeByUserId(JdbcTemplate jdbcTemplate, int userId) {
    Set<String> columns = columnSet(jdbcTemplate, "employee");
    if (!columns.containsAll(Set.of("employee_id", "user_id"))) {
      return null;
    }
    String deletedFilter = columns.contains("is_deleted") ? " AND is_deleted = false" : "";
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT *
            FROM employee
            WHERE user_id = ?
            """
                + deletedFilter
                + """
            ORDER BY create_time DESC
            LIMIT 1
            """,
            (rs, rowNum) -> employeeMap(rs, columns),
            userId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 查询员工绑定账号信息，用于列表和详情补充旧接口字段。 */
  public Map<Integer, Map<String, Object>> findAccountsByUserIds(
      JdbcTemplate jdbcTemplate, String customerId, List<Integer> userIds) {
    List<Integer> ids = positiveUniqueIds(userIds);
    if (ids.isEmpty() || !hasColumns(jdbcTemplate, "user", "id", "username", "real_name", "phone")) {
      return Map.of();
    }

    List<Object> args = new ArrayList<>();
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT id, username, real_name, phone
            FROM user
            WHERE id IN (
            """
                + placeholders(ids.size())
                + """
            )
            """);
    args.addAll(ids);
    if (hasColumn(jdbcTemplate, "user", "customer_type") && StringUtils.hasText(customerId)) {
      sql.append(" AND customer_type = ?");
      args.add(customerId);
    }
    sql.append(" ORDER BY real_name ASC, username ASC");

    Map<Integer, Map<String, Object>> result = new LinkedHashMap<>();
    jdbcTemplate.query(
        sql.toString(),
        rs -> {
          int id = rs.getInt("id");
          result.put(id, accountInfoMap(rs));
        },
        args.toArray());
    return result;
  }

  /** 查询已被其他员工占用的账号 ID。 */
  public List<Integer> findOccupiedEmployeeUserIds(JdbcTemplate jdbcTemplate, Integer employeeId) {
    if (!hasColumns(jdbcTemplate, "employee", "employee_id", "user_id", "is_deleted")) {
      return List.of();
    }
    List<Object> args = new ArrayList<>();
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT user_id
            FROM employee
            WHERE is_deleted = false
              AND user_id IS NOT NULL
            """);
    if (employeeId != null && employeeId > 0) {
      sql.append(" AND employee_id <> ?");
      args.add(employeeId);
    }
    return jdbcTemplate.queryForList(sql.toString(), Integer.class, args.toArray()).stream()
        .filter(id -> id != null && id > 0)
        .distinct()
        .toList();
  }

  /** 查询可绑定账号候选，排除已被其他员工占用的账号。 */
  public List<Map<String, Object>> findBindableAccounts(
      JdbcTemplate jdbcTemplate,
      String customerId,
      List<Integer> occupiedUserIds,
      String keyword,
      int limit) {
    if (!hasColumns(jdbcTemplate, "user", "id", "username", "real_name", "phone")) {
      return List.of();
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    if (hasColumn(jdbcTemplate, "user", "customer_type") && StringUtils.hasText(customerId)) {
      where.append(" AND customer_type = ?");
      args.add(customerId);
    }
    if (hasColumn(jdbcTemplate, "user", "status")) {
      where.append(" AND (status IS NULL OR status <> 2)");
    }
    List<Integer> occupiedIds = positiveUniqueIds(occupiedUserIds);
    if (!occupiedIds.isEmpty()) {
      where.append(" AND id NOT IN (").append(placeholders(occupiedIds.size())).append(")");
      args.addAll(occupiedIds);
    }
    if (StringUtils.hasText(keyword)) {
      where.append(" AND (phone LIKE ? OR real_name LIKE ? OR username LIKE ?)");
      String like = "%" + keyword.trim() + "%";
      args.add(like);
      args.add(like);
      args.add(like);
    }
    args.add(Math.min(Math.max(limit, 1), 100));

    return jdbcTemplate.query(
        """
        SELECT id, username, real_name, phone
        FROM user
        """
            + where
            + """
        ORDER BY real_name ASC, username ASC
        LIMIT ?
        """,
        (rs, rowNum) -> bindableAccountMap(rs),
        args.toArray());
  }

  /** 查询某个账号，员工当前绑定账号不存在于候选时也要补回选项。 */
  public Map<String, Object> findBindableAccountById(JdbcTemplate jdbcTemplate, int userId) {
    if (!hasColumns(jdbcTemplate, "user", "id", "username", "real_name", "phone")) {
      return null;
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            """
            SELECT id, username, real_name, phone
            FROM user
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> bindableAccountMap(rs),
            userId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 查询考勤分页记录，保持旧接口 Super 可按 username 查全部、普通用户只查本人。 */
  public AttendanceRecordPage findAttendancePage(
      JdbcTemplate jdbcTemplate,
      HrmAttendanceQuery query,
      Integer currentUserId,
      boolean superUser) {
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    if (!columns.readable()) {
      return new AttendanceRecordPage(List.of(), 0);
    }
    AttendanceWhere where =
        attendanceWhere(
            columns, query.username(), currentUserId, superUser, query.startDate(), query.endDate());
    if (!where.valid()) {
      return new AttendanceRecordPage(List.of(), 0);
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM attendances " + where.sql(), Long.class, where.args().toArray());
    List<Object> pageArgs = new ArrayList<>(where.args());
    pageArgs.add((query.page() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<AttendanceRecord> records =
        jdbcTemplate.query(
            selectAttendanceSql(columns)
                + " FROM attendances "
                + where.sql()
                + " ORDER BY "
                + quote(columns.punchIn())
                + " DESC LIMIT ?, ?",
            (rs, rowNum) -> attendanceRecordMap(rs),
            pageArgs.toArray());
    return new AttendanceRecordPage(records, total == null ? 0 : total);
  }

  /** 查询今日最新一条考勤记录。 */
  public AttendanceRecord findTodayAttendanceRecord(
      JdbcTemplate jdbcTemplate,
      String username,
      Integer currentUserId,
      boolean superUser,
      LocalDate today) {
    List<AttendanceRecord> records =
        findAttendanceRecordsInRange(
            jdbcTemplate, username, currentUserId, superUser, today.atStartOfDay(), today.plusDays(1).atStartOfDay());
    return records.isEmpty() ? null : records.get(0);
  }

  /** 查询某个时间范围内的考勤记录，统计接口复用该只读方法。 */
  public List<AttendanceRecord> findAttendanceRecordsInRange(
      JdbcTemplate jdbcTemplate,
      String username,
      Integer currentUserId,
      boolean superUser,
      LocalDateTime rangeStart,
      LocalDateTime rangeEnd) {
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    if (!columns.readable()) {
      return List.of();
    }
    AttendanceWhere where =
        attendanceScopeWhere(columns, username, currentUserId, superUser, rangeStart, rangeEnd);
    if (!where.valid()) {
      return List.of();
    }
    return jdbcTemplate.query(
        selectAttendanceSql(columns)
            + " FROM attendances "
            + where.sql()
            + " ORDER BY "
            + quote(columns.punchIn())
            + " DESC",
        (rs, rowNum) -> attendanceRecordMap(rs),
        where.args().toArray());
  }

  /** 查询单条考勤记录；写接口更新前复用该方法确认记录存在。 */
  public AttendanceRecord findAttendanceById(JdbcTemplate jdbcTemplate, int attendanceId) {
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    if (!columns.readable()) {
      return null;
    }
    List<AttendanceRecord> rows =
        jdbcTemplate.query(
            selectAttendanceSql(columns)
                + " FROM attendances WHERE "
                + quote(columns.attendanceId())
                + " = ? LIMIT 1",
            (rs, rowNum) -> attendanceRecordMap(rs),
            attendanceId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** 判断当前用户当天是否已有上班打卡记录。 */
  public boolean existsAttendanceOnDay(
      JdbcTemplate jdbcTemplate, int userId, LocalDate attendanceDay) {
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    if (!columns.readable() || columns.userId() == null) {
      return false;
    }
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM attendances WHERE "
                + quote(columns.userId())
                + " = ? AND "
                + quote(columns.punchIn())
                + " >= ? AND "
                + quote(columns.punchIn())
                + " < ?",
            Long.class,
            userId,
            Timestamp.valueOf(attendanceDay.atStartOfDay()),
            Timestamp.valueOf(attendanceDay.plusDays(1).atStartOfDay()));
    return count != null && count > 0;
  }

  /** 新增上班打卡记录，只写 attendances 主表字段。 */
  public AttendanceRecord createAttendance(
      JdbcTemplate jdbcTemplate,
      LocalDateTime punchIn,
      int status,
      BigDecimal longitude,
      BigDecimal latitude,
      int userId,
      String username) {
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    if (!columns.readable()
        || columns.longitude() == null
        || columns.latitude() == null
        || columns.userId() == null
        || columns.username() == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "考勤表结构不完整");
    }
    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    insertColumns.add(quote(columns.punchIn()));
    args.add(Timestamp.valueOf(punchIn));
    if (columns.status() != null) {
      insertColumns.add(quote(columns.status()));
      args.add(status);
    }
    insertColumns.add(quote(columns.longitude()));
    args.add(longitude);
    insertColumns.add(quote(columns.latitude()));
    args.add(latitude);
    insertColumns.add(quote(columns.userId()));
    args.add(userId);
    insertColumns.add(quote(columns.username()));
    args.add(username);

    jdbcTemplate.update(
        "INSERT INTO attendances ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    AttendanceRecord record = id == null ? null : findAttendanceById(jdbcTemplate, id);
    if (record == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建失败");
    }
    return record;
  }

  /** 更新下班打卡记录，只写 punchOut、坐标和状态字段。 */
  public AttendanceRecord updateAttendancePunchOut(
      JdbcTemplate jdbcTemplate,
      int attendanceId,
      LocalDateTime punchOut,
      int status,
      BigDecimal longitude,
      BigDecimal latitude) {
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    if (!columns.readable()
        || columns.punchOut() == null
        || columns.longitude() == null
        || columns.latitude() == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "考勤表结构不完整");
    }
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    assignments.add(quote(columns.punchOut()) + " = ?");
    args.add(Timestamp.valueOf(punchOut));
    assignments.add(quote(columns.longitude()) + " = ?");
    args.add(longitude);
    assignments.add(quote(columns.latitude()) + " = ?");
    args.add(latitude);
    if (columns.status() != null) {
      assignments.add(quote(columns.status()) + " = ?");
      args.add(status);
    }
    args.add(attendanceId);
    jdbcTemplate.update(
        "UPDATE attendances SET "
            + String.join(", ", assignments)
            + " WHERE "
            + quote(columns.attendanceId())
            + " = ?",
        args.toArray());
    AttendanceRecord updated = findAttendanceById(jdbcTemplate, attendanceId);
    if (updated == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "找不到该打卡记录");
    }
    return updated;
  }

  /** 批量读取员工排班时间，当前先按 employee.user_id 精确匹配。 */
  public Map<Integer, AttendanceSchedule> findAttendanceSchedulesByUserIds(
      JdbcTemplate jdbcTemplate, List<Integer> userIds) {
    List<Integer> ids = positiveUniqueIds(userIds);
    Set<String> columns = columnSet(jdbcTemplate, "employee");
    if (ids.isEmpty() || !columns.containsAll(Set.of("employee_id", "user_id"))) {
      return Map.of();
    }

    String checkInColumn = firstColumn(columns, "check_in", "checkIn", "checkin");
    String checkOutColumn = firstColumn(columns, "check_out", "checkOut", "checkout");
    List<Object> args = new ArrayList<>(ids);
    StringBuilder sql =
        new StringBuilder(
            "SELECT "
                + quote("employee_id")
                + " AS employeeId, "
                + quote("user_id")
                + " AS userId, "
                + selectColumn(checkInColumn, "checkIn")
                + ", "
                + selectColumn(checkOutColumn, "checkOut")
                + " FROM employee WHERE user_id IN ("
                + placeholders(ids.size())
                + ")");
    if (columns.contains("is_deleted")) {
      sql.append(" AND is_deleted = false");
    }
    sql.append(" ORDER BY ");
    sql.append(columns.contains("create_time") ? "create_time DESC" : "employee_id DESC");

    Map<Integer, AttendanceSchedule> result = new LinkedHashMap<>();
    jdbcTemplate.query(
        sql.toString(),
        rs -> {
          Integer userId = objectInteger(rs.getObject("userId"));
          if (userId == null || result.containsKey(userId)) {
            return;
          }
          result.put(
              userId,
              new AttendanceSchedule(
                  objectInteger(rs.getObject("employeeId")),
                  userId,
                  resultLocalTime(rs, "checkIn"),
                  resultLocalTime(rs, "checkOut")));
        },
        args.toArray());
    return result;
  }

  /** 查询指定用户在时间范围内已审批通过的请假区间。 */
  public Map<Integer, List<TimeRange>> findApprovedLeaveRangesByUserIds(
      JdbcTemplate jdbcTemplate,
      List<Integer> userIds,
      LocalDateTime rangeStart,
      LocalDateTime rangeEnd) {
    List<Integer> ids = positiveUniqueIds(userIds);
    LeaveColumns columns = leaveColumns(jdbcTemplate);
    if (ids.isEmpty() || !columns.hasApprovedRangeColumns()) {
      return Map.of();
    }

    List<Object> args = new ArrayList<>();
    args.add(Timestamp.valueOf(rangeStart));
    args.add(Timestamp.valueOf(rangeEnd));
    args.addAll(ids);
    Map<Integer, List<TimeRange>> result = new LinkedHashMap<>();
    jdbcTemplate.query(
        "SELECT "
            + quote(columns.userId())
            + " AS userId, "
            + quote(columns.startDate())
            + " AS startDate, "
            + quote(columns.endDate())
            + " AS endDate FROM leave_application WHERE "
            + quote(columns.status())
            + " = 1 AND "
            + quote(columns.endDate())
            + " > ? AND "
            + quote(columns.startDate())
            + " < ? AND "
            + quote(columns.userId())
            + " IN ("
            + placeholders(ids.size())
            + ")",
        rs -> {
          Integer userId = objectInteger(rs.getObject("userId"));
          TimeRange range = timeRange(rs, "startDate", "endDate");
          if (userId != null && range != null) {
            result.computeIfAbsent(userId, key -> new ArrayList<>()).add(range);
          }
        },
        args.toArray());
    return result;
  }

  /** 查询统计范围内已审批请假，保留旧接口 Super/人事视角的 username/userId 过滤口径。 */
  public List<LeaveRangeRecord> findApprovedLeaveRangesForStats(
      JdbcTemplate jdbcTemplate,
      String username,
      Integer currentUserId,
      boolean superUser,
      LocalDateTime rangeStart,
      LocalDateTime rangeEnd) {
    LeaveColumns columns = leaveColumns(jdbcTemplate);
    if (!columns.hasApprovedRangeColumns()) {
      return List.of();
    }

    List<Object> args = new ArrayList<>();
    StringBuilder where =
        new StringBuilder(
            "WHERE "
                + quote(columns.status())
                + " = 1 AND "
                + quote(columns.endDate())
                + " > ? AND "
                + quote(columns.startDate())
                + " < ?");
    args.add(Timestamp.valueOf(rangeStart));
    args.add(Timestamp.valueOf(rangeEnd));
    if (superUser) {
      String userColumn = firstNonBlank(columns.user(), columns.username());
      if (StringUtils.hasText(username) && userColumn != null) {
        where.append(" AND ").append(quote(userColumn)).append(" = ?");
        args.add(username.trim());
      }
    } else {
      if (columns.userId() == null || currentUserId == null) {
        return List.of();
      }
      where.append(" AND ").append(quote(columns.userId())).append(" = ?");
      args.add(currentUserId);
    }

    return jdbcTemplate.query(
        "SELECT "
            + selectColumn(columns.userId(), "userId")
            + ", "
            + quote(columns.startDate())
            + " AS startDate, "
            + quote(columns.endDate())
            + " AS endDate FROM leave_application "
            + where,
        (rs, rowNum) ->
            new LeaveRangeRecord(
                objectInteger(rs.getObject("userId")), timeRange(rs, "startDate", "endDate")),
        args.toArray());
  }

  /** 批量读取考勤设备异常摘要，缺表时保持 normal/空异常数组。 */
  public Map<Integer, DeviceRecordInfo> findAttendanceDeviceInfoMap(
      JdbcTemplate jdbcTemplate, List<Integer> attendanceIds) {
    List<Integer> ids = positiveUniqueIds(attendanceIds);
    Map<Integer, LinkedHashSet<String>> abnormalTypeMap = new LinkedHashMap<>();
    ids.forEach(id -> abnormalTypeMap.put(id, new LinkedHashSet<>()));
    Set<String> columns = columnSet(jdbcTemplate, "attendance_device_abnormal_log");
    String attendanceIdColumn = firstColumn(columns, "attendance_id", "attendanceId", "attendanceid");
    String abnormalTypeColumn = firstColumn(columns, "abnormal_type", "abnormalType", "abnormaltype");
    if (ids.isEmpty() || attendanceIdColumn == null || abnormalTypeColumn == null) {
      return deviceInfoResult(abnormalTypeMap);
    }

    List<Object> args = new ArrayList<>(ids);
    jdbcTemplate.query(
        "SELECT "
            + quote(attendanceIdColumn)
            + " AS attendanceId, "
            + quote(abnormalTypeColumn)
            + " AS abnormalType FROM attendance_device_abnormal_log WHERE "
            + quote(attendanceIdColumn)
            + " IN ("
            + placeholders(ids.size())
            + ") ORDER BY id ASC",
        rs -> {
          Integer attendanceId = objectInteger(rs.getObject("attendanceId"));
          if (attendanceId == null || !abnormalTypeMap.containsKey(attendanceId)) {
            return;
          }
          for (String abnormalType : normalizeAbnormalTypes(rs.getString("abnormalType"))) {
            abnormalTypeMap.get(attendanceId).add(abnormalType);
          }
        },
        args.toArray());
    return deviceInfoResult(abnormalTypeMap);
  }

  /** 查询请假申请分页，并按旧接口补齐申请人、园区和审批人展示名称。 */
  public LeaveApplicationPage findLeaveApplicationPage(
      JdbcTemplate jdbcTemplate,
      HrmLeaveApplicationQuery query,
      Integer currentUserId,
      boolean canViewAll) {
    LeaveColumns columns = leaveColumns(jdbcTemplate);
    if (!columns.listReadable()) {
      return new LeaveApplicationPage(List.of(), 0);
    }
    LeaveWhere where = leaveWhere(columns, query, currentUserId, canViewAll);
    if (!where.valid()) {
      return new LeaveApplicationPage(List.of(), 0);
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM leave_application " + where.sql(),
            Long.class,
            where.args().toArray());
    List<Object> pageArgs = new ArrayList<>(where.args());
    pageArgs.add((query.currentPage() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            selectLeaveApplicationSql(columns)
                + " FROM leave_application "
                + where.sql()
                + " ORDER BY "
                + quote(firstNonBlank(columns.createdTime(), columns.id()))
                + " DESC LIMIT ?, ?",
            (rs, rowNum) -> leaveApplicationMap(rs),
            pageArgs.toArray());
    enrichLeaveApplicationNames(jdbcTemplate, rows);
    return new LeaveApplicationPage(rows, total == null ? 0 : total);
  }

  /** 请假申请页面园区下拉。 */
  public List<Map<String, Object>> findLeaveApplicationParks(JdbcTemplate jdbcTemplate) {
    Set<String> columns = columnSet(jdbcTemplate, "park");
    if (!columns.containsAll(Set.of("park_id", "park_name"))) {
      return List.of();
    }
    String deletedFilter = columns.contains("is_deleted") ? " WHERE is_deleted = false" : "";
    return jdbcTemplate.query(
        """
        SELECT park_id, park_name
        FROM park
        """
            + deletedFilter
            + """
        ORDER BY park_name ASC
        """,
        (rs, rowNum) -> {
          Map<String, Object> map = new LinkedHashMap<>();
          map.put("parkId", rs.getInt("park_id"));
          map.put("parkName", defaultString(rs.getString("park_name")));
          return map;
        });
  }

  /** 查询当前登录用户显示名，用于兼容旧接口更新请假申请时写入 username。 */
  public String findUserDisplayNameById(JdbcTemplate jdbcTemplate, Integer userId) {
    if (userId == null || userId <= 0) {
      return null;
    }
    return findUserDisplayNamesByIds(jdbcTemplate, List.of(userId)).get(userId);
  }

  /** 查询请假申请详情；写接口删除前复用该方法确认记录存在。 */
  public Map<String, Object> findLeaveApplicationDetail(JdbcTemplate jdbcTemplate, int id) {
    LeaveColumns columns = leaveColumns(jdbcTemplate);
    if (!columns.listReadable()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            selectLeaveApplicationSql(columns)
                + " FROM leave_application WHERE "
                + quote(columns.id())
                + " = ? LIMIT 1",
            (rs, rowNum) -> leaveApplicationMap(rs),
            id);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    enrichLeaveApplicationNames(jdbcTemplate, rows);
    return rows.get(0);
  }

  /** 更新请假申请主表字段；用户和园区展示字段按旧接口做精确回填。 */
  public Map<String, Object> updateLeaveApplication(
      JdbcTemplate jdbcTemplate,
      int id,
      HrmLeaveApplicationUpdateRequest request,
      String operatorDisplayName) {
    findLeaveApplicationDetail(jdbcTemplate, id);
    LeaveColumns columns = leaveColumns(jdbcTemplate);
    List<String> assignments = new ArrayList<>();
    List<Object> args = new ArrayList<>();

    if (request != null && request.user() != null && columns.user() != null) {
      String userName = blankToNull(request.user());
      assignments.add(quote(columns.user()) + " = ?");
      args.add(userName);
      Integer userId = findUserIdByDisplayName(jdbcTemplate, userName);
      if (userId != null && columns.userId() != null) {
        assignments.add(quote(columns.userId()) + " = ?");
        args.add(userId);
      }
    }
    if (request != null && request.parkId() != null && columns.parkId() != null) {
      Integer parkId = toInteger(request.parkId(), "parkId参数错误");
      assignments.add(quote(columns.parkId()) + " = ?");
      args.add(parkId);
      String parkName = findParkNameById(jdbcTemplate, parkId);
      if (columns.park() != null) {
        assignments.add(quote(columns.park()) + " = ?");
        args.add(parkName);
      }
    }
    appendTimestampAssignment(
        assignments,
        args,
        columns.startDate(),
        request == null ? null : request.startDate(),
        "startDate参数错误");
    appendTimestampAssignment(
        assignments,
        args,
        columns.endDate(),
        request == null ? null : request.endDate(),
        "endDate参数错误");
    appendStringAssignment(assignments, args, columns.leaveType(), request == null ? null : request.leaveType());
    appendStringAssignment(assignments, args, columns.reason(), request == null ? null : request.reason());
    appendIntegerAssignment(
        assignments, args, columns.status(), request == null ? null : request.status(), "status参数错误");
    appendStringAssignment(assignments, args, columns.reply(), request == null ? null : request.reply());
    if (request != null && request.auditUser() != null && columns.auditUser() != null) {
      String auditUserName = blankToNull(request.auditUser());
      assignments.add(quote(columns.auditUser()) + " = ?");
      args.add(auditUserName);
      Integer auditUserId = findUserIdByDisplayName(jdbcTemplate, auditUserName);
      if (auditUserId != null && columns.auditUserId() != null) {
        assignments.add(quote(columns.auditUserId()) + " = ?");
        args.add(auditUserId);
      }
    }
    if (columns.username() != null && StringUtils.hasText(operatorDisplayName)) {
      assignments.add(quote(columns.username()) + " = ?");
      args.add(operatorDisplayName.trim());
    }
    if (assignments.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有提供要更新的字段");
    }
    if (columns.updatedTime() != null) {
      assignments.add(quote(columns.updatedTime()) + " = CURRENT_TIMESTAMP");
    }
    args.add(id);
    jdbcTemplate.update(
        "UPDATE leave_application SET "
            + String.join(", ", assignments)
            + " WHERE "
            + quote(columns.id())
            + " = ?",
        args.toArray());
    return findLeaveApplicationDetail(jdbcTemplate, id);
  }

  /** 新增请假申请主表记录；申请人、园区和审批人名称按旧接口规则回填关联 ID。 */
  public Map<String, Object> createLeaveApplication(
      JdbcTemplate jdbcTemplate,
      HrmLeaveApplicationCreateRequest request,
      String operatorDisplayName) {
    LeaveColumns columns = leaveColumns(jdbcTemplate);
    if (!columns.listReadable()
        || columns.startDate() == null
        || columns.endDate() == null
        || columns.reason() == null
        || columns.parkId() == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请假申请表结构不完整");
    }
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的表单字段");
    }

    String applicantName = firstNonBlank(blankToNull(request.user()), blankToNull(request.username()));
    if (!StringUtils.hasText(applicantName)
        || request.parkId() == null
        || request.startDate() == null
        || request.endDate() == null
        || !StringUtils.hasText(blankToNull(request.reason()))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的表单字段");
    }

    Integer parkId = toInteger(request.parkId(), "parkId参数错误");
    List<String> insertColumns = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    appendTimestampValue(insertColumns, args, columns.startDate(), request.startDate(), "startDate参数错误");
    appendTimestampValue(insertColumns, args, columns.endDate(), request.endDate(), "endDate参数错误");
    appendStringValue(insertColumns, args, columns.leaveType(), firstNonBlank(blankToNull(request.leaveType()), "事假"));
    appendStringValue(insertColumns, args, columns.reason(), request.reason());
    if (request.status() != null) {
      appendIntegerValue(insertColumns, args, columns.status(), request.status(), "status参数错误");
    }
    appendStringValue(insertColumns, args, columns.reply(), request.reply());
    appendStringValue(insertColumns, args, columns.user(), applicantName);
    if (columns.userId() != null) {
      Integer userId = findUserIdByDisplayName(jdbcTemplate, applicantName);
      if (userId != null) {
        insertColumns.add(quote(columns.userId()));
        args.add(userId);
      }
    }
    insertColumns.add(quote(columns.parkId()));
    args.add(parkId);
    if (columns.park() != null) {
      insertColumns.add(quote(columns.park()));
      args.add(findParkNameById(jdbcTemplate, parkId));
    }
    String auditUserName = blankToNull(request.auditUser());
    if (columns.auditUser() != null) {
      insertColumns.add(quote(columns.auditUser()));
      args.add(StringUtils.hasText(auditUserName) ? auditUserName : null);
    }
    if (StringUtils.hasText(auditUserName) && columns.auditUserId() != null) {
      Integer auditUserId = findUserIdByDisplayName(jdbcTemplate, auditUserName);
      if (auditUserId != null) {
        insertColumns.add(quote(columns.auditUserId()));
        args.add(auditUserId);
      }
    }
    if (columns.username() != null) {
      insertColumns.add(quote(columns.username()));
      args.add(firstNonBlank(blankToNull(request.username()), operatorDisplayName));
    }
    if (columns.createdTime() != null) {
      insertColumns.add(quote(columns.createdTime()));
      args.add(new Timestamp(System.currentTimeMillis()));
    }
    if (columns.updatedTime() != null) {
      insertColumns.add(quote(columns.updatedTime()));
      args.add(new Timestamp(System.currentTimeMillis()));
    }

    jdbcTemplate.update(
        "INSERT INTO leave_application ("
            + String.join(", ", insertColumns)
            + ") VALUES ("
            + placeholders(insertColumns.size())
            + ")",
        args.toArray());
    Integer id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
    if (id == null || id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建请假申请失败");
    }
    return findLeaveApplicationDetail(jdbcTemplate, id);
  }

  /** 物理删除请假申请，保持旧 Prisma delete 语义。 */
  public void deleteLeaveApplication(JdbcTemplate jdbcTemplate, int id) {
    LeaveColumns columns = leaveColumns(jdbcTemplate);
    if (!columns.listReadable()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    findLeaveApplicationDetail(jdbcTemplate, id);
    jdbcTemplate.update("DELETE FROM leave_application WHERE " + quote(columns.id()) + " = ?", id);
  }

  /** 查询 HR 轨迹分页列表；旧接口用于管理侧查看所有员工打卡位置。 */
  public AttendanceRecordPage findTrajectoryPage(
      JdbcTemplate jdbcTemplate, HrmTrajectoryQuery query) {
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    if (!columns.readable()) {
      return new AttendanceRecordPage(List.of(), 0);
    }
    TrajectoryWhere where = trajectoryWhere(jdbcTemplate, columns, query);
    if (!where.valid()) {
      return new AttendanceRecordPage(List.of(), 0);
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM attendances a "
                + where.joinSql()
                + " "
                + where.whereSql(),
            Long.class,
            where.args().toArray());
    List<Object> pageArgs = new ArrayList<>(where.args());
    pageArgs.add((query.page() - 1) * query.pageSize());
    pageArgs.add(query.pageSize());
    List<AttendanceRecord> rows =
        jdbcTemplate.query(
            selectTrajectorySql(columns, where.userColumns())
                + " FROM attendances a "
                + where.joinSql()
                + " "
                + where.whereSql()
                + " ORDER BY a."
                + quote(columns.punchIn())
                + " DESC LIMIT ?, ?",
            (rs, rowNum) -> trajectoryRecordMap(rs),
            pageArgs.toArray());
    return new AttendanceRecordPage(rows, total == null ? 0 : total);
  }

  /** 查询当前用户设备异常日志；旧 GET 接口只读返回当天异常记录。 */
  public List<Map<String, Object>> findAttendanceDeviceAbnormalLogs(
      JdbcTemplate jdbcTemplate,
      Integer userId,
      LocalDateTime startTime,
      LocalDateTime endTime,
      int limit) {
    Set<String> columns = columnSet(jdbcTemplate, "attendance_device_abnormal_log");
    if (userId == null
        || !columns.containsAll(Set.of("id", "user_id", "action", "abnormal_type", "current_device_id"))) {
      return List.of();
    }
    String attendanceIdColumn = firstColumn(columns, "attendance_id", "attendanceId", "attendanceid");
    String boundDeviceIdColumn = firstColumn(columns, "bound_device_id", "boundDeviceId", "bounddeviceid");
    String duplicateUserNamesColumn =
        firstColumn(columns, "duplicate_user_names", "duplicateUserNames", "duplicateusernames");
    String punchTimeColumn = firstColumn(columns, "punch_time", "punchTime", "punchtime");
    String createTimeColumn = firstColumn(columns, "create_time", "createTime", "createtime");
    String timeExpression =
        punchTimeColumn != null && createTimeColumn != null
            ? "COALESCE(" + quote(punchTimeColumn) + ", " + quote(createTimeColumn) + ")"
            : quote(firstNonBlank(punchTimeColumn, createTimeColumn, "id"));
    List<Object> args = new ArrayList<>();
    args.add(userId);
    args.add(Timestamp.valueOf(startTime));
    args.add(Timestamp.valueOf(endTime));
    args.add(Math.min(Math.max(limit, 1), 100));
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT id, "
                + selectColumn(attendanceIdColumn, "attendanceId")
                + ", action, abnormal_type AS abnormalType, "
                + selectColumn(boundDeviceIdColumn, "boundDeviceId")
                + ", current_device_id AS currentDeviceId, "
                + selectColumn(duplicateUserNamesColumn, "duplicateUserNames")
                + ", "
                + selectColumn(punchTimeColumn, "punchTime")
                + ", "
                + selectColumn(createTimeColumn, "createTime")
                + " FROM attendance_device_abnormal_log WHERE user_id = ? AND "
                + timeExpression
                + " >= ? AND "
                + timeExpression
                + " < ? ORDER BY id DESC LIMIT ?",
            (rs, rowNum) -> attendanceDeviceLogMap(rs),
            args.toArray());
    return mergeAttendanceDeviceLogs(rows, Math.min(Math.max(limit, 1), 100));
  }

  /** 查询轨迹导出记录，最多返回 5000 条，避免导出接口误拉全库。 */
  public List<AttendanceRecord> findTrajectoryRecordsForExport(
      JdbcTemplate jdbcTemplate, HrmTrajectoryQuery query) {
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    if (!columns.readable()) {
      return List.of();
    }
    TrajectoryWhere where = trajectoryWhere(jdbcTemplate, columns, query);
    if (!where.valid()) {
      return List.of();
    }
    return jdbcTemplate.query(
        selectTrajectorySql(columns, where.userColumns())
            + " FROM attendances a "
            + where.joinSql()
            + " "
            + where.whereSql()
            + " ORDER BY a."
            + quote(columns.punchIn())
            + " DESC LIMIT 5000",
        (rs, rowNum) -> trajectoryRecordMap(rs),
        where.args().toArray());
  }

  /** 按考勤记录 ID 查询园区名称，供旧导出接口按园区分组。 */
  public Map<Integer, String> findTrajectoryParkNamesByAttendanceIds(
      JdbcTemplate jdbcTemplate, List<Integer> attendanceIds) {
    List<Integer> ids = positiveUniqueIds(attendanceIds);
    AttendanceColumns columns = attendanceColumns(jdbcTemplate);
    Set<String> userColumns = columnSet(jdbcTemplate, "user");
    Set<String> parkColumns = columnSet(jdbcTemplate, "park");
    if (ids.isEmpty()
        || columns.attendanceId() == null
        || columns.userId() == null
        || !userColumns.containsAll(Set.of("id", "park_id"))
        || !parkColumns.containsAll(Set.of("park_id", "park_name"))) {
      return Map.of();
    }
    Map<Integer, String> result = new LinkedHashMap<>();
    List<Object> args = new ArrayList<>(ids);
    jdbcTemplate.query(
        "SELECT a."
            + quote(columns.attendanceId())
            + " AS attendanceId, p.park_name AS parkName FROM attendances a "
            + "LEFT JOIN user u ON u.id = a."
            + quote(columns.userId())
            + " LEFT JOIN park p ON p.park_id = u.park_id WHERE a."
            + quote(columns.attendanceId())
            + " IN ("
            + placeholders(ids.size())
            + ")",
        rs -> {
          Integer attendanceId = objectInteger(rs.getObject("attendanceId"));
          if (attendanceId != null) {
            result.put(attendanceId, defaultString(rs.getString("parkName")));
          }
        },
        args.toArray());
    return result;
  }

  private void appendDeletedFilter(
      StringBuilder where, List<Object> args, Set<String> columns, String rawValue) {
    if (!columns.contains("is_deleted")) {
      return;
    }
    Boolean value = parseBoolean(rawValue);
    if (value == null && !StringUtils.hasText(rawValue)) {
      value = false;
    }
    if (value != null) {
      where.append(" AND is_deleted = ?");
      args.add(value);
    }
  }

  private void appendBooleanFilter(
      StringBuilder where, List<Object> args, Set<String> columns, String column, String rawValue) {
    Boolean value = parseBoolean(rawValue);
    if (columns.contains(column) && value != null) {
      where.append(" AND ").append(column).append(" = ?");
      args.add(value);
    }
  }

  private void appendLike(
      StringBuilder where, List<Object> args, Set<String> columns, String column, String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND ").append(column).append(" LIKE ?");
      args.add("%" + value.trim() + "%");
    }
  }

  private void appendEquals(
      StringBuilder where, List<Object> args, Set<String> columns, String column, String value) {
    if (columns.contains(column) && StringUtils.hasText(value)) {
      where.append(" AND ").append(column).append(" = ?");
      args.add(value.trim());
    }
  }

  private void appendHireDateRange(
      StringBuilder where, List<Object> args, Set<String> columns, String start, String end) {
    if (!columns.contains("hire_date") || !StringUtils.hasText(start) || !StringUtils.hasText(end)) {
      return;
    }
    try {
      LocalDate startDate = LocalDate.parse(start.trim());
      LocalDate endDate = LocalDate.parse(end.trim());
      where.append(" AND hire_date BETWEEN ? AND ?");
      args.add(Timestamp.valueOf(startDate.atStartOfDay()));
      args.add(Timestamp.valueOf(endDate.atTime(23, 59, 59)));
    } catch (RuntimeException error) {
      // 旧接口对非法日期实际查不到精确范围；这里直接忽略非法日期筛选。
    }
  }

  private Map<String, Object> employeeMap(ResultSet rs, Set<String> columns) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("employeeId", rs.getInt("employee_id"));
    map.put("name", safeString(rs, "name"));
    map.put("gender", safeString(rs, "gender"));
    map.put("phone", safeString(rs, "phone"));
    map.put("userId", safeInteger(rs, "user_id"));
    map.put("age", safeInteger(rs, "age"));
    map.put("idNumber", safeString(rs, "id_number"));
    map.put("address", safeString(rs, "address"));
    map.put("education", safeString(rs, "education"));
    map.put("department", safeString(rs, "department"));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("hireDate", toIso(safeTimestamp(rs, "hire_date")));
    map.put("leaveDate", toIso(safeTimestamp(rs, "leave_date")));
    map.put("remark", safeString(rs, "remark"));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    map.put("isDeleted", columns.contains("is_deleted") && Boolean.TRUE.equals(safeBoolean(rs, "is_deleted")));
    map.put("isResigned", columns.contains("is_resigned") && Boolean.TRUE.equals(safeBoolean(rs, "is_resigned")));
    map.put("checkIn", timeText(rs, "check_in"));
    map.put("checkOut", timeText(rs, "check_out"));
    return map;
  }

  private Map<String, Object> accountInfoMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("userId", rs.getInt("id"));
    map.put("accountUsername", defaultString(rs.getString("username")));
    map.put("accountRealName", defaultString(rs.getString("real_name")));
    map.put("accountPhone", defaultString(rs.getString("phone")));
    map.put("accountLabel", bindingLabel(map));
    return map;
  }

  private Map<String, Object> bindableAccountMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("value", rs.getInt("id"));
    map.put("username", defaultString(rs.getString("username")));
    map.put("realName", defaultString(rs.getString("real_name")));
    map.put("phone", defaultString(rs.getString("phone")));
    map.put("label", bindingLabel(map));
    return map;
  }

  private String bindingLabel(Map<String, Object> account) {
    String realName = defaultString(account.getOrDefault("accountRealName", account.get("realName"))).trim();
    String username = defaultString(account.getOrDefault("accountUsername", account.get("username"))).trim();
    String phone = defaultString(account.getOrDefault("accountPhone", account.get("phone"))).trim();
    if (StringUtils.hasText(realName)) {
      return realName;
    }
    if (StringUtils.hasText(username)) {
      return username;
    }
    if (StringUtils.hasText(phone)) {
      return phone;
    }
    return "未命名账号";
  }

  private List<Integer> positiveUniqueIds(List<Integer> ids) {
    if (ids == null || ids.isEmpty()) {
      return List.of();
    }
    return ids.stream()
        .filter(id -> id != null && id > 0)
        .collect(Collectors.toCollection(LinkedHashSet::new))
        .stream()
        .toList();
  }

  private Boolean parseBoolean(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    String normalized = value.trim().toLowerCase(Locale.ROOT);
    if ("true".equals(normalized) || "1".equals(normalized)) {
      return true;
    }
    if ("false".equals(normalized) || "0".equals(normalized)) {
      return false;
    }
    return null;
  }

  private boolean hasColumns(JdbcTemplate jdbcTemplate, String tableName, String... columns) {
    Set<String> columnSet = columnSet(jdbcTemplate, tableName);
    for (String column : columns) {
      if (!columnSet.contains(column.toLowerCase(Locale.ROOT))) {
        return false;
      }
    }
    return true;
  }

  private boolean hasColumn(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
    return columnSet(jdbcTemplate, tableName).contains(columnName.toLowerCase(Locale.ROOT));
  }

  private AttendanceWhere attendanceWhere(
      AttendanceColumns columns,
      String username,
      Integer currentUserId,
      boolean superUser,
      String startDate,
      String endDate) {
    LocalDate start = parseDate(startDate);
    LocalDate end = parseDate(endDate);
    LocalDateTime rangeStart = start == null ? null : start.atStartOfDay();
    LocalDateTime rangeEnd = end == null ? null : end.plusDays(1).atStartOfDay();
    return attendanceScopeWhere(columns, username, currentUserId, superUser, rangeStart, rangeEnd);
  }

  private AttendanceWhere attendanceScopeWhere(
      AttendanceColumns columns,
      String username,
      Integer currentUserId,
      boolean superUser,
      LocalDateTime rangeStart,
      LocalDateTime rangeEnd) {
    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    if (superUser) {
      if (StringUtils.hasText(username) && columns.username() != null) {
        where.append(" AND ").append(quote(columns.username())).append(" = ?");
        args.add(username.trim());
      }
    } else {
      if (columns.userId() == null || currentUserId == null) {
        return AttendanceWhere.invalid();
      }
      where.append(" AND ").append(quote(columns.userId())).append(" = ?");
      args.add(currentUserId);
    }
    if (rangeStart != null && rangeEnd != null && rangeEnd.isAfter(rangeStart)) {
      where.append(" AND ").append(quote(columns.punchIn())).append(" >= ?");
      where.append(" AND ").append(quote(columns.punchIn())).append(" < ?");
      args.add(Timestamp.valueOf(rangeStart));
      args.add(Timestamp.valueOf(rangeEnd));
    }
    return new AttendanceWhere(where.toString(), args, true);
  }

  private LeaveWhere leaveWhere(
      LeaveColumns columns,
      HrmLeaveApplicationQuery query,
      Integer currentUserId,
      boolean canViewAll) {
    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    String userColumn = firstNonBlank(columns.user(), columns.username());
    if (StringUtils.hasText(query.user()) && userColumn != null) {
      where.append(" AND ").append(quote(userColumn)).append(" LIKE ?");
      args.add("%" + query.user().trim() + "%");
    }
    Integer parkId = parsePositiveInt(query.parkId());
    if (parkId != null && columns.parkId() != null) {
      where.append(" AND ").append(quote(columns.parkId())).append(" = ?");
      args.add(parkId);
    }
    if (StringUtils.hasText(query.leaveType()) && columns.leaveType() != null) {
      where.append(" AND ").append(quote(columns.leaveType())).append(" = ?");
      args.add(query.leaveType().trim());
    }
    if (!canViewAll) {
      if (columns.userId() == null || currentUserId == null) {
        return LeaveWhere.invalid();
      }
      where.append(" AND ").append(quote(columns.userId())).append(" = ?");
      args.add(currentUserId);
    }
    return new LeaveWhere(where.toString(), args, true);
  }

  private TrajectoryWhere trajectoryWhere(
      JdbcTemplate jdbcTemplate, AttendanceColumns columns, HrmTrajectoryQuery query) {
    Set<String> userColumns = columnSet(jdbcTemplate, "user");
    boolean canJoinUser = columns.userId() != null && userColumns.contains("id");
    List<Object> args = new ArrayList<>();
    String joinSql = canJoinUser ? "LEFT JOIN user u ON u.id = a." + quote(columns.userId()) : "";
    StringBuilder where = new StringBuilder("WHERE 1 = 1");
    LocalDate startDate = parseDate(query.startDate());
    LocalDate endDate = parseDate(query.endDate());
    LocalDateTime rangeStart =
        (startDate == null ? LocalDate.of(2020, 1, 1) : startDate).atStartOfDay();
    LocalDateTime rangeEnd =
        (endDate == null ? LocalDate.now() : endDate).plusDays(1).atStartOfDay();
    where.append(" AND a.").append(quote(columns.punchIn())).append(" >= ?");
    where.append(" AND a.").append(quote(columns.punchIn())).append(" < ?");
    args.add(Timestamp.valueOf(rangeStart));
    args.add(Timestamp.valueOf(rangeEnd));

    if (StringUtils.hasText(query.employeeName())) {
      List<String> conditions = new ArrayList<>();
      if (columns.username() != null) {
        conditions.add("a." + quote(columns.username()) + " LIKE ?");
        args.add("%" + query.employeeName().trim() + "%");
      }
      if (canJoinUser && userColumns.contains("real_name")) {
        conditions.add("u.real_name LIKE ?");
        args.add("%" + query.employeeName().trim() + "%");
      }
      if (canJoinUser && userColumns.contains("username")) {
        conditions.add("u.username LIKE ?");
        args.add("%" + query.employeeName().trim() + "%");
      }
      if (!conditions.isEmpty()) {
        where.append(" AND (").append(String.join(" OR ", conditions)).append(")");
      }
    }
    Integer parkId = parsePositiveInt(query.parkId());
    if (parkId != null) {
      if (!canJoinUser || !userColumns.contains("park_id")) {
        return TrajectoryWhere.invalid();
      }
      where.append(" AND u.park_id = ?");
      args.add(parkId);
    }
    return new TrajectoryWhere(joinSql, where.toString(), args, userColumns, true);
  }

  private AttendanceColumns attendanceColumns(JdbcTemplate jdbcTemplate) {
    Set<String> columns = columnSet(jdbcTemplate, "attendances");
    return new AttendanceColumns(
        firstColumn(columns, "attendance_id", "attendanceId", "attendanceid"),
        firstColumn(columns, "punch_in", "punchIn", "punchin"),
        firstColumn(columns, "punch_out", "punchOut", "punchout"),
        firstColumn(columns, "status"),
        firstColumn(columns, "longitude"),
        firstColumn(columns, "latitude"),
        firstColumn(columns, "user_id", "userId", "userid"),
        firstColumn(columns, "username"));
  }

  private LeaveColumns leaveColumns(JdbcTemplate jdbcTemplate) {
    Set<String> columns = columnSet(jdbcTemplate, "leave_application");
    return new LeaveColumns(
        firstColumn(columns, "id"),
        firstColumn(columns, "start_date", "startDate", "startdate"),
        firstColumn(columns, "end_date", "endDate", "enddate"),
        firstColumn(columns, "leave_type", "leaveType", "leavetype"),
        firstColumn(columns, "reason"),
        firstColumn(columns, "status"),
        firstColumn(columns, "reply"),
        firstColumn(columns, "username"),
        firstColumn(columns, "park"),
        firstColumn(columns, "user"),
        firstColumn(columns, "audit_user", "auditUser", "audituser"),
        firstColumn(columns, "user_id", "userId", "userid"),
        firstColumn(columns, "park_id", "parkId", "parkid"),
        firstColumn(columns, "audit_user_id", "auditUserId", "audituserid"),
        firstColumn(columns, "created_time", "createdTime", "createdtime"),
        firstColumn(columns, "updated_time", "updatedTime", "updatedtime"));
  }

  private String selectAttendanceSql(AttendanceColumns columns) {
    return "SELECT "
        + quote(columns.attendanceId())
        + " AS attendanceId, "
        + quote(columns.punchIn())
        + " AS punchIn, "
        + selectColumn(columns.punchOut(), "punchOut")
        + ", "
        + selectColumn(columns.status(), "status")
        + ", "
        + selectColumn(columns.longitude(), "longitude")
        + ", "
        + selectColumn(columns.latitude(), "latitude")
        + ", "
        + selectColumn(columns.userId(), "userId")
        + ", "
        + selectColumn(columns.username(), "username");
  }

  private String selectTrajectorySql(AttendanceColumns columns, Set<String> userColumns) {
    boolean hasUserRealName = userColumns.contains("real_name");
    boolean hasUserUsername = userColumns.contains("username");
    String usernameExpression =
        hasUserRealName && hasUserUsername
            ? "COALESCE(NULLIF(u.real_name, ''), NULLIF(u.username, ''), "
                + (columns.username() == null ? "''" : "a." + quote(columns.username()))
                + ", '未知用户')"
            : columns.username() == null ? "'未知用户'" : "a." + quote(columns.username());
    return "SELECT a."
        + quote(columns.attendanceId())
        + " AS attendanceId, a."
        + quote(columns.punchIn())
        + " AS punchIn, "
        + selectAlias("a", columns.punchOut(), "punchOut")
        + ", "
        + selectAlias("a", columns.status(), "status")
        + ", "
        + selectAlias("a", columns.longitude(), "longitude")
        + ", "
        + selectAlias("a", columns.latitude(), "latitude")
        + ", "
        + selectAlias("a", columns.userId(), "userId")
        + ", "
        + usernameExpression
        + " AS username";
  }

  private String selectLeaveApplicationSql(LeaveColumns columns) {
    return "SELECT "
        + quote(columns.id())
        + " AS id, "
        + selectColumn(columns.startDate(), "startDate")
        + ", "
        + selectColumn(columns.endDate(), "endDate")
        + ", "
        + selectColumn(columns.leaveType(), "leaveType")
        + ", "
        + selectColumn(columns.reason(), "reason")
        + ", "
        + selectColumn(columns.status(), "status")
        + ", "
        + selectColumn(columns.reply(), "reply")
        + ", "
        + selectColumn(columns.username(), "username")
        + ", "
        + selectColumn(columns.park(), "park")
        + ", "
        + selectColumn(columns.user(), "user")
        + ", "
        + selectColumn(columns.auditUser(), "auditUser")
        + ", "
        + selectColumn(columns.userId(), "userId")
        + ", "
        + selectColumn(columns.parkId(), "parkId")
        + ", "
        + selectColumn(columns.auditUserId(), "auditUserId")
        + ", "
        + selectColumn(columns.createdTime(), "createdTime")
        + ", "
        + selectColumn(columns.updatedTime(), "updatedTime");
  }

  private AttendanceRecord attendanceRecordMap(ResultSet rs) throws SQLException {
    Timestamp punchIn = rs.getTimestamp("punchIn");
    Timestamp punchOut = rs.getTimestamp("punchOut");
    return new AttendanceRecord(
        objectInteger(rs.getObject("attendanceId")),
        punchIn == null ? null : punchIn.toLocalDateTime(),
        punchOut == null ? null : punchOut.toLocalDateTime(),
        objectInteger(rs.getObject("status")),
        objectDecimal(rs.getObject("longitude")),
        objectDecimal(rs.getObject("latitude")),
        objectInteger(rs.getObject("userId")),
        safeString(rs, "username"));
  }

  private AttendanceRecord trajectoryRecordMap(ResultSet rs) throws SQLException {
    return attendanceRecordMap(rs);
  }

  private Map<String, Object> leaveApplicationMap(ResultSet rs) throws SQLException {
    Timestamp startDate = rs.getTimestamp("startDate");
    Timestamp endDate = rs.getTimestamp("endDate");
    Timestamp createdTime = rs.getTimestamp("createdTime");
    Timestamp updatedTime = rs.getTimestamp("updatedTime");
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", objectInteger(rs.getObject("id")));
    map.put("startDate", toIso(startDate));
    map.put("endDate", toIso(endDate));
    map.put("leaveType", defaultString(safeString(rs, "leaveType")));
    map.put("reason", defaultString(safeString(rs, "reason")));
    Integer status = objectInteger(rs.getObject("status"));
    map.put("status", status == null ? 0 : status);
    map.put("reply", defaultString(safeString(rs, "reply")));
    map.put("username", defaultString(safeString(rs, "username")));
    map.put("park", defaultString(safeString(rs, "park")));
    map.put("user", defaultString(safeString(rs, "user")));
    map.put("auditUser", defaultString(safeString(rs, "auditUser")));
    map.put("userId", objectInteger(rs.getObject("userId")));
    map.put("parkId", objectInteger(rs.getObject("parkId")));
    map.put("auditUserId", objectInteger(rs.getObject("auditUserId")));
    map.put("createdTime", toIso(createdTime));
    map.put("updatedTime", toIso(updatedTime));
    map.put("createdAt", toIso(createdTime));
    map.put("updatedAt", toIso(updatedTime));
    return map;
  }

  private Map<String, Object> attendanceDeviceLogMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    String abnormalType = defaultString(rs.getString("abnormalType"));
    map.put("id", objectInteger(rs.getObject("id")));
    map.put("attendanceId", objectInteger(rs.getObject("attendanceId")));
    map.put("action", defaultString(rs.getString("action")));
    map.put("abnormalType", serializeAbnormalTypes(normalizeAbnormalTypes(abnormalType)));
    map.put("abnormalTypes", normalizeAbnormalTypes(abnormalType));
    map.put("boundDeviceId", safeString(rs, "boundDeviceId"));
    map.put("currentDeviceId", defaultString(rs.getString("currentDeviceId")));
    map.put("duplicateUserNames", safeString(rs, "duplicateUserNames"));
    map.put("punchTime", toIso(safeTimestamp(rs, "punchTime")));
    map.put("createTime", toIso(safeTimestamp(rs, "createTime")));
    return map;
  }

  private List<Map<String, Object>> mergeAttendanceDeviceLogs(
      List<Map<String, Object>> rows, int limit) {
    Map<String, Map<String, Object>> merged = new LinkedHashMap<>();
    for (Map<String, Object> row : rows) {
      String key = attendanceDeviceLogGroupKey(row);
      Map<String, Object> existing = merged.get(key);
      if (existing == null) {
        merged.put(key, new LinkedHashMap<>(row));
        continue;
      }
      @SuppressWarnings("unchecked")
      List<String> existingTypes = (List<String>) existing.getOrDefault("abnormalTypes", List.of());
      @SuppressWarnings("unchecked")
      List<String> rowTypes = (List<String>) row.getOrDefault("abnormalTypes", List.of());
      List<String> mergedTypes =
          normalizeAbnormalTypes(String.join(",", existingTypes) + "," + String.join(",", rowTypes));
      existing.put("abnormalTypes", mergedTypes);
      existing.put("abnormalType", serializeAbnormalTypes(mergedTypes));
      if (!StringUtils.hasText(String.valueOf(existing.get("duplicateUserNames")))
          && StringUtils.hasText(String.valueOf(row.get("duplicateUserNames")))) {
        existing.put("duplicateUserNames", row.get("duplicateUserNames"));
      }
    }
    return merged.values().stream().limit(limit).toList();
  }

  private String attendanceDeviceLogGroupKey(Map<String, Object> row) {
    Object attendanceId = row.get("attendanceId");
    if (attendanceId instanceof Number number && number.intValue() > 0) {
      return "attendance:" + number.intValue() + ":" + row.get("action");
    }
    return String.join(
        ":",
        "fallback",
        defaultString(row.get("action")),
        defaultString(row.get("boundDeviceId")),
        defaultString(row.get("currentDeviceId")),
        defaultString(row.get("punchTime")));
  }

  private void enrichLeaveApplicationNames(
      JdbcTemplate jdbcTemplate, List<Map<String, Object>> rows) {
    if (rows.isEmpty()) {
      return;
    }
    Map<Integer, String> users =
        findUserDisplayNamesByIds(
            jdbcTemplate,
            rows.stream()
                .flatMap(
                    row ->
                        java.util.stream.Stream.of(
                            number(row.get("userId")), number(row.get("auditUserId"))))
                .toList());
    Map<Integer, String> parks =
        findParkNamesByIds(jdbcTemplate, rows.stream().map(row -> number(row.get("parkId"))).toList());
    for (Map<String, Object> row : rows) {
      Integer userId = number(row.get("userId"));
      Integer parkId = number(row.get("parkId"));
      Integer auditUserId = number(row.get("auditUserId"));
      if (userId != null && StringUtils.hasText(users.get(userId))) {
        row.put("user", users.get(userId));
      }
      if (parkId != null && StringUtils.hasText(parks.get(parkId))) {
        row.put("park", parks.get(parkId));
      }
      if (auditUserId != null && StringUtils.hasText(users.get(auditUserId))) {
        row.put("auditUser", users.get(auditUserId));
      }
    }
  }

  private Map<Integer, String> findUserDisplayNamesByIds(
      JdbcTemplate jdbcTemplate, List<Integer> rawIds) {
    List<Integer> ids = positiveUniqueIds(rawIds);
    Set<String> columns = columnSet(jdbcTemplate, "user");
    if (ids.isEmpty() || !columns.contains("id")) {
      return Map.of();
    }
    String realNameColumn = firstColumn(columns, "real_name", "realName", "realname");
    String usernameColumn = firstColumn(columns, "username");
    if (realNameColumn == null && usernameColumn == null) {
      return Map.of();
    }
    String displayExpression =
        realNameColumn != null && usernameColumn != null
            ? "COALESCE(NULLIF("
                + quote(realNameColumn)
                + ", ''), "
                + quote(usernameColumn)
                + ")"
            : quote(firstNonBlank(realNameColumn, usernameColumn));
    Map<Integer, String> result = new HashMap<>();
    jdbcTemplate.query(
        "SELECT id, "
            + displayExpression
            + " AS displayName FROM user WHERE id IN ("
            + placeholders(ids.size())
            + ")",
        rs -> {
          result.put(rs.getInt("id"), defaultString(rs.getString("displayName")));
        },
        ids.toArray());
    return result;
  }

  private Integer findUserIdByDisplayName(JdbcTemplate jdbcTemplate, String displayName) {
    if (!StringUtils.hasText(displayName)) {
      return null;
    }
    Set<String> columns = columnSet(jdbcTemplate, "user");
    if (!columns.contains("id")) {
      return null;
    }
    String realNameColumn = firstColumn(columns, "real_name", "realName", "realname");
    String usernameColumn = firstColumn(columns, "username");
    List<String> conditions = new ArrayList<>();
    List<Object> args = new ArrayList<>();
    if (realNameColumn != null) {
      conditions.add(quote(realNameColumn) + " = ?");
      args.add(displayName.trim());
    }
    if (usernameColumn != null) {
      conditions.add(quote(usernameColumn) + " = ?");
      args.add(displayName.trim());
    }
    if (conditions.isEmpty()) {
      return null;
    }
    List<Integer> rows =
        jdbcTemplate.queryForList(
            "SELECT id FROM user WHERE "
                + String.join(" OR ", conditions)
                + " ORDER BY id ASC LIMIT 1",
            Integer.class,
            args.toArray());
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<Integer, String> findParkNamesByIds(JdbcTemplate jdbcTemplate, List<Integer> rawIds) {
    List<Integer> ids = positiveUniqueIds(rawIds);
    if (ids.isEmpty() || !hasColumns(jdbcTemplate, "park", "park_id", "park_name")) {
      return Map.of();
    }
    Map<Integer, String> result = new HashMap<>();
    jdbcTemplate.query(
        "SELECT park_id, park_name FROM park WHERE park_id IN (" + placeholders(ids.size()) + ")",
        rs -> {
          result.put(rs.getInt("park_id"), defaultString(rs.getString("park_name")));
        },
        ids.toArray());
    return result;
  }

  private String findParkNameById(JdbcTemplate jdbcTemplate, Integer parkId) {
    if (parkId == null || parkId <= 0) {
      return null;
    }
    return findParkNamesByIds(jdbcTemplate, List.of(parkId)).get(parkId);
  }

  private void appendStringAssignment(
      List<String> assignments, List<Object> args, String columnName, Object value) {
    if (columnName == null || value == null) {
      return;
    }
    assignments.add(quote(columnName) + " = ?");
    args.add(blankToNull(value));
  }

  private void appendIntegerAssignment(
      List<String> assignments,
      List<Object> args,
      String columnName,
      Object value,
      String message) {
    if (columnName == null || value == null) {
      return;
    }
    assignments.add(quote(columnName) + " = ?");
    args.add(toInteger(value, message));
  }

  private void appendTimestampAssignment(
      List<String> assignments,
      List<Object> args,
      String columnName,
      Object value,
      String message) {
    if (columnName == null || value == null) {
      return;
    }
    assignments.add(quote(columnName) + " = ?");
    args.add(toTimestamp(value, message));
  }

  private void appendStringValue(
      List<String> columns, List<Object> args, String columnName, Object value) {
    if (columnName == null || value == null) {
      return;
    }
    columns.add(quote(columnName));
    args.add(blankToNull(value));
  }

  private void appendStringValue(
      List<String> targetColumns,
      List<Object> args,
      Set<String> existingColumns,
      String columnName,
      Object value) {
    if (!existingColumns.contains(columnName) || value == null) {
      return;
    }
    appendStringValue(targetColumns, args, columnName, value);
  }

  private void appendIntegerValue(
      List<String> columns, List<Object> args, String columnName, Object value, String message) {
    if (columnName == null || value == null) {
      return;
    }
    columns.add(quote(columnName));
    args.add(toInteger(value, message));
  }

  private void appendIntegerValue(
      List<String> targetColumns,
      List<Object> args,
      Set<String> existingColumns,
      String columnName,
      Object value,
      String message) {
    if (!existingColumns.contains(columnName) || value == null) {
      return;
    }
    appendIntegerValue(targetColumns, args, columnName, value, message);
  }

  private void appendTimestampValue(
      List<String> columns, List<Object> args, String columnName, Object value, String message) {
    if (columnName == null || value == null) {
      return;
    }
    columns.add(quote(columnName));
    args.add(toTimestamp(value, message));
  }

  private void appendTimestampValue(
      List<String> targetColumns,
      List<Object> args,
      Set<String> existingColumns,
      String columnName,
      Object value,
      String message) {
    if (!existingColumns.contains(columnName) || value == null) {
      return;
    }
    appendTimestampValue(targetColumns, args, columnName, value, message);
  }

  private void appendTimeValue(
      List<String> targetColumns,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value,
      String message) {
    if (!columns.contains(columnName) || value == null) {
      return;
    }
    targetColumns.add(quote(columnName));
    args.add(toTime(value, message));
  }

  private void appendStringAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value) {
    if (!columns.contains(columnName) || value == null) {
      return;
    }
    assignments.add(quote(columnName) + " = ?");
    args.add(blankToNull(value));
  }

  private void appendIntegerAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value,
      String message) {
    if (!columns.contains(columnName) || value == null) {
      return;
    }
    assignments.add(quote(columnName) + " = ?");
    args.add(toInteger(value, message));
  }

  private void appendTimestampAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value,
      String message) {
    if (!columns.contains(columnName) || value == null) {
      return;
    }
    assignments.add(quote(columnName) + " = ?");
    args.add(toTimestamp(value, message));
  }

  private void appendTimeAssignment(
      List<String> assignments,
      List<Object> args,
      Set<String> columns,
      String columnName,
      Object value,
      String message) {
    if (!columns.contains(columnName) || value == null) {
      return;
    }
    assignments.add(quote(columnName) + " = ?");
    args.add(toTime(value, message));
  }

  private boolean employeeIdNumberExists(
      JdbcTemplate jdbcTemplate, String idNumber, int excludeEmployeeId) {
    if (!hasColumns(jdbcTemplate, "employee", "employee_id", "id_number")) {
      return false;
    }
    String deletedFilter = hasColumn(jdbcTemplate, "employee", "is_deleted") ? " AND is_deleted = false" : "";
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM employee WHERE id_number = ? AND employee_id <> ?"
                + deletedFilter,
            Long.class,
            idNumber,
            excludeEmployeeId);
    return count != null && count > 0;
  }

  private Integer normalizeEmployeeUserId(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      int parsed =
          value instanceof Number number
              ? number.intValue()
              : (int) Math.floor(Double.parseDouble(text));
      return parsed > 0 ? parsed : null;
    } catch (RuntimeException error) {
      return null;
    }
  }

  private void ensureEmployeeBindingUserAvailable(
      JdbcTemplate jdbcTemplate, Integer userId, int employeeId, String customerId) {
    if (userId == null) {
      return;
    }
    if (!hasColumns(jdbcTemplate, "user", "id", "username", "real_name", "phone")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "绑定账号不存在或已删除");
    }
    List<Object> userArgs = new ArrayList<>();
    StringBuilder userWhere = new StringBuilder("WHERE id = ?");
    userArgs.add(userId);
    if (hasColumn(jdbcTemplate, "user", "customer_type") && StringUtils.hasText(customerId)) {
      userWhere.append(" AND customer_type = ?");
      userArgs.add(customerId);
    }
    if (hasColumn(jdbcTemplate, "user", "status")) {
      userWhere.append(" AND (status IS NULL OR status <> 2)");
    }
    Long userCount =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM user " + userWhere, Long.class, userArgs.toArray());
    if (userCount == null || userCount <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "绑定账号不存在或已删除");
    }

    if (!hasColumns(jdbcTemplate, "employee", "employee_id", "user_id")) {
      return;
    }
    String deletedFilter = hasColumn(jdbcTemplate, "employee", "is_deleted") ? " AND is_deleted = false" : "";
    List<Map<String, Object>> rows =
        jdbcTemplate.query(
            "SELECT employee_id, name FROM employee WHERE user_id = ? AND employee_id <> ?"
                + deletedFilter
                + " LIMIT 1",
            (rs, rowNum) -> {
              Map<String, Object> map = new LinkedHashMap<>();
              map.put("employeeId", rs.getInt("employee_id"));
              map.put("name", defaultString(safeString(rs, "name")));
              return map;
            },
            userId,
            employeeId);
    if (!rows.isEmpty()) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "该账号已绑定员工 " + defaultString(rows.get(0).get("name")));
    }
  }

  private String blankToNull(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return StringUtils.hasText(text) ? text : null;
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
    if (count <= 0) {
      return "NULL";
    }
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private String quote(String columnName) {
    return "`" + columnName.replace("`", "``") + "`";
  }

  private String selectColumn(String columnName, String alias) {
    return columnName == null ? "NULL AS " + alias : quote(columnName) + " AS " + alias;
  }

  private String selectAlias(String tableAlias, String columnName, String alias) {
    return columnName == null
        ? "NULL AS " + alias
        : tableAlias + "." + quote(columnName) + " AS " + alias;
  }

  private String firstColumn(Set<String> columns, String... candidates) {
    for (String candidate : candidates) {
      if (candidate != null && columns.contains(candidate.toLowerCase(Locale.ROOT))) {
        return candidate;
      }
    }
    return null;
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value;
      }
    }
    return null;
  }

  private LocalDate parseDate(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      String text = value.trim();
      return LocalDate.parse(text.length() >= 10 ? text.substring(0, 10) : text);
    } catch (RuntimeException error) {
      return null;
    }
  }

  private Integer parsePositiveInt(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    try {
      int parsed = Integer.parseInt(value.trim());
      return parsed > 0 ? parsed : null;
    } catch (NumberFormatException error) {
      return null;
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
      // Continue with yyyy-MM-dd HH:mm:ss or yyyy-MM-ddTHH:mm:ss from the old frontend.
    }
    try {
      return Timestamp.from(OffsetDateTime.parse(text).toInstant());
    } catch (DateTimeParseException ignored) {
      // Continue with local date-time parsing.
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

  private Timestamp nullableTimestamp(Object value, String message) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    return toTimestamp(value, message);
  }

  private Time toTime(Object value, String message) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    if (value instanceof Time time) {
      return time;
    }
    if (value instanceof java.util.Date date) {
      return new Time(date.getTime());
    }
    String text = String.valueOf(value).trim();
    try {
      if (text.contains("T") || text.contains(" ")) {
        return Time.valueOf(toTimestamp(text, message).toLocalDateTime().toLocalTime());
      }
      return Time.valueOf(text.length() == 5 ? text + ":00" : text);
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
  }

  private boolean booleanValue(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    String text = String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
    return "true".equals(text) || "1".equals(text) || "yes".equals(text);
  }

  private TimeRange timeRange(ResultSet rs, String startAlias, String endAlias) throws SQLException {
    Timestamp start = rs.getTimestamp(startAlias);
    Timestamp end = rs.getTimestamp(endAlias);
    if (start == null || end == null) {
      return null;
    }
    TimeRange range = new TimeRange(start.toLocalDateTime(), end.toLocalDateTime());
    return range.isValid() ? range : null;
  }

  private Map<Integer, DeviceRecordInfo> deviceInfoResult(
      Map<Integer, LinkedHashSet<String>> abnormalTypeMap) {
    Map<Integer, DeviceRecordInfo> result = new LinkedHashMap<>();
    for (Map.Entry<Integer, LinkedHashSet<String>> entry : abnormalTypeMap.entrySet()) {
      List<String> abnormalTypes = List.copyOf(entry.getValue());
      result.put(
          entry.getKey(),
          new DeviceRecordInfo(abnormalTypes, abnormalTypes.isEmpty() ? "normal" : "abnormal"));
    }
    return result;
  }

  private List<String> normalizeAbnormalTypes(String value) {
    if (!StringUtils.hasText(value)) {
      return List.of();
    }
    List<String> result = new ArrayList<>();
    for (String item : value.split(",")) {
      String normalized = item.trim();
      if (StringUtils.hasText(normalized) && !result.contains(normalized)) {
        result.add(normalized);
      }
    }
    return result;
  }

  private String serializeAbnormalTypes(List<String> abnormalTypes) {
    return String.join(",", abnormalTypes == null ? List.of() : abnormalTypes);
  }

  private Integer safeInteger(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getObject(columnName, Integer.class);
    } catch (SQLException error) {
      return null;
    }
  }

  private Integer objectInteger(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value == null) {
      return null;
    }
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private BigDecimal objectDecimal(Object value) {
    if (value instanceof BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    if (value == null) {
      return null;
    }
    try {
      return new BigDecimal(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private Integer number(Object value) {
    return objectInteger(value);
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

  private String timeText(ResultSet rs, String columnName) throws SQLException {
    try {
      Time time = rs.getTime(columnName);
      if (time != null) {
        return time.toLocalTime().toString();
      }
      Timestamp timestamp = rs.getTimestamp(columnName);
      return timestamp == null ? null : timestamp.toLocalDateTime().toLocalTime().toString();
    } catch (SQLException error) {
      return null;
    }
  }

  private LocalTime resultLocalTime(ResultSet rs, String columnName) throws SQLException {
    try {
      Time time = rs.getTime(columnName);
      if (time != null) {
        return time.toLocalTime();
      }
      Timestamp timestamp = rs.getTimestamp(columnName);
      return timestamp == null ? null : timestamp.toLocalDateTime().toLocalTime();
    } catch (SQLException error) {
      return null;
    }
  }

  private String defaultString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  public record EmployeePage(List<Map<String, Object>> items, long total) {}

  public record AttendanceRecord(
      Integer attendanceId,
      LocalDateTime punchIn,
      LocalDateTime punchOut,
      Integer storedStatus,
      BigDecimal longitude,
      BigDecimal latitude,
      Integer userId,
      String username) {}

  public record AttendanceRecordPage(List<AttendanceRecord> items, long total) {}

  public record DeviceRecordInfo(List<String> abnormalTypes, String status) {}

  public record LeaveRangeRecord(Integer userId, TimeRange range) {}

  public record LeaveApplicationPage(List<Map<String, Object>> items, long total) {}

  private record AttendanceColumns(
      String attendanceId,
      String punchIn,
      String punchOut,
      String status,
      String longitude,
      String latitude,
      String userId,
      String username) {
    boolean readable() {
      return attendanceId != null && punchIn != null;
    }
  }

  private record LeaveColumns(
      String id,
      String startDate,
      String endDate,
      String leaveType,
      String reason,
      String status,
      String reply,
      String username,
      String park,
      String user,
      String auditUser,
      String userId,
      String parkId,
      String auditUserId,
      String createdTime,
      String updatedTime) {
    boolean listReadable() {
      return id != null;
    }

    boolean hasApprovedRangeColumns() {
      return startDate != null && endDate != null && status != null && userId != null;
    }
  }

  private record AttendanceWhere(String sql, List<Object> args, boolean valid) {
    static AttendanceWhere invalid() {
      return new AttendanceWhere("", List.of(), false);
    }
  }

  private record LeaveWhere(String sql, List<Object> args, boolean valid) {
    static LeaveWhere invalid() {
      return new LeaveWhere("", List.of(), false);
    }
  }

  private record TrajectoryWhere(
      String joinSql, String whereSql, List<Object> args, Set<String> userColumns, boolean valid) {
    static TrajectoryWhere invalid() {
      return new TrajectoryWhere("", "", List.of(), Set.of(), false);
    }
  }
}
