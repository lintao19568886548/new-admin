package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewController;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewService;
import cn.yizuw.magic.backend.dashboard.overview.MeterStatisticsQuery;
import cn.yizuw.magic.backend.integration.wework.WeworkCallbackController;
import cn.yizuw.magic.backend.integration.wework.WeworkCallbackService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十八批表计本地统计和企业微信 POST 回调本地记录接口测试。 */
class SixtyEighthBatchControllerTest {

  private DashboardOverviewService dashboardOverviewService;
  private MockMvc mockMvc;
  private WeworkCallbackService weworkCallbackService;

  @BeforeEach
  void setUp() {
    dashboardOverviewService = org.mockito.Mockito.mock(DashboardOverviewService.class);
    weworkCallbackService = org.mockito.Mockito.mock(WeworkCallbackService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new DashboardOverviewController(dashboardOverviewService),
                new WeworkCallbackController(weworkCallbackService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void meterStatisticsBindsQueryAndReturnsLocalPayload() throws Exception {
    when(dashboardOverviewService.getMeterStatistics(any(MeterStatisticsQuery.class)))
        .thenReturn(
            Map.of(
                "source",
                "amount_bill_local",
                "totalMeters",
                2,
                "electricity",
                Map.of("meterCount", 1),
                "water",
                Map.of("meterCount", 1)));

    mockMvc
        .perform(
            get("/dashboard/meter-statistics")
                .param("date", "2026-06")
                .param("dateType", "month")
                .param("endDate", "2026-06-30")
                .param("parkId", "park-1")
                .param("projCode", "241")
                .param("startDate", "2026-06-01")
                .param("type", "all"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.source").value("amount_bill_local"))
        .andExpect(jsonPath("$.data.totalMeters").value(2))
        .andExpect(jsonPath("$.data.electricity.meterCount").value(1));

    verify(dashboardOverviewService)
        .getMeterStatistics(
            argThat(
                query ->
                    "2026-06".equals(query.date())
                        && "month".equals(query.dateType())
                        && "2026-06-30".equals(query.endDate())
                        && "park-1".equals(query.parkId())
                        && "2026-06-01".equals(query.startDate())
                        && "all".equals(query.type())
                        && "241".equals(query.projCode())));
  }

  @Test
  void postWeworkCallbackPassesRawXmlToService() throws Exception {
    String rawXml = "<xml><Event><![CDATA[add_external_contact]]></Event></xml>";
    when(weworkCallbackService.recordCallback(any(), any(), any(), any(), any()))
        .thenReturn("success");

    mockMvc
        .perform(
            post("/wework/callback")
                .queryParam("msg_signature", "msg-sig")
                .queryParam("nonce", "nonce-1")
                .queryParam("signature", "plain-sig")
                .queryParam("timestamp", "1782912000")
                .contentType(MediaType.APPLICATION_XML)
                .content(rawXml))
        .andExpect(status().isOk())
        .andExpect(content().string("success"));

    verify(weworkCallbackService)
        .recordCallback(rawXml, "msg-sig", "nonce-1", "plain-sig", "1782912000");
  }
}
