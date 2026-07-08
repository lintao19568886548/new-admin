package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.integration.ymsino.YmsinoController;
import cn.yizuw.magic.backend.integration.ymsino.YmsinoMeterKind;
import cn.yizuw.magic.backend.integration.ymsino.YmsinoService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第一百六十批亿玛表计只读兼容接口的路由和参数绑定测试。 */
class OneHundredSixtiethBatchControllerTest {

  private MockMvc mockMvc;
  private YmsinoService ymsinoService;

  @BeforeEach
  void setUp() {
    ymsinoService = org.mockito.Mockito.mock(YmsinoService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new YmsinoController(ymsinoService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void waterDataReturnsPagedFrozenReadings() throws Exception {
    org.mockito.Mockito.when(
            ymsinoService.getData(
                eq(YmsinoMeterKind.WATER), eq("W001"), eq(2), eq(15), eq("YZWL"), eq("2026-07-04")))
        .thenReturn(
            Map.of(
                "currentPage",
                2,
                "items",
                List.of(Map.of("comAddress", "W001", "dataValue", "12.5")),
                "pageSize",
                15,
                "total",
                1));

    mockMvc
        .perform(
            get("/ymsino/waterinfo/data")
                .param("comAddress", "W001")
                .param("page", "2")
                .param("pageSize", "15")
                .param("ptId", "YZWL")
                .param("tyDate", "2026-07-04"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.items[0].comAddress").value("W001"));
  }

  @Test
  void waterTreeReturnsDiagnosticEnvelopeWhenRequested() throws Exception {
    org.mockito.Mockito.when(
            ymsinoService.getTree(eq(YmsinoMeterKind.WATER), eq("A栋"), eq("YZWL"), eq("1")))
        .thenReturn(
            Map.of(
                "diagnostics",
                Map.of("bindingValidated", true),
                "items",
                List.of(Map.of("title", "A栋", "key", "A栋", "children", List.of()))));

    mockMvc
        .perform(
            get("/ymsino/waterinfo/tree")
                .param("keyword", "A栋")
                .param("ptId", "YZWL")
                .param("includeDiagnostics", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.diagnostics.bindingValidated").value(true))
        .andExpect(jsonPath("$.data.items[0].title").value("A栋"));
  }

  @Test
  void meterDataFallsBackToCurrentPageParam() throws Exception {
    org.mockito.Mockito.when(
            ymsinoService.getData(
                eq(YmsinoMeterKind.ELECTRIC),
                eq("E001,E002"),
                eq(3),
                eq(20),
                eq(null),
                eq("2026-07-04")))
        .thenReturn(
            Map.of(
                "currentPage",
                3,
                "items",
                List.of(Map.of("comAddress", "E001", "dataValue1", "1.5")),
                "pageSize",
                20,
                "total",
                2));

    mockMvc
        .perform(
            get("/ymsino/meterinfo/data")
                .param("comAddress", "E001,E002")
                .param("currentPage", "3")
                .param("pageSize", "20")
                .param("tyDate", "2026-07-04"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currentPage").value(3))
        .andExpect(jsonPath("$.data.items[0].dataValue1").value("1.5"));
  }

  @Test
  void meterTreeReturnsTreeArray() throws Exception {
    org.mockito.Mockito.when(
            ymsinoService.getTree(eq(YmsinoMeterKind.ELECTRIC), eq(null), eq(null), eq(null)))
        .thenReturn(List.of(Map.of("title", "1楼", "key", "R001", "children", List.of())));

    mockMvc
        .perform(get("/ymsino/meterinfo/tree"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].key").value("R001"));
  }
}
