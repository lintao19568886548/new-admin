package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 微信支付退款响应解析测试；不请求微信、不更新退款状态。 */
class WechatPayRefundResponseMapperTest {

  private final WechatPayRefundResponseMapper mapper = new WechatPayRefundResponseMapper();

  @Test
  void parseMapsWechatRefundResponseToLocalSnapshot() {
    WechatPayRefundResponseMapper.WechatPayRefundResponse response =
        mapper.parse(
            """
            {
              "refund_id": "5000001",
              "out_refund_no": "vip_refund_wxapp_1",
              "out_trade_no": "wxapp_order_1",
              "transaction_id": "4200000000000000001",
              "status": "SUCCESS",
              "success_time": "2026-07-02T08:00:00+08:00",
              "amount": {
                "refund": 100,
                "total": 300,
                "currency": "CNY"
              }
            }
            """);

    assertThat(response.outRefundNo()).isEqualTo("vip_refund_wxapp_1");
    assertThat(response.refundId()).isEqualTo("5000001");
    assertThat(response.outTradeNo()).isEqualTo("wxapp_order_1");
    assertThat(response.transactionId()).isEqualTo("4200000000000000001");
    assertThat(response.providerStatus()).isEqualTo("SUCCESS");
    assertThat(response.localStatus()).isEqualTo("SUCCESS");
    assertThat(response.successTime()).isEqualTo("2026-07-02T08:00:00+08:00");
    assertThat(response.refundAmount()).isEqualTo(100);
    assertThat(response.totalAmount()).isEqualTo(300);
    assertThat(response.currency()).isEqualTo("CNY");
  }

  @Test
  void parseAcceptsRefundNotifyAliasesAndStringAmounts() {
    WechatPayRefundResponseMapper.WechatPayRefundResponse response =
        mapper.parse(
            Map.of(
                "outRefundNo",
                "vip_refund_wxapp_2",
                "refundStatus",
                "PROCESSING",
                "amount",
                Map.of("refund", "50", "total", "300", "currency", "CNY")));

    assertThat(response.outRefundNo()).isEqualTo("vip_refund_wxapp_2");
    assertThat(response.providerStatus()).isEqualTo("PROCESSING");
    assertThat(response.localStatus()).isEqualTo("PROCESSING");
    assertThat(response.refundAmount()).isEqualTo(50);
    assertThat(response.totalAmount()).isEqualTo(300);
  }

  @Test
  void parseKeepsUnknownProviderStatusVisible() {
    WechatPayRefundResponseMapper.WechatPayRefundResponse response =
        mapper.parse(Map.of("out_refund_no", "vip_refund_wxapp_3", "status", "manual_review"));

    assertThat(response.providerStatus()).isEqualTo("manual_review");
    assertThat(response.localStatus()).isEqualTo("UNKNOWN");
  }

  @Test
  void parseRejectsMissingRequiredFields() {
    assertThatThrownBy(() -> mapper.parse("{\"status\":\"SUCCESS\"}"))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("缺少微信支付退款响应字段 outRefundNo");
  }

  @Test
  void parseRejectsInvalidAmountValue() {
    assertThatThrownBy(
            () ->
                mapper.parse(
                    Map.of(
                        "out_refund_no",
                        "vip_refund_wxapp_4",
                        "status",
                        "SUCCESS",
                        "amount",
                        Map.of("refund", "abc"))))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付退款响应金额不是合法整数");
  }
}
