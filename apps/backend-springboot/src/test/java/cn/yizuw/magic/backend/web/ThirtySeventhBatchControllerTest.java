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
import cn.yizuw.magic.backend.maintenance.MaintenanceController;
import cn.yizuw.magic.backend.maintenance.MaintenanceFactoryMaintUpdateRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceHygieneCheckUpdateRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十七批维保剩余低副作用写接口的路由与响应协议测试。 */
class ThirtySeventhBatchControllerTest {

  private MaintenanceService maintenanceService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    maintenanceService = org.mockito.Mockito.mock(MaintenanceService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new MaintenanceController(maintenanceService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void transformerDeleteReturnsDeletedSnapshot() throws Exception {
    when(maintenanceService.deleteTransformer(11))
        .thenReturn(Map.of("transformerId", 11, "transformerName", "T1"));

    mockMvc
        .perform(delete("/maintenance/transformer/11"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.transformerId").value(11));

    verify(maintenanceService).deleteTransformer(11);
  }

  @Test
  void hygieneCheckUpdateReturnsUpdatedRow() throws Exception {
    when(maintenanceService.updateHygieneCheck(
            eq(12), any(MaintenanceHygieneCheckUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "hygieneCheckId",
                12,
                "checkItems",
                "公共区域",
                "checkResult",
                "合格",
                "checker",
                "李四"));

    mockMvc
        .perform(
            put("/maintenance/hygieneCheck/12")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "checkItems":"公共区域",
                      "checkResult":"合格",
                      "checker":"李四",
                      "checkDate":"2026-06-29",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.hygieneCheckId").value(12))
        .andExpect(jsonPath("$.data.checkResult").value("合格"));
  }

  @Test
  void hygieneCheckDeleteReturnsDeletedSnapshot() throws Exception {
    when(maintenanceService.deleteHygieneCheck(12))
        .thenReturn(Map.of("hygieneCheckId", 12, "checkItems", "公共区域"));

    mockMvc
        .perform(delete("/maintenance/hygieneCheck/12"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.hygieneCheckId").value(12));

    verify(maintenanceService).deleteHygieneCheck(12);
  }

  @Test
  void factoryMaintUpdateReturnsUpdatedRow() throws Exception {
    when(maintenanceService.updateFactoryMaint(
            eq(15), any(MaintenanceFactoryMaintUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "factoryMaintenanceId",
                15,
                "maintenanceItem",
                "屋面防水",
                "maintenanceStatus",
                "处理中",
                "personInCharge",
                "王五"));

    mockMvc
        .perform(
            put("/maintenance/factoryMaint/15")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "maintenanceItem":"屋面防水",
                      "maintenanceStatus":"处理中",
                      "personInCharge":"王五",
                      "startTime":"2026-06-29 09:00:00",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryMaintenanceId").value(15))
        .andExpect(jsonPath("$.data.maintenanceStatus").value("处理中"));
  }

  @Test
  void factoryMaintDeleteReturnsDeletedSnapshot() throws Exception {
    when(maintenanceService.deleteFactoryMaint(15))
        .thenReturn(Map.of("factoryMaintenanceId", 15, "maintenanceItem", "屋面防水"));

    mockMvc
        .perform(delete("/maintenance/factoryMaint/15"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryMaintenanceId").value(15));

    verify(maintenanceService).deleteFactoryMaint(15);
  }
}
