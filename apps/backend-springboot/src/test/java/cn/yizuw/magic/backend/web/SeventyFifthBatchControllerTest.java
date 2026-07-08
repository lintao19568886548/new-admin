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
import cn.yizuw.magic.backend.investment.PublicOpportunityBatchRunRequest;
import cn.yizuw.magic.backend.investment.PublicOpportunityCrawlerRunRequest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十五批招商雷达公开机会采集运维本地队列接口路由测试。 */
class SeventyFifthBatchControllerTest {

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
  void createRadarCollectTaskReturnsLocalTaskSnapshot() throws Exception {
    when(investmentService.createRadarCollectTask())
        .thenReturn(
            Map.of(
                "task",
                Map.of("created", 1, "status", "SUCCESS", "taskId", "radar_collect_1"),
                "taskId",
                "radar_collect_1"));

    mockMvc
        .perform(post("/investment/radar/collect/task"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value("radar_collect_1"))
        .andExpect(jsonPath("$.data.task.status").value("SUCCESS"));

    verify(investmentService).createRadarCollectTask();
  }

  @Test
  void startCrawlerTaskSchedulerReturnsLocalSchedulerState() throws Exception {
    when(investmentService.startCrawlerTaskScheduler())
        .thenReturn(
            Map.of(
                "active",
                true,
                "enabled",
                true,
                "scheduleType",
                "DAILY",
                "startSource",
                "api"));

    mockMvc
        .perform(post("/investment/radar/crawler-task/scheduler/start"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.active").value(true))
        .andExpect(jsonPath("$.data.startSource").value("api"));

    verify(investmentService).startCrawlerTaskScheduler();
  }

  @Test
  void stopCrawlerTaskSchedulerReturnsStoppedState() throws Exception {
    when(investmentService.stopCrawlerTaskScheduler())
        .thenReturn(
            Map.of(
                "active",
                false,
                "enabled",
                false,
                "nextRunAt",
                "",
                "running",
                false));

    mockMvc
        .perform(post("/investment/radar/crawler-task/scheduler/stop"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.active").value(false))
        .andExpect(jsonPath("$.data.running").value(false));

    verify(investmentService).stopCrawlerTaskScheduler();
  }

  @Test
  void runPublicOpportunityCrawlerTaskQueuesLocalTask() throws Exception {
    when(investmentService.runPublicOpportunityCrawlerTask(any(PublicOpportunityCrawlerRunRequest.class)))
        .thenReturn(
            Map.of(
                "requestConfig",
                Map.of("batchSize", 3, "sourceCode", "PUBLIC_OPPORTUNITY_99CFW"),
                "sourceCode",
                "PUBLIC_OPPORTUNITY_99CFW",
                "status",
                "PENDING",
                "taskId",
                31,
                "workerMode",
                "LOCAL_QUEUE_ONLY"));

    mockMvc
        .perform(
            post("/investment/radar/crawler-task/run-public-opportunity")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "batchSize": 3,
                      "ignoreInterval": true,
                      "sourceCode": "PUBLIC_OPPORTUNITY_99CFW"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.status").value("PENDING"))
        .andExpect(jsonPath("$.data.workerMode").value("LOCAL_QUEUE_ONLY"))
        .andExpect(jsonPath("$.data.requestConfig.batchSize").value(3));

    verify(investmentService).runPublicOpportunityCrawlerTask(any(PublicOpportunityCrawlerRunRequest.class));
  }

  @Test
  void runPublicOpportunityCrawlerBatchQueuesPlatformTasks() throws Exception {
    when(investmentService.runPublicOpportunityCrawlerBatch(any(PublicOpportunityBatchRunRequest.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(
                        "sourceCode",
                        "PUBLIC_DEMAND_99CFW_GD",
                        "status",
                        "PENDING",
                        "taskId",
                        42)),
                "mode",
                "DEMAND",
                "roundCount",
                1,
                "total",
                Map.of("queuedPlatformCount", 1, "totalPlatformCount", 1)));

    mockMvc
        .perform(
            post("/investment/radar/crawler-task/run-public-opportunity-batch")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "batchSize": 5,
                      "mode": "DEMAND",
                      "maxRounds": 1
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.mode").value("DEMAND"))
        .andExpect(jsonPath("$.data.items[0].status").value("PENDING"))
        .andExpect(jsonPath("$.data.total.queuedPlatformCount").value(1));

    verify(investmentService).runPublicOpportunityCrawlerBatch(any(PublicOpportunityBatchRunRequest.class));
  }
}
