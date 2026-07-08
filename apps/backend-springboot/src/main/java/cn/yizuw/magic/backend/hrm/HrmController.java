package cn.yizuw.magic.backend.hrm;

import cn.yizuw.magic.backend.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** HRM 员工和考勤配置只读接口，按第十六批迁移边界实现。 */
@RestController
public class HrmController {

  private final HrmService hrmService;

  public HrmController(HrmService hrmService) {
    this.hrmService = hrmService;
  }

  /** 查询员工分页列表，并附带绑定账号摘要。 */
  @GetMapping("/hrm/employee/list")
  public ApiResponse<Map<String, Object>> employeeList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String department,
      @RequestParam(required = false) String education,
      @RequestParam(required = false) String gender,
      @RequestParam(required = false) String hireDateEnd,
      @RequestParam(required = false) String hireDateStart,
      @RequestParam(required = false) String idNumber,
      @RequestParam(required = false) String isDeleted,
      @RequestParam(required = false) String isResigned,
      @RequestParam(required = false) String name,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String phone) {
    HrmEmployeeQuery query =
        new HrmEmployeeQuery(
            normalizePage(currentPage),
            department,
            education,
            gender,
            hireDateEnd,
            hireDateStart,
            idNumber,
            isDeleted,
            isResigned,
            name,
            normalizePageSize(pageSize),
            phone);
    return ApiResponse.ok(hrmService.getEmployeeList(query));
  }

  /** 查询员工详情，并附带绑定账号摘要。 */
  @GetMapping("/hrm/employee/{id}")
  public ApiResponse<Map<String, Object>> employeeDetail(@PathVariable Integer id) {
    return ApiResponse.ok(hrmService.getEmployeeDetail(id));
  }

  /** 软删除员工；不处理账号解绑、组织生命周期或考勤重算。 */
  @DeleteMapping("/hrm/employee/{id}")
  public ApiResponse<Map<String, Object>> deleteEmployee(@PathVariable int id) {
    return ApiResponse.ok(hrmService.deleteEmployee(id), "删除员工成功");
  }

  /** 更新员工主表字段；不触发中心库账号生命周期或组织角色同步。 */
  @PutMapping("/hrm/employee/{id}")
  public ApiResponse<Map<String, Object>> updateEmployee(
      @PathVariable int id, @RequestBody(required = false) HrmEmployeeUpdateRequest request) {
    return ApiResponse.ok(hrmService.updateEmployee(id, request));
  }

  /** 新增员工主表记录；不创建中心库账号、不同步组织角色或考勤数据。 */
  @PostMapping("/hrm/employee")
  public ApiResponse<Map<String, Object>> createEmployee(
      @RequestBody(required = false) HrmEmployeeCreateRequest request) {
    return ApiResponse.ok(hrmService.createEmployee(request));
  }

  /** 查询可绑定到员工的系统账号选项。 */
  @GetMapping("/hrm/employee/accounts")
  public ApiResponse<List<Map<String, Object>>> employeeAccounts(
      @RequestParam(required = false) Integer employeeId,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(hrmService.getBindableEmployeeAccounts(employeeId, keyword));
  }

  /** 查询当前登录用户的考勤时间配置。 */
  @GetMapping("/hrm/attendance/config")
  public ApiResponse<Map<String, Object>> attendanceConfig() {
    return ApiResponse.ok(hrmService.getAttendanceConfig());
  }

  /** 查询固定办公打卡地点。 */
  @GetMapping("/hrm/attendance/locations")
  public ApiResponse<List<Map<String, Object>>> attendanceLocations() {
    return ApiResponse.ok(hrmService.getAttendanceLocations());
  }

  /** 查询考勤记录分页列表，并重算请假、迟到、早退和设备异常摘要。 */
  @GetMapping("/hrm/attendance/list")
  public ApiResponse<Map<String, Object>> attendanceList(
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String username) {
    HrmAttendanceQuery query =
        new HrmAttendanceQuery(
            normalizePage(page), normalizeAttendancePageSize(pageSize), startDate, endDate, username);
    return ApiResponse.ok(hrmService.getAttendanceList(query));
  }

  /** 上班打卡；只创建 attendances 主表记录，不写设备异常日志。 */
  @PostMapping("/hrm/attendance")
  public ApiResponse<Map<String, Object>> createAttendance(
      @Valid @RequestBody HrmAttendancePunchRequest request) {
    return ApiResponse.ok(hrmService.createAttendance(request), "打卡成功");
  }

  /** 下班打卡更新；只更新 attendances 主表记录，不写设备异常日志。 */
  @PutMapping("/hrm/attendance/{id}")
  public ApiResponse<Map<String, Object>> updateAttendance(
      @PathVariable int id, @Valid @RequestBody HrmAttendancePunchRequest request) {
    return ApiResponse.ok(hrmService.updateAttendance(id, request), "更新成功");
  }

  /** 查询今日最新一条打卡记录。 */
  @GetMapping("/hrm/attendance/today")
  public ApiResponse<Map<String, Object>> todayAttendance(
      @RequestParam(required = false) String username) {
    return ApiResponse.ok(hrmService.getTodayAttendanceRecord(username));
  }

  /** 查询当前月份考勤统计。 */
  @GetMapping("/hrm/attendance/stats")
  public ApiResponse<Map<String, Object>> attendanceStats(
      @RequestParam(required = false) String username) {
    return ApiResponse.ok(hrmService.getMonthAttendanceStats(username));
  }

  /** 查询当前用户某天的考勤设备异常日志；POST 设备更换和短信验证码仍保留在旧后端。 */
  @GetMapping("/hrm/attendance/device")
  public ApiResponse<Map<String, Object>> attendanceDevice(
      @RequestParam(required = false) String date,
      @RequestParam(required = false) Integer limit) {
    return ApiResponse.ok(hrmService.getAttendanceDeviceLogs(date, limit));
  }

  /** 查询请假申请分页列表。 */
  @GetMapping("/hrm/leaveapplication/list")
  public ApiResponse<Map<String, Object>> leaveApplicationList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String leaveType,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String user) {
    HrmLeaveApplicationQuery query =
        new HrmLeaveApplicationQuery(
            normalizePage(currentPage), normalizeAttendancePageSize(pageSize), user, parkId, leaveType);
    return ApiResponse.ok(hrmService.getLeaveApplicationList(query));
  }

  /** 查询请假申请可选园区；兼容旧文件名 park。 */
  @GetMapping("/hrm/leaveapplication/park")
  public ApiResponse<List<Map<String, Object>>> leaveApplicationParks() {
    return ApiResponse.ok(hrmService.getLeaveApplicationParks());
  }

  /** 查询请假申请可选园区；兼容前端实际调用的 parks 别名。 */
  @GetMapping("/hrm/leaveapplication/parks")
  public ApiResponse<List<Map<String, Object>>> leaveApplicationParksAlias() {
    return leaveApplicationParks();
  }

  /** 新增请假申请主表记录；不触发审批流、消息通知或考勤重算。 */
  @PostMapping("/hrm/leaveapplication")
  public ApiResponse<Map<String, Object>> createLeaveApplication(
      @RequestBody(required = false) HrmLeaveApplicationCreateRequest request) {
    return ApiResponse.ok(hrmService.createLeaveApplication(request));
  }

  /** 更新请假申请主表字段；申请人、审批人和园区展示名按旧接口逻辑回填。 */
  @PutMapping("/hrm/leaveapplication/{id}")
  public ApiResponse<Map<String, Object>> updateLeaveApplication(
      @PathVariable int id, @RequestBody(required = false) HrmLeaveApplicationUpdateRequest request) {
    return ApiResponse.ok(hrmService.updateLeaveApplication(id, request));
  }

  /** 删除请假申请，保持旧接口物理删除并返回 null。 */
  @DeleteMapping("/hrm/leaveapplication/{id}")
  public ApiResponse<Void> deleteLeaveApplication(@PathVariable int id) {
    hrmService.deleteLeaveApplication(id);
    return ApiResponse.ok(null);
  }

  /** 查询 HR 考勤轨迹分页列表。 */
  @GetMapping("/hrm/trajectory/list")
  public ApiResponse<Map<String, Object>> trajectoryList(
      @RequestParam(required = false) String employeeName,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String startDate) {
    HrmTrajectoryQuery query =
        new HrmTrajectoryQuery(
            normalizePage(page), normalizeAttendancePageSize(pageSize), employeeName, parkId, startDate, endDate);
    return ApiResponse.ok(hrmService.getTrajectoryList(query));
  }

  /** 导出视角的 HR 考勤轨迹数据；旧接口返回按园区分组的数据，不生成文件。 */
  @GetMapping("/hrm/trajectory/export")
  public ApiResponse<Map<String, List<Map<String, Object>>>> trajectoryExport(
      @RequestParam(required = false) String employeeName,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) String parkId,
      @RequestParam(required = false) String startDate) {
    return ApiResponse.ok(hrmService.getTrajectoryExport(employeeName, parkId, startDate, endDate));
  }

  private int normalizePage(Integer value) {
    return value == null || value < 1 ? 1 : value;
  }

  private int normalizePageSize(Integer value) {
    return value == null || value < 1 ? 20 : Math.min(value, 200);
  }

  private int normalizeAttendancePageSize(Integer value) {
    return value == null || value < 1 ? 10 : Math.min(value, 200);
  }
}
