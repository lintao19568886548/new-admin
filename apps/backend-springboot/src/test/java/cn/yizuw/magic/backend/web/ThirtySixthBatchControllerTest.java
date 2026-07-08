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
import cn.yizuw.magic.backend.maintenance.MaintenanceElevatorUpdateRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceFirefightingUpdateRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceService;
import cn.yizuw.magic.backend.maintenance.MaintenanceTransformerUpdateRequest;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十六批维保低副作用写接口的路由与响应协议测试。 */
class ThirtySixthBatchControllerTest {

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
  void elevatorUpdateReturnsUpdatedElevatorRow() throws Exception {
    when(maintenanceService.updateElevator(eq(8), any(MaintenanceElevatorUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "elevatorId",
                8,
                "name",
                "A栋客梯",
                "loadCapacity",
                new BigDecimal("2.50"),
                "status",
                "正常"));

    mockMvc
        .perform(
            put("/maintenance/elevator/8")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"A栋客梯",
                      "status":"正常",
                      "loadCapacity":2.5,
                      "checkTime":"2026-06-29 09:00:00",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.elevatorId").value(8))
        .andExpect(jsonPath("$.data.name").value("A栋客梯"));
  }

  @Test
  void elevatorDeleteReturnsDeletedSnapshot() throws Exception {
    when(maintenanceService.deleteElevator(8))
        .thenReturn(Map.of("elevatorId", 8, "name", "A栋客梯"));

    mockMvc
        .perform(delete("/maintenance/elevator/8"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.elevatorId").value(8));

    verify(maintenanceService).deleteElevator(8);
  }

  @Test
  void firefightingUpdateReturnsUpdatedFirefightingRow() throws Exception {
    when(maintenanceService.updateFirefighting(
            eq(9), any(MaintenanceFirefightingUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "firefightingId",
                9,
                "firefightingName",
                "消防设施",
                "hydrant",
                "正常",
                "parkName",
                "科技园"));

    mockMvc
        .perform(
            put("/maintenance/firefighting/9")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "firefightingName":"消防设施",
                      "extinguisher":"正常",
                      "hydrant":"正常",
                      "fireExit":"畅通",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.firefightingId").value(9))
        .andExpect(jsonPath("$.data.parkName").value("科技园"));
  }

  @Test
  void firefightingDeleteReturnsDeletedSnapshot() throws Exception {
    when(maintenanceService.deleteFirefighting(9))
        .thenReturn(Map.of("firefightingId", 9, "firefightingName", "消防设施"));

    mockMvc
        .perform(delete("/maintenance/firefighting/9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.firefightingId").value(9));

    verify(maintenanceService).deleteFirefighting(9);
  }

  @Test
  void transformerUpdateReturnsUpdatedTransformerRow() throws Exception {
    when(maintenanceService.updateTransformer(
            eq(11), any(MaintenanceTransformerUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "transformerId",
                11,
                "transformerName",
                "T1",
                "status",
                "维护",
                "specifications",
                "10kV"));

    mockMvc
        .perform(
            put("/maintenance/transformer/11")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "transformerName":"T1",
                      "status":"维护",
                      "specifications":"10kV",
                      "checkTime":"2026-06-29",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.transformerId").value(11))
        .andExpect(jsonPath("$.data.status").value("维护"));
  }
}
