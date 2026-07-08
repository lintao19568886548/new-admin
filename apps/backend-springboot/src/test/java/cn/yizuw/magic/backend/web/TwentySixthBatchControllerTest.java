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
import cn.yizuw.magic.backend.investment.OutreachTaskQuery;
import cn.yizuw.magic.backend.investment.OutreachTemplateQuery;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第二十六批招商雷达触达模板和触达任务只读接口的路由测试。 */
class TwentySixthBatchControllerTest {

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
  void outreachTemplateListReturnsPagedTemplates() throws Exception {
    when(investmentService.getOutreachTemplateList(any(OutreachTemplateQuery.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "channel",
                        "SMS",
                        "enabled",
                        true,
                        "placeholderJson",
                        List.of("companyName", "parkName"),
                        "templateCode",
                        "RADAR_A_SMS",
                        "templateId",
                        11,
                        "templateName",
                        "A级线索短信首触达")),
                "page",
                Map.of("currentPage", 1, "pageSize", 20, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/outreach-template/list")
                .param("approvalStatus", "APPROVED")
                .param("channel", "SMS")
                .param("enabled", "true")
                .param("keyword", "A级"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].templateCode").value("RADAR_A_SMS"))
        .andExpect(jsonPath("$.data.items[0].placeholderJson[0]").value("companyName"));

    verify(investmentService).getOutreachTemplateList(any(OutreachTemplateQuery.class));
  }

  @Test
  void outreachTemplateStatsReturnsItems() throws Exception {
    when(investmentService.getOutreachTemplateStats())
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "failedTasks",
                        1,
                        "positiveReplies",
                        2,
                        "sentTasks",
                        8,
                        "templateCode",
                        "RADAR_A_SMS",
                        "templateId",
                        11,
                        "totalTasks",
                        10)),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/outreach-template/stats"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].sentTasks").value(8))
        .andExpect(jsonPath("$.data.items[0].positiveReplies").value(2));

    verify(investmentService).getOutreachTemplateStats();
  }

  @Test
  void outreachTemplateVersionsReturnsItems() throws Exception {
    when(investmentService.getOutreachTemplateVersions(eq(11L)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "changeType",
                        "UPDATE",
                        "templateCode",
                        "RADAR_A_SMS",
                        "templateId",
                        11,
                        "versionId",
                        21,
                        "versionNo",
                        2)),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/outreach-template/11/versions"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].versionId").value(21))
        .andExpect(jsonPath("$.data.items[0].changeType").value("UPDATE"));

    verify(investmentService).getOutreachTemplateVersions(11L);
  }

  @Test
  void outreachTaskListReturnsSummaryAndItems() throws Exception {
    when(investmentService.getOutreachTaskList(any(OutreachTaskQuery.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "enterpriseName",
                        "意向企业",
                        "leadId",
                        31,
                        "replyStatus",
                        "NO_REPLY",
                        "status",
                        "PENDING",
                        "taskId",
                        41,
                        "templateCode",
                        "RADAR_A_SMS")),
                "page",
                Map.of("currentPage", 1, "pageSize", 20, "total", 1),
                "summary",
                Map.of("pendingTasks", 1, "sentTasks", 0, "totalTasks", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/outreach-task/list")
                .param("status", "PENDING")
                .param("channel", "SMS")
                .param("priorityLevel", "A"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].taskId").value(41))
        .andExpect(jsonPath("$.data.summary.pendingTasks").value(1));

    verify(investmentService).getOutreachTaskList(any(OutreachTaskQuery.class));
  }

  @Test
  void outreachTaskDetailReturnsTaskAndLeadSnapshot() throws Exception {
    when(investmentService.getOutreachTaskDetail(eq(41L)))
        .thenReturn(
            Map.of(
                "enterpriseId",
                51,
                "enterpriseName",
                "意向企业",
                "leadId",
                31,
                "parkName",
                "测试园区",
                "providerResponseJson",
                Map.of("requestId", "abc"),
                "taskId",
                41,
                "totalScore",
                88));

    mockMvc
        .perform(get("/investment/radar/outreach-task/41"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value(41))
        .andExpect(jsonPath("$.data.providerResponseJson.requestId").value("abc"));

    verify(investmentService).getOutreachTaskDetail(41L);
  }
}
