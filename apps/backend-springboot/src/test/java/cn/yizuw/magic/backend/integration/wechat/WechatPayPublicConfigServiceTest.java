package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** 微信支付配置体检测试；只检查配置完整性，不读取密钥内容、不请求微信。 */
class WechatPayPublicConfigServiceTest {

  @Test
  void getAppConfigStatusReportsMissingRequiredRuntimeConfig() {
    WechatPayPublicConfigService service =
        new WechatPayPublicConfigService(new MockEnvironment());

    Map<String, Object> status = service.getAppConfigStatus();

    assertThat(status)
        .containsEntry("appId", null)
        .containsEntry("configured", false)
        .containsEntry("mchId", null);
    @SuppressWarnings("unchecked")
    List<String> missing = (List<String>) status.get("missing");
    assertThat(missing)
        .contains(
            "WECHAT_OPEN_APP_ID / WECHAT_APP_ID",
            "WECHAT_PAY_MERCHANT_ID",
            "WECHAT_PAY_API_V3_KEY",
            "WECHAT_PAY_CERT_SERIAL_NO",
            "WECHAT_PAY_NOTIFY_URL",
            "WECHAT_PAY_PRIVATE_KEY / WECHAT_PAY_PRIVATE_KEY_PATH");
    @SuppressWarnings("unchecked")
    List<String> signingMissing = (List<String>) status.get("signingMissing");
    assertThat(signingMissing).containsExactly("WECHAT_PAY_PRIVATE_KEY_PARSEABLE");
  }

  @Test
  void getAppConfigStatusAcceptsWechatAppIdAliasAndInlinePrivateKey() {
    KeyPair keyPair = rsaKeyPair();
    MockEnvironment environment =
        new MockEnvironment()
            .withProperty("WECHAT_APP_ID", "wx-miniapp")
            .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
            .withProperty("WECHAT_PAY_API_V3_KEY", "api-v3-key")
            .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
            .withProperty("WECHAT_PAY_NOTIFY_URL", "https://pay.example.com/notify")
            .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(keyPair));
    WechatPayPublicConfigService service = new WechatPayPublicConfigService(environment);

    Map<String, Object> status = service.getAppConfigStatus();

    assertThat(status)
        .containsEntry("appId", "wx-miniapp")
        .containsEntry("configured", true)
        .containsEntry("mchId", "1900000001")
        .containsEntry("missing", List.of())
        .containsEntry("signingMissing", List.of())
        .containsEntry("signingReady", true);
  }

  @Test
  void getAppConfigStatusReportsNotifyReadinessWhenCallbackSwitchesAndKeysAreValid() {
    KeyPair keyPair = rsaKeyPair();
    MockEnvironment environment =
        new MockEnvironment()
            .withProperty("WECHAT_OPEN_APP_ID", "wx-open")
            .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
            .withProperty("WECHAT_PAY_API_V3_KEY", "0123456789abcdef0123456789abcdef")
            .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
            .withProperty("WECHAT_PAY_NOTIFY_URL", "https://pay.example.com/notify")
            .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(keyPair))
            .withProperty("WECHAT_PAY_PUBLIC_KEY_ID", "PUB_KEY_ID_1")
            .withProperty("WECHAT_PAY_PUBLIC_KEY", publicKeyPem(keyPair))
            .withProperty("WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED", "true")
            .withProperty("WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED", "true");
    WechatPayPublicConfigService service = new WechatPayPublicConfigService(environment);

    Map<String, Object> status = service.getAppConfigStatus();

    assertThat(status)
        .containsEntry("configured", true)
        .containsEntry("notifyMissing", List.of())
        .containsEntry("notifyReady", true)
        .containsEntry("notifyResourceDecryptEnabled", true)
        .containsEntry("notifySignatureVerifyEnabled", true);
  }

  @Test
  void getAppConfigStatusRequiresPublicKeyIdWhenPublicKeyIsConfigured() {
    KeyPair keyPair = rsaKeyPair();
    MockEnvironment environment =
        new MockEnvironment()
            .withProperty("WECHAT_OPEN_APP_ID", "wx-open")
            .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
            .withProperty("WECHAT_PAY_API_V3_KEY", "api-v3-key")
            .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
            .withProperty("WECHAT_PAY_NOTIFY_URL", "https://pay.example.com/notify")
            .withProperty("WECHAT_PAY_PRIVATE_KEY", privateKeyPem(keyPair))
            .withProperty("WECHAT_PAY_PUBLIC_KEY", publicKeyPem(keyPair));
    WechatPayPublicConfigService service = new WechatPayPublicConfigService(environment);

    Map<String, Object> status = service.getAppConfigStatus();

    assertThat(status).containsEntry("configured", false);
    @SuppressWarnings("unchecked")
    List<String> missing = (List<String>) status.get("missing");
    assertThat(missing).containsExactly("WECHAT_PAY_PUBLIC_KEY_ID");
    assertThat(status).containsEntry("signingReady", true);
    @SuppressWarnings("unchecked")
    List<String> notifyMissing = (List<String>) status.get("notifyMissing");
    assertThat(notifyMissing)
        .contains(
            "WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED",
            "WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED",
            "WECHAT_PAY_PUBLIC_KEY_ID",
            "WECHAT_PAY_API_V3_KEY_32_BYTES");
  }

  @Test
  void getAppConfigStatusReportsUnparseableSigningKeysWithoutExposingKeyContent() {
    MockEnvironment environment =
        new MockEnvironment()
            .withProperty("WECHAT_OPEN_APP_ID", "wx-open")
            .withProperty("WECHAT_PAY_MERCHANT_ID", "1900000001")
            .withProperty("WECHAT_PAY_API_V3_KEY", "api-v3-key")
            .withProperty("WECHAT_PAY_CERT_SERIAL_NO", "serial-no")
            .withProperty("WECHAT_PAY_NOTIFY_URL", "https://pay.example.com/notify")
            .withProperty("WECHAT_PAY_PRIVATE_KEY", "not-a-private-key")
            .withProperty("WECHAT_PAY_PUBLIC_KEY_ID", "PUB_KEY_ID_1")
            .withProperty("WECHAT_PAY_PUBLIC_KEY", "not-a-public-key");
    WechatPayPublicConfigService service = new WechatPayPublicConfigService(environment);

    Map<String, Object> status = service.getAppConfigStatus();

    assertThat(status)
        .containsEntry("configured", true)
        .containsEntry("signingReady", false);
    @SuppressWarnings("unchecked")
    List<String> signingMissing = (List<String>) status.get("signingMissing");
    assertThat(signingMissing)
        .containsExactly("WECHAT_PAY_PRIVATE_KEY_PARSEABLE", "WECHAT_PAY_PUBLIC_KEY_PARSEABLE");
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

  private String publicKeyPem(KeyPair keyPair) {
    return pem("PUBLIC KEY", keyPair.getPublic().getEncoded());
  }

  private String pem(String type, byte[] content) {
    return "-----BEGIN "
        + type
        + "-----\n"
        + Base64.getMimeEncoder(64, "\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII))
            .encodeToString(content)
        + "\n-----END "
        + type
        + "-----\n";
  }
}
