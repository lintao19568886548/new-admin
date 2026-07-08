package cn.yizuw.magic.backend.web;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.bill.AmountBillController;
import cn.yizuw.magic.backend.bill.AmountBillService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmService;
import cn.yizuw.magic.backend.llm.LlmController;
import cn.yizuw.magic.backend.llm.LlmService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八十批旧工具路由、OAuth callback 和 LLM 本地占位接口测试。 */
class EightiethBatchControllerTest {

  private AmountBillService amountBillService;
  private CrmService crmService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    amountBillService = org.mockito.Mockito.mock(AmountBillService.class);
    crmService = org.mockito.Mockito.mock(CrmService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AmountBillController(amountBillService),
                new CrmController(crmService),
                new LlmController(new LlmService()))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void amountBillUtilsReturnsCompatibilityInfo() throws Exception {
    when(amountBillService.getAmountBillUtilityRouteInfo("utils"))
        .thenReturn(Map.of("externalRoute", false, "name", "utils", "status", "compatibility_stub"));

    mockMvc
        .perform(get("/bill/amount/utils"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.name").value("utils"))
        .andExpect(jsonPath("$.data.externalRoute").value(false));

    verify(amountBillService).getAmountBillUtilityRouteInfo("utils");
  }

  @Test
  void amountBillDeleteUtilsReturnsCompatibilityInfo() throws Exception {
    when(amountBillService.getAmountBillUtilityRouteInfo("delete-utils"))
        .thenReturn(
            Map.of("externalRoute", false, "name", "delete-utils", "status", "compatibility_stub"));

    mockMvc
        .perform(get("/bill/amount/delete-utils"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.name").value("delete-utils"))
        .andExpect(jsonPath("$.data.status").value("compatibility_stub"));

    verify(amountBillService).getAmountBillUtilityRouteInfo("delete-utils");
  }

  @Test
  void wechatOauthCallbackRedirectsWithoutExternalCall() throws Exception {
    when(crmService.getWechatOauthCallbackRedirect(
            "http://localhost:5173", null, "oauth-code", "crm_sales_9", null))
        .thenReturn(
            "http://localhost:5173/invite/crm?oauth_error=external_disabled&scene=crm_sales_9");

    mockMvc
        .perform(
            get("/crm/invite/wechat-oauth/callback")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                .queryParam("code", "oauth-code")
                .queryParam("state", "crm_sales_9"))
        .andExpect(status().isFound())
        .andExpect(
            header()
                .string(
                    HttpHeaders.LOCATION,
                    "http://localhost:5173/invite/crm?oauth_error=external_disabled&scene=crm_sales_9"));

    verify(crmService)
        .getWechatOauthCallbackRedirect("http://localhost:5173", null, "oauth-code", "crm_sales_9", null);
  }

  @Test
  void amountBillAnalyzeReturnsLocalStubSchema() throws Exception {
    MockMultipartFile file =
        new MockMultipartFile(
            "file",
            "amount-bill.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            new byte[] {1, 2, 3});

    mockMvc
        .perform(multipart("/llm/amount-bill-analyze").file(file).param("formulaContext", "A1+B1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.tenantName").value(""))
        .andExpect(jsonPath("$.data.eleItems").isArray())
        .andExpect(jsonPath("$.data._meta.mode").value("local_stub"))
        .andExpect(jsonPath("$.data._meta.externalCall").value(false))
        .andExpect(jsonPath("$.data._meta.fileName").value("amount-bill.xlsx"));
  }

  @Test
  void tenantImagesReturnsLocalStubSchema() throws Exception {
    mockMvc
        .perform(
            post("/llm/tenant-images")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"dataUrls\":[\"data:image/png;base64,abc\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.tenantName").value(""))
        .andExpect(jsonPath("$.data.contractDate.start").value(""))
        .andExpect(jsonPath("$.data._meta.mode").value("local_stub"))
        .andExpect(jsonPath("$.data._meta.imageCount").value(1))
        .andExpect(jsonPath("$.data._meta.externalCall").value(false));
  }
}
