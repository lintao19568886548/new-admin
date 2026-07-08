package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmInviteResolveRequest;
import cn.yizuw.magic.backend.crm.CrmService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十八批 CRM 邀请和销售联系方式本地兼容接口路由测试。 */
class SeventyEighthBatchControllerTest {

  private CrmService crmService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    crmService = org.mockito.Mockito.mock(CrmService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new CrmController(crmService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void inviteUrlLinkReturnsLocalCompatibleLink() throws Exception {
    when(crmService.getInviteUrlLink(
            "https://console.example.com", null, "crm_sales_9", "pages/home/index", "trial", 7))
        .thenReturn(
            Map.of(
                "channel", Map.of("id", 9, "scene", "crm_sales_9"),
                "envVersion", "trial",
                "expireInterval", 7,
                "page", "pages/home/index",
                "query", "scene=crm_sales_9",
                "scene", "crm_sales_9",
                "urlLink", "https://console.example.com/invite/crm?scene=crm_sales_9"));

    mockMvc
        .perform(
            get("/crm/invite/url-link")
                .header("Origin", "https://console.example.com")
                .param("scene", "crm_sales_9")
                .param("page", "pages/home/index")
                .param("envVersion", "trial")
                .param("expireInterval", "7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.scene").value("crm_sales_9"))
        .andExpect(jsonPath("$.data.urlLink").value("https://console.example.com/invite/crm?scene=crm_sales_9"));

    verify(crmService)
        .getInviteUrlLink(
            "https://console.example.com", null, "crm_sales_9", "pages/home/index", "trial", 7);
  }

  @Test
  void inviteWxacodeReturnsLocalPngDataUrl() throws Exception {
    when(crmService.getInviteWxacode(
            "https://console.example.com", null, "crm_sales_9", "pages/home/index", "release", 430))
        .thenReturn(
            Map.of(
                "channel", Map.of("id", 9, "scene", "crm_sales_9"),
                "envVersion", "release",
                "page", "pages/home/index",
                "scene", "crm_sales_9",
                "wxacode", Map.of("dataUrl", "data:image/png;base64,abc", "mimeType", "image/png")));

    mockMvc
        .perform(
            get("/crm/invite/wxacode")
                .header("Origin", "https://console.example.com")
                .param("scene", "crm_sales_9")
                .param("page", "pages/home/index")
                .param("envVersion", "release")
                .param("width", "430"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.wxacode.mimeType").value("image/png"))
        .andExpect(jsonPath("$.data.wxacode.dataUrl").value("data:image/png;base64,abc"));

    verify(crmService)
        .getInviteWxacode(
            "https://console.example.com", null, "crm_sales_9", "pages/home/index", "release", 430);
  }

  @Test
  void wechatOauthStartReturnsRedirectLocation() throws Exception {
    when(crmService.getWechatOauthStartRedirect(null, "https://console.example.com/app", "crm_sales_9"))
        .thenReturn("https://console.example.com/invite/crm?oauth_error=not_configured&scene=crm_sales_9");

    mockMvc
        .perform(
            get("/crm/invite/wechat-oauth/start")
                .header("Referer", "https://console.example.com/app")
                .param("scene", "crm_sales_9"))
        .andExpect(status().isFound())
        .andExpect(
            header()
                .string(
                    "Location",
                    "https://console.example.com/invite/crm?oauth_error=not_configured&scene=crm_sales_9"));

    verify(crmService)
        .getWechatOauthStartRedirect(null, "https://console.example.com/app", "crm_sales_9");
  }

  @Test
  void resolveInviteBindsBodyHeadersAndClientIp() throws Exception {
    when(crmService.resolveInvite(any(CrmInviteResolveRequest.class)))
        .thenReturn(
            Map.of(
                "binding", Map.of("id", 31, "ownerSalesUserId", 9),
                "channel", Map.of("id", 7, "scene", "crm_sales_9"),
                "contactWay", Map.of("id", 5, "state", "crm_binding_31"),
                "isFirstBind", true,
                "owner", Map.of("salesUserId", 9, "salesName", "销售A")));

    mockMvc
        .perform(
            post("/crm/invite/resolve")
                .contentType(MediaType.APPLICATION_JSON)
                .header("User-Agent", "MicroMessenger miniProgram")
                .header("X-Forwarded-For", "10.0.0.7, 10.0.0.8")
                .content(
                    """
                    {
                      "scene":"crm_sales_9",
                      "customerName":"客户A",
                      "phone":"13800138000",
                      "source":"wechat"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.binding.id").value(31))
        .andExpect(jsonPath("$.data.contactWay.state").value("crm_binding_31"));

    verify(crmService)
        .resolveInvite(
            eq(
                new CrmInviteResolveRequest(
                    "crm_sales_9",
                    "wechat",
                    "客户A",
                    "13800138000",
                    null,
                    null,
                    "10.0.0.7",
                    "MicroMessenger miniProgram")));
  }

  @Test
  void salesContactWayReturnsLocalRecord() throws Exception {
    when(crmService.getSalesContactWay(9, 31, true, "custom-state", "ww-user"))
        .thenReturn(
            Map.of(
                "id", 6,
                "qrCode", "data:image/png;base64,abc",
                "salesUserId", 9,
                "state", "custom-state",
                "weworkUserId", "ww-user"));

    mockMvc
        .perform(
            get("/crm/sales/contact-way")
                .param("salesUserId", "9")
                .param("bindingId", "31")
                .param("refresh", "true")
                .param("state", "custom-state")
                .param("weworkUserId", "ww-user"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.state").value("custom-state"))
        .andExpect(jsonPath("$.data.qrCode").value("data:image/png;base64,abc"));

    verify(crmService).getSalesContactWay(9, 31, true, "custom-state", "ww-user");
  }
}
