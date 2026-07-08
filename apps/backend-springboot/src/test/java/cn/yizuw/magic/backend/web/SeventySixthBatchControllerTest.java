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
import cn.yizuw.magic.backend.investment.PublicOpportunityCrawlerRunRequest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十六批招商雷达采集运行本地队列接口路由测试。 */
class SeventySixthBatchControllerTest {

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
  void runCrawlerTaskQueuesGenericPublicOpportunityTask() throws Exception {
    when(investmentService.runCrawlerTask(any(PublicOpportunityCrawlerRunRequest.class)))
        .thenReturn(
            Map.of(
                "requestConfig",
                Map.of("batchSize", 10, "maxListPages", 5),
                "sourceCode",
                "PUBLIC_OPPORTUNITY_99CFW",
                "status",
                "PENDING",
                "taskId",
                51,
                "workerMode",
                "LOCAL_QUEUE_ONLY"));

    mockMvc
        .perform(
            post("/investment/radar/crawler-task/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"batchSize\":10,\"maxListPages\":5,\"ignoreInterval\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.status").value("PENDING"))
        .andExpect(jsonPath("$.data.requestConfig.maxListPages").value(5));

    verify(investmentService).runCrawlerTask(any(PublicOpportunityCrawlerRunRequest.class));
  }

  @Test
  void runEiaCrawlerTaskQueuesNamedTask() throws Exception {
    when(investmentService.runNamedCrawlerTask("EIA"))
        .thenReturn(namedQueueResult("PUBLIC_EIA_NOTICE_MEE_CANDIDATE", "MANUAL_EIA", 52));

    mockMvc
        .perform(post("/investment/radar/crawler-task/run-eia"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.requestConfig.taskType").value("MANUAL_EIA"))
        .andExpect(jsonPath("$.data.sourceCode").value("PUBLIC_EIA_NOTICE_MEE_CANDIDATE"));

    verify(investmentService).runNamedCrawlerTask("EIA");
  }

  @Test
  void runInternalContractExpiryCrawlerTaskQueuesNamedTask() throws Exception {
    when(investmentService.runNamedCrawlerTask("INTERNAL_CONTRACT_EXPIRY"))
        .thenReturn(namedQueueResult("INTERNAL_CONTRACT_EXPIRY", "INTERNAL_CONTRACT_EXPIRY", 53));

    mockMvc
        .perform(post("/investment/radar/crawler-task/run-internal-contract-expiry"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.requestConfig.taskType").value("INTERNAL_CONTRACT_EXPIRY"))
        .andExpect(jsonPath("$.data.sourceCode").value("INTERNAL_CONTRACT_EXPIRY"));

    verify(investmentService).runNamedCrawlerTask("INTERNAL_CONTRACT_EXPIRY");
  }

  @Test
  void runRecruitmentCrawlerTaskQueuesNamedTask() throws Exception {
    when(investmentService.runNamedCrawlerTask("RECRUITMENT"))
        .thenReturn(namedQueueResult("PUBLIC_RECRUITMENT_51JOB_CANDIDATE", "MANUAL_RECRUITMENT", 54));

    mockMvc
        .perform(post("/investment/radar/crawler-task/run-recruitment"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.requestConfig.taskType").value("MANUAL_RECRUITMENT"))
        .andExpect(jsonPath("$.data.sourceCode").value("PUBLIC_RECRUITMENT_51JOB_CANDIDATE"));

    verify(investmentService).runNamedCrawlerTask("RECRUITMENT");
  }

  @Test
  void runTenderCrawlerTaskQueuesNamedTask() throws Exception {
    when(investmentService.runNamedCrawlerTask("TENDER"))
        .thenReturn(namedQueueResult("PUBLIC_TENDER_CCGP_CANDIDATE", "MANUAL_TENDER", 55));

    mockMvc
        .perform(post("/investment/radar/crawler-task/run-tender"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.requestConfig.taskType").value("MANUAL_TENDER"))
        .andExpect(jsonPath("$.data.sourceCode").value("PUBLIC_TENDER_CCGP_CANDIDATE"));

    verify(investmentService).runNamedCrawlerTask("TENDER");
  }

  private Map<String, Object> namedQueueResult(String sourceCode, String taskType, int taskId) {
    return Map.of(
        "requestConfig",
        Map.of("sourceCode", sourceCode, "taskType", taskType),
        "sourceCode",
        sourceCode,
        "status",
        "PENDING",
        "taskId",
        taskId,
        "workerMode",
        "LOCAL_QUEUE_ONLY");
  }
}
