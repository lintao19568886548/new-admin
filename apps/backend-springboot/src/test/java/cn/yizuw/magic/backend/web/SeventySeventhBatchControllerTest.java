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
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十七批招商雷达本地数据重建接口路由测试。 */
class SeventySeventhBatchControllerTest {

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
  void syncInternalContractExpiryScansLocalContracts() throws Exception {
    when(investmentService.syncInternalContractExpiryToRadar())
        .thenReturn(
            Map.of(
                "convertedCount", 2,
                "horizonDays", 90,
                "scannedCount", 3,
                "workerMode", "SPRINGBOOT_LOCAL_DB_SCAN"));

    mockMvc
        .perform(post("/investment/radar/crawler-task/sync-internal-contract-expiry"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.convertedCount").value(2))
        .andExpect(jsonPath("$.data.workerMode").value("SPRINGBOOT_LOCAL_DB_SCAN"));

    verify(investmentService).syncInternalContractExpiryToRadar();
  }

  @Test
  void importRadarLeadsAcceptsJsonItems() throws Exception {
    when(investmentService.importRadarLeads(any()))
        .thenReturn(Map.of("failItems", List.of(), "leadIds", List.of(101L), "success", 1));

    mockMvc
        .perform(
            post("/investment/radar/lead/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[{\"enterpriseName\":\"测试企业\",\"intentScore\":80}]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.success").value(1))
        .andExpect(jsonPath("$.data.leadIds[0]").value(101));

    verify(investmentService).importRadarLeads(any());
  }

  @Test
  void rebuildSingleRadarLeadPropertyMatchReturnsMatches() throws Exception {
    when(investmentService.rebuildRadarLeadPropertyMatch(88L))
        .thenReturn(
            Map.of(
                "matches",
                List.of(Map.of("factoryId", 12, "matchScore", 91)),
                "rebuiltAt",
                "2026-07-01T08:00:00Z",
                "totalCount",
                1));

    mockMvc
        .perform(post("/investment/radar/lead/88/rebuild-property-match"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.totalCount").value(1))
        .andExpect(jsonPath("$.data.matches[0].matchScore").value(91));

    verify(investmentService).rebuildRadarLeadPropertyMatch(88L);
  }

  @Test
  void rebuildRadarLeadPropertyMatchBatchUsesRequestLimit() throws Exception {
    when(investmentService.rebuildRadarLeadPropertyMatchBatch(any()))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("leadId", 88, "matchCount", 3, "topMatchScore", 95)),
                "rebuiltLeadCount",
                1));

    mockMvc
        .perform(
            post("/investment/radar/lead/rebuild-property-match-batch")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"limit\":5}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.rebuiltLeadCount").value(1))
        .andExpect(jsonPath("$.data.items[0].leadId").value(88));

    verify(investmentService).rebuildRadarLeadPropertyMatchBatch(any());
  }

  @Test
  void rebuildRadarAcquisitionPipelineRunsLocalPipeline() throws Exception {
    when(investmentService.rebuildRadarAcquisitionPipeline())
        .thenReturn(
            Map.of(
                "createdOutreachTaskCount",
                4,
                "createdSignalEventCount",
                6,
                "recalculatedLeadCount",
                5,
                "targetLeadCount",
                7));

    mockMvc
        .perform(post("/investment/radar/pipeline/rebuild"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.createdSignalEventCount").value(6))
        .andExpect(jsonPath("$.data.recalculatedLeadCount").value(5));

    verify(investmentService).rebuildRadarAcquisitionPipeline();
  }
}
