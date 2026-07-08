package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.CrawlerTaskItemReclaimRequest;
import cn.yizuw.magic.backend.investment.CrawlerTaskItemRequeueRequest;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.PublicOpportunityImportUrlsRequest;
import cn.yizuw.magic.backend.investment.PublicOpportunityManualRequest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十四批招商雷达采集 URL 和公开机会本地写接口路由测试。 */
class FiftyFourthBatchControllerTest {

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
  void requeueCrawlerTaskItemsReturnsPendingSummary() throws Exception {
    when(investmentService.requeueCrawlerTaskItems(any(CrawlerTaskItemRequeueRequest.class)))
        .thenReturn(Map.of("requeuedCount", 2, "sourceId", 7, "status", "PENDING"));

    mockMvc
        .perform(
            post("/investment/radar/crawler-task/item/requeue")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "sourceCode":"PUBLIC_OPPORTUNITY_99CFW",
                      "itemIds":[11,12],
                      "statuses":["FAILED","SKIPPED"]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.requeuedCount").value(2))
        .andExpect(jsonPath("$.data.status").value("PENDING"));

    verify(investmentService).requeueCrawlerTaskItems(any(CrawlerTaskItemRequeueRequest.class));
  }

  @Test
  void reclaimStaleCrawlerTaskItemsReturnsReclaimedCount() throws Exception {
    when(investmentService.reclaimStaleCrawlerTaskItems(any(CrawlerTaskItemReclaimRequest.class)))
        .thenReturn(Map.of("reclaimedCount", 1, "sourceId", 7, "staleMinutes", 30));

    mockMvc
        .perform(
            post("/investment/radar/crawler-task/item/reclaim-stale-running")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "sourceId":7,
                      "staleMinutes":30
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.reclaimedCount").value(1))
        .andExpect(jsonPath("$.data.staleMinutes").value(30));

    verify(investmentService).reclaimStaleCrawlerTaskItems(any(CrawlerTaskItemReclaimRequest.class));
  }

  @Test
  void createManualPublicOpportunityReturnsCreatedOpportunity() throws Exception {
    when(investmentService.createManualPublicOpportunity(any(PublicOpportunityManualRequest.class)))
        .thenReturn(
            Map.of(
                "created",
                true,
                "opportunity",
                Map.of("opportunityId", 41, "opportunityType", "DEMAND", "title", "求租厂房")));

    mockMvc
        .perform(
            post("/investment/radar/public-opportunity/manual")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "title":"求租厂房",
                      "opportunityType":"DEMAND",
                      "city":"深圳"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.created").value(true))
        .andExpect(jsonPath("$.data.opportunity.title").value("求租厂房"));

    verify(investmentService).createManualPublicOpportunity(any(PublicOpportunityManualRequest.class));
  }

  @Test
  void importPublicOpportunityUrlsReturnsSeedResult() throws Exception {
    when(investmentService.importPublicOpportunityUrls(any(PublicOpportunityImportUrlsRequest.class)))
        .thenReturn(
            Map.of(
                "acceptedCount",
                1,
                "acceptedUrls",
                List.of("https://example.com/detail/1"),
                "duplicateInputCount",
                1,
                "rejectedCount",
                0,
                "seed",
                Map.of("createdCount", 1, "updatedCount", 0),
                "source",
                Map.of("sourceCode", "PUBLIC_FACTORY_LISTING_CFZSW68", "sourceId", 9),
                "totalInputCount",
                2));

    mockMvc
        .perform(
            post("/investment/radar/public-opportunity/import-urls")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "sourceCode":"PUBLIC_FACTORY_LISTING_CFZSW68",
                      "urls":["https://example.com/detail/1","https://example.com/detail/1"],
                      "maxRetryCount":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.acceptedCount").value(1))
        .andExpect(jsonPath("$.data.seed.createdCount").value(1));

    verify(investmentService).importPublicOpportunityUrls(any(PublicOpportunityImportUrlsRequest.class));
  }
}
