package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.hrm.HrmAttendanceQuery;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmLeaveApplicationQuery;
import cn.yizuw.magic.backend.hrm.HrmService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十七批 HRM 考勤和请假只读接口的路由、参数绑定和响应协议测试。 */
class SeventeenthBatchControllerTest {

  private HrmService hrmService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new HrmController(hrmService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void attendanceListReturnsPagedRecords() throws Exception {
    HrmAttendanceQuery query =
        new HrmAttendanceQuery(2, 5, "2026-06-01", "2026-06-27", "张三");
    when(hrmService.getAttendanceList(eq(query)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "attendanceId",
                        11,
                        "date",
                        "2026-06-27",
                        "deviceStatus",
                        "normal",
                        "leaveScope",
                        "none",
                        "punchIn",
                        "09:03:00",
                        "punchOut",
                        "18:10:00",
                        "status",
                        1,
                        "workHours",
                        9.12)),
                "total",
                1));

    mockMvc
        .perform(
            get("/hrm/attendance/list")
                .param("page", "2")
                .param("pageSize", "5")
                .param("startDate", "2026-06-01")
                .param("endDate", "2026-06-27")
                .param("username", "张三"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].attendanceId").value(11))
        .andExpect(jsonPath("$.data.items[0].status").value(1));
    verify(hrmService).getAttendanceList(query);
  }

  @Test
  void todayAttendanceReturnsLatestRecord() throws Exception {
    when(hrmService.getTodayAttendanceRecord(eq("张三")))
        .thenReturn(
            Map.of(
                "attendanceId",
                11,
                "deviceAbnormalTypes",
                List.of("device_changed"),
                "deviceStatus",
                "abnormal",
                "leaveMinutes",
                0,
                "leaveScope",
                "none",
                "punchIn",
                "2026-06-27T09:03:00",
                "punchOut",
                "2026-06-27T18:10:00",
                "status",
                1));

    mockMvc
        .perform(get("/hrm/attendance/today").param("username", "张三"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.attendanceId").value(11))
        .andExpect(jsonPath("$.data.deviceStatus").value("abnormal"))
        .andExpect(jsonPath("$.data.deviceAbnormalTypes[0]").value("device_changed"));
  }

  @Test
  void attendanceStatsReturnsMonthSummary() throws Exception {
    when(hrmService.getMonthAttendanceStats(eq("张三")))
        .thenReturn(
            Map.of(
                "attendanceDays",
                20,
                "earlyLeaveDays",
                1,
                "lateDays",
                2,
                "leaveDays",
                1.5,
                "overtimeHours",
                0));

    mockMvc
        .perform(get("/hrm/attendance/stats").param("username", "张三"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.attendanceDays").value(20))
        .andExpect(jsonPath("$.data.leaveDays").value(1.5));
  }

  @Test
  void leaveApplicationListReturnsPagedApplications() throws Exception {
    HrmLeaveApplicationQuery query =
        new HrmLeaveApplicationQuery(3, 10, "张", "5", "事假");
    when(hrmService.getLeaveApplicationList(eq(query)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "auditUser",
                        "李经理",
                        "endDate",
                        "2026-06-28T18:00:00Z",
                        "id",
                        9,
                        "leaveType",
                        "事假",
                        "park",
                        "总部园区",
                        "startDate",
                        "2026-06-27T09:00:00Z",
                        "status",
                        1,
                        "user",
                        "张三")),
                "total",
                1));

    mockMvc
        .perform(
            get("/hrm/leaveapplication/list")
                .param("currentPage", "3")
                .param("pageSize", "10")
                .param("user", "张")
                .param("parkId", "5")
                .param("leaveType", "事假"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].user").value("张三"))
        .andExpect(jsonPath("$.data.items[0].auditUser").value("李经理"));
    verify(hrmService).getLeaveApplicationList(query);
  }

  @Test
  void leaveApplicationParksReturnsOptions() throws Exception {
    when(hrmService.getLeaveApplicationParks())
        .thenReturn(List.of(Map.of("parkId", 5, "parkName", "总部园区")));

    mockMvc
        .perform(get("/hrm/leaveapplication/parks"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].parkId").value(5))
        .andExpect(jsonPath("$.data[0].parkName").value("总部园区"));
  }
}
