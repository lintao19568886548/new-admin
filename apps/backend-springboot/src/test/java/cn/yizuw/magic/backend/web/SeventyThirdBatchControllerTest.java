package cn.yizuw.magic.backend.web;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

/** 第七十三批招商雷达本地派生数据刷新接口路由测试。 */
class SeventyThirdBatchControllerTest {

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
  void refreshSignalEventsReturnsRefreshCounters() throws Exception {
    when(investmentService.refreshSignalEvents())
        .thenReturn(
            Map.of(
                "createdEventCount", 2,
                "createdEvidenceCount", 3,
                "deletedDirtyEventCount", 1,
                "totalSourceLeadCount", 5,
                "updatedEventCount", 4,
                "updatedEvidenceCount", 6));

    mockMvc
        .perform(post("/investment/radar/signal-event/refresh"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.createdEventCount").value(2))
        .andExpect(jsonPath("$.data.totalSourceLeadCount").value(5));

    verify(investmentService).refreshSignalEvents();
  }

  @Test
  void refreshEnterpriseProfilesReturnsProfileAndTagCounters() throws Exception {
    when(investmentService.refreshEnterpriseProfiles())
        .thenReturn(
            Map.of(
                "createdProfileCount", 1,
                "createdTagCount", 2,
                "signalEventCount", 8,
                "sourceCompanyCount", 3,
                "updatedProfileCount", 4,
                "updatedTagCount", 5));

    mockMvc
        .perform(post("/investment/radar/enterprise-profile/refresh"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.sourceCompanyCount").value(3))
        .andExpect(jsonPath("$.data.updatedTagCount").value(5));

    verify(investmentService).refreshEnterpriseProfiles();
  }

  @Test
  void recalculateRadarLeadScoresReturnsBatchSummary() throws Exception {
    when(investmentService.recalculateRadarLeadScores())
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("leadId", 9, "totalScore", 80)),
                "recalculatedCount",
                1,
                "totalLeadCount",
                2));

    mockMvc
        .perform(post("/investment/radar/lead/recalculate-scores"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].leadId").value(9))
        .andExpect(jsonPath("$.data.recalculatedCount").value(1))
        .andExpect(jsonPath("$.data.totalLeadCount").value(2));

    verify(investmentService).recalculateRadarLeadScores();
  }
}
