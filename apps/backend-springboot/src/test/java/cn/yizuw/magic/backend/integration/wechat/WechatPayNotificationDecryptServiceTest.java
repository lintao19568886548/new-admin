package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** 微信支付回调 resource 离线解密测试；只使用本地 API v3 key，不请求微信。 */
class WechatPayNotificationDecryptServiceTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @Test
  void decryptsWechatPayNotificationResource() throws Exception {
    String apiV3Key = "0123456789abcdef0123456789abcdef";
    String plaintext = "{\"out_trade_no\":\"wxapp_1\",\"trade_state\":\"SUCCESS\"}";
    Map<String, Object> resource =
        encryptedResource(apiV3Key, "nonce-123456", "transaction", plaintext);
    String rawBody = JSON.writeValueAsString(Map.of("id", "notify-1", "resource", resource));
    WechatPayNotificationDecryptService service =
        new WechatPayNotificationDecryptService(
            new MockEnvironment().withProperty("WECHAT_PAY_API_V3_KEY", apiV3Key));

    WechatPayNotificationDecryptService.WechatPayDecryptedResource result =
        service.decrypt(rawBody);

    assertThat(result.algorithm()).isEqualTo("AEAD_AES_256_GCM");
    assertThat(result.plaintext()).isEqualTo(plaintext);
    assertThat(result.data())
        .containsEntry("out_trade_no", "wxapp_1")
        .containsEntry("trade_state", "SUCCESS");
  }

  @Test
  void decryptRejectsUnsupportedAlgorithm() {
    WechatPayNotificationDecryptService service =
        new WechatPayNotificationDecryptService(
            new MockEnvironment().withProperty("WECHAT_PAY_API_V3_KEY", "0123456789abcdef0123456789abcdef"));

    assertThatThrownBy(
            () ->
                service.decryptResource(
                    Map.of(
                        "algorithm",
                        "RSA_OAEP",
                        "ciphertext",
                        "ciphertext",
                        "nonce",
                        "nonce-123456")))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("不支持的微信支付 resource 加密算法");
  }

  @Test
  void decryptRequiresThirtyTwoByteApiV3Key() throws Exception {
    String plaintext = "{\"out_refund_no\":\"vip_refund_wxapp_1\",\"refund_status\":\"SUCCESS\"}";
    Map<String, Object> resource =
        encryptedResource("0123456789abcdef0123456789abcdef", "nonce-123456", "", plaintext);
    WechatPayNotificationDecryptService service =
        new WechatPayNotificationDecryptService(
            new MockEnvironment().withProperty("WECHAT_PAY_API_V3_KEY", "too-short"));

    assertThatThrownBy(() -> service.decryptResource(resource))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付 API v3 key 必须为 32 字节");
  }

  private Map<String, Object> encryptedResource(
      String apiV3Key, String nonce, String associatedData, String plaintext) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(
        Cipher.ENCRYPT_MODE,
        new SecretKeySpec(apiV3Key.getBytes(StandardCharsets.UTF_8), "AES"),
        new GCMParameterSpec(128, nonce.getBytes(StandardCharsets.UTF_8)));
    if (!associatedData.isBlank()) {
      cipher.updateAAD(associatedData.getBytes(StandardCharsets.UTF_8));
    }
    String ciphertext =
        Base64.getEncoder().encodeToString(cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8)));
    Map<String, Object> resource = new LinkedHashMap<>();
    resource.put("algorithm", "AEAD_AES_256_GCM");
    resource.put("associated_data", associatedData);
    resource.put("ciphertext", ciphertext);
    resource.put("nonce", nonce);
    return resource;
  }
}
