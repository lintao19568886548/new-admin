package cn.yizuw.magic.backend.web;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十七批招商雷达本地状态写接口路由测试。 */
class FortySeventhBatchControllerTest {

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
  void enableCrawlerSourceReturnsUpdatedSource() throws Exception {
    when(investmentService.setCrawlerSourceEnabled(7L, true))
        .thenReturn(Map.of("sourceId", 7, "sourceCode", "PUBLIC_OPPORTUNITY_99CFW", "enabled", true));

    mockMvc
        .perform(post("/investment/radar/crawler-source/7/enable"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.sourceId").value(7))
        .andExpect(jsonPath("$.data.enabled").value(true));

    verify(investmentService).setCrawlerSourceEnabled(7L, true);
  }

  @Test
  void disableCrawlerSourceReturnsUpdatedSource() throws Exception {
    when(investmentService.setCrawlerSourceEnabled(7L, false))
        .thenReturn(Map.of("sourceId", 7, "sourceCode", "PUBLIC_OPPORTUNITY_99CFW", "enabled", false));

    mockMvc
        .perform(post("/investment/radar/crawler-source/7/disable"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.enabled").value(false));

    verify(investmentService).setCrawlerSourceEnabled(7L, false);
  }

  @Test
  void cancelCrawlerTaskReturnsCanceledTask() throws Exception {
    when(investmentService.cancelCrawlerTask(11L))
        .thenReturn(Map.of("taskId", 11, "status", "CANCELED", "skipReason", "MANUAL_CANCEL"));

    mockMvc
        .perform(post("/investment/radar/crawler-task/11/cancel"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value(11))
        .andExpect(jsonPath("$.data.status").value("CANCELED"));

    verify(investmentService).cancelCrawlerTask(11L);
  }

  @Test
  void enableOutreachTemplateReturnsEnabledFlag() throws Exception {
    when(investmentService.setOutreachTemplateEnabled(5L, true))
        .thenReturn(Map.of("templateId", 5, "enabled", true));

    mockMvc
        .perform(post("/investment/radar/outreach-template/5/enable"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.templateId").value(5))
        .andExpect(jsonPath("$.data.enabled").value(true));

    verify(investmentService).setOutreachTemplateEnabled(5L, true);
  }

  @Test
  void disableOutreachTemplateReturnsEnabledFlag() throws Exception {
    when(investmentService.setOutreachTemplateEnabled(5L, false))
        .thenReturn(Map.of("templateId", 5, "enabled", false));

    mockMvc
        .perform(post("/investment/radar/outreach-template/5/disable"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.templateId").value(5))
        .andExpect(jsonPath("$.data.enabled").value(false));

    verify(investmentService).setOutreachTemplateEnabled(5L, false);
  }
}
