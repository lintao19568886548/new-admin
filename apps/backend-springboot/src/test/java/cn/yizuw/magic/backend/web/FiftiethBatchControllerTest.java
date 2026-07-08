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
import cn.yizuw.magic.backend.investment.ContactRestrictionReleaseRequest;
import cn.yizuw.magic.backend.investment.InvestmentController;
import cn.yizuw.magic.backend.investment.InvestmentService;
import cn.yizuw.magic.backend.investment.PropertyTagUpdateRequest;
import cn.yizuw.magic.backend.investment.SignalEventUpdateRequest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十批招商雷达本地状态写接口路由测试。 */
class FiftiethBatchControllerTest {

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
  void submitContactRestrictionReleaseReturnsPendingStatus() throws Exception {
    when(investmentService.submitContactRestrictionRelease(
            eq(9L), any(ContactRestrictionReleaseRequest.class)))
        .thenReturn(Map.of("restrictionId", 9, "status", "RELEASE_PENDING"));

    mockMvc
        .perform(
            post("/investment/radar/contact-restriction/9/release")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"remark\":\"客户主动申请解除\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.restrictionId").value(9))
        .andExpect(jsonPath("$.data.status").value("RELEASE_PENDING"));

    verify(investmentService)
        .submitContactRestrictionRelease(eq(9L), any(ContactRestrictionReleaseRequest.class));
  }

  @Test
  void approveContactRestrictionReleaseReturnsReleasedStatus() throws Exception {
    when(investmentService.approveContactRestrictionRelease(
            eq(9L), any(ContactRestrictionReleaseRequest.class)))
        .thenReturn(Map.of("restrictionId", 9, "status", "RELEASED"));

    mockMvc
        .perform(
            post("/investment/radar/contact-restriction/9/approve-release")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"remark\":\"确认可联系\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.status").value("RELEASED"));

    verify(investmentService)
        .approveContactRestrictionRelease(eq(9L), any(ContactRestrictionReleaseRequest.class));
  }

  @Test
  void rejectContactRestrictionReleaseReturnsRejectedStatus() throws Exception {
    when(investmentService.rejectContactRestrictionRelease(
            eq(9L), any(ContactRestrictionReleaseRequest.class)))
        .thenReturn(Map.of("restrictionId", 9, "status", "RELEASE_REJECTED"));

    mockMvc
        .perform(
            post("/investment/radar/contact-restriction/9/reject-release")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"remark\":\"仍不允许触达\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.status").value("RELEASE_REJECTED"));

    verify(investmentService)
        .rejectContactRestrictionRelease(eq(9L), any(ContactRestrictionReleaseRequest.class));
  }

  @Test
  void updateRadarPropertyTagsReturnsTagSnapshot() throws Exception {
    when(investmentService.updateRadarPropertyTags(eq(18L), any(PropertyTagUpdateRequest.class)))
        .thenReturn(
            Map.of(
                "factoryId", 18,
                "factoryName", "A 栋厂房",
                "tags", List.of("可环评", "大电量"),
                "updateTime", "2026-06-30T08:00:00Z"));

    mockMvc
        .perform(
            put("/investment/radar/property/18/tags")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tags\":[\"可环评\",\"大电量\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.factoryId").value(18))
        .andExpect(jsonPath("$.data.tags[0]").value("可环评"));

    verify(investmentService).updateRadarPropertyTags(eq(18L), any(PropertyTagUpdateRequest.class));
  }

  @Test
  void updateSignalEventReturnsReviewedStatus() throws Exception {
    when(investmentService.updateSignalEvent(eq(21L), any(SignalEventUpdateRequest.class)))
        .thenReturn(Map.of("eventId", 21, "status", "REVIEWED"));

    mockMvc
        .perform(
            put("/investment/radar/signal-event/21")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"REVIEWED\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.eventId").value(21))
        .andExpect(jsonPath("$.data.status").value("REVIEWED"));

    verify(investmentService).updateSignalEvent(eq(21L), any(SignalEventUpdateRequest.class));
  }
}
