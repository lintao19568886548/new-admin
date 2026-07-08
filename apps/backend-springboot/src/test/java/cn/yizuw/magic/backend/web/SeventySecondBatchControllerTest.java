package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.RadarLeadConvertRequest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十二批招商雷达转换和评分重算接口路由测试。 */
class SeventySecondBatchControllerTest {

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
  void convertExternalLeadReturnsRadarLeadId() throws Exception {
    when(investmentService.convertExternalLead(eq(11L), any(RadarLeadConvertRequest.class)))
        .thenReturn(
            Map.of(
                "convertedAt", "2026-07-01T06:40:00Z",
                "externalLeadId", 11,
                "radarLeadId", 101,
                "reused", false));

    mockMvc
        .perform(
            post("/investment/radar/external-lead/11/convert")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "ownerUserId":7,
                      "remark":"人工确认有效"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.externalLeadId").value(11))
        .andExpect(jsonPath("$.data.radarLeadId").value(101))
        .andExpect(jsonPath("$.data.reused").value(false));

    verify(investmentService).convertExternalLead(eq(11L), any(RadarLeadConvertRequest.class));
  }

  @Test
  void convertSignalEventReturnsReusedFlag() throws Exception {
    when(investmentService.convertSignalEvent(eq(22L), any(RadarLeadConvertRequest.class)))
        .thenReturn(Map.of("eventId", 22, "radarLeadId", 102, "reused", true));

    mockMvc
        .perform(
            post("/investment/radar/signal-event/22/convert")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "ownerUserId":null
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.eventId").value(22))
        .andExpect(jsonPath("$.data.radarLeadId").value(102))
        .andExpect(jsonPath("$.data.reused").value(true));

    verify(investmentService).convertSignalEvent(eq(22L), any(RadarLeadConvertRequest.class));
  }

  @Test
  void recalculateRadarLeadScoreReturnsScoreSummary() throws Exception {
    when(investmentService.recalculateRadarLeadScore(33L))
        .thenReturn(
            Map.of(
                "breakdownCount", 3,
                "intentScore", 85,
                "leadId", 33,
                "matchedEventCount", 2,
                "priorityLevel", "A",
                "totalScore", 85));

    mockMvc
        .perform(post("/investment/radar/lead/33/recalculate-score"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.leadId").value(33))
        .andExpect(jsonPath("$.data.totalScore").value(85))
        .andExpect(jsonPath("$.data.priorityLevel").value("A"));

    verify(investmentService).recalculateRadarLeadScore(33L);
  }
}
