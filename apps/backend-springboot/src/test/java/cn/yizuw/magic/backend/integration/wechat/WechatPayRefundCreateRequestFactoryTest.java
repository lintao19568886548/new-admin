package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** 微信支付退款创建请求离线构造测试；不请求微信、不更新退款状态。 */
class WechatPayRefundCreateRequestFactoryTest {

  @Test
  void buildCreatesSignedRefundCreateRequestOffline() {
    WechatPayRefundCreateRequestFactory factory = newFactory(rsaKeyPair());

    WechatPayRefundCreateRequestFactory.WechatPayRefundCreateRequest request =
        factory.build(
            new WechatPayRefundCreateRequestFactory.WechatPayRefundCreateCommand(
                "wxapp_order_1",
                "",
                "vip_refund_wxapp_1",
                100,
                300,
                "membership refund",
                "https://api.example.com/api/wechat/pay/refund-notify",
                ""),
            "1780000000",
            "nonce-1");

    assertThat(request.method()).isEqualTo("POST");
    assertThat(request.path()).isEqualTo("/v3/refund/domestic/refunds");
    assertThat(request.body())
        .isEqualTo(
            "{\"out_trade_no\":\"wxapp_order_1\","
                + "\"out_refund_no\":\"vip_refund_wxapp_1\","
                + "\"reason\":\"membership refund\","
                + "\"notify_url\":\"https://api.example.com/api/wechat/pay/refund-notify\","
                + "\"amount\":{\"refund\":100,\"total\":300,\"currency\":\"CNY\"}}");
    assertThat(request.signatureMessage())
        .isEqualTo(
            "POST\n"
                + "/v3/refund/domestic/refunds\n"
                + "1780000000\n"
                + "nonce-1\n"
                + request.body()
                + "\n");
    assertThat(request.headers())
        .containsEntry("Accept", "application/json")
        .containsEntry("Content-Type", "application/json")
        .containsEntry("User-Agent", "magic-backend-springboot");
    assertThat(request.headers().get("Authorization"))
        .startsWith("WECHATPAY2-SHA256-RSA2048 ")
        .contains("mchid=\"1900000001\"")
        .contains("nonce_str=\"nonce-1\"")
        .contains("serial_no=\"serial-no\"")
        .doesNotContain("PRIVATE KEY");
  }

  @Test
  void buildUsesTransactionIdWhenProvided() {
    WechatPayRefundCreateRequestFactory factory = newFactory(rsaKeyPair());

    WechatPayRefundCreateRequestFactory.WechatPayRefundCreateRequest request =
        factory.build(
            new WechatPayRefundCreateRequestFactory.WechatPayRefundCreateCommand(
                "wxapp_order_1",
                "4200000000000000001",
                "vip_refund_wxapp_1",
                100,
                300,
                "",
                "",
                "USD"),
            "1780000000",
            "nonce-1");

    assertThat(request.body())
        .isEqualTo(
            "{\"transaction_id\":\"4200000000000000001\","
                + "\"out_refund_no\":\"vip_refund_wxapp_1\","
                + "\"amount\":{\"refund\":100,\"total\":300,\"currency\":\"USD\"}}");
    assertThat(request.body()).doesNotContain("out_trade_no");
  }

  @Test
  void buildRejectsRefundAmountGreaterThanTotalAmount() {
    WechatPayRefundCreateRequestFactory factory = newFactory(rsaKeyPair());

    assertThatThrownBy(
            () ->
                factory.build(
                    new WechatPayRefundCreateRequestFactory.WechatPayRefundCreateCommand(
                        "wxapp_order_1", "", "vip_refund_wxapp_1", 400, 300, "", "", ""),
                    "1780000000",
                    "nonce-1"))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付退款金额不能大于订单金额");
  }

  @Test
  void buildRejectsMissingOutRefundNo() {
    WechatPayRefundCreateRequestFactory factory = newFactory(rsaKeyPair());

    assertThatThrownBy(
            () ->
                factory.build(
                    new WechatPayRefundCreateRequestFactory.WechatPayRefundCreateCommand(
                        "wxapp_order_1", "", " ", 100, 300, "", "", ""),
                    "1780000000",
                    "nonce-1"))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("缺少微信支付退款创建参数 outRefundNo");
  }

  private WechatPayRefundCreateRequestFactory newFactory(KeyPair keyPair) {
    WechatPaySigningService signingService =
        new WechatPaySigningService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
                .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
                .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(keyPair)));
    return new WechatPayRefundCreateRequestFactory(signingService);
  }

  private KeyPair rsaKeyPair() {
    try {
      KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
      generator.initialize(2048);
      return generator.generateKeyPair();
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  private String privateKeyPem(KeyPair keyPair) {
    return pem("PRIVATE KEY", keyPair.getPrivate().getEncoded());
  }

  private String pem(String type, byte[] content) {
    return "-----BEGIN "
        + type
        + "-----\n"
        + Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
            .encodeToString(content)
        + "\n-----END "
        + type
        + "-----\n";
  }
}
