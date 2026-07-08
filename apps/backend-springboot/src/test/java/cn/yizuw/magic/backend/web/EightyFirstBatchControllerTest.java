package cn.yizuw.magic.backend.web;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.auth.AuthController;
import cn.yizuw.magic.backend.auth.AuthService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayController;
import cn.yizuw.magic.backend.integration.wechat.WechatPayPublicConfigService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundOrderService;
import cn.yizuw.magic.backend.llm.ChatController;
import cn.yizuw.magic.backend.llm.LlmService;
import cn.yizuw.magic.backend.permission.PermissionService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八十一批认证兼容、支付只读、小程序本地校验和智谱占位接口测试。 */
class EightyFirstBatchControllerTest {

  private AuthService authService;
  private CrmService crmService;
  private LlmService llmService;
  private MockMvc mockMvc;
  private WechatPayRefundOrderService wechatPayRefundOrderService;

  @BeforeEach
  void setUp() {
    authService = org.mockito.Mockito.mock(AuthService.class);
    crmService = org.mockito.Mockito.mock(CrmService.class);
    llmService = org.mockito.Mockito.mock(LlmService.class);
    PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    wechatPayRefundOrderService = org.mockito.Mockito.mock(WechatPayRefundOrderService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AuthController(authService, permissionService),
                new CrmController(crmService),
                new WechatPayController(
                    wechatPayRefundOrderService, wechatPayPublicConfigService),
                new ChatController(llmService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void authPasswordGetReturnsCompatibilityInfo() throws Exception {
    when(authService.passwordCompatibilityInfo())
        .thenReturn(Map.of("method", "POST", "path", "/api/auth/password", "writeOnGet", false));

    mockMvc
        .perform(get("/auth/password"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.method").value("POST"))
        .andExpect(jsonPath("$.data.writeOnGet").value(false));

    verify(authService).passwordCompatibilityInfo();
  }

  @Test
  void wechatPayQueryReturnsLocalSnapshot() throws Exception {
    when(wechatPayRefundOrderService.queryLocalPaymentOrder("vip_20260701_1"))
        .thenReturn(
            Map.of(
                "externalCall",
                false,
                "mode",
                "local_snapshot",
                "outTradeNo",
                "vip_20260701_1",
                "tradeState",
                "SUCCESS"));

    mockMvc
        .perform(get("/wechat/pay/query").param("outTradeNo", "vip_20260701_1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.outTradeNo").value("vip_20260701_1"))
        .andExpect(jsonPath("$.data.externalCall").value(false));

    verify(wechatPayRefundOrderService).queryLocalPaymentOrder("vip_20260701_1");
  }

  @Test
  void miniProgramSessionReturnsLocalStub() throws Exception {
    when(crmService.exchangeMiniProgramSessionLocal(org.mockito.ArgumentMatchers.anyMap()))
        .thenReturn(Map.of("externalCall", false, "mode", "local_stub", "openid", "", "unionid", ""));

    mockMvc
        .perform(
            post("/crm/miniprogram/session")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"mini-code\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.mode").value("local_stub"))
        .andExpect(jsonPath("$.data.externalCall").value(false));

    verify(crmService).exchangeMiniProgramSessionLocal(org.mockito.ArgumentMatchers.anyMap());
  }

  @Test
  void miniProgramPhoneReturnsLocalStub() throws Exception {
    when(crmService.getMiniProgramPhoneLocal(org.mockito.ArgumentMatchers.anyMap()))
        .thenReturn(Map.of("externalCall", false, "mode", "local_stub", "phoneNumber", ""));

    mockMvc
        .perform(
            post("/crm/miniprogram/phone")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"phone-code\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.mode").value("local_stub"))
        .andExpect(jsonPath("$.data.phoneNumber").value(""));

    verify(crmService).getMiniProgramPhoneLocal(org.mockito.ArgumentMatchers.anyMap());
  }

  @Test
  void chatZhipuReturnsLocalStub() throws Exception {
    when(llmService.chatZhipu(org.mockito.ArgumentMatchers.any()))
        .thenReturn(
            Map.of(
                "externalCall",
                false,
                "id",
                "local-zhipu-stub",
                "model",
                "glm-4",
                "object",
                "chat.completion"));

    mockMvc
        .perform(
            post("/chat/zhipu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"你好\",\"model\":\"glm-4\",\"apikey\":\"secret\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value("local-zhipu-stub"))
        .andExpect(jsonPath("$.data.externalCall").value(false));

    verify(llmService).chatZhipu(org.mockito.ArgumentMatchers.any());
  }
}
