package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第二十三批招商雷达详情类只读接口的路由测试。 */
class TwentyThirdBatchControllerTest {

  private InvestmentService investmentService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    investmentService = org.mockito.Mockito.mock(InvestmentService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new InvestmentController(investmentService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void crawlerTaskDetailReturnsTask() throws Exception {
    when(investmentService.getCrawlerTaskDetail(eq(11L)))
        .thenReturn(
            Map.of(
                "requestConfigJson",
                Map.of("dryRun", true),
                "sourceName",
                "公开招商平台",
                "status",
                "RUNNING",
                "taskId",
                11));

    mockMvc
        .perform(get("/investment/radar/crawler-task/11"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value(11))
        .andExpect(jsonPath("$.data.requestConfigJson.dryRun").value(true));

    verify(investmentService).getCrawlerTaskDetail(11L);
  }

  @Test
  void crawlerTaskLogsReturnsItems() throws Exception {
    when(investmentService.getCrawlerTaskLogs(eq(11L)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "detailJson",
                        Map.of("count", 3),
                        "level",
                        "INFO",
                        "logId",
                        21,
                        "message",
                        "开始采集",
                        "taskId",
                        11)),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/crawler-task/11/log"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].logId").value(21))
        .andExpect(jsonPath("$.data.items[0].detailJson.count").value(3));

    verify(investmentService).getCrawlerTaskLogs(11L);
  }

  @Test
  void crawlerTaskItemsBindsPagingAndFilters() throws Exception {
    when(investmentService.getCrawlerTaskItems(eq(11L), eq(2), eq(10), eq(5), eq("FAILED")))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "itemId",
                        31,
                        "lastHttpStatus",
                        500,
                        "sourceUrl",
                        "https://example.test/detail/1",
                        "status",
                        "FAILED")),
                "page",
                Map.of("currentPage", 2, "pageSize", 10, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/crawler-task/11/item")
                .param("currentPage", "2")
                .param("pageSize", "10")
                .param("sourceId", "5")
                .param("status", "FAILED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.page.currentPage").value(2))
        .andExpect(jsonPath("$.data.items[0].lastHttpStatus").value(500));

    verify(investmentService).getCrawlerTaskItems(11L, 2, 10, 5, "FAILED");
  }

  @Test
  void signalEventDetailReturnsEvidences() throws Exception {
    when(investmentService.getSignalEventDetail(eq(41L)))
        .thenReturn(
            Map.of(
                "companyName",
                "信号公司",
                "evidences",
                List.of(Map.of("evidenceId", 51, "matchedKeywords", List.of("扩产"))),
                "eventId",
                41,
                "eventType",
                "EIA_EXPAND",
                "rawPayloadJson",
                Map.of("source", "notice")));

    mockMvc
        .perform(get("/investment/radar/signal-event/41"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.eventId").value(41))
        .andExpect(jsonPath("$.data.evidences[0].matchedKeywords[0]").value("扩产"));

    verify(investmentService).getSignalEventDetail(41L);
  }

  @Test
  void signalEventEvidencesReturnsItems() throws Exception {
    when(investmentService.getSignalEventEvidences(eq(41L)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "evidenceId",
                        51,
                        "eventId",
                        41,
                        "matchedSentences",
                        List.of("新增产线"),
                        "scoreDelta",
                        20)),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/signal-event/41/evidence"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].evidenceId").value(51))
        .andExpect(jsonPath("$.data.items[0].matchedSentences[0]").value("新增产线"));

    verify(investmentService).getSignalEventEvidences(41L);
  }
}
