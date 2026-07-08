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

/** 第二十二批招商雷达只读列表接口的路由测试。 */
class TwentySecondBatchControllerTest {

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
  void radarSalesUserListBindsParkAndKeyword() throws Exception {
    when(investmentService.getRadarSalesUserList(eq(3), eq("王")))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "activeLeadCount",
                        2,
                        "parkName",
                        "科技园",
                        "userId",
                        9,
                        "userName",
                        "王销售")),
                "total",
                1));

    mockMvc
        .perform(get("/investment/radar/sales-user/list").param("parkId", "3").param("keyword", "王"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].userId").value(9))
        .andExpect(jsonPath("$.data.items[0].activeLeadCount").value(2));

    verify(investmentService).getRadarSalesUserList(3, "王");
  }

  @Test
  void crawlerTaskListBindsPagingAndFilters() throws Exception {
    when(investmentService.getCrawlerTaskList(eq(2), eq(10), eq(5), eq("SUCCESS")))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "requestConfigJson",
                        Map.of("dryRun", false),
                        "sourceCode",
                        "PUBLIC_OPPORTUNITY_99CFW",
                        "status",
                        "SUCCESS",
                        "taskId",
                        11)),
                "page",
                Map.of("currentPage", 2, "pageSize", 10, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/crawler-task/list")
                .param("currentPage", "2")
                .param("pageSize", "10")
                .param("sourceId", "5")
                .param("status", "SUCCESS"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.page.currentPage").value(2))
        .andExpect(jsonPath("$.data.items[0].sourceCode").value("PUBLIC_OPPORTUNITY_99CFW"))
        .andExpect(jsonPath("$.data.items[0].requestConfigJson.dryRun").value(false));

    verify(investmentService).getCrawlerTaskList(2, 10, 5, "SUCCESS");
  }

  @Test
  void signalEventListBindsFilters() throws Exception {
    when(investmentService.getSignalEventList(
            eq("测试公司"),
            eq(1),
            eq("RELOCATION"),
            eq("搬迁"),
            eq(20),
            eq("公开平台"),
            eq("PUBLIC"),
            eq("NEW")))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "companyName",
                        "测试公司",
                        "eventId",
                        21,
                        "eventType",
                        "RELOCATION",
                        "rawPayloadJson",
                        Map.of("source", "crawler"),
                        "status",
                        "NEW")),
                "page",
                Map.of("currentPage", 1, "pageSize", 20, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/signal-event/list")
                .param("companyName", "测试公司")
                .param("currentPage", "1")
                .param("eventType", "RELOCATION")
                .param("keyword", "搬迁")
                .param("pageSize", "20")
                .param("sourceName", "公开平台")
                .param("sourceType", "PUBLIC")
                .param("status", "NEW"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].eventId").value(21))
        .andExpect(jsonPath("$.data.items[0].rawPayloadJson.source").value("crawler"));

    verify(investmentService)
        .getSignalEventList("测试公司", 1, "RELOCATION", "搬迁", 20, "公开平台", "PUBLIC", "NEW");
  }

  @Test
  void externalLeadListBindsFilters() throws Exception {
    when(investmentService.getExternalLeadList(
            eq("HIGH"),
            eq(3),
            eq("RENT_FACTORY"),
            eq("先进制造"),
            eq("扩产"),
            eq(15),
            eq("深圳"),
            eq("99厂房网"),
            eq("PUBLIC"),
            eq("NEW")))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "companyName",
                        "外部线索公司",
                        "confidenceLevel",
                        "HIGH",
                        "hitKeywords",
                        List.of("扩产"),
                        "leadId",
                        31)),
                "page",
                Map.of("currentPage", 3, "pageSize", 15, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/external-lead/list")
                .param("confidenceLevel", "HIGH")
                .param("currentPage", "3")
                .param("demandType", "RENT_FACTORY")
                .param("industryName", "先进制造")
                .param("keyword", "扩产")
                .param("pageSize", "15")
                .param("regionCity", "深圳")
                .param("sourceName", "99厂房网")
                .param("sourceType", "PUBLIC")
                .param("status", "NEW"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.page.currentPage").value(3))
        .andExpect(jsonPath("$.data.items[0].hitKeywords[0]").value("扩产"));

    verify(investmentService)
        .getExternalLeadList(
            "HIGH", 3, "RENT_FACTORY", "先进制造", "扩产", 15, "深圳", "99厂房网", "PUBLIC", "NEW");
  }

  @Test
  void enterpriseProfileListBindsFilters() throws Exception {
    when(investmentService.getEnterpriseProfileList(eq(2), eq("电子信息"), eq("芯片"), eq(10), eq("东莞")))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "companyName",
                        "企业画像公司",
                        "industryTags",
                        List.of("芯片"),
                        "profileCompleteness",
                        80,
                        "profileId",
                        41)),
                "page",
                Map.of("currentPage", 2, "pageSize", 10, "total", 1),
                "total",
                1));

    mockMvc
        .perform(
            get("/investment/radar/enterprise-profile/list")
                .param("currentPage", "2")
                .param("industryName", "电子信息")
                .param("keyword", "芯片")
                .param("pageSize", "10")
                .param("regionCity", "东莞"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].profileId").value(41))
        .andExpect(jsonPath("$.data.items[0].industryTags[0]").value("芯片"));

    verify(investmentService).getEnterpriseProfileList(2, "电子信息", "芯片", 10, "东莞");
  }
}
