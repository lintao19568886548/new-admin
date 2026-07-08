package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** 微信支付 Authorization 离线签名测试；不发起微信请求。 */
class WechatPaySigningServiceTest {

  @Test
  void buildAuthorizationSignsWechatPayMessageOffline() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    WechatPaySigningService service =
        new WechatPaySigningService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
                .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
                .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(keyPair)));

    WechatPaySigningService.WechatPayAuthorization authorization =
        service.buildAuthorization(
            "post",
            "/v3/refund/domestic/refunds",
            "{\"out_refund_no\":\"vip_refund_wxapp_1\"}",
            "1780000000",
            "nonce-1");

    assertThat(authorization.authorization())
        .startsWith("WECHATPAY2-SHA256-RSA2048 ")
        .contains("mchid=\"1900000001\"")
        .contains("nonce_str=\"nonce-1\"")
        .contains("serial_no=\"serial-no\"")
        .doesNotContain("PRIVATE KEY");
    assertThat(authorization.message())
        .isEqualTo(
            "POST\n"
                + "/v3/refund/domestic/refunds\n"
                + "1780000000\n"
                + "nonce-1\n"
                + "{\"out_refund_no\":\"vip_refund_wxapp_1\"}\n");
    assertThat(verifies(keyPair, authorization.message(), authorization.signature())).isTrue();
  }

  @Test
  void buildAuthorizationRejectsMissingPrivateKey() {
    WechatPaySigningService service =
        new WechatPaySigningService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
                .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no"));

    assertThatThrownBy(
            () ->
                service.buildAuthorization(
                    "GET", "/v3/pay/transactions/out-trade-no/order_1", "", "1780000000", "nonce-1"))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("缺少微信支付环境变量 WECHAT_PAY_PRIVATE_KEY_PATH");
  }

  private boolean verifies(KeyPair keyPair, String message, String signatureText) throws Exception {
    Signature verifier = Signature.getInstance("SHA256withRSA");
    verifier.initVerify(keyPair.getPublic());
    verifier.update(message.getBytes(StandardCharsets.UTF_8));
    return verifier.verify(Base64.getDecoder().decode(signatureText));
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
