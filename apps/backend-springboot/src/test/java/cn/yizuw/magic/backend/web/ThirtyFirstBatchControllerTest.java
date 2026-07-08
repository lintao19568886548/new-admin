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

/** 第三十一批招商雷达公开机会审计、采集任务、房源匹配和限制导出只读接口测试。 */
class ThirtyFirstBatchControllerTest {

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
  void publicOpportunityAuditSummaryBindsRefreshFlag() throws Exception {
    when(investmentService.getPublicOpportunityAuditSummary(eq("true")))
        .thenReturn(
            Map.of(
                "generatedAt",
                "2026-06-29T00:00:00Z",
                "issues",
                Map.of("missingCity", 2, "stalePublishedAt", 1),
                "summary",
                Map.of("issueCount", 3, "total", 20)));

    mockMvc
        .perform(get("/investment/radar/public-opportunity/audit-summary").param("refresh", "true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.summary.total").value(20))
        .andExpect(jsonPath("$.data.issues.missingCity").value(2));

    verify(investmentService).getPublicOpportunityAuditSummary("true");
  }

  @Test
  void publicOpportunityAuditPreviewReturnsIssueRows() throws Exception {
    when(investmentService.getPublicOpportunityAuditPreview())
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "issueCode",
                        "MISSING_CITY",
                        "opportunityId",
                        9,
                        "sourceSite",
                        "99cfw",
                        "title",
                        "测试公开机会")),
                "limit",
                50,
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/public-opportunity/audit-preview"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].opportunityId").value(9))
        .andExpect(jsonPath("$.data.items[0].issueCode").value("MISSING_CITY"));

    verify(investmentService).getPublicOpportunityAuditPreview();
  }

  @Test
  void radarCollectTaskDetailReturnsTaskSnapshot() throws Exception {
    when(investmentService.getRadarCollectTaskDetail(eq("task-1")))
        .thenReturn(
            Map.of(
                "createdAt",
                "2026-06-29T00:00:00Z",
                "progress",
                80,
                "status",
                "RUNNING",
                "taskId",
                "task-1"));

    mockMvc
        .perform(get("/investment/radar/collect/task/task-1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value("task-1"))
        .andExpect(jsonPath("$.data.status").value("RUNNING"));

    verify(investmentService).getRadarCollectTaskDetail("task-1");
  }

  @Test
  void radarLeadPropertyMatchReturnsSavedMatches() throws Exception {
    when(investmentService.getRadarLeadPropertyMatch(eq(101L)))
        .thenReturn(
            List.of(
                Map.of(
                    "factoryId",
                    7,
                    "leadId",
                    101,
                    "matchScore",
                    86,
                    "propertyName",
                    "测试厂房")));

    mockMvc
        .perform(get("/investment/radar/lead/101/property-match"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].leadId").value(101))
        .andExpect(jsonPath("$.data[0].matchScore").value(86));

    verify(investmentService).getRadarLeadPropertyMatch(101L);
  }

  @Test
  void contactRestrictionExportReturnsJsonRowsByDefault() throws Exception {
    when(investmentService.exportContactRestrictions(eq("测试"), eq("BLACKLIST"), eq("ACTIVE")))
        .thenReturn(
            Map.of(
                "rows",
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
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/contact-restriction/export")
                .param("keyword", "测试")
                .param("restrictionType", "BLACKLIST")
                .param("status", "ACTIVE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rows[0].restrictionId").value(3))
        .andExpect(jsonPath("$.data.total").value(1));

    verify(investmentService).exportContactRestrictions("测试", "BLACKLIST", "ACTIVE");
  }
}
