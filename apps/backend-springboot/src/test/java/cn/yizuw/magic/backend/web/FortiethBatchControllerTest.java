package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.factory.FactoryController;
import cn.yizuw.magic.backend.factory.FactoryService;
import cn.yizuw.magic.backend.finance.FinanceController;
import cn.yizuw.magic.backend.finance.FinanceService;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmService;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.park.ParkUpdateRequest;
import cn.yizuw.magic.backend.park.SystemParkController;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十批园区、厂房、财务和员工低副作用写接口路由测试。 */
class FortiethBatchControllerTest {

  private FactoryService factoryService;
  private FinanceService financeService;
  private HrmService hrmService;
  private MockMvc mockMvc;
  private ParkService parkService;

  @BeforeEach
  void setUp() {
    factoryService = org.mockito.Mockito.mock(FactoryService.class);
    financeService = org.mockito.Mockito.mock(FinanceService.class);
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new SystemParkController(parkService),
                new FactoryController(factoryService),
                new FinanceController(financeService),
                new HrmController(hrmService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void systemParkUpdateReturnsUpdatedPark() throws Exception {
    when(parkService.updateSystemPark(eq(7), any(ParkUpdateRequest.class)))
        .thenReturn(Map.of("parkId", 7, "parkName", "科技园", "area", 1200));

    mockMvc
        .perform(
            put("/system/park/7")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "parkName":"科技园",
                      "address":"深圳",
                      "area":1200,
                      "description":"低副作用更新",
                      "status":"active"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.parkId").value(7))
        .andExpect(jsonPath("$.data.parkName").value("科技园"));

    verify(parkService).updateSystemPark(eq(7), any(ParkUpdateRequest.class));
  }

  @Test
  void systemParkDeleteReturnsSoftDeletedPark() throws Exception {
    when(parkService.deleteSystemPark(7))
        .thenReturn(Map.of("parkId", 7, "parkName", "科技园", "isDeleted", true));

    mockMvc
        .perform(delete("/system/park/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.parkId").value(7))
        .andExpect(jsonPath("$.data.isDeleted").value(true));

    verify(parkService).deleteSystemPark(7);
  }

  @Test
  void factoryDeleteReturnsSoftDeletedFactory() throws Exception {
    when(factoryService.deleteFactory(3))
        .thenReturn(Map.of("factoryId", 3, "factoryName", "A栋厂房", "isDeleted", true));

    mockMvc
        .perform(delete("/factory/3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryId").value(3))
        .andExpect(jsonPath("$.data.isDeleted").value(true));

    verify(factoryService).deleteFactory(3);
  }

  @Test
  void financeDeleteReturnsSoftDeletedFinance() throws Exception {
    when(financeService.deleteFinance(8))
        .thenReturn(Map.of("financeId", 8, "billName", "2026年6月房租", "isDeleted", true));

    mockMvc
        .perform(delete("/finance/8"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.financeId").value(8))
        .andExpect(jsonPath("$.data.isDeleted").value(true));

    verify(financeService).deleteFinance(8);
  }

  @Test
  void employeeDeleteReturnsLegacySuccessMessage() throws Exception {
    when(hrmService.deleteEmployee(5))
        .thenReturn(Map.of("employeeId", 5, "name", "张三", "isDeleted", true));

    mockMvc
        .perform(delete("/hrm/employee/5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("删除员工成功"))
        .andExpect(jsonPath("$.data.employeeId").value(5))
        .andExpect(jsonPath("$.data.isDeleted").value(true));

    verify(hrmService).deleteEmployee(5);
  }
}
