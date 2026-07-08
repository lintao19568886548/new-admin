package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmMiniProgramQrcodeTestRequest;
import cn.yizuw.magic.backend.crm.CrmSalesQrcodeRequest;
import cn.yizuw.magic.backend.crm.CrmService;
import cn.yizuw.magic.backend.hrm.HrmController;
import cn.yizuw.magic.backend.hrm.HrmService;
import cn.yizuw.magic.backend.integration.wework.WeworkCallbackController;
import cn.yizuw.magic.backend.integration.wework.WeworkCallbackService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第七十九批 CRM 本地二维码、HRM park 旧路径和企微回调显式路由测试。 */
class SeventyNinthBatchControllerTest {

  private CrmService crmService;
  private HrmService hrmService;
  private MockMvc mockMvc;
  private WeworkCallbackService weworkCallbackService;

  @BeforeEach
  void setUp() {
    crmService = org.mockito.Mockito.mock(CrmService.class);
    hrmService = org.mockito.Mockito.mock(HrmService.class);
    weworkCallbackService = org.mockito.Mockito.mock(WeworkCallbackService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new CrmController(crmService),
                new HrmController(hrmService),
                new WeworkCallbackController(weworkCallbackService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void salesQrcodeCreatesChannelAndLocalWxacode() throws Exception {
    when(crmService.createSalesQrcode(any(CrmSalesQrcodeRequest.class)))
        .thenReturn(
            Map.of(
                "channel", Map.of("id", 19, "scene", "crm_sales_19"),
                "wxacode", Map.of("dataUrl", "data:image/png;base64,abc", "mimeType", "image/png")));

    mockMvc
        .perform(
            post("/crm/sales/qrcode")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "salesUserId":19,
                      "channelName":"本地销售码",
                      "generateWxacode":true,
                      "page":"pages/home/index",
                      "envVersion":"trial"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.channel.scene").value("crm_sales_19"))
        .andExpect(jsonPath("$.data.wxacode.mimeType").value("image/png"));

    verify(crmService).createSalesQrcode(any(CrmSalesQrcodeRequest.class));
  }

  @Test
  void miniprogramQrcodeTestReturnsLocalPngDataUrl() throws Exception {
    when(crmService.createMiniProgramQrcodeTest(any(CrmMiniProgramQrcodeTestRequest.class)))
        .thenReturn(
            Map.of(
                "envVersion", "release",
                "page", "pages/home/index",
                "scene", "test_scene",
                "wxacode", Map.of("dataUrl", "data:image/png;base64,xyz", "mimeType", "image/png")));

    mockMvc
        .perform(
            post("/crm/miniprogram/qrcode-test")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "scene":"test_scene",
                      "width":430
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.scene").value("test_scene"))
        .andExpect(jsonPath("$.data.wxacode.dataUrl").value("data:image/png;base64,xyz"));

    verify(crmService).createMiniProgramQrcodeTest(any(CrmMiniProgramQrcodeTestRequest.class));
  }

  @Test
  void leaveApplicationParkOldPathReturnsOptions() throws Exception {
    when(hrmService.getLeaveApplicationParks())
        .thenReturn(List.of(Map.of("label", "园区A", "value", 3)));

    mockMvc
        .perform(get("/hrm/leaveapplication/park"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data[0].label").value("园区A"))
        .andExpect(jsonPath("$.data[0].value").value(3));

    verify(hrmService).getLeaveApplicationParks();
  }

  @Test
  void getWeworkCallbackReturnsPlainEcho() throws Exception {
    when(weworkCallbackService.verifyCallback("echo", "sig", "nonce-1", "1782912000"))
        .thenReturn("echo");

    mockMvc
        .perform(
            get("/wework/callback")
                .queryParam("echostr", "echo")
                .queryParam("signature", "sig")
                .queryParam("nonce", "nonce-1")
                .queryParam("timestamp", "1782912000"))
        .andExpect(status().isOk())
        .andExpect(content().string("echo"));

    verify(weworkCallbackService).verifyCallback("echo", "sig", "nonce-1", "1782912000");
  }

  @Test
  void postWeworkCallbackReturnsSuccess() throws Exception {
    String rawXml = "<xml><Event><![CDATA[add_external_contact]]></Event></xml>";
    when(weworkCallbackService.recordCallback(rawXml, "msg-sig", "nonce-1", "sig", "1782912000"))
        .thenReturn("success");

    mockMvc
        .perform(
            post("/wework/callback")
                .contentType(MediaType.APPLICATION_XML)
                .queryParam("msg_signature", "msg-sig")
                .queryParam("nonce", "nonce-1")
                .queryParam("signature", "sig")
                .queryParam("timestamp", "1782912000")
                .content(rawXml))
        .andExpect(status().isOk())
        .andExpect(content().string("success"));

    verify(weworkCallbackService)
        .recordCallback(rawXml, "msg-sig", "nonce-1", "sig", "1782912000");
  }
}
