package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.ContactRestrictionAuditQuery;
import cn.yizuw.magic.backend.investment.ContactRestrictionQuery;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第二十九批招商雷达触达建议、限制名单和剩余分析只读接口的路由测试。 */
class TwentyNinthBatchControllerTest {

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
  void radarSalesFunnelAnalyticsReturnsFunnel() throws Exception {
    when(investmentService.getRadarSalesFunnelAnalytics())
        .thenReturn(
            Map.of(
                "assignedLeads",
                8,
                "contactRate",
                60.0,
                "contactedLeads",
                6,
                "dealLeads",
                2,
                "newLeads",
                3));

    mockMvc
        .perform(get("/investment/radar/analytics/sales-funnel"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.assignedLeads").value(8))
        .andExpect(jsonPath("$.data.dealLeads").value(2));

    verify(investmentService).getRadarSalesFunnelAnalytics();
  }

  @Test
  void radarRoiAnalyticsReturnsChannelItems() throws Exception {
    when(investmentService.getRadarRoiAnalytics())
        .thenReturn(
            List.of(
                Map.of(
                    "channel",
                    "SMS",
                    "dealLeads",
                    1,
                    "estimatedCost",
                    0.8,
                    "estimatedRevenue",
                    10_000,
                    "roi",
                    12_499.0,
                    "sentTasks",
                    10)));

    mockMvc
        .perform(get("/investment/radar/analytics/roi"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].channel").value("SMS"))
        .andExpect(jsonPath("$.data[0].estimatedRevenue").value(10_000));

    verify(investmentService).getRadarRoiAnalytics();
  }

  @Test
  void radarLeadOutreachSuggestionReturnsTemplatesAndRestrictionReason() throws Exception {
    when(investmentService.getRadarLeadOutreachSuggestion(eq(101L)))
        .thenReturn(
            Map.of(
                "canContact",
                true,
                "companyName",
                "测试企业",
                "contactRestrictionReason",
                "",
                "leadId",
                101,
                "suggestions",
                List.of(
                    Map.of(
                        "channel",
                        "SMS",
                        "suggestedContent",
                        "您好，测试企业有厂房需求",
                        "templateCode",
                        "RADAR_A_SMS",
                        "templateId",
                        7))));

    mockMvc
        .perform(get("/investment/radar/lead/101/outreach-suggestion"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.leadId").value(101))
        .andExpect(jsonPath("$.data.suggestions[0].templateCode").value("RADAR_A_SMS"));

    verify(investmentService).getRadarLeadOutreachSuggestion(101L);
  }

  @Test
  void contactRestrictionListReturnsSummaryAndItems() throws Exception {
    when(investmentService.getContactRestrictionList(any(ContactRestrictionQuery.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "enterpriseName",
                        "测试企业",
                        "phoneNumber",
                        "13800138000",
                        "restrictionId",
                        3,
                        "restrictionType",
                        "BLACKLIST",
                        "status",
                        "ACTIVE")),
                "page",
                Map.of("currentPage", 1, "pageSize", 20, "total", 1),
                "summary",
                Map.of("activeRestrictions", 1, "totalRestrictions", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/contact-restriction/list")
                .param("keyword", "测试")
                .param("restrictionType", "BLACKLIST")
                .param("status", "ACTIVE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].restrictionId").value(3))
        .andExpect(jsonPath("$.data.summary.activeRestrictions").value(1));

    verify(investmentService).getContactRestrictionList(any(ContactRestrictionQuery.class));
  }

  @Test
  void contactRestrictionAuditListReturnsAuditRows() throws Exception {
    when(investmentService.getContactRestrictionAuditList(any(ContactRestrictionAuditQuery.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "action",
                        "CREATE",
                        "actorName",
                        "招商A",
                        "auditId",
                        11,
                        "restrictionId",
                        3)),
                "page",
                Map.of("currentPage", 1, "pageSize", 20, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/contact-restriction/audit/list")
                .param("action", "CREATE")
                .param("keyword", "招商")
                .param("restrictionId", "3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].auditId").value(11))
        .andExpect(jsonPath("$.data.items[0].action").value("CREATE"));

    verify(investmentService).getContactRestrictionAuditList(any(ContactRestrictionAuditQuery.class));
  }
}
