package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.maintenance.MaintenanceController;
import cn.yizuw.magic.backend.maintenance.MaintenanceElevatorUpdateRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceFactoryMaintUpdateRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceFirefightingUpdateRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceHygieneCheckUpdateRequest;
import cn.yizuw.magic.backend.maintenance.MaintenanceService;
import cn.yizuw.magic.backend.maintenance.MaintenanceTransformerUpdateRequest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十七批维保新增主表接口的路由与响应协议测试。 */
class FiftySeventhBatchControllerTest {

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
  void elevatorCreateReturnsCreatedElevatorRow() throws Exception {
    when(maintenanceService.createElevator(any(MaintenanceElevatorUpdateRequest.class)))
        .thenReturn(Map.of("elevatorId", 21, "name", "B栋货梯", "status", "正常"));

    mockMvc
        .perform(
            post("/maintenance/elevator")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"B栋货梯",
                      "status":"正常",
                      "loadCapacity":3.5,
                      "checker":"张三",
                      "checkTime":"2026-06-30 09:00:00",
                      "factoryId":20,
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.elevatorId").value(21))
        .andExpect(jsonPath("$.data.name").value("B栋货梯"));
  }

  @Test
  void firefightingCreateReturnsCreatedFirefightingRow() throws Exception {
    when(maintenanceService.createFirefighting(any(MaintenanceFirefightingUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "firefightingId",
                22,
                "firefightingName",
                "消防栓月检",
                "hydrant",
                "正常"));

    mockMvc
        .perform(
            post("/maintenance/firefighting")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "firefightingName":"消防栓月检",
                      "extinguisher":"正常",
                      "hydrant":"正常",
                      "fireExit":"畅通",
                      "checker":"李四",
                      "checkTime":"2026-06-30 10:00:00",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.firefightingId").value(22))
        .andExpect(jsonPath("$.data.hydrant").value("正常"));
  }

  @Test
  void transformerCreateReturnsCreatedTransformerRow() throws Exception {
    when(maintenanceService.createTransformer(any(MaintenanceTransformerUpdateRequest.class)))
        .thenReturn(Map.of("transformerId", 23, "transformerName", "T2", "status", "维护中"));

    mockMvc
        .perform(
            post("/maintenance/transformer")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "transformerName":"T2",
                      "status":"维护中",
                      "specifications":"10kV",
                      "checker":"王五",
                      "checkTime":"2026-06-30",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.transformerId").value(23))
        .andExpect(jsonPath("$.data.status").value("维护中"));
  }

  @Test
  void hygieneCheckCreateReturnsCreatedHygieneCheckRow() throws Exception {
    when(maintenanceService.createHygieneCheck(any(MaintenanceHygieneCheckUpdateRequest.class)))
        .thenReturn(
            Map.of("hygieneCheckId", 24, "checkItems", "公共区域", "checkResult", "合格"));

    mockMvc
        .perform(
            post("/maintenance/hygieneCheck")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "checkItems":"公共区域",
                      "checker":"赵六",
                      "checkDate":"2026-06-30",
                      "checkResult":"合格",
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.hygieneCheckId").value(24))
        .andExpect(jsonPath("$.data.checkResult").value("合格"));
  }

  @Test
  void factoryMaintCreateReturnsCreatedFactoryMaintRow() throws Exception {
    when(maintenanceService.createFactoryMaint(any(MaintenanceFactoryMaintUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "factoryMaintenanceId",
                25,
                "maintenanceItem",
                "屋面检修",
                "maintenanceStatus",
                "待处理"));

    mockMvc
        .perform(
            post("/maintenance/factoryMaint")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "maintenanceItem":"屋面检修",
                      "maintenanceStatus":"待处理",
                      "personInCharge":"钱七",
                      "startTime":"2026-06-30 11:00:00",
                      "factoryId":20,
                      "parkId":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryMaintenanceId").value(25))
        .andExpect(jsonPath("$.data.maintenanceStatus").value("待处理"));
  }
}
