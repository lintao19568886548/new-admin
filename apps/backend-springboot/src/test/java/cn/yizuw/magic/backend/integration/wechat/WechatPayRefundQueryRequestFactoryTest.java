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

/** 微信支付退款查询请求离线构造测试；不请求微信、不更新退款状态。 */
class WechatPayRefundQueryRequestFactoryTest {

  @Test
  void buildCreatesSignedRefundQueryRequestOffline() {
    WechatPayRefundQueryRequestFactory factory = newFactory(rsaKeyPair());

    WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest request =
        factory.build("vip_refund_wxapp_1", "1780000000", "nonce-1");

    assertThat(request.method()).isEqualTo("GET");
    assertThat(request.path()).isEqualTo("/v3/refund/domestic/refunds/vip_refund_wxapp_1");
    assertThat(request.body()).isEmpty();
    assertThat(request.signatureMessage())
        .isEqualTo(
            "GET\n"
                + "/v3/refund/domestic/refunds/vip_refund_wxapp_1\n"
                + "1780000000\n"
                + "nonce-1\n"
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
  void buildEncodesOutRefundNoAsPathSegment() {
    WechatPayRefundQueryRequestFactory factory = newFactory(rsaKeyPair());

    WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest request =
        factory.build("vip refund/1", "1780000000", "nonce-1");

    assertThat(request.path()).isEqualTo("/v3/refund/domestic/refunds/vip%20refund%2F1");
    assertThat(request.signatureMessage()).contains("/v3/refund/domestic/refunds/vip%20refund%2F1\n");
  }

  @Test
  void buildRejectsMissingOutRefundNo() {
    WechatPayRefundQueryRequestFactory factory = newFactory(rsaKeyPair());

    assertThatThrownBy(() -> factory.build(" ", "1780000000", "nonce-1"))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("缺少微信支付退款查询参数 outRefundNo");
  }

  private WechatPayRefundQueryRequestFactory newFactory(KeyPair keyPair) {
    WechatPaySigningService signingService =
        new WechatPaySigningService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
                .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
                .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(keyPair)));
    return new WechatPayRefundQueryRequestFactory(signingService);
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
