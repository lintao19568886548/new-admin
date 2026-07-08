package cn.yizuw.magic.backend.hrm;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.hrm.AttendanceCalculator.AttendanceSchedule;
import cn.yizuw.magic.backend.hrm.AttendanceCalculator.AttendanceState;
import cn.yizuw.magic.backend.hrm.AttendanceCalculator.TimeRange;
import cn.yizuw.magic.backend.hrm.HrmRepository.AttendanceRecord;
import cn.yizuw.magic.backend.hrm.HrmRepository.AttendanceRecordPage;
import cn.yizuw.magic.backend.hrm.HrmRepository.DeviceRecordInfo;
import cn.yizuw.magic.backend.hrm.HrmRepository.EmployeePage;
import cn.yizuw.magic.backend.hrm.HrmRepository.LeaveApplicationPage;
import cn.yizuw.magic.backend.hrm.HrmRepository.LeaveRangeRecord;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** HRM 只读业务层，负责登录态、默认租户和员工账号绑定信息组装。 */
@Service
@Transactional(readOnly = true)
public class HrmService {

  private static final String DEFAULT_CHECK_IN = "09:00:00";
  private static final String DEFAULT_CHECK_OUT = "18:00:00";
  private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");
  private static final Set<String> LEAVE_MANAGER_ROLES = Set.of("Super", "董事长", "人事部");

  private final AppProperties appProperties;
  private final HrmRepository hrmRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public HrmService(
      AppProperties appProperties,
      HrmRepository hrmRepository,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.appProperties = appProperties;
    this.hrmRepository = hrmRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /** 员工分页列表，返回旧接口兼容的 items/total 结构。 */
  public Map<String, Object> getEmployeeList(HrmEmployeeQuery query) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    EmployeePage page = hrmRepository.findEmployeePage(jdbcTemplate, query);
    enrichEmployeeBindingInfo(jdbcTemplate, customerId(payload), page.items());
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", page.items());
    result.put("total", page.total());
    return result;
  }

  /** 员工详情，保持旧接口 employeeId 错误和不存在文案。 */
  public Map<String, Object> getEmployeeDetail(Integer employeeId) {
    if (employeeId == null || employeeId <= 0) {
      throw new BusinessException(HttpStatus.OK, "employeeId错误");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Map<String, Object> employee = hrmRepository.findEmployeeById(jdbcTemplate, employeeId);
    if (employee == null) {
      throw new BusinessException(HttpStatus.OK, "员工不存在");
    }
    enrichEmployeeBindingInfo(jdbcTemplate, customerId(payload), List.of(employee));
    return employee;
  }

  /** 软删除员工；保持旧接口设置 isDeleted 和缺省 leaveDate 的主表写入语义。 */
  @Transactional
  public Map<String, Object> deleteEmployee(int employeeId) {
    if (employeeId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "employeeId错误");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Map<String, Object> employee = hrmRepository.softDeleteEmployee(jdbcTemplate, employeeId);
    enrichEmployeeBindingInfo(jdbcTemplate, customerId(payload), List.of(employee));
    return employee;
  }

  /** 更新员工主表字段；只处理租户库 employee，不联动中心库账号或组织角色。 */
  @Transactional
  public Map<String, Object> updateEmployee(int employeeId, HrmEmployeeUpdateRequest request) {
    if (employeeId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "employeeId错误");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Map<String, Object> employee =
        hrmRepository.updateEmployee(jdbcTemplate, employeeId, request, customerId(payload));
    enrichEmployeeBindingInfo(jdbcTemplate, customerId(payload), List.of(employee));
    return employee;
  }

  /** 新增员工主表记录；只处理租户库 employee，不联动中心库账号或组织角色。 */
  @Transactional
  public Map<String, Object> createEmployee(HrmEmployeeCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Map<String, Object> employee =
        hrmRepository.createEmployee(jdbcTemplate, request, customerId(payload));
    enrichEmployeeBindingInfo(jdbcTemplate, customerId(payload), List.of(employee));
    return employee;
  }

  /** 可绑定账号选项，排除已被其他员工绑定的账号，并补回当前员工已绑定账号。 */
  public List<Map<String, Object>> getBindableEmployeeAccounts(Integer employeeId, String keyword) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer normalizedEmployeeId = employeeId != null && employeeId > 0 ? employeeId : null;
    Map<String, Object> currentEmployee =
        normalizedEmployeeId == null ? null : hrmRepository.findEmployeeById(jdbcTemplate, normalizedEmployeeId);
    Integer currentUserId = number(currentEmployee == null ? null : currentEmployee.get("userId"));
    List<Integer> occupiedUserIds = hrmRepository.findOccupiedEmployeeUserIds(jdbcTemplate, normalizedEmployeeId);
    List<Map<String, Object>> options =
        new ArrayList<>(
            hrmRepository.findBindableAccounts(
                jdbcTemplate, customerId(payload), occupiedUserIds, keyword, 50));

    if (currentUserId != null
        && options.stream().noneMatch(option -> currentUserId.equals(number(option.get("value"))))) {
      Map<String, Object> currentAccount = hrmRepository.findBindableAccountById(jdbcTemplate, currentUserId);
      if (currentAccount != null) {
        options.add(currentAccount);
      } else {
        options.add(
            Map.of(
                "label",
                "账号 #" + currentUserId + "（不存在）",
                "phone",
                "",
                "realName",
                "",
                "username",
                "",
                "value",
                currentUserId));
      }
    }
    options.sort(Comparator.comparing(option -> String.valueOf(option.get("label"))));
    return options;
  }

  /** 当前用户考勤时间配置，优先使用绑定员工的 checkIn/checkOut。 */
  public Map<String, Object> getAttendanceConfig() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Map<String, Object> employee = findScheduleEmployee(jdbcTemplate, payload);
    String scheduledCheckIn = employee == null ? DEFAULT_CHECK_IN : timeOrDefault(employee.get("checkIn"), DEFAULT_CHECK_IN);
    String scheduledCheckOut = employee == null ? DEFAULT_CHECK_OUT : timeOrDefault(employee.get("checkOut"), DEFAULT_CHECK_OUT);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("employeeId", employee == null ? null : employee.get("employeeId"));
    result.put("scheduledCheckIn", scheduledCheckIn);
    result.put("scheduledCheckOut", scheduledCheckOut);
    result.put("source", employee == null ? "default" : "employee");
    result.put("userId", payload.id());
    return result;
  }

  /** 固定办公地点列表。 */
  public List<Map<String, Object>> getAttendanceLocations() {
    TenantRequired.currentUser();
    return AttendanceOfficeLocations.all();
  }

  /** 考勤记录分页列表，兼容旧接口的字段、状态重算和设备异常摘要。 */
  public Map<String, Object> getAttendanceList(HrmAttendanceQuery query) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer currentUserId = payloadUserId(payload);
    AttendanceRecordPage page =
        hrmRepository.findAttendancePage(jdbcTemplate, query, currentUserId, isSuper(payload));
    Map<Integer, List<TimeRange>> leaveMap =
        findLeaveMapForAttendanceRecords(jdbcTemplate, page.items(), currentUserId, query);
    Map<Integer, AttendanceSchedule> scheduleMap =
        hrmRepository.findAttendanceSchedulesByUserIds(
            jdbcTemplate, resolvedUserIds(page.items(), currentUserId));
    Map<Integer, DeviceRecordInfo> deviceInfoMap =
        hrmRepository.findAttendanceDeviceInfoMap(jdbcTemplate, attendanceIds(page.items()));

    List<Map<String, Object>> items =
        page.items().stream()
            .map(record -> attendanceListItem(record, currentUserId, leaveMap, scheduleMap, deviceInfoMap))
            .toList();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", items);
    result.put("total", page.total());
    return result;
  }

  /** 上班打卡；只创建考勤主表记录，不迁移设备绑定/异常日志副作用。 */
  @Transactional
  public Map<String, Object> createAttendance(HrmAttendancePunchRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer currentUserId = payloadUserId(payload);
    LocalDateTime punchIn = parsePunchTime(request.punchTime());
    validateAttendanceLocation(request);
    if (currentUserId == null || currentUserId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "未登录或登录已过期");
    }
    if (hrmRepository.existsAttendanceOnDay(jdbcTemplate, currentUserId, punchIn.toLocalDate())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "今天已经打过上班卡了");
    }

    Map<Integer, List<TimeRange>> leaveMap =
        hrmRepository.findApprovedLeaveRangesByUserIds(
            jdbcTemplate,
            List.of(currentUserId),
            punchIn.toLocalDate().atStartOfDay(),
            punchIn.toLocalDate().plusDays(1).atStartOfDay());
    AttendanceSchedule schedule =
        hrmRepository
            .findAttendanceSchedulesByUserIds(jdbcTemplate, List.of(currentUserId))
            .getOrDefault(currentUserId, AttendanceSchedule.defaults(currentUserId));
    AttendanceState state =
        AttendanceCalculator.resolveState(
            punchIn, null, leaveMap.getOrDefault(currentUserId, List.of()), schedule);
    String username = currentUserDisplayName(jdbcTemplate, payload);
    AttendanceRecord record =
        hrmRepository.createAttendance(
            jdbcTemplate,
            punchIn,
            state.status(),
            request.longitude(),
            request.latitude(),
            currentUserId,
            username);
    return attendanceWriteResult(record, currentUserId, leaveMap, Map.of(currentUserId, schedule));
  }

  /** 下班打卡更新；只更新 punchOut、坐标和状态，不写设备异常日志。 */
  @Transactional
  public Map<String, Object> updateAttendance(int id, HrmAttendancePunchRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer currentUserId = payloadUserId(payload);
    LocalDateTime punchOut = parsePunchTime(request.punchTime());
    validateAttendanceLocation(request);
    AttendanceRecord existing = hrmRepository.findAttendanceById(jdbcTemplate, id);
    if (existing == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "找不到该打卡记录");
    }
    if (!isSuper(payload)
        && (existing.userId() == null
            || currentUserId == null
            || !existing.userId().equals(currentUserId))) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "没有权限修改他人考勤记录");
    }
    Integer resolvedUserId = resolvedUserId(existing, currentUserId);
    Map<Integer, List<TimeRange>> leaveMap =
        resolvedUserId == null
            ? Map.of()
            : hrmRepository.findApprovedLeaveRangesByUserIds(
                jdbcTemplate,
                List.of(resolvedUserId),
                punchOut.toLocalDate().atStartOfDay(),
                punchOut.toLocalDate().plusDays(1).atStartOfDay());
    AttendanceSchedule schedule =
        resolvedUserId == null
            ? AttendanceSchedule.defaults(null)
            : hrmRepository
                .findAttendanceSchedulesByUserIds(jdbcTemplate, List.of(resolvedUserId))
                .getOrDefault(resolvedUserId, AttendanceSchedule.defaults(resolvedUserId));
    AttendanceState state =
        AttendanceCalculator.resolveState(
            existing.punchIn() == null ? punchOut : existing.punchIn(),
            punchOut,
            resolvedUserId == null ? List.of() : leaveMap.getOrDefault(resolvedUserId, List.of()),
            schedule);
    AttendanceRecord record =
        hrmRepository.updateAttendancePunchOut(
            jdbcTemplate, id, punchOut, state.status(), request.longitude(), request.latitude());
    Map<Integer, AttendanceSchedule> scheduleMap =
        resolvedUserId == null ? Map.of() : Map.of(resolvedUserId, schedule);
    return attendanceWriteResult(record, currentUserId, leaveMap, scheduleMap);
  }

  /** 今日最新打卡记录；没有记录时按旧接口返回 null。 */
  public Map<String, Object> getTodayAttendanceRecord(String username) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer currentUserId = payloadUserId(payload);
    AttendanceRecord record =
        hrmRepository.findTodayAttendanceRecord(
            jdbcTemplate, username, currentUserId, isSuper(payload), LocalDate.now());
    if (record == null) {
      return null;
    }
    Map<Integer, List<TimeRange>> leaveMap =
        hrmRepository.findApprovedLeaveRangesByUserIds(
            jdbcTemplate,
            record.userId() == null ? List.of() : List.of(record.userId()),
            record.punchIn().toLocalDate().atStartOfDay(),
            record.punchIn().toLocalDate().plusDays(1).atStartOfDay());
    Map<Integer, AttendanceSchedule> scheduleMap =
        hrmRepository.findAttendanceSchedulesByUserIds(
            jdbcTemplate, List.of(resolvedUserId(record, currentUserId)));
    DeviceRecordInfo deviceInfo =
        hrmRepository
            .findAttendanceDeviceInfoMap(jdbcTemplate, List.of(record.attendanceId()))
            .getOrDefault(record.attendanceId(), new DeviceRecordInfo(List.of(), "normal"));
    AttendanceState state = attendanceState(record, currentUserId, leaveMap, scheduleMap);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("attendanceId", record.attendanceId());
    result.put("punchIn", toLocalIso(record.punchIn()));
    result.put("punchOut", toLocalIso(record.punchOut()));
    result.put("status", state.status());
    result.put("longitude", decimalOrNull(record.longitude()));
    result.put("latitude", decimalOrNull(record.latitude()));
    result.put("userId", record.userId());
    result.put("username", record.username());
    result.put("deviceAbnormalTypes", deviceInfo.abnormalTypes());
    result.put("deviceStatus", deviceInfo.status());
    result.put("leaveMinutes", state.leaveMinutes());
    result.put("leaveScope", state.leaveScope());
    result.put("workHours", AttendanceCalculator.workHours(record.punchIn(), record.punchOut()));
    return result;
  }

  /** 当前月份考勤统计，保留旧接口 overtimeHours 暂为 0 的口径。 */
  public Map<String, Object> getMonthAttendanceStats(String username) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer currentUserId = payloadUserId(payload);
    LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
    LocalDateTime rangeStart = monthStart.atStartOfDay();
    LocalDateTime rangeEnd = monthStart.plusMonths(1).atStartOfDay();
    List<AttendanceRecord> records =
        hrmRepository.findAttendanceRecordsInRange(
            jdbcTemplate, username, currentUserId, isSuper(payload), rangeStart, rangeEnd);
    List<LeaveRangeRecord> approvedLeaves =
        hrmRepository.findApprovedLeaveRangesForStats(
            jdbcTemplate, username, currentUserId, isSuper(payload), rangeStart, rangeEnd);
    Map<Integer, List<TimeRange>> leaveMap = groupLeaveRangesByUser(approvedLeaves);
    Map<Integer, AttendanceSchedule> scheduleMap =
        hrmRepository.findAttendanceSchedulesByUserIds(
            jdbcTemplate, resolvedUserIds(records, currentUserId));

    int attendanceDays = 0;
    int lateDays = 0;
    int earlyLeaveDays = 0;
    for (AttendanceRecord record : records) {
      AttendanceState state = attendanceState(record, currentUserId, leaveMap, scheduleMap);
      if (state.status() == AttendanceCalculator.STATUS_LATE
          || state.status() == AttendanceCalculator.STATUS_LATE_AND_EARLY_LEAVE) {
        lateDays++;
      }
      if (state.status() == AttendanceCalculator.STATUS_EARLY_LEAVE
          || state.status() == AttendanceCalculator.STATUS_LATE_AND_EARLY_LEAVE) {
        earlyLeaveDays++;
      }
      if (record.punchIn() != null && record.punchOut() != null) {
        attendanceDays++;
      }
    }

    double leaveDays = 0;
    for (List<TimeRange> ranges : leaveMap.values()) {
      leaveDays += AttendanceCalculator.calculateApprovedLeaveDaysInRange(ranges, rangeStart, rangeEnd);
    }
    leaveDays +=
        approvedLeaves.stream()
            .filter(leave -> leave.userId() == null)
            .map(LeaveRangeRecord::range)
            .filter(range -> range != null)
            .mapToDouble(
                range ->
                    AttendanceCalculator.calculateApprovedLeaveDaysInRange(
                        List.of(range), rangeStart, rangeEnd))
            .sum();

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("attendanceDays", attendanceDays);
    result.put("lateDays", lateDays);
    result.put("earlyLeaveDays", earlyLeaveDays);
    result.put("overtimeHours", 0);
    result.put("leaveDays", Math.round(leaveDays * 100.0) / 100.0);
    return result;
  }

  /** 当前用户考勤设备异常日志，只迁移 GET 查询，不迁移设备更换或验证码发送。 */
  public Map<String, Object> getAttendanceDeviceLogs(String date, Integer limit) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Integer currentUserId = payloadUserId(payload);
    LocalDate targetDate = parseDateOrToday(date);
    int normalizedLimit = limit == null ? 20 : Math.min(Math.max(limit, 1), 100);
    List<Map<String, Object>> items =
        hrmRepository.findAttendanceDeviceAbnormalLogs(
            jdbcTemplate,
            currentUserId,
            targetDate.atStartOfDay(),
            targetDate.plusDays(1).atStartOfDay(),
            normalizedLimit);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", items);
    result.put("total", items.size());
    return result;
  }

  /** 请假申请分页列表，普通用户只看本人，管理角色可看全部。 */
  public Map<String, Object> getLeaveApplicationList(HrmLeaveApplicationQuery query) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    LeaveApplicationPage page =
        hrmRepository.findLeaveApplicationPage(
            jdbcTemplate, query, payloadUserId(payload), canViewAllLeaveApplications(payload));
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", page.items());
    result.put("total", page.total());
    return result;
  }

  /** 请假申请园区下拉。 */
  public List<Map<String, Object>> getLeaveApplicationParks() {
    TenantRequired.currentUser();
    return hrmRepository.findLeaveApplicationParks(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate());
  }

  /** 新增请假申请；只迁移主表写入，不接入审批流、消息通知或考勤重算。 */
  @Transactional
  public Map<String, Object> createLeaveApplication(HrmLeaveApplicationCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    String operatorDisplayName =
        hrmRepository.findUserDisplayNameById(jdbcTemplate, payloadUserId(payload));
    if (!StringUtils.hasText(operatorDisplayName)) {
      operatorDisplayName = payload.username();
    }
    return hrmRepository.createLeaveApplication(jdbcTemplate, request, operatorDisplayName);
  }

  /** 更新请假申请；本批只迁移主表写入，不接入审批流、消息通知或考勤重算。 */
  @Transactional
  public Map<String, Object> updateLeaveApplication(
      int id, HrmLeaveApplicationUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    String operatorDisplayName =
        hrmRepository.findUserDisplayNameById(jdbcTemplate, payloadUserId(payload));
    if (!StringUtils.hasText(operatorDisplayName)) {
      operatorDisplayName = payload.username();
    }
    return hrmRepository.updateLeaveApplication(jdbcTemplate, id, request, operatorDisplayName);
  }

  /** 删除请假申请；保持旧 Nitro 物理删除语义。 */
  @Transactional
  public void deleteLeaveApplication(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的ID");
    }
    TenantRequired.currentUser();
    hrmRepository.deleteLeaveApplication(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id);
  }

  /** HR 轨迹分页列表，返回地图轨迹页面需要的打卡位置和设备异常字段。 */
  public Map<String, Object> getTrajectoryList(HrmTrajectoryQuery query) {
    TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    AttendanceRecordPage page = hrmRepository.findTrajectoryPage(jdbcTemplate, query);
    Map<Integer, DeviceRecordInfo> deviceInfoMap =
        hrmRepository.findAttendanceDeviceInfoMap(jdbcTemplate, attendanceIds(page.items()));
    List<Map<String, Object>> items =
        page.items().stream().map(record -> trajectoryItem(record, deviceInfoMap)).toList();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", items);
    result.put("total", page.total());
    return result;
  }

  /** HR 轨迹导出视角，旧端返回按园区名分组的数据对象。 */
  public Map<String, List<Map<String, Object>>> getTrajectoryExport(
      String employeeName, String parkId, String startDate, String endDate) {
    TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<AttendanceRecord> records =
        hrmRepository.findTrajectoryRecordsForExport(
            jdbcTemplate, new HrmTrajectoryQuery(1, 200, employeeName, parkId, startDate, endDate));
    Map<Integer, DeviceRecordInfo> deviceInfoMap =
        hrmRepository.findAttendanceDeviceInfoMap(jdbcTemplate, attendanceIds(records));
    Map<Integer, String> parkNameMap =
        hrmRepository.findTrajectoryParkNamesByAttendanceIds(jdbcTemplate, attendanceIds(records));
    Map<String, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
    for (AttendanceRecord record : records) {
      String parkName = parkNameMap.getOrDefault(record.attendanceId(), "未分配园区");
      grouped.computeIfAbsent(parkName, key -> new ArrayList<>()).add(trajectoryItem(record, deviceInfoMap));
    }
    return grouped;
  }

  private Map<String, Object> findScheduleEmployee(JdbcTemplate jdbcTemplate, UserTokenPayload payload) {
    Integer tenantUserId = payload.id() == null ? null : payload.id().intValue();
    if (tenantUserId != null && tenantUserId > 0) {
      return hrmRepository.findEmployeeByUserId(jdbcTemplate, tenantUserId);
    }
    return null;
  }

  private void enrichEmployeeBindingInfo(
      JdbcTemplate jdbcTemplate, String customerId, List<Map<String, Object>> employees) {
    if (employees.isEmpty()) {
      return;
    }
    List<Integer> userIds =
        employees.stream()
            .map(employee -> number(employee.get("userId")))
            .filter(id -> id != null && id > 0)
            .distinct()
            .toList();
    Map<Integer, Map<String, Object>> accounts =
        hrmRepository.findAccountsByUserIds(jdbcTemplate, customerId, userIds);
    for (Map<String, Object> employee : employees) {
      Integer userId = number(employee.get("userId"));
      Map<String, Object> account = userId == null ? null : accounts.get(userId);
      if (account != null) {
        employee.putAll(account);
      } else {
        employee.put(
            "accountLabel",
            userId != null && userId > 0 ? "账号 #" + userId + "（不存在）" : "");
        employee.put("accountPhone", "");
        employee.put("accountRealName", "");
        employee.put("accountUsername", "");
      }
    }
  }

  private Map<String, Object> attendanceListItem(
      AttendanceRecord record,
      Integer currentUserId,
      Map<Integer, List<TimeRange>> leaveMap,
      Map<Integer, AttendanceSchedule> scheduleMap,
      Map<Integer, DeviceRecordInfo> deviceInfoMap) {
    DeviceRecordInfo deviceInfo =
        deviceInfoMap.getOrDefault(record.attendanceId(), new DeviceRecordInfo(List.of(), "normal"));
    AttendanceState state = attendanceState(record, currentUserId, leaveMap, scheduleMap);
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("attendanceId", record.attendanceId());
    map.put("id", record.attendanceId());
    map.put("key", record.attendanceId());
    map.put("date", record.punchIn() == null ? null : record.punchIn().toLocalDate().toString());
    map.put("deviceAbnormalTypes", deviceInfo.abnormalTypes());
    map.put("deviceStatus", deviceInfo.status());
    map.put("leaveMinutes", state.leaveMinutes());
    map.put("leaveScope", state.leaveScope());
    map.put("punchIn", record.punchIn() == null ? "-" : TIME_FORMATTER.format(record.punchIn()));
    map.put("punchOut", record.punchOut() == null ? "-" : TIME_FORMATTER.format(record.punchOut()));
    map.put("status", state.status());
    map.put("workHours", AttendanceCalculator.workHours(record.punchIn(), record.punchOut()));
    return map;
  }

  private Map<String, Object> trajectoryItem(
      AttendanceRecord record, Map<Integer, DeviceRecordInfo> deviceInfoMap) {
    DeviceRecordInfo deviceInfo =
        deviceInfoMap.getOrDefault(record.attendanceId(), new DeviceRecordInfo(List.of(), "normal"));
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("attendanceId", record.attendanceId());
    map.put("key", record.attendanceId());
    map.put("username", StringUtils.hasText(record.username()) ? record.username() : "未知用户");
    map.put("date", record.punchIn() == null ? null : record.punchIn().toLocalDate().toString());
    map.put("deviceAbnormalTypes", deviceInfo.abnormalTypes());
    map.put("deviceStatus", deviceInfo.status());
    map.put("punchIn", record.punchIn() == null ? "-" : TIME_FORMATTER.format(record.punchIn()));
    map.put("punchOut", record.punchOut() == null ? "-" : TIME_FORMATTER.format(record.punchOut()));
    map.put("status", record.storedStatus());
    map.put("workHours", AttendanceCalculator.workHours(record.punchIn(), record.punchOut()));
    map.put("latitude", decimalOrNull(record.latitude()));
    map.put("longitude", decimalOrNull(record.longitude()));
    return map;
  }

  private Map<String, Object> attendanceWriteResult(
      AttendanceRecord record,
      Integer currentUserId,
      Map<Integer, List<TimeRange>> leaveMap,
      Map<Integer, AttendanceSchedule> scheduleMap) {
    AttendanceState state = attendanceState(record, currentUserId, leaveMap, scheduleMap);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("attendanceId", record.attendanceId());
    result.put("punchIn", toLocalIso(record.punchIn()));
    result.put("punchOut", toLocalIso(record.punchOut()));
    result.put("status", state.status());
    result.put("longitude", decimalOrNull(record.longitude()));
    result.put("latitude", decimalOrNull(record.latitude()));
    result.put("userId", record.userId());
    result.put("username", record.username());
    result.put("leaveMinutes", state.leaveMinutes());
    result.put("leaveScope", state.leaveScope());
    result.put("workHours", AttendanceCalculator.workHours(record.punchIn(), record.punchOut()));
    return result;
  }

  private AttendanceState attendanceState(
      AttendanceRecord record,
      Integer currentUserId,
      Map<Integer, List<TimeRange>> leaveMap,
      Map<Integer, AttendanceSchedule> scheduleMap) {
    if (record.punchIn() == null) {
      return new AttendanceState(0, AttendanceCalculator.LEAVE_SCOPE_NONE, AttendanceCalculator.STATUS_NORMAL);
    }
    Integer resolvedUserId = resolvedUserId(record, currentUserId);
    AttendanceSchedule schedule =
        scheduleMap.getOrDefault(resolvedUserId, AttendanceSchedule.defaults(resolvedUserId));
    List<TimeRange> leaveRanges =
        record.userId() == null ? List.of() : leaveMap.getOrDefault(record.userId(), List.of());
    return AttendanceCalculator.resolveState(record.punchIn(), record.punchOut(), leaveRanges, schedule);
  }

  private Map<Integer, List<TimeRange>> findLeaveMapForAttendanceRecords(
      JdbcTemplate jdbcTemplate,
      List<AttendanceRecord> records,
      Integer currentUserId,
      HrmAttendanceQuery query) {
    List<Integer> userIds = records.stream().map(AttendanceRecord::userId).toList();
    LocalDateTime rangeStart = recordsRangeStart(records, query);
    LocalDateTime rangeEnd = recordsRangeEnd(records, query);
    if (rangeStart == null || rangeEnd == null) {
      return Map.of();
    }
    return hrmRepository.findApprovedLeaveRangesByUserIds(
        jdbcTemplate, userIds.stream().filter(id -> id != null && id > 0).toList(), rangeStart, rangeEnd);
  }

  private Map<Integer, List<TimeRange>> groupLeaveRangesByUser(List<LeaveRangeRecord> leaves) {
    Map<Integer, List<TimeRange>> result = new HashMap<>();
    for (LeaveRangeRecord leave : leaves) {
      if (leave.userId() != null && leave.range() != null) {
        result.computeIfAbsent(leave.userId(), key -> new ArrayList<>()).add(leave.range());
      }
    }
    return result;
  }

  private List<Integer> attendanceIds(List<AttendanceRecord> records) {
    return records.stream().map(AttendanceRecord::attendanceId).filter(id -> id != null && id > 0).toList();
  }

  private List<Integer> resolvedUserIds(List<AttendanceRecord> records, Integer currentUserId) {
    return records.stream()
        .map(record -> resolvedUserId(record, currentUserId))
        .filter(id -> id != null && id > 0)
        .distinct()
        .toList();
  }

  private Integer resolvedUserId(AttendanceRecord record, Integer currentUserId) {
    return record.userId() == null || record.userId() <= 0 ? currentUserId : record.userId();
  }

  private LocalDateTime recordsRangeStart(List<AttendanceRecord> records, HrmAttendanceQuery query) {
    return records.stream()
        .map(AttendanceRecord::punchIn)
        .filter(value -> value != null)
        .map(value -> value.toLocalDate().atStartOfDay())
        .min(LocalDateTime::compareTo)
        .orElseGet(() -> queryDateStart(query.startDate()));
  }

  private LocalDateTime recordsRangeEnd(List<AttendanceRecord> records, HrmAttendanceQuery query) {
    return records.stream()
        .map(AttendanceRecord::punchIn)
        .filter(value -> value != null)
        .map(value -> value.toLocalDate().plusDays(1).atStartOfDay())
        .max(LocalDateTime::compareTo)
        .orElseGet(() -> queryDateEnd(query.endDate()));
  }

  private LocalDateTime queryDateStart(String value) {
    try {
      return StringUtils.hasText(value) ? LocalDate.parse(value.trim().substring(0, 10)).atStartOfDay() : null;
    } catch (RuntimeException error) {
      return null;
    }
  }

  private LocalDateTime queryDateEnd(String value) {
    try {
      return StringUtils.hasText(value)
          ? LocalDate.parse(value.trim().substring(0, 10)).plusDays(1).atStartOfDay()
          : null;
    } catch (RuntimeException error) {
      return null;
    }
  }

  private LocalDate parseDateOrToday(String value) {
    if (!StringUtils.hasText(value)) {
      return LocalDate.now();
    }
    try {
      String text = value.trim();
      return LocalDate.parse(text.length() >= 10 ? text.substring(0, 10) : text);
    } catch (RuntimeException error) {
      return LocalDate.now();
    }
  }

  private LocalDateTime parsePunchTime(String value) {
    if (!StringUtils.hasText(value)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少必要的参数");
    }
    String text = value.trim();
    try {
      return LocalDateTime.ofInstant(Instant.parse(text), ZoneId.systemDefault());
    } catch (DateTimeParseException ignored) {
      // Continue with offset or local date-time strings used by the old frontend.
    }
    try {
      return OffsetDateTime.parse(text).toLocalDateTime();
    } catch (DateTimeParseException ignored) {
      // Continue with yyyy-MM-dd HH:mm:ss / yyyy-MM-ddTHH:mm:ss.
    }
    try {
      return LocalDateTime.parse(text.replace(' ', 'T'));
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "punchTime参数错误");
    }
  }

  private void validateAttendanceLocation(HrmAttendancePunchRequest request) {
    AttendanceLocationValidator.ValidationResult validation =
        AttendanceLocationValidator.validate(request.latitude(), request.longitude());
    if (!validation.valid()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "定位失败，请开启定位权限后重新打卡");
    }
    if (!validation.inRange() && !Boolean.TRUE.equals(request.allowOutsideRange())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "当前位置不在打卡范围内，请确认后再打卡");
    }
  }

  private String currentUserDisplayName(JdbcTemplate jdbcTemplate, UserTokenPayload payload) {
    String displayName = hrmRepository.findUserDisplayNameById(jdbcTemplate, payloadUserId(payload));
    if (StringUtils.hasText(displayName)) {
      return displayName;
    }
    return StringUtils.hasText(payload.username()) ? payload.username() : "未知用户";
  }

  private Integer number(Object value) {
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

  private Integer payloadUserId(UserTokenPayload payload) {
    return payload.id() == null ? null : payload.id().intValue();
  }

  private String customerId(UserTokenPayload payload) {
    return StringUtils.hasText(payload.customerId()) ? payload.customerId() : appProperties.getDefaultCustomerId();
  }

  private boolean isSuper(UserTokenPayload payload) {
    return payload.roles() != null && payload.roles().contains("Super");
  }

  private boolean canViewAllLeaveApplications(UserTokenPayload payload) {
    return payload.roles() != null && payload.roles().stream().anyMatch(LEAVE_MANAGER_ROLES::contains);
  }

  private String timeOrDefault(Object value, String fallback) {
    if (value instanceof LocalTime time) {
      return time.toString();
    }
    if (StringUtils.hasText(String.valueOf(value == null ? "" : value))) {
      String text = String.valueOf(value).trim();
      return text.length() == 5 ? text + ":00" : text;
    }
    return fallback;
  }

  private Object decimalOrNull(BigDecimal value) {
    return value == null ? null : value;
  }

  private String toLocalIso(LocalDateTime value) {
    return value == null ? null : value.toString();
  }
}
