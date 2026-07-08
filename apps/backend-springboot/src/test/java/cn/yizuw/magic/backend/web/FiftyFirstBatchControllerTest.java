package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.ExternalLeadUpdateRequest;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.OutreachTaskCreateRequest;
import cn.yizuw.magic.backend.investment.OutreachTaskReplyRequest;
import cn.yizuw.magic.backend.investment.RadarLeadCloseRequest;
import cn.yizuw.magic.backend.investment.RadarLeadFollowRequest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十一批招商雷达线索和触达本地写接口路由测试。 */
class FiftyFirstBatchControllerTest {

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
  void updateExternalLeadReturnsStatusSnapshot() throws Exception {
    when(investmentService.updateExternalLead(eq(31L), any(ExternalLeadUpdateRequest.class)))
        .thenReturn(Map.of("leadId", 31, "status", "FOLLOWING"));

    mockMvc
        .perform(
            put("/investment/radar/external-lead/31")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"FOLLOWING\",\"remark\":\"已分配跟进\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.leadId").value(31))
        .andExpect(jsonPath("$.data.status").value("FOLLOWING"));

    verify(investmentService).updateExternalLead(eq(31L), any(ExternalLeadUpdateRequest.class));
  }

  @Test
  void createRadarLeadFollowReturnsRecordId() throws Exception {
    when(investmentService.createRadarLeadFollow(eq(9L), any(RadarLeadFollowRequest.class)))
        .thenReturn(Map.of("recordId", 7001));

    mockMvc
        .perform(
            post("/investment/radar/lead/9/follow")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"客户表示有兴趣\",\"followResult\":\"POSITIVE\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.recordId").value(7001));

    verify(investmentService).createRadarLeadFollow(eq(9L), any(RadarLeadFollowRequest.class));
  }

  @Test
  void closeRadarLeadReturnsFinalStage() throws Exception {
    when(investmentService.closeRadarLead(eq(9L), any(RadarLeadCloseRequest.class)))
        .thenReturn(Map.of("leadId", 9, "stage", "DEAL", "invalidReason", ""));

    mockMvc
        .perform(
            post("/investment/radar/lead/9/close")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stage\":\"DEAL\",\"reason\":\"客户已成交\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.leadId").value(9))
        .andExpect(jsonPath("$.data.stage").value("DEAL"));

    verify(investmentService).closeRadarLead(eq(9L), any(RadarLeadCloseRequest.class));
  }

  @Test
  void createOutreachTaskReturnsPendingTask() throws Exception {
    when(investmentService.createOutreachTask(any(OutreachTaskCreateRequest.class)))
        .thenReturn(Map.of("leadId", 9, "status", "PENDING", "taskId", 88));

    mockMvc
        .perform(
            post("/investment/radar/outreach-task")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"leadId\":9,\"phoneNumber\":\"13800138000\",\"content\":\"欢迎联系\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value(88))
        .andExpect(jsonPath("$.data.status").value("PENDING"));

    verify(investmentService).createOutreachTask(any(OutreachTaskCreateRequest.class));
  }

  @Test
  void replyOutreachTaskReturnsReplySnapshot() throws Exception {
    when(investmentService.replyOutreachTask(eq(88L), any(OutreachTaskReplyRequest.class)))
        .thenReturn(Map.of("replyStatus", "POSITIVE", "taskId", 88));

    mockMvc
        .perform(
            post("/investment/radar/outreach-task/88/reply")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"replyStatus\":\"POSITIVE\",\"replyContent\":\"可以约看\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value(88))
        .andExpect(jsonPath("$.data.replyStatus").value("POSITIVE"));

    verify(investmentService).replyOutreachTask(eq(88L), any(OutreachTaskReplyRequest.class));
  }
}
