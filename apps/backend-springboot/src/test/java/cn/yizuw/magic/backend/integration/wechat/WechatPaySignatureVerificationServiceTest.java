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

/** 微信支付回包/回调离线验签测试；不拉平台证书、不请求微信。 */
class WechatPaySignatureVerificationServiceTest {

  @Test
  void verifyChecksWechatPaySignatureWithConfiguredPublicKey() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    WechatPaySignatureVerificationService service =
        new WechatPaySignatureVerificationService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_PUBLIC_KEY_ID", "PUB_KEY_ID_1")
                .withProperty("WECHAT_PAY_PUBLIC_KEY", publicKeyPem(keyPair)));
    String message = "1780000000\nnonce-1\n{\"code\":\"SUCCESS\"}\n";
    String signatureText = sign(keyPair, message);

    WechatPaySignatureVerificationService.WechatPaySignatureVerification result =
        service.verify("PUB_KEY_ID_1", "1780000000", "nonce-1", "{\"code\":\"SUCCESS\"}", signatureText);

    assertThat(result.verified()).isTrue();
    assertThat(result.serial()).isEqualTo("PUB_KEY_ID_1");
    assertThat(result.message()).isEqualTo(message);
  }

  @Test
  void verifyReturnsFalseForInvalidSignature() throws Exception {
    KeyPair keyPair = rsaKeyPair();
    WechatPaySignatureVerificationService service =
        new WechatPaySignatureVerificationService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_PUBLIC_KEY_ID", "PUB_KEY_ID_1")
                .withProperty("WECHAT_PAY_PUBLIC_KEY", publicKeyPem(keyPair)));

    WechatPaySignatureVerificationService.WechatPaySignatureVerification result =
        service.verify(
            "PUB_KEY_ID_1",
            "1780000000",
            "nonce-1",
            "{\"code\":\"SUCCESS\"}",
            sign(keyPair, "1780000000\nnonce-2\n{\"code\":\"SUCCESS\"}\n"));

    assertThat(result.verified()).isFalse();
  }

  @Test
  void verifyRejectsMismatchedPublicKeySerial() {
    KeyPair keyPair = rsaKeyPair();
    WechatPaySignatureVerificationService service =
        new WechatPaySignatureVerificationService(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_PUBLIC_KEY_ID", "PUB_KEY_ID_1")
                .withProperty("WECHAT_PAY_PUBLIC_KEY", publicKeyPem(keyPair)));

    assertThatThrownBy(() -> service.verify("PUB_KEY_ID_2", "1780000000", "nonce-1", "{}", "signature"))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付验签公钥序列号不匹配");
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
