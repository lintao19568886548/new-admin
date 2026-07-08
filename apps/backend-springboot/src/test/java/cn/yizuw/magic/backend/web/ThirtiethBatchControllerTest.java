package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.RadarOperationAuditQuery;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十批招商雷达模板转化、爬虫运维和审计只读接口的路由测试。 */
class ThirtiethBatchControllerTest {

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
  void radarTemplateConversionAnalyticsReturnsTemplateRows() throws Exception {
    when(investmentService.getRadarTemplateConversionAnalytics())
        .thenReturn(
            List.of(
                Map.of(
                    "dealLeads",
                    2,
                    "dealRate",
                    20.0,
                    "sentTasks",
                    10,
                    "templateCode",
                    "RADAR_A_SMS",
                    "templateName",
                    "A 类短信",
                    "totalTasks",
                    12)));

    mockMvc
        .perform(get("/investment/radar/analytics/template-conversion"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].templateCode").value("RADAR_A_SMS"))
        .andExpect(jsonPath("$.data[0].dealLeads").value(2));

    verify(investmentService).getRadarTemplateConversionAnalytics();
  }

  @Test
  void crawlerTaskOpsSummaryBindsSourceFilters() throws Exception {
    when(investmentService.getCrawlerTaskOpsSummary(eq(7), eq("PUBLIC_OPPORTUNITY_99CFW")))
        .thenReturn(
            Map.of(
                "itemStatus",
                Map.of("FAILED", 2),
                "latestFailedItems",
                List.of(Map.of("itemId", 9, "status", "FAILED")),
                "latestTask",
                Map.of("taskId", 11, "status", "SUCCESS"),
                "scheduler",
                Map.of("canRunNow", true, "enabled", true, "reason", ""),
                "source",
                Map.of("sourceCode", "PUBLIC_OPPORTUNITY_99CFW", "sourceId", 7),
                "taskStatus",
                Map.of("SUCCESS", 3)));

    mockMvc
        .perform(
            get("/investment/radar/crawler-task/ops-summary")
                .param("sourceId", "7")
                .param("sourceCode", "PUBLIC_OPPORTUNITY_99CFW"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.source.sourceId").value(7))
        .andExpect(jsonPath("$.data.latestTask.taskId").value(11))
        .andExpect(jsonPath("$.data.itemStatus.FAILED").value(2));

    verify(investmentService).getCrawlerTaskOpsSummary(7, "PUBLIC_OPPORTUNITY_99CFW");
  }

  @Test
  void crawlerTaskHealthReturnsSummaryAndSources() throws Exception {
    when(investmentService.getCrawlerTaskHealth())
        .thenReturn(
            Map.of(
                "generatedAt",
                "2026-06-29T00:00:00Z",
                "scheduler",
                Map.of("active", false, "enabled", true),
                "sources",
                List.of(Map.of("healthStatus", "WARNING", "sourceCode", "PUBLIC_OPPORTUNITY_99CFW")),
                "summary",
                Map.of("sourceCount", 1, "warningSourceCount", 1)));

    mockMvc
        .perform(get("/investment/radar/crawler-task/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.summary.sourceCount").value(1))
        .andExpect(jsonPath("$.data.sources[0].healthStatus").value("WARNING"));

    verify(investmentService).getCrawlerTaskHealth();
  }

  @Test
  void crawlerTaskAuditListBindsFilters() throws Exception {
    when(investmentService.getCrawlerTaskAuditList(any(RadarOperationAuditQuery.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "action",
                        "CRAWLER_RUN",
                        "actorName",
                        "管理员",
                        "auditId",
                        21,
                        "objectType",
                        "crawler_task",
                        "result",
                        "SUCCESS")),
                "page",
                Map.of("currentPage", 2, "pageSize", 10, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/crawler-task/audit/list")
                .param("action", "CRAWLER_RUN")
                .param("currentPage", "2")
                .param("keyword", "管理")
                .param("objectType", "crawler_task")
                .param("pageSize", "10")
                .param("result", "SUCCESS"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].auditId").value(21))
        .andExpect(jsonPath("$.data.page.currentPage").value(2));

    verify(investmentService).getCrawlerTaskAuditList(any(RadarOperationAuditQuery.class));
  }

  @Test
  void crawlerTaskSchedulerStatusReturnsRuntimeShape() throws Exception {
    when(investmentService.getCrawlerTaskSchedulerStatus())
        .thenReturn(
            Map.of(
                "active",
                false,
                "dailyRunHour",
                8,
                "enabled",
                true,
                "mode",
                "DEMAND",
                "running",
                false,
                "scheduleType",
                "DAILY",
                "version",
                "public-crawler-daily-8-demand-v1"));

    mockMvc
        .perform(get("/investment/radar/crawler-task/scheduler/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.active").value(false))
        .andExpect(jsonPath("$.data.scheduleType").value("DAILY"));

    verify(investmentService).getCrawlerTaskSchedulerStatus();
  }
}
