package cn.yizuw.magic.backend.web;

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

/** 第二十七批招商雷达分析看板只读接口的路由测试。 */
class TwentySeventhBatchControllerTest {

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
  void radarAnalysisSummaryReturnsFunnelAndSuggestions() throws Exception {
    when(investmentService.getRadarAnalysisSummary())
        .thenReturn(
            Map.of(
                "channelStats",
                List.of(Map.of("channel", "SMS", "totalTasks", 10)),
                "funnel",
                Map.of("totalLeads", 20, "contactRate", 60.0, "dealLeads", 3),
                "generatedAt",
                "2026-06-27T10:00:00Z",
                "ownerStats",
                List.of(Map.of("ownerName", "招商A", "totalLeads", 8)),
                "suggestions",
                List.of(Map.of("title", "提升触达", "level", "warning"))));

    mockMvc
        .perform(get("/investment/radar/analysis/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.funnel.totalLeads").value(20))
        .andExpect(jsonPath("$.data.channelStats[0].channel").value("SMS"))
        .andExpect(jsonPath("$.data.suggestions[0].title").value("提升触达"));

    verify(investmentService).getRadarAnalysisSummary();
  }

  @Test
  void radarAcquisitionAnalyticsReturnsFunnelAndConversions() throws Exception {
    when(investmentService.getRadarAcquisitionAnalytics())
        .thenReturn(
            Map.of(
                "funnel",
                Map.of("companyLeadTotal", 30, "conversionRate", 40.0, "convertedToRadar", 12),
                "signalTypeConversion",
                List.of(Map.of("eventType", "RECRUITMENT", "radarLeads", 5)),
                "sourceConversion",
                List.of(Map.of("sourceName", "公开机会", "convertedLeads", 12))));

    mockMvc
        .perform(get("/investment/radar/analytics/acquisition"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.funnel.convertedToRadar").value(12))
        .andExpect(jsonPath("$.data.sourceConversion[0].sourceName").value("公开机会"));

    verify(investmentService).getRadarAcquisitionAnalytics();
  }

  @Test
  void radarChannelAnalyticsReturnsChannelItems() throws Exception {
    when(investmentService.getRadarChannelAnalytics())
        .thenReturn(
            List.of(
                Map.of(
                    "channel",
                    "SMS",
                    "positiveRate",
                    25.0,
                    "repliedTasks",
                    4,
                    "sendRate",
                    80.0,
                    "totalTasks",
                    10)));

    mockMvc
        .perform(get("/investment/radar/analytics/channel"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].channel").value("SMS"))
        .andExpect(jsonPath("$.data[0].sendRate").value(80.0));

    verify(investmentService).getRadarChannelAnalytics();
  }

  @Test
  void radarTemplateAnalyticsReturnsTemplateItems() throws Exception {
    when(investmentService.getRadarTemplateAnalytics())
        .thenReturn(
            List.of(
                Map.of(
                    "positiveReplies",
                    2,
                    "replyRate",
                    50.0,
                    "templateCode",
                    "RADAR_A_SMS",
                    "templateName",
                    "A级线索短信",
                    "totalTasks",
                    8)));

    mockMvc
        .perform(get("/investment/radar/analytics/template"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].templateCode").value("RADAR_A_SMS"))
        .andExpect(jsonPath("$.data[0].replyRate").value(50.0));

    verify(investmentService).getRadarTemplateAnalytics();
  }

  @Test
  void radarSalesAnalyticsReturnsOwnerItems() throws Exception {
    when(investmentService.getRadarSalesAnalytics())
        .thenReturn(
            List.of(
                Map.of(
                    "contactRate",
                    70.0,
                    "dealLeads",
                    2,
                    "ownerName",
                    "招商A",
                    "ownerUserId",
                    9,
                    "totalLeads",
                    10)));

    mockMvc
        .perform(get("/investment/radar/analytics/sales"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].ownerName").value("招商A"))
        .andExpect(jsonPath("$.data[0].dealLeads").value(2));

    verify(investmentService).getRadarSalesAnalytics();
  }
}
