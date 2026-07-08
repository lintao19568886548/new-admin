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
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第九批维保模块只读接口的路由、参数绑定和响应协议测试。 */
class NinthBatchControllerTest {

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
  void transformerDetailReturnsTransformerRow() throws Exception {
    when(maintenanceService.getTransformerDetail(11))
        .thenReturn(
            Map.of(
                "transformerId",
                11,
                "transformerName",
                "T1",
                "factoryName",
                "A栋厂房"));

    mockMvc
        .perform(get("/maintenance/transformer/11"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.transformerId").value(11))
        .andExpect(jsonPath("$.data.factoryName").value("A栋厂房"));
  }

  @Test
  void hygieneCheckListReturnsPagedRows() throws Exception {
    when(maintenanceService.getHygieneCheckList(
            eq(1),
            eq(20),
            isNull(),
            isNull(),
            eq(-1),
            eq(12),
            eq("地面"),
            eq("王"),
            eq("合格"),
            eq("2026-04-01"),
            eq("2026-04-30")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "hygieneCheckId",
                        21,
                        "checkItems",
                        "地面清洁",
                        "checkResult",
                        "合格",
                        "park",
                        "科技园")),
                1,
                1,
                20));

    mockMvc
        .perform(
            get("/maintenance/hygieneCheck/list")
                .param("currentPage", "1")
                .param("pageSize", "20")
                .param("currentPark", "-1")
                .param("factoryId", "12")
                .param("checkItems", "地面")
                .param("checker", "王")
                .param("checkResult", "合格")
                .param("startTime", "2026-04-01")
                .param("endTime", "2026-04-30"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].hygieneCheckId").value(21))
        .andExpect(jsonPath("$.data.items[0].checkResult").value("合格"));
  }

  @Test
  void hygieneCheckDetailReturnsRow() throws Exception {
    when(maintenanceService.getHygieneCheckDetail(21))
        .thenReturn(Map.of("hygieneCheckId", 21, "checkItems", "地面清洁", "checker", "王五"));

    mockMvc
        .perform(get("/maintenance/hygieneCheck/21"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.hygieneCheckId").value(21))
        .andExpect(jsonPath("$.data.checker").value("王五"));
  }

  @Test
  void factoryMaintListReturnsPagedRows() throws Exception {
    when(maintenanceService.getFactoryMaintList(
            eq(2),
            isNull(),
            eq(15),
            isNull(),
            eq(3),
            eq(12),
            eq("消防门"),
            eq("维护"),
            eq("李"),
            eq("2026-05-01"),
            eq("2026-05-31")))
        .thenReturn(
            new PageResult<>(
                List.of(
                    Map.of(
                        "factoryMaintenanceId",
                        31,
                        "maintenanceItem",
                        "消防门维护",
                        "maintenanceStatus",
                        "维护",
                        "factory",
                        "A栋厂房")),
                1,
                2,
                15));

    mockMvc
        .perform(
            get("/maintenance/factoryMaint/list")
                .param("currentPage", "2")
                .param("limit", "15")
                .param("currentPark", "3")
                .param("factoryId", "12")
                .param("maintenanceItem", "消防门")
                .param("maintenanceStatus", "维护")
                .param("personInCharge", "李")
                .param("startTime", "2026-05-01")
                .param("endTime", "2026-05-31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.currentPage").value(2))
        .andExpect(jsonPath("$.data.items[0].factoryMaintenanceId").value(31))
        .andExpect(jsonPath("$.data.items[0].factory").value("A栋厂房"));
    verify(maintenanceService)
        .getFactoryMaintList(2, null, 15, null, 3, 12, "消防门", "维护", "李", "2026-05-01", "2026-05-31");
  }

  @Test
  void factoryMaintDetailReturnsRow() throws Exception {
    when(maintenanceService.getFactoryMaintDetail(31))
        .thenReturn(
            Map.of(
                "factoryMaintenanceId",
                31,
                "maintenanceItem",
                "消防门维护",
                "personInCharge",
                "李四"));

    mockMvc
        .perform(get("/maintenance/factoryMaint/31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryMaintenanceId").value(31))
        .andExpect(jsonPath("$.data.personInCharge").value("李四"));
  }
}
