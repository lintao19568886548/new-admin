package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.finance.FinanceController;
import cn.yizuw.magic.backend.finance.FinanceService;
import cn.yizuw.magic.backend.finance.FinanceUpdateRequest;
import cn.yizuw.magic.backend.hrm.HrmAttendancePunchRequest;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmEmployeeUpdateRequest;
import cn.yizuw.magic.backend.hrm.HrmService;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantController;
import cn.yizuw.magic.backend.rental.tenant.RentalTenantService;
import cn.yizuw.magic.backend.rental.tenant.SalaryUpdateRequest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十三批财务、工资、员工和考勤低副作用写接口路由测试。 */
class FortyThirdBatchControllerTest {

  private FinanceService financeService;
  private HrmService hrmService;
  private MockMvc mockMvc;
  private RentalTenantService rentalTenantService;

  @BeforeEach
  void setUp() {
    financeService = org.mockito.Mockito.mock(FinanceService.class);
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    rentalTenantService = org.mockito.Mockito.mock(RentalTenantService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new FinanceController(financeService),
                new HrmController(hrmService),
                new RentalTenantController(rentalTenantService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void updateFinanceReturnsUpdatedMainRecord() throws Exception {
    when(financeService.updateFinance(eq(8), any(FinanceUpdateRequest.class)))
        .thenReturn(Map.of("financeId", 8, "billName", "2026年6月房租", "status", 1));

    mockMvc
        .perform(
            put("/finance/8")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "billName":"2026年6月房租",
                      "billCategory":"租金",
                      "amount":1200.5,
                      "transactionType":"收入",
                      "status":1
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.financeId").value(8))
        .andExpect(jsonPath("$.data.billName").value("2026年6月房租"));

    verify(financeService).updateFinance(eq(8), any(FinanceUpdateRequest.class));
  }

  @Test
  void updateSalaryReturnsUpdatedSalaryRecord() throws Exception {
    when(rentalTenantService.updateSalary(eq(12), any(SalaryUpdateRequest.class)))
        .thenReturn(Map.of("salaryId", 12, "rentalTenantId", 3, "issued", true));

    mockMvc
        .perform(
            put("/rental/salary/12")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "rentalTenantId":3,
                      "salaryAmount":8600,
                      "issueDate":"2026-06-30",
                      "issued":true,
                      "remark":"六月工资"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.salaryId").value(12))
        .andExpect(jsonPath("$.data.issued").value(true));

    verify(rentalTenantService).updateSalary(eq(12), any(SalaryUpdateRequest.class));
  }

  @Test
  void updateEmployeeReturnsUpdatedEmployeeRecord() throws Exception {
    when(hrmService.updateEmployee(eq(5), any(HrmEmployeeUpdateRequest.class)))
        .thenReturn(Map.of("employeeId", 5, "name", "张三", "userId", 18));

    mockMvc
        .perform(
            put("/hrm/employee/5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"张三",
                      "phone":"13800000000",
                      "department":"招商部",
                      "userId":18,
                      "checkIn":"09:00:00",
                      "checkOut":"18:00:00"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.employeeId").value(5))
        .andExpect(jsonPath("$.data.userId").value(18));

    verify(hrmService).updateEmployee(eq(5), any(HrmEmployeeUpdateRequest.class));
  }

  @Test
  void createAttendanceReturnsLegacyPunchSuccessMessage() throws Exception {
    when(hrmService.createAttendance(any(HrmAttendancePunchRequest.class)))
        .thenReturn(Map.of("attendanceId", 21, "status", 0, "username", "张三"));

    mockMvc
        .perform(
            post("/hrm/attendance")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "punchTime":"2026-06-30T09:00:00",
                      "longitude":113.76957489705129,
                      "latitude":23.099596024527226,
                      "allowOutsideRange":true
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("打卡成功"))
        .andExpect(jsonPath("$.data.attendanceId").value(21));

    verify(hrmService).createAttendance(any(HrmAttendancePunchRequest.class));
  }

  @Test
  void updateAttendanceReturnsLegacyUpdateSuccessMessage() throws Exception {
    when(hrmService.updateAttendance(eq(21), any(HrmAttendancePunchRequest.class)))
        .thenReturn(Map.of("attendanceId", 21, "status", 0, "workHours", 8.0));

    mockMvc
        .perform(
            put("/hrm/attendance/21")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "punchTime":"2026-06-30T18:00:00",
                      "longitude":113.76957489705129,
                      "latitude":23.099596024527226,
                      "allowOutsideRange":true
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("更新成功"))
        .andExpect(jsonPath("$.data.attendanceId").value(21));

    verify(hrmService).updateAttendance(eq(21), any(HrmAttendancePunchRequest.class));
  }
}
