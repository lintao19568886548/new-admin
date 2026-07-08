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
import cn.yizuw.magic.backend.investment.RadarLeadAssignOwnerRequest;
import cn.yizuw.magic.backend.investment.RadarLeadVisitRequest;
import cn.yizuw.magic.backend.investment.RadarVisitCompleteRequest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十九批招商雷达本地动作接口路由测试。 */
class FortyNinthBatchControllerTest {

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
  void cancelOutreachTaskReturnsCanceledStatus() throws Exception {
    when(investmentService.cancelOutreachTask(8L))
        .thenReturn(Map.of("taskId", 8, "status", "CANCELED", "resultCode", "CANCELED"));

    mockMvc
        .perform(post("/investment/radar/outreach-task/8/cancel"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.taskId").value(8))
        .andExpect(jsonPath("$.data.status").value("CANCELED"));

    verify(investmentService).cancelOutreachTask(8L);
  }

  @Test
  void assignRadarLeadOwnerReturnsOwnerSnapshot() throws Exception {
    when(investmentService.assignRadarLeadOwner(eq(12L), any(RadarLeadAssignOwnerRequest.class)))
        .thenReturn(Map.of("leadId", 12, "ownerUserId", 5, "ownerName", "招商顾问", "stage", "PENDING_CONTACT"));

    mockMvc
        .perform(
            post("/investment/radar/lead/12/assign-owner")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "ownerUserId":5,
                      "assignReason":"人工调整负责人"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.leadId").value(12))
        .andExpect(jsonPath("$.data.ownerName").value("招商顾问"));

    verify(investmentService).assignRadarLeadOwner(eq(12L), any(RadarLeadAssignOwnerRequest.class));
  }

  @Test
  void completeRadarSopReminderReturnsDoneStatus() throws Exception {
    when(investmentService.completeRadarSopReminder(33L))
        .thenReturn(Map.of("reminderId", 33, "status", "DONE", "handledTime", "2026-06-30T03:00:00Z"));

    mockMvc
        .perform(post("/investment/radar/sop-reminder/33/complete"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.reminderId").value(33))
        .andExpect(jsonPath("$.data.status").value("DONE"));

    verify(investmentService).completeRadarSopReminder(33L);
  }

  @Test
  void createRadarLeadVisitReturnsVisitId() throws Exception {
    when(investmentService.createRadarLeadVisit(eq(12L), any(RadarLeadVisitRequest.class)))
        .thenReturn(Map.of("visitId", 44));

    mockMvc
        .perform(
            post("/investment/radar/lead/12/visit")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "factoryFloorId":9,
                      "scheduledTime":"2026-07-01T10:00:00+08:00",
                      "visitorName":"王总",
                      "visitorPhone":"13800000000"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.visitId").value(44));

    verify(investmentService).createRadarLeadVisit(eq(12L), any(RadarLeadVisitRequest.class));
  }

  @Test
  void completeRadarVisitRecordReturnsFeedback() throws Exception {
    when(investmentService.completeRadarVisitRecord(eq(44L), any(RadarVisitCompleteRequest.class)))
        .thenReturn(
            Map.of(
                "visitId", 44,
                "visitStatus", "DONE",
                "feedback", "客户对楼层和电量满意",
                "actualTime", "2026-07-01T03:00:00Z"));

    mockMvc
        .perform(
            post("/investment/radar/visit-record/44/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "feedback":"客户对楼层和电量满意",
                      "actualTime":"2026-07-01T11:00:00+08:00"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.visitId").value(44))
        .andExpect(jsonPath("$.data.visitStatus").value("DONE"));

    verify(investmentService).completeRadarVisitRecord(eq(44L), any(RadarVisitCompleteRequest.class));
  }
}
