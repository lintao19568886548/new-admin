package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.localization.LocalizationController;
import cn.yizuw.magic.backend.localization.LocalizationService;
import cn.yizuw.magic.backend.localization.LocalizationUpdateRequest;
import cn.yizuw.magic.backend.status.TestController;
import cn.yizuw.magic.backend.user.UserFeedbackController;
import cn.yizuw.magic.backend.user.UserFeedbackRequest;
import cn.yizuw.magic.backend.user.UserFeedbackService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第三十四批低副作用写接口和模板预览接口测试。 */
class ThirtyFourthBatchControllerTest {

  private UserFeedbackService feedbackService;
  private InvestmentService investmentService;
  private LocalizationService localizationService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    feedbackService = org.mockito.Mockito.mock(UserFeedbackService.class);
    investmentService = org.mockito.Mockito.mock(InvestmentService.class);
    localizationService = org.mockito.Mockito.mock(LocalizationService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new TestController(),
                new UserFeedbackController(feedbackService),
                new InvestmentController(investmentService),
                new LocalizationController(localizationService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void testPostRouteKeepsLegacyPlainText() throws Exception {
    mockMvc
        .perform(post("/test"))
        .andExpect(status().isOk())
        .andExpect(content().string("Test post handler"));
  }

  @Test
  void userFeedbackSubmitReturnsFeedbackIdAndMessage() throws Exception {
    when(feedbackService.submit(any(UserFeedbackRequest.class), eq("JUnit")))
        .thenReturn(Map.of("categoryLabel", "功能建议", "feedbackId", 18));

    mockMvc
        .perform(
            post("/user/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .header("user-agent", "JUnit")
                .content(
                    """
                    {
                      "category":"feature",
                      "content":"希望增加批量导出能力",
                      "contact":"13800000000",
                      "clientPlatform":"web",
                      "images":[{"imgId":3}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("反馈已提交，感谢您的建议"))
        .andExpect(jsonPath("$.data.feedbackId").value(18))
        .andExpect(jsonPath("$.data.categoryLabel").value("功能建议"));
  }

  @Test
  void outreachTemplatePreviewRendersPlaceholdersInMemory() throws Exception {
    when(investmentService.previewOutreachTemplate(any()))
        .thenReturn(
            Map.of(
                "content",
                "您好，测试企业可看测试园区",
                "missingPlaceholders",
                List.of(),
                "placeholders",
                List.of("companyName", "parkName"),
                "usedPlaceholders",
                List.of("companyName", "parkName")));

    mockMvc
        .perform(
            post("/investment/radar/outreach-template/preview")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "content":"您好，{companyName}可看{parkName}",
                      "placeholderJson":["companyName","parkName"]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.content").value("您好，测试企业可看测试园区"))
        .andExpect(jsonPath("$.data.placeholders[0]").value("companyName"));
  }

  @Test
  void localizationUpdateReturnsUpdatedRecord() throws Exception {
    when(localizationService.update(eq(7), any(LocalizationUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "localizationId",
                7,
                "latitude",
                new BigDecimal("22.54321"),
                "longitude",
                new BigDecimal("113.12345"),
                "status",
                1,
                "username",
                "zhangsan"));

    mockMvc
        .perform(
            put("/localization/7")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "latitude":22.54321,
                      "longitude":113.12345,
                      "status":1
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("更新成功"))
        .andExpect(jsonPath("$.data.localizationId").value(7))
        .andExpect(jsonPath("$.data.username").value("zhangsan"));
  }

  @Test
  void localizationDeleteReturnsLegacySuccessMessage() throws Exception {
    mockMvc
        .perform(delete("/localization/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("删除成功"));

    verify(localizationService).delete(7);
  }
}
