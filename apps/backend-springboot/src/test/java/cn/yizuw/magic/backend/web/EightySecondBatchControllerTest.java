package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.integration.wechat.WechatPayController;
import cn.yizuw.magic.backend.integration.wechat.WechatPayPublicConfigService;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundOrderService;
import cn.yizuw.magic.backend.organization.OrganizationController;
import cn.yizuw.magic.backend.organization.OrganizationProvisioningRequeueRequest;
import cn.yizuw.magic.backend.organization.OrganizationService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第八十二批微信支付本地兼容和组织开通任务重排接口测试。 */
class EightySecondBatchControllerTest {

  private MockMvc mockMvc;
  private OrganizationService organizationService;
  private WechatPayRefundOrderService wechatPayRefundOrderService;

  @BeforeEach
  void setUp() {
    organizationService = org.mockito.Mockito.mock(OrganizationService.class);
    WechatPayPublicConfigService wechatPayPublicConfigService =
        org.mockito.Mockito.mock(WechatPayPublicConfigService.class);
    wechatPayRefundOrderService = org.mockito.Mockito.mock(WechatPayRefundOrderService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new WechatPayController(
                    wechatPayRefundOrderService, wechatPayPublicConfigService),
                new OrganizationController(organizationService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void appPrepayReturnsLocalLaunchParams() throws Exception {
    when(wechatPayRefundOrderService.createAppPrepayLocal(anyMap()))
        .thenReturn(
            Map.of(
                "externalCall",
                false,
                "launchParams",
                Map.of(
                    "outTradeNo",
                    "wxapp_1",
                    "packageValue",
                    "Sign=WXPay",
                    "prepayId",
                    "local_wxapp_1"),
                "mode",
                "local_prepay_snapshot",
                "prepayId",
                "local_wxapp_1"));

    mockMvc
        .perform(
            post("/wechat/pay/app/prepay")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "amount": 98000,
                      "attach": "vip-membership",
                      "description": "组织会员月度服务"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.externalCall").value(false))
        .andExpect(jsonPath("$.data.launchParams.outTradeNo").value("wxapp_1"))
        .andExpect(jsonPath("$.data.prepayId").value("local_wxapp_1"));

    verify(wechatPayRefundOrderService).createAppPrepayLocal(anyMap());
  }

  @Test
  void payNotifyReturnsWechatSuccessPayload() throws Exception {
    when(wechatPayRefundOrderService.acceptPayNotificationLocal(any(), anyMap()))
        .thenReturn(
            Map.of(
                "externalCall",
                false,
                "mode",
                "local_notify_ack",
                "outTradeNo",
                "wxapp_1"));

    mockMvc
        .perform(
            post("/wechat/pay/notify")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Wechatpay-Serial", "serial")
                .content("{\"resource\":{\"out_trade_no\":\"wxapp_1\",\"trade_state\":\"SUCCESS\"}}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value("SUCCESS"))
        .andExpect(jsonPath("$.message").value("成功"));

    verify(wechatPayRefundOrderService).acceptPayNotificationLocal(any(), anyMap());
  }

  @Test
  void payNotifyReturnsWechatFailPayloadWhenSignatureRejected() throws Exception {
    when(wechatPayRefundOrderService.acceptPayNotificationLocal(any(), anyMap()))
        .thenThrow(new BusinessException(HttpStatus.BAD_REQUEST, "微信支付回调签名校验失败"));

    mockMvc
        .perform(
            post("/wechat/pay/notify")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Wechatpay-Serial", "serial")
                .content("{\"resource\":{\"out_trade_no\":\"wxapp_1\",\"trade_state\":\"SUCCESS\"}}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("FAIL"))
        .andExpect(jsonPath("$.message").value("微信支付回调签名校验失败"));

    verify(wechatPayRefundOrderService).acceptPayNotificationLocal(any(), anyMap());
  }

  @Test
  void refundCreatesLocalRequest() throws Exception {
    when(wechatPayRefundOrderService.createRefundLocal(anyMap()))
        .thenReturn(
            Map.of(
                "externalCall",
                false,
                "mode",
                "local_refund_request",
                "outRefundNo",
                "vip_refund_wxapp_1",
                "outTradeNo",
                "wxapp_1",
                "submittedToWechat",
                false));

    mockMvc
        .perform(
            post("/wechat/pay/refund")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"outTradeNo\":\"wxapp_1\",\"reason\":\"测试退款\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.outRefundNo").value("vip_refund_wxapp_1"))
        .andExpect(jsonPath("$.data.submittedToWechat").value(false));

    verify(wechatPayRefundOrderService).createRefundLocal(anyMap());
  }

  @Test
  void refundNotifyReturnsWechatSuccessPayload() throws Exception {
    when(wechatPayRefundOrderService.acceptRefundNotificationLocal(any(), anyMap()))
        .thenReturn(
            Map.of(
                "externalCall",
                false,
                "mode",
                "local_refund_notify_ack",
                "outRefundNo",
                "vip_refund_wxapp_1"));

    mockMvc
        .perform(
            post("/wechat/pay/refund-notify")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Wechatpay-Serial", "serial")
                .content("{\"resource\":{\"out_refund_no\":\"vip_refund_wxapp_1\",\"status\":\"SUCCESS\"}}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value("SUCCESS"))
        .andExpect(jsonPath("$.message").value("成功"));

    verify(wechatPayRefundOrderService).acceptRefundNotificationLocal(any(), anyMap());
  }

  @Test
  void requeueFailedManualJobReturnsPreview() throws Exception {
    when(organizationService.requeueFailedManualJob(
            any(OrganizationProvisioningRequeueRequest.class)))
        .thenReturn(
            Map.of(
                "confirmation",
                "requeue_failed_manual:31:org001",
                "execute",
                false,
                "job",
                Map.of("id", 31, "status", "failed_manual"),
                "message",
                "预览模式，未写入。",
                "organization",
                Map.of("id", 7, "name", "测试组织")));

    mockMvc
        .perform(
            post("/organization/provisioning/requeue-failed-manual")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"jobId\":31,\"reason\":\"已修复配置\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.confirmation").value("requeue_failed_manual:31:org001"))
        .andExpect(jsonPath("$.data.execute").value(false))
        .andExpect(jsonPath("$.data.job.status").value("failed_manual"));

    verify(organizationService).requeueFailedManualJob(
        any(OrganizationProvisioningRequeueRequest.class));
  }
}
