package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** 微信支付 HTTP 响应验签测试；不请求微信、不解析业务响应。 */
class WechatPayHttpResponseVerificationServiceTest {

  @Test
  void verifyChecksWechatPayHttpResponseSignature() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    WechatPayHttpResponseVerificationService service = newService(keyPair);
    String body = "{\"out_refund_no\":\"vip_refund_wxapp_1\",\"status\":\"SUCCESS\"}";
    String message = "1780000000\nnonce-1\n" + body + "\n";

    WechatPayHttpResponseVerificationService.WechatPayHttpResponseVerification verification =
        service.verify(response(200, body, headers("PUB_KEY_ID_1", "1780000000", "nonce-1", sign(keyPair, message))));

    assertThat(verification.verified()).isTrue();
    assertThat(verification.statusCode()).isEqualTo(200);
    assertThat(verification.serial()).isEqualTo("PUB_KEY_ID_1");
    assertThat(verification.message()).isEqualTo(message);
  }

  @Test
  void verifyReadsHeadersCaseInsensitively() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    WechatPayHttpResponseVerificationService service = newService(keyPair);
    String body = "{}";
    String message = "1780000000\nnonce-1\n{}\n";

    WechatPayHttpResponseVerificationService.WechatPayHttpResponseVerification verification =
        service.verify(
            response(
                204,
                body,
                Map.of(
                    "wechatpay-serial",
                    List.of("PUB_KEY_ID_1"),
                    "wechatpay-timestamp",
                    List.of("1780000000"),
                    "wechatpay-nonce",
                    List.of("nonce-1"),
                    "wechatpay-signature",
                    List.of(sign(keyPair, message)))));

    assertThat(verification.verified()).isTrue();
    assertThat(verification.statusCode()).isEqualTo(204);
  }

  @Test
  void verifyRejectsMissingSignatureHeader() {
    WechatPayHttpResponseVerificationService service = newService(rsaKeyPair());

    assertThatThrownBy(
            () ->
                service.verify(
                    response(
                        200,
                        "{}",
                        Map.of(
                            "Wechatpay-Serial",
                            List.of("PUB_KEY_ID_1"),
                            "Wechatpay-Timestamp",
                            List.of("1780000000"),
                            "Wechatpay-Nonce",
                            List.of("nonce-1")))))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("缺少微信支付响应验签头 Wechatpay-Signature");
  }

  @Test
  void verifyRejectsInvalidSignature() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    WechatPayHttpResponseVerificationService service = newService(keyPair);

    assertThatThrownBy(
            () ->
                service.verify(
                    response(
                        200,
                        "{}",
                        headers(
                            "PUB_KEY_ID_1",
                            "1780000000",
                            "nonce-1",
                            sign(keyPair, "1780000000\nnonce-2\n{}\n")))))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付 HTTP 响应验签失败");
  }

  private WechatPayHttpResponseVerificationService newService(KeyPair keyPair) {
    return new WechatPayHttpResponseVerificationService(
        new WechatPaySignatureVerificationService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_PUBLIC_KEY_ID", "PUB_KEY_ID_1")
                .withProperty("WECHAT_PAY_PUBLIC_KEY", publicKeyPem(keyPair))));
  }

  private WechatPayHttpClient.WechatPayHttpResponse response(
      int statusCode, String body, Map<String, List<String>> headers) {
    return new WechatPayHttpClient.WechatPayHttpResponse(statusCode, body, headers);
  }

  private Map<String, List<String>> headers(
      String serial, String timestamp, String nonce, String signature) {
    return Map.of(
        "Wechatpay-Serial",
        List.of(serial),
        "Wechatpay-Timestamp",
        List.of(timestamp),
        "Wechatpay-Nonce",
        List.of(nonce),
        "Wechatpay-Signature",
        List.of(signature));
  }

  private String sign(KeyPair keyPair, String message) throws Exception {
    Signature signer = Signature.getInstance("SHA256withRSA");
    signer.initSign(keyPair.getPrivate());
    signer.update(message.getBytes(StandardCharsets.UTF_8));
    return Base64.getEncoder().encodeToString(signer.sign());
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

  private String publicKeyPem(KeyPair keyPair) {
    return pem("PUBLIC KEY", keyPair.getPublic().getEncoded());
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
