package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmEmployeeQuery;
import cn.yizuw.magic.backend.hrm.HrmService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第十六批 HRM 员工和考勤配置只读接口的路由、参数绑定和响应协议测试。 */
class SixteenthBatchControllerTest {

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
  void employeeListReturnsBoundAccountInfo() throws Exception {
    HrmEmployeeQuery query =
        new HrmEmployeeQuery(
            2,
            "运营",
            "本科",
            "女",
            "2026-06-30",
            "2026-06-01",
            "4401",
            null,
            "false",
            "张",
            5,
            "138");
    when(hrmService.getEmployeeList(eq(query)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "employeeId",
                        7,
                        "name",
                        "张三",
                        "accountLabel",
                        "张三账号",
                        "accountPhone",
                        "13800000000")),
                "total",
                1));

    mockMvc
        .perform(
            get("/hrm/employee/list")
                .param("currentPage", "2")
                .param("pageSize", "5")
                .param("department", "运营")
                .param("education", "本科")
                .param("gender", "女")
                .param("hireDateStart", "2026-06-01")
                .param("hireDateEnd", "2026-06-30")
                .param("idNumber", "4401")
                .param("isResigned", "false")
                .param("name", "张")
                .param("phone", "138"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].employeeId").value(7))
        .andExpect(jsonPath("$.data.items[0].accountLabel").value("张三账号"));
    verify(hrmService).getEmployeeList(query);
  }

  @Test
  void employeeDetailReturnsOneEmployee() throws Exception {
    when(hrmService.getEmployeeDetail(eq(7)))
        .thenReturn(Map.of("employeeId", 7, "name", "张三", "accountUsername", "zhangsan"));

    mockMvc
        .perform(get("/hrm/employee/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.employeeId").value(7))
        .andExpect(jsonPath("$.data.accountUsername").value("zhangsan"));
  }

  @Test
  void employeeAccountsReturnsBindableOptions() throws Exception {
    when(hrmService.getBindableEmployeeAccounts(eq(7), eq("zhang")))
        .thenReturn(
            List.of(
                Map.of(
                    "label",
                    "张三",
                    "phone",
                    "13800000000",
                    "realName",
                    "张三",
                    "username",
                    "zhangsan",
                    "value",
                    21)));

    mockMvc
        .perform(get("/hrm/employee/accounts").param("employeeId", "7").param("keyword", "zhang"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].value").value(21))
        .andExpect(jsonPath("$.data[0].label").value("张三"));
  }

  @Test
  void attendanceConfigReturnsSchedule() throws Exception {
    when(hrmService.getAttendanceConfig())
        .thenReturn(
            Map.of(
                "employeeId",
                7,
                "scheduledCheckIn",
                "09:30:00",
                "scheduledCheckOut",
                "18:30:00",
                "source",
                "employee",
                "userId",
                21));

    mockMvc
        .perform(get("/hrm/attendance/config"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.scheduledCheckIn").value("09:30:00"))
        .andExpect(jsonPath("$.data.source").value("employee"));
  }

  @Test
  void attendanceLocationsReturnsOfficeLocations() throws Exception {
    when(hrmService.getAttendanceLocations())
        .thenReturn(List.of(Map.of("name", "总部办公室", "lat", 23.099596, "lng", 113.769574, "radius", 100)));

    mockMvc
        .perform(get("/hrm/attendance/locations"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].name").value("总部办公室"))
        .andExpect(jsonPath("$.data[0].radius").value(100));
  }
}
