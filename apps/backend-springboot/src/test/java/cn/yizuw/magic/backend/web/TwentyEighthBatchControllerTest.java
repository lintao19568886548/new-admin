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
import cn.yizuw.magic.backend.investment.RadarLeadQuery;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第二十八批招商雷达线索和 SOP 只读接口的路由测试。 */
class TwentyEighthBatchControllerTest {

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
  void radarLeadListReturnsPagedLeads() throws Exception {
    when(investmentService.getRadarLeadList(any(RadarLeadQuery.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "enterpriseName",
                        "测试企业",
                        "leadId",
                        101,
                        "priorityLevel",
                        "A",
                        "stage",
                        "NEW",
                        "totalScore",
                        88)),
                "page",
                Map.of("currentPage", 1, "pageSize", 20, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/lead/list")
                .param("keyword", "测试")
                .param("priorityLevel", "A")
                .param("stage", "NEW")
                .param("parkId", "3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].leadId").value(101))
        .andExpect(jsonPath("$.data.items[0].totalScore").value(88));

    verify(investmentService).getRadarLeadList(any(RadarLeadQuery.class));
  }

  @Test
  void radarLeadDetailReturnsNavigationAndOutreachSummary() throws Exception {
    when(investmentService.getRadarLeadDetail(eq(101L)))
        .thenReturn(
            Map.of(
                "enterpriseName",
                "测试企业",
                "leadId",
                101,
                "navigation",
                Map.of("nextLead", Map.of("leadId", 102), "previousLead", Map.of("leadId", 100)),
                "outreachSummary",
                Map.of("count", 2),
                "stage",
                "CONTACTED"));

    mockMvc
        .perform(get("/investment/radar/lead/101"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.leadId").value(101))
        .andExpect(jsonPath("$.data.outreachSummary.count").value(2))
        .andExpect(jsonPath("$.data.navigation.nextLead.leadId").value(102));

    verify(investmentService).getRadarLeadDetail(101L);
  }

  @Test
  void radarLeadScoreBreakdownReturnsItems() throws Exception {
    when(investmentService.getRadarLeadScoreBreakdown(eq(101L)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "breakdownId",
                        9,
                        "eventTitle",
                        "招聘扩张",
                        "leadId",
                        101,
                        "scoreDelta",
                        20)),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/lead/101/score-breakdown"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].eventTitle").value("招聘扩张"))
        .andExpect(jsonPath("$.data.items[0].scoreDelta").value(20));

    verify(investmentService).getRadarLeadScoreBreakdown(101L);
  }

  @Test
  void radarSopReminderListReturnsSummaryAndItems() throws Exception {
    when(investmentService.getRadarSopReminderList(
            any(RadarLeadQuery.class), eq("PENDING"), eq("NEW_LEAD")))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "enterpriseName",
                        "测试企业",
                        "leadId",
                        101,
                        "reminderId",
                        12,
                        "reminderStatus",
                        "PENDING",
                        "reminderType",
                        "NEW_LEAD")),
                "page",
                Map.of("currentPage", 1, "pageSize", 20, "total", 1),
                "summary",
                Map.of("pendingReminders", 1, "totalReminders", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/sop-reminder/list")
                .param("reminderStatus", "PENDING")
                .param("reminderType", "NEW_LEAD")
                .param("priorityLevel", "A"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].reminderId").value(12))
        .andExpect(jsonPath("$.data.summary.pendingReminders").value(1));

    verify(investmentService)
        .getRadarSopReminderList(any(RadarLeadQuery.class), eq("PENDING"), eq("NEW_LEAD"));
  }

  @Test
  void radarLeadSopReturnsRecordsAndReminders() throws Exception {
    when(investmentService.getRadarLeadSop(eq(101L)))
        .thenReturn(
            Map.of(
                "assignmentRecords",
                List.of(Map.of("ownerName", "招商A")),
                "followRecords",
                List.of(Map.of("recordId", 5, "followResult", "CONTACTED")),
                "reminders",
                List.of(Map.of("reminderType", "NEW_LEAD", "title", "新线索待联系")),
                "visitRecords",
                List.of()));

    mockMvc
        .perform(get("/investment/radar/lead/101/sop"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.assignmentRecords[0].ownerName").value("招商A"))
        .andExpect(jsonPath("$.data.reminders[0].reminderType").value("NEW_LEAD"));

    verify(investmentService).getRadarLeadSop(101L);
  }
}
