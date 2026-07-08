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

/** 第二十四批招商雷达外部线索和企业画像只读接口的路由测试。 */
class TwentyFourthBatchControllerTest {

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
  void externalLeadDetailReturnsEvidences() throws Exception {
    when(investmentService.getExternalLeadDetail(eq(31L)))
        .thenReturn(
            Map.of(
                "companyName",
                "外部公开线索公司",
                "evidences",
                List.of(Map.of("evidenceId", 71, "matchedKeywords", List.of("租厂"))),
                "leadId",
                31,
                "sourceName",
                "99厂房网"));

    mockMvc
        .perform(get("/investment/radar/external-lead/31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.leadId").value(31))
        .andExpect(jsonPath("$.data.evidences[0].matchedKeywords[0]").value("租厂"));

    verify(investmentService).getExternalLeadDetail(31L);
  }

  @Test
  void externalLeadEvidencesReturnsItems() throws Exception {
    when(investmentService.getExternalLeadEvidences(eq(31L)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "evidenceId",
                        71,
                        "leadId",
                        31,
                        "matchedSentences",
                        List.of("需要厂房"),
                        "scoreDelta",
                        15)),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/external-lead/31/evidence"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].evidenceId").value(71))
        .andExpect(jsonPath("$.data.items[0].matchedSentences[0]").value("需要厂房"));

    verify(investmentService).getExternalLeadEvidences(31L);
  }

  @Test
  void enterpriseProfileDetailReturnsProfile() throws Exception {
    when(investmentService.getEnterpriseProfileDetail(eq(41L)))
        .thenReturn(
            Map.of(
                "companyName",
                "企业画像公司",
                "industryTags",
                List.of("电子信息"),
                "profileCompleteness",
                85,
                "profileId",
                41));

    mockMvc
        .perform(get("/investment/radar/enterprise-profile/41"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.profileId").value(41))
        .andExpect(jsonPath("$.data.industryTags[0]").value("电子信息"));

    verify(investmentService).getEnterpriseProfileDetail(41L);
  }

  @Test
  void enterpriseProfileSignalsReturnsItems() throws Exception {
    when(investmentService.getEnterpriseProfileSignals(eq(41L)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "companyName",
                        "企业画像公司",
                        "eventId",
                        81,
                        "eventType",
                        "EIA_EXPAND",
                        "status",
                        "NEW")),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/enterprise-profile/41/signals"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].eventId").value(81))
        .andExpect(jsonPath("$.data.items[0].eventType").value("EIA_EXPAND"));

    verify(investmentService).getEnterpriseProfileSignals(41L);
  }

  @Test
  void enterpriseProfileTagsReturnsItems() throws Exception {
    when(investmentService.getEnterpriseProfileTags(eq(41L)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "confidenceScore",
                        90,
                        "tagId",
                        91,
                        "tagName",
                        "扩产",
                        "tagType",
                        "INTENT")),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/enterprise-profile/41/tags"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].tagId").value(91))
        .andExpect(jsonPath("$.data.items[0].tagName").value("扩产"));

    verify(investmentService).getEnterpriseProfileTags(41L);
  }
}
