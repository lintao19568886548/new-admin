package cn.yizuw.magic.backend.web;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.agent.AgentChatRequest;
import cn.yizuw.magic.backend.agent.AgentController;
import cn.yizuw.magic.backend.agent.AgentService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.integration.wechat.WechatPayController;
import cn.yizuw.magic.backend.integration.wechat.WechatPayPublicConfigService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundOrderService;
import cn.yizuw.magic.backend.llm.SmartServiceChatController;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八十八批收尾接口：Agent Chat、智能客服 SSE 和微信 H5 预支付本地兼容。 */
class EightyEighthBatchControllerTest {

  private AgentService agentService;
  private MockMvc mockMvc;
  private WechatPayRefundOrderService wechatPayRefundOrderService;

  @BeforeEach
  void setUp() {
    agentService = org.mockito.Mockito.mock(AgentService.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    wechatPayRefundOrderService = org.mockito.Mockito.mock(WechatPayRefundOrderService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AgentController(agentService),
                new SmartServiceChatController(),
                new WechatPayController(
                    wechatPayRefundOrderService, wechatPayPublicConfigService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void agentChatReturnsLocalCompatibleResponse() throws Exception {
    when(agentService.chat(any(AgentChatRequest.class)))
        .thenReturn(
            Map.of(
                "agentCode",
                "operations",
                "agentId",
                "operations",
                "createdAt",
                "2026-07-02T00:00:00Z",
                "model",
                "qwen3.5-plus",
                "reply",
                "local reply",
                "status",
                "succeeded",
                "steps",
                List.of(),
                "taskId",
                "local_agt_1"));

    mockMvc
        .perform(
            post("/agent/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "agentId": "operations",
                      "messages": [
                        {"role": "user", "content": "帮我看看今日待办"}
                      ]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.agentCode").value("operations"))
        .andExpect(jsonPath("$.data.reply").value("local reply"))
        .andExpect(jsonPath("$.data.taskId").value("local_agt_1"));

    verify(agentService).chat(any(AgentChatRequest.class));
  }

  @Test
  void smartServiceChatReturnsSsePayload() throws Exception {
    mockMvc
        .perform(
            post("/smart-service/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "messages": [
                        {"role": "user", "content": "忘记密码怎么办"}
                      ]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(content().string(containsString("data:")))
        .andExpect(content().string(containsString("忘记密码")))
        .andExpect(content().string(containsString("[DONE]")));
  }

  @Test
  void h5PrepayReturnsLocalSnapshot() throws Exception {
    when(wechatPayRefundOrderService.createH5PrepayLocal(anyMap()))
        .thenReturn(
            Map.of(
                "checkoutFlowToken",
                "local_checkout",
                "externalCall",
                false,
                "h5Url",
                "https://pay.local.invalid/wechat/h5?out_trade_no=wxh5_1",
                "mode",
                "local_h5_prepay_snapshot",
                "outTradeNo",
                "wxh5_1"));

    mockMvc
        .perform(
            post("/wechat/pay/h5/prepay")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "amount": 98000,
                      "attach": "vip-membership",
                      "description": "组织会员月度服务",
                      "h5Type": "Wap"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.externalCall").value(false))
        .andExpect(jsonPath("$.data.h5Url").value("https://pay.local.invalid/wechat/h5?out_trade_no=wxh5_1"))
        .andExpect(jsonPath("$.data.outTradeNo").value("wxh5_1"));

    verify(wechatPayRefundOrderService).createH5PrepayLocal(anyMap());
  }
}
