package cn.yizuw.magic.backend.web;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十六批 CRM H5 邀请二维码本地生成接口路由测试。 */
class FiftySixthBatchControllerTest {

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
  void inviteH5QrcodeReturnsLocalPngDataUrl() throws Exception {
    when(crmService.getInviteH5Qrcode(
            "https://console.example.com", null, "crm_sales_9", 360))
        .thenReturn(
            Map.of(
                "channel",
                Map.of("id", 7, "scene", "crm_sales_9", "status", 1),
                "inviteUrl",
                "https://crm.example.com/invite/crm?scene=crm_sales_9",
                "qrcode",
                Map.of("dataUrl", "data:image/png;base64,abc", "mimeType", "image/png"),
                "scene",
                "crm_sales_9"));

    mockMvc
        .perform(
            get("/crm/invite/h5-qrcode")
                .header("Origin", "https://console.example.com")
                .param("scene", "crm_sales_9")
                .param("width", "360"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.scene").value("crm_sales_9"))
        .andExpect(jsonPath("$.data.channel.id").value(7))
        .andExpect(jsonPath("$.data.qrcode.mimeType").value("image/png"))
        .andExpect(jsonPath("$.data.qrcode.dataUrl").value("data:image/png;base64,abc"));

    verify(crmService)
        .getInviteH5Qrcode("https://console.example.com", null, "crm_sales_9", 360);
  }
}
