package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.maintenance.MaintenanceController;
import cn.yizuw.magic.backend.maintenance.MaintenanceService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八批维保模块只读接口的路由、参数绑定和响应协议测试。 */
class EighthBatchControllerTest {

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
  void elevatorListReturnsPagedElevatorRows() throws Exception {
    when(maintenanceService.getElevatorList(
            eq(1),
            isNull(),
            eq(20),
            isNull(),
            eq(-1),
            eq(12),
            eq("A栋"),
            eq("正常"),
            isNull(),
            eq("2"),
            isNull(),
            eq("王"),
            eq("2x2"),
            eq("2025-01-01"),
            eq("2025-01-31"),
            isNull(),
            isNull(),
            eq("2026-01-01"),
            eq("2026-01-31")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "elevatorId",
                        8,
                        "name",
                        "A栋客梯",
                        "factory",
                        "A栋厂房",
                        "loadCapacity",
                        new BigDecimal("2.00"))),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/maintenance/elevator/list")
                .param("currentPage", "1")
                .param("limit", "20")
                .param("currentPark", "-1")
                .param("factoryId", "12")
                .param("name", "A栋")
                .param("status", "正常")
                .param("loadCapacity", "2")
                .param("checker", "王")
                .param("size", "2x2")
                .param("productionDateStart", "2025-01-01")
                .param("productionDateEnd", "2025-01-31")
                .param("startTime", "2026-01-01")
                .param("endTime", "2026-01-31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].elevatorId").value(8))
        .andExpect(jsonPath("$.data.items[0].factory").value("A栋厂房"));
  }

  @Test
  void elevatorDetailReturnsElevatorRow() throws Exception {
    when(maintenanceService.getElevatorDetail(8))
        .thenReturn(Map.of("elevatorId", 8, "name", "A栋客梯", "status", "正常"));

    mockMvc
        .perform(get("/maintenance/elevator/8"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.elevatorId").value(8))
        .andExpect(jsonPath("$.data.name").value("A栋客梯"));
  }

  @Test
  void firefightingListReturnsPagedFirefightingRows() throws Exception {
    when(maintenanceService.getFirefightingList(
            eq(2),
            eq(10),
            isNull(),
            isNull(),
            eq(3),
            eq(12),
            eq("消防"),
            eq("深圳"),
            eq("正常"),
            eq("异常"),
            eq("维护"),
            eq("李"),
            eq("2026-02-01"),
            eq("2026-02-28")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "firefightingId",
                        9,
                        "firefightingName",
                        "消防设施",
                        "factory",
                        "A栋厂房",
                        "park",
                        "科技园")),
                1,
                2,
                10));

    mockMvc
        .perform(
            get("/maintenance/firefighting/list")
                .param("currentPage", "2")
                .param("pageSize", "10")
                .param("currentPark", "3")
                .param("factoryId", "12")
                .param("firefightingName", "消防")
                .param("address", "深圳")
                .param("extinguisher", "正常")
                .param("hydrant", "异常")
                .param("fireExit", "维护")
                .param("checker", "李")
                .param("startTime", "2026-02-01")
                .param("endTime", "2026-02-28"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.currentPage").value(2))
        .andExpect(jsonPath("$.data.items[0].firefightingId").value(9))
        .andExpect(jsonPath("$.data.items[0].park").value("科技园"));
  }

  @Test
  void firefightingDetailReturnsFirefightingRow() throws Exception {
    when(maintenanceService.getFirefightingDetail(9))
        .thenReturn(Map.of("firefightingId", 9, "extinguisher", "正常", "hydrant", "异常"));

    mockMvc
        .perform(get("/maintenance/firefighting/9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.firefightingId").value(9))
        .andExpect(jsonPath("$.data.hydrant").value("异常"));
  }

  @Test
  void transformerListReturnsPagedTransformerRows() throws Exception {
    when(maintenanceService.getTransformerList(
            eq(1),
            isNull(),
            eq(15),
            isNull(),
            eq(-1),
            eq(12),
            eq("T1"),
            eq("深圳"),
            eq("赵"),
            eq("维护"),
            eq("10kV"),
            eq("2026-03-01"),
            eq("2026-03-31")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "transformerId",
                        11,
                        "transformerName",
                        "T1",
                        "factoryName",
                        "A栋厂房",
                        "status",
                        "维护")),
                1,
                1,
                15));

    mockMvc
        .perform(
            get("/maintenance/transformer/list")
                .param("currentPage", "1")
                .param("limit", "15")
                .param("currentPark", "-1")
                .param("factoryId", "12")
                .param("transformerName", "T1")
                .param("address", "深圳")
                .param("checker", "赵")
                .param("status", "维护")
                .param("specifications", "10kV")
                .param("startTime", "2026-03-01")
                .param("endTime", "2026-03-31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].transformerId").value(11))
        .andExpect(jsonPath("$.data.items[0].factoryName").value("A栋厂房"));
    verify(maintenanceService)
        .getTransformerList(1, null, 15, null, -1, 12, "T1", "深圳", "赵", "维护", "10kV", "2026-03-01", "2026-03-31");
  }
}
