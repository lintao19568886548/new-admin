package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.PublicOpportunityParseDemandPageRequest;
import cn.yizuw.magic.backend.investment.PublicOpportunityRepairRequest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十四批招商雷达公开机会本地处理和触达发送路由测试。 */
class SeventyFourthBatchControllerTest {

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
  void parseDemandPageReturnsAcceptedOpportunity() throws Exception {
    when(investmentService.parsePublicOpportunityDemandPage(
            any(PublicOpportunityParseDemandPageRequest.class)))
        .thenReturn(
            Map.of(
                "accepted",
                true,
                "created",
                true,
                "opportunity",
                Map.of("opportunityId", 91, "title", "深圳企业求租厂房"),
                "skipReason",
                ""));

    mockMvc
        .perform(
            post("/investment/radar/public-opportunity/parse-demand-page")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "sourceUrl":"https://example.com/demand/1",
                      "sourceSite":"example.com",
                      "html":"<html><title>深圳企业求租厂房</title><body>需求面积：3000平方米 联系电话：13800138000</body></html>"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.accepted").value(true))
        .andExpect(jsonPath("$.data.opportunity.opportunityId").value(91));

    verify(investmentService).parsePublicOpportunityDemandPage(any(PublicOpportunityParseDemandPageRequest.class));
  }

  @Test
  void repairPublicOpportunityHistoryReturnsDryRunSummary() throws Exception {
    when(investmentService.repairPublicOpportunityHistory(any(PublicOpportunityRepairRequest.class)))
        .thenReturn(
            Map.of(
                "auditMode",
                "DRY_RUN",
                "dryRun",
                true,
                "plannedDowngradeCount",
                3,
                "previewItems",
                List.of(Map.of("opportunityId", 10, "proposedDowngradeStatus", "INVALID"))));

    mockMvc
        .perform(
            post("/investment/radar/public-opportunity/repair")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"dryRun\":true,\"limit\":5}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.auditMode").value("DRY_RUN"))
        .andExpect(jsonPath("$.data.previewItems[0].opportunityId").value(10));

    verify(investmentService).repairPublicOpportunityHistory(any(PublicOpportunityRepairRequest.class));
  }

  @Test
  void rebuildExternalLeadsFromPublicOpportunityReturnsCounters() throws Exception {
    when(investmentService.rebuildExternalLeadsFromPublicOpportunity())
        .thenReturn(
            Map.of(
                "createdLeadCount",
                1,
                "matchedCount",
                2,
                "sampleLeadIds",
                List.of(101),
                "scannedCount",
                4,
                "skippedCount",
                2));

    mockMvc
        .perform(post("/investment/radar/external-lead/rebuild-from-public-opportunity"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.createdLeadCount").value(1))
        .andExpect(jsonPath("$.data.sampleLeadIds[0]").value(101));

    verify(investmentService).rebuildExternalLeadsFromPublicOpportunity();
  }

  @Test
  void sendOutreachTaskReturnsLocalSentResult() throws Exception {
    when(investmentService.sendOutreachTask(88L))
        .thenReturn(Map.of("resultCode", "LOCAL_SENT", "status", "SENT", "taskId", 88));

    mockMvc
        .perform(post("/investment/radar/outreach-task/88/send"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value(88))
        .andExpect(jsonPath("$.data.status").value("SENT"));

    verify(investmentService).sendOutreachTask(88L);
  }

  @Test
  void mockSendOutreachTaskReusesSendService() throws Exception {
    when(investmentService.sendOutreachTask(89L))
        .thenReturn(Map.of("resultCode", "LOCAL_SENT", "status", "SENT", "taskId", 89));

    mockMvc
        .perform(post("/investment/radar/outreach-task/89/mock-send"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value(89))
        .andExpect(jsonPath("$.data.resultCode").value("LOCAL_SENT"));

    verify(investmentService).sendOutreachTask(89L);
  }
}
