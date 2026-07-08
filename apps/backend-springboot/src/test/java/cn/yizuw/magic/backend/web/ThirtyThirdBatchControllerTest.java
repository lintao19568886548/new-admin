package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.dashboard.overview.AnalyticsController;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewController;
import cn.yizuw.magic.backend.dashboard.overview.DashboardOverviewService;
import cn.yizuw.magic.backend.dashboard.overview.RevenueStatsQuery;
import cn.yizuw.magic.backend.integration.wechat.WechatPayController;
import cn.yizuw.magic.backend.integration.wechat.WechatPayPublicConfigService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundOrderService;
import cn.yizuw.magic.backend.integration.wework.WeworkCallbackController;
import cn.yizuw.magic.backend.integration.wework.WeworkCallbackService;
import cn.yizuw.magic.backend.park.ParkService;
import cn.yizuw.magic.backend.status.TestController;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十三批营收、退款订单、企业微信回调验证和测试路由只读接口测试。 */
class ThirtyThirdBatchControllerTest {

  private DashboardOverviewService dashboardOverviewService;
  private MockMvc mockMvc;
  private ParkService parkService;
  private WechatPayPublicConfigService wechatPayPublicConfigService;
  private WechatPayRefundOrderService wechatPayRefundOrderService;
  private WeworkCallbackService weworkCallbackService;

  @BeforeEach
  void setUp() {
    dashboardOverviewService = org.mockito.Mockito.mock(DashboardOverviewService.class);
    parkService = org.mockito.Mockito.mock(ParkService.class);
    wechatPayPublicConfigService = org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    wechatPayRefundOrderService = org.mockito.Mockito.mock(WechatPayRefundOrderService.class);
    weworkCallbackService = org.mockito.Mockito.mock(WeworkCallbackService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new DashboardOverviewController(dashboardOverviewService),
                new AnalyticsController(dashboardOverviewService, parkService),
                new WechatPayController(
                    wechatPayRefundOrderService, wechatPayPublicConfigService),
                new WeworkCallbackController(weworkCallbackService),
                new TestController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void dashboardRevenueStatsBindsPeriodAndPark() throws Exception {
    RevenueStatsQuery query =
        new RevenueStatsQuery("2026-06-29", "2026-06-30", "2026-06", "3", "2026-06-01");
    when(dashboardOverviewService.getRevenueStats(eq(query)))
        .thenReturn(
            Map.of(
                "periodLabel",
                "2026年6月1日-2026年6月30日",
                "summary",
                Map.of("billCount", 2, "receivableTotal", 1000.0, "receivedTotal", 800.0),
                "trend",
                Map.of(
                    "months",
                    List.of("2026-06"),
                    "receivable",
                    List.of(1000.0),
                    "received",
                    List.of(800.0),
                    "remaining",
                    List.of(200.0))));

    mockMvc
        .perform(
            get("/dashboard/revenue-stats")
                .param("date", "2026-06-29")
                .param("endDate", "2026-06-30")
                .param("month", "2026-06")
                .param("parkId", "3")
                .param("startDate", "2026-06-01"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.summary.billCount").value(2))
        .andExpect(jsonPath("$.data.trend.remaining[0]").value(200.0));

    verify(dashboardOverviewService).getRevenueStats(query);
  }

  @Test
  void analyticsRevenueOverviewReturnsSummaryAndTrend() throws Exception {
    when(dashboardOverviewService.getAnalyticsRevenueOverview(eq("all")))
        .thenReturn(
            Map.of(
                "summary",
                Map.of(
                    "expenseTotal",
                    120.0,
                    "incomeTotal",
                    300.0,
                    "netTotal",
                    180.0,
                    "yearLabel",
                    "2026年度"),
                "trend",
                Map.of(
                    "expense",
                    List.of(20.0),
                    "income",
                    List.of(50.0),
                    "months",
                    List.of("2026-06"),
                    "net",
                    List.of(30.0))));

    mockMvc
        .perform(get("/analytics/revenue-overview").param("parkId", "all"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.summary.netTotal").value(180.0))
        .andExpect(jsonPath("$.data.trend.net[0]").value(30.0));

    verify(dashboardOverviewService).getAnalyticsRevenueOverview("all");
  }

  @Test
  void refundOrdersReturnsCenterDatabaseOrderSnapshots() throws Exception {
    when(wechatPayRefundOrderService.listRefundOrders())
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "amountTotal",
                        98000,
                        "outTradeNo",
                        "vip_1",
                        "refundable",
                        true,
                        "tradeState",
                        "SUCCESS"))));

    mockMvc
        .perform(get("/wechat/pay/refund/orders"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].outTradeNo").value("vip_1"))
        .andExpect(jsonPath("$.data.items[0].refundable").value(true));

    verify(wechatPayRefundOrderService).listRefundOrders();
  }

  @Test
  void weworkCallbackReturnsPlainEcho() throws Exception {
    when(weworkCallbackService.verifyCallback(
            eq("encrypted-echo"), eq("sig"), eq("nonce-1"), eq("123456")))
        .thenReturn("plain-echo");

    mockMvc
        .perform(
            get("/wework/callback")
                .param("echostr", "encrypted-echo")
                .param("msg_signature", "sig")
                .param("nonce", "nonce-1")
                .param("timestamp", "123456"))
        .andExpect(status().isOk())
        .andExpect(content().string("plain-echo"));

    verify(weworkCallbackService).verifyCallback("encrypted-echo", "sig", "nonce-1", "123456");
  }

  @Test
  void testRouteKeepsLegacyPlainText() throws Exception {
    mockMvc
        .perform(get("/test"))
        .andExpect(status().isOk())
        .andExpect(content().string("Test get handler"));
  }
}
