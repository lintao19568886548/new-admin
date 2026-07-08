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
import cn.yizuw.magic.backend.investment.InvestmentListQuery;
import cn.yizuw.magic.backend.investment.InvestmentService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第二十一批招商和招商雷达只读接口的路由测试。 */
class TwentyFirstBatchControllerTest {

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
  void investmentListBindsFiltersAndReturnsItems() throws Exception {
    when(investmentService.getInvestmentList(any(InvestmentListQuery.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "agentName",
                        "张三",
                        "imageUrlList",
                        List.of("/investment.jpg"),
                        "investmentId",
                        9,
                        "parkName",
                        "科技园",
                        "tenantName",
                        "测试客户")),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/list")
                .param("agentName", "张")
                .param("currentPage", "2")
                .param("currentPark", "3")
                .param("endTime", "2026-06-30")
                .param("intentArea", "between,100,300")
                .param("intentLevel", "高")
                .param("pageSize", "5")
                .param("progress", "深入沟通")
                .param("startTime", "2026-06-01")
                .param("tenantName", "测试"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].investmentId").value(9))
        .andExpect(jsonPath("$.data.items[0].imageUrlList[0]").value("/investment.jpg"));

    verify(investmentService)
        .getInvestmentList(
            eq(
                new InvestmentListQuery(
                    "张",
                    3,
                    2,
                    "2026-06-30",
                    "between,100,300",
                    "高",
                    5,
                    "深入沟通",
                    "2026-06-01",
                    "测试")));
  }

  @Test
  void investmentParkListReturnsParks() throws Exception {
    when(investmentService.getInvestmentParkList())
        .thenReturn(List.of(Map.of("parkId", 3, "parkName", "科技园")));

    mockMvc
        .perform(get("/investment/park-list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].parkId").value(3))
        .andExpect(jsonPath("$.data[0].parkName").value("科技园"));
    verify(investmentService).getInvestmentParkList();
  }

  @Test
  void investmentDetailReturnsCoreFields() throws Exception {
    when(investmentService.getInvestmentDetail(eq(7)))
        .thenReturn(
            Map.of(
                "agentName",
                "李四",
                "investmentId",
                7,
                "intentLevel",
                "很高",
                "progress",
                "初步接洽",
                "tenantName",
                "意向客户"));

    mockMvc
        .perform(get("/investment/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.investmentId").value(7))
        .andExpect(jsonPath("$.data.tenantName").value("意向客户"));
    verify(investmentService).getInvestmentDetail(7);
  }

  @Test
  void radarScoreRuleListReturnsPagedRules() throws Exception {
    when(investmentService.getLeadScoreRuleList())
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "enabled",
                        true,
                        "keywordJson",
                        List.of("扩建"),
                        "ruleCode",
                        "KEYWORD_EXPAND",
                        "ruleId",
                        1,
                        "scoreDelta",
                        15)),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/score-rule/list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].ruleCode").value("KEYWORD_EXPAND"))
        .andExpect(jsonPath("$.data.items[0].keywordJson[0]").value("扩建"));
    verify(investmentService).getLeadScoreRuleList();
  }

  @Test
  void radarCrawlerSourceListReturnsVisibleSources() throws Exception {
    when(investmentService.getCrawlerSourceList())
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "adapterStatus",
                        "READY",
                        "enabled",
                        true,
                        "sourceCode",
                        "PUBLIC_OPPORTUNITY_99CFW",
                        "sourceId",
                        8,
                        "sourceName",
                        "99cfw public opportunity demand")),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/crawler-source/list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].adapterStatus").value("READY"))
        .andExpect(jsonPath("$.data.items[0].sourceCode").value("PUBLIC_OPPORTUNITY_99CFW"));
    verify(investmentService).getCrawlerSourceList();
  }
}
