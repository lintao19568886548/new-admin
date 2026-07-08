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
import cn.yizuw.magic.backend.investment.PublicOpportunityQuery;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第二十五批招商雷达公开机会只读接口的路由测试。 */
class TwentyFifthBatchControllerTest {

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
  void publicOpportunityEffectiveListReturnsItemsAndMeta() throws Exception {
    when(investmentService.getPublicOpportunityEffectiveList(any(PublicOpportunityQuery.class)))
        .thenReturn(
            Map.of(
                "filters",
                Map.of("sourceSites", List.of("99cfw"), "publishedAgeLabels", List.of("1 天前")),
                "items",
                List.of(
                    Map.of(
                        "city",
                        "东莞",
                        "opportunityId",
                        101,
                        "opportunityType",
                        "DEMAND",
                        "title",
                        "求租厂房")),
                "page",
                Map.of("currentPage", 2, "pageSize", 10, "total", 1),
                "scope",
                "strict",
                "strictTotal",
                1,
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/public-opportunity/effective-list")
                .param("city", "东莞")
                .param("currentPage", "2")
                .param("pageSize", "10")
                .param("opportunityType", "demand")
                .param("scope", "strict"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].opportunityId").value(101))
        .andExpect(jsonPath("$.data.page.currentPage").value(2))
        .andExpect(jsonPath("$.data.filters.sourceSites[0]").value("99cfw"));

    verify(investmentService).getPublicOpportunityEffectiveList(any(PublicOpportunityQuery.class));
  }

  @Test
  void publicOpportunityEffectiveOptionsReturnsFilters() throws Exception {
    when(investmentService.getPublicOpportunityEffectiveOptions(any(PublicOpportunityQuery.class)))
        .thenReturn(
            Map.of(
                "filters",
                Map.of("publishedAgeLabels", List.of("2 小时前"), "sourceSites", List.of("cfzsw68.com")),
                "scope",
                "collected"));

    mockMvc
        .perform(
            get("/investment/radar/public-opportunity/effective-options")
                .param("scope", "collected")
                .param("sourceSite", "cfzsw68.com"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.scope").value("collected"))
        .andExpect(jsonPath("$.data.filters.publishedAgeLabels[0]").value("2 小时前"));

    verify(investmentService).getPublicOpportunityEffectiveOptions(any(PublicOpportunityQuery.class));
  }

  @Test
  void publicOpportunityEffectiveStatsReturnsTotals() throws Exception {
    when(investmentService.getPublicOpportunityEffectiveStats(any(PublicOpportunityQuery.class)))
        .thenReturn(Map.of("scope", "raw", "strictTotal", 8, "total", 21));

    mockMvc
        .perform(
            get("/investment/radar/public-opportunity/effective-stats")
                .param("scope", "raw")
                .param("includeMeta", "false")
                .param("includeTotal", "true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.total").value(21))
        .andExpect(jsonPath("$.data.strictTotal").value(8));

    verify(investmentService).getPublicOpportunityEffectiveStats(any(PublicOpportunityQuery.class));
  }

  @Test
  void publicOpportunityEffectiveProgressReturnsSources() throws Exception {
    when(investmentService.getPublicOpportunityEffectiveProgress(eq("SUPPLY")))
        .thenReturn(
            Map.of(
                "note",
                "crawler_progress_only_not_effective_counts",
                "opportunityType",
                "SUPPLY",
                "sourceCount",
                1,
                "sources",
                List.of(
                    Map.of(
                        "itemStatus",
                        Map.of("SUCCESS", 3),
                        "latestTask",
                        Map.of("taskId", 301, "status", "SUCCESS"),
                        "sourceCode",
                        "PUBLIC_FACTORY_LISTING_CFZSW68",
                        "sourceId",
                        5,
                        "sourceName",
                        "厂房网"))));

    mockMvc
        .perform(
            get("/investment/radar/public-opportunity/effective-progress")
                .param("opportunityType", "SUPPLY"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.sourceCount").value(1))
        .andExpect(jsonPath("$.data.sources[0].itemStatus.SUCCESS").value(3));

    verify(investmentService).getPublicOpportunityEffectiveProgress("SUPPLY");
  }

  @Test
  void publicOpportunityDetailReturnsSerializedOpportunity() throws Exception {
    when(investmentService.getPublicOpportunityDetail(eq(101L)))
        .thenReturn(
            Map.of(
                "detailJson",
                Map.of("responseHash", "abc"),
                "hasDetailEvidence",
                true,
                "opportunityId",
                101,
                "sourceUrl",
                "https://example.com/opportunity/101",
                "tagsJson",
                List.of("PUBLIC_DEMAND_99CFW_GD"),
                "title",
                "求租厂房"));

    mockMvc
        .perform(get("/investment/radar/public-opportunity/101"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.opportunityId").value(101))
        .andExpect(jsonPath("$.data.tagsJson[0]").value("PUBLIC_DEMAND_99CFW_GD"))
        .andExpect(jsonPath("$.data.detailJson.responseHash").value("abc"));

    verify(investmentService).getPublicOpportunityDetail(101L);
  }
}
