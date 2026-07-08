package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.bill.AmountBillCollectionSmsPreviewRequest;
import cn.yizuw.magic.backend.bill.AmountBillController;
import cn.yizuw.magic.backend.bill.AmountBillExportRequest;
import cn.yizuw.magic.backend.bill.AmountBillService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.image.ImageController;
import cn.yizuw.magic.backend.image.ImageService;
import cn.yizuw.magic.backend.organization.OrganizationController;
import cn.yizuw.magic.backend.organization.OrganizationInvitationRevokeRequest;
import cn.yizuw.magic.backend.organization.OrganizationService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.multipart.MultipartFile;

/** 第五十二批账单、图片和组织邀请码低副作用接口路由测试。 */
class FiftySecondBatchControllerTest {

  private AmountBillService amountBillService;
  private ImageService imageService;
  private MockMvc mockMvc;
  private OrganizationService organizationService;

  @BeforeEach
  void setUp() {
    amountBillService = org.mockito.Mockito.mock(AmountBillService.class);
    imageService = org.mockito.Mockito.mock(ImageService.class);
    organizationService = org.mockito.Mockito.mock(OrganizationService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AmountBillController(amountBillService),
                new ImageController(imageService),
                new OrganizationController(organizationService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void amountBillExportReturnsParkGroupedBills() throws Exception {
    when(amountBillService.exportAmountBills(any(AmountBillExportRequest.class)))
        .thenReturn(
            List.of(
                Map.of(
                    "parkName",
                    "科技园",
                    "bills",
                    List.of(Map.of("tenantName", "租户A", "totalFee", 1200)))));

    mockMvc
        .perform(
            post("/bill/amount/export")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"parkIds\":[1,2]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].parkName").value("科技园"))
        .andExpect(jsonPath("$.data[0].bills[0].tenantName").value("租户A"));

    verify(amountBillService).exportAmountBills(any(AmountBillExportRequest.class));
  }

  @Test
  void collectionSmsPreviewReturnsItemsOptionsAndSummary() throws Exception {
    when(amountBillService.previewCollectionSms(any(AmountBillCollectionSmsPreviewRequest.class)))
        .thenReturn(
            Map.of(
                "items",
                List.of(Map.of("billId", 9, "canSend", true, "message", "租赁费用提醒")),
                "options",
                Map.of("collectionType", "payment_reminder"),
                "summary",
                Map.of("candidateCount", 1, "sendableCount", 1, "totalRemainingAmount", 300)));

    mockMvc
        .perform(
            post("/bill/amount/collection-sms/preview")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "collectionType":"payment_reminder",
                      "currentPark":3,
                      "filters":{"tenantName":"租户"}
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.items[0].billId").value(9))
        .andExpect(jsonPath("$.data.summary.sendableCount").value(1));

    verify(amountBillService).previewCollectionSms(any(AmountBillCollectionSmsPreviewRequest.class));
  }

  @Test
  void imageUploadReturnsUploadedImageInfo() throws Exception {
    when(imageService.upload(any(MultipartFile.class)))
        .thenReturn(
            Map.of(
                "imgId", 22,
                "name", "factory.png",
                "thumbUrl", "/uploads/factory.png",
                "url", "/uploads/factory.png"));
    MockMultipartFile file =
        new MockMultipartFile("file", "factory.png", "image/png", new byte[] {1, 2, 3});

    mockMvc
        .perform(multipart("/image/upload").file(file))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.imgId").value(22))
        .andExpect(jsonPath("$.data.url").value("/uploads/factory.png"));

    verify(imageService).upload(any(MultipartFile.class));
  }

  @Test
  void deleteAmountBillReturnsDeletedSnapshot() throws Exception {
    when(amountBillService.deleteAmountBill(eq(9)))
        .thenReturn(Map.of("billId", 9, "projectName", "2026年6月租金"));

    mockMvc
        .perform(delete("/bill/amount/9"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.billId").value(9))
        .andExpect(jsonPath("$.data.projectName").value("2026年6月租金"));

    verify(amountBillService).deleteAmountBill(9);
  }

  @Test
  void revokeOrganizationInvitationReturnsRevokedFlag() throws Exception {
    when(organizationService.revokeInvitation(any(OrganizationInvitationRevokeRequest.class)))
        .thenReturn(Map.of("revoked", true));

    mockMvc
        .perform(
            post("/organization/invitation/revoke")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"id\":8}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.revoked").value(true));

    verify(organizationService).revokeInvitation(any(OrganizationInvitationRevokeRequest.class));
  }
}
