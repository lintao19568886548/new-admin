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
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.OutreachTemplateSaveRequest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第四十八批招商雷达触达模板本地审批流接口路由测试。 */
class FortyEighthBatchControllerTest {

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
  void createOutreachTemplateReturnsPendingTemplate() throws Exception {
    when(investmentService.createOutreachTemplate(any(OutreachTemplateSaveRequest.class)))
        .thenReturn(
            Map.of(
                "templateId", 61,
                "templateCode", "RADAR_NEW_SMS",
                "approvalStatus", "PENDING_APPROVAL",
                "enabled", false));

    mockMvc
        .perform(
            post("/investment/radar/outreach-template")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "templateCode":"RADAR_NEW_SMS",
                      "templateName":"新短信模板",
                      "content":"您好，{companyName}",
                      "placeholderJson":["companyName"]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.templateId").value(61))
        .andExpect(jsonPath("$.data.approvalStatus").value("PENDING_APPROVAL"));

    verify(investmentService).createOutreachTemplate(any(OutreachTemplateSaveRequest.class));
  }

  @Test
  void updateOutreachTemplateReturnsNewVersion() throws Exception {
    when(investmentService.updateOutreachTemplate(eq(61L), any(OutreachTemplateSaveRequest.class)))
        .thenReturn(
            Map.of(
                "templateId", 61,
                "templateCode", "RADAR_NEW_SMS",
                "approvalStatus", "PENDING_APPROVAL",
                "versionNo", 2));

    mockMvc
        .perform(
            put("/investment/radar/outreach-template/61")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "templateCode":"RADAR_NEW_SMS",
                      "templateName":"新短信模板",
                      "content":"您好，{companyName}，欢迎咨询",
                      "placeholderJson":"companyName"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.templateId").value(61))
        .andExpect(jsonPath("$.data.versionNo").value(2));

    verify(investmentService)
        .updateOutreachTemplate(eq(61L), any(OutreachTemplateSaveRequest.class));
  }

  @Test
  void submitOutreachTemplateApprovalReturnsPendingStatus() throws Exception {
    when(investmentService.submitOutreachTemplateApproval(61L))
        .thenReturn(Map.of("templateId", 61, "approvalStatus", "PENDING_APPROVAL", "enabled", false));

    mockMvc
        .perform(post("/investment/radar/outreach-template/61/submit-approval"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.approvalStatus").value("PENDING_APPROVAL"))
        .andExpect(jsonPath("$.data.enabled").value(false));

    verify(investmentService).submitOutreachTemplateApproval(61L);
  }

  @Test
  void approveOutreachTemplateReturnsApprovedStatus() throws Exception {
    when(investmentService.setOutreachTemplateApproval(61L, "APPROVED"))
        .thenReturn(Map.of("templateId", 61, "approvalStatus", "APPROVED", "enabled", true));

    mockMvc
        .perform(post("/investment/radar/outreach-template/61/approve"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.approvalStatus").value("APPROVED"))
        .andExpect(jsonPath("$.data.enabled").value(true));

    verify(investmentService).setOutreachTemplateApproval(61L, "APPROVED");
  }

  @Test
  void rejectOutreachTemplateReturnsRejectedStatus() throws Exception {
    when(investmentService.setOutreachTemplateApproval(61L, "REJECTED"))
        .thenReturn(Map.of("templateId", 61, "approvalStatus", "REJECTED", "enabled", false));

    mockMvc
        .perform(post("/investment/radar/outreach-template/61/reject"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.approvalStatus").value("REJECTED"))
        .andExpect(jsonPath("$.data.enabled").value(false));

    verify(investmentService).setOutreachTemplateApproval(61L, "REJECTED");
  }
}
