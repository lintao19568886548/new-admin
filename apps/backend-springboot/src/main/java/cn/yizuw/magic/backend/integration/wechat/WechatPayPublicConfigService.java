package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 微信支付公开配置只读服务，不读取私钥、不发起微信支付请求。 */
@Service
@Transactional(readOnly = true)
public class WechatPayPublicConfigService {

  private final Environment environment;

  public WechatPayPublicConfigService(Environment environment) {
    this.environment = environment;
  }

  /** 返回 App 拉起微信支付需要公开给前端的 appId 和商户号。 */
  public Map<String, Object> getAppPublicConfig() {
    return Map.of(
        "appId", requiredEnv("WECHAT_OPEN_APP_ID", "WECHAT_APP_ID"),
        "mchId", requiredEnv("WECHAT_PAY_MERCHANT_ID"));
  }

  /** 返回微信支付运行配置体检结果；不暴露私钥、API v3 key 或证书内容。 */
  public Map<String, Object> getAppConfigStatus() {
    String appId = firstEnv("WECHAT_OPEN_APP_ID", "WECHAT_APP_ID");
    String mchId = env("WECHAT_PAY_MERCHANT_ID");
    List<String> missing = new ArrayList<>();

    if (!StringUtils.hasText(appId)) {
      missing.add("WECHAT_OPEN_APP_ID / WECHAT_APP_ID");
    }
    if (!StringUtils.hasText(mchId)) {
      missing.add("WECHAT_PAY_MERCHANT_ID");
    }
    if (!StringUtils.hasText(env("WECHAT_PAY_API_V3_KEY"))) {
      missing.add("WECHAT_PAY_API_V3_KEY");
    }
    if (!StringUtils.hasText(env("WECHAT_PAY_CERT_SERIAL_NO"))) {
      missing.add("WECHAT_PAY_CERT_SERIAL_NO");
    }
    if (!StringUtils.hasText(env("WECHAT_PAY_NOTIFY_URL"))) {
      missing.add("WECHAT_PAY_NOTIFY_URL");
    }

    boolean hasInlinePublicKey = StringUtils.hasText(env("WECHAT_PAY_PUBLIC_KEY"));
    String publicKeyPath = env("WECHAT_PAY_PUBLIC_KEY_PATH");
    boolean hasPublicKeyFile = StringUtils.hasText(publicKeyPath) && fileExists(publicKeyPath);
    if ((hasInlinePublicKey || hasPublicKeyFile)
        && !StringUtils.hasText(env("WECHAT_PAY_PUBLIC_KEY_ID"))) {
      missing.add("WECHAT_PAY_PUBLIC_KEY_ID");
    }
    if (!hasInlinePublicKey && StringUtils.hasText(publicKeyPath) && !hasPublicKeyFile) {
      missing.add("WECHAT_PAY_PUBLIC_KEY_PATH");
    }

    boolean hasInlinePrivateKey = StringUtils.hasText(env("WECHAT_PAY_PRIVATE_KEY"));
    String privateKeyPath = env("WECHAT_PAY_PRIVATE_KEY_PATH");
    boolean hasPrivateKeyPath = StringUtils.hasText(privateKeyPath);
    if (!hasInlinePrivateKey && !hasPrivateKeyPath) {
      missing.add("WECHAT_PAY_PRIVATE_KEY / WECHAT_PAY_PRIVATE_KEY_PATH");
    }
    if (!hasInlinePrivateKey && hasPrivateKeyPath && !fileExists(privateKeyPath)) {
      missing.add("WECHAT_PAY_PRIVATE_KEY_PATH");
    }

    List<String> signingMissing = signingMissing(hasInlinePrivateKey, privateKeyPath, hasInlinePublicKey, publicKeyPath);
    boolean notifySignatureVerifyEnabled =
        featureEnabled(
            "WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED",
            "wechat.pay.notify-signature-verify-enabled");
    boolean notifyResourceDecryptEnabled =
        featureEnabled(
            "WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED",
            "wechat.pay.notify-resource-decrypt-enabled");
    List<String> notifyMissing =
        notifyMissing(
            notifySignatureVerifyEnabled,
            notifyResourceDecryptEnabled,
            hasInlinePublicKey,
            publicKeyPath);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("appId", blankToNull(appId));
    result.put("configured", missing.isEmpty());
    result.put("mchId", blankToNull(mchId));
    result.put("missing", missing);
    result.put("notifyMissing", notifyMissing);
    result.put("notifyReady", notifyMissing.isEmpty());
    result.put("notifyResourceDecryptEnabled", notifyResourceDecryptEnabled);
    result.put("notifySignatureVerifyEnabled", notifySignatureVerifyEnabled);
    result.put("signingMissing", signingMissing);
    result.put("signingReady", signingMissing.isEmpty());
    return result;
  }

  private String requiredEnv(String name, String... aliases) {
    String value = firstEnv(name, aliases);
    if (!StringUtils.hasText(value)) {
      String names = String.join(" / ", java.util.stream.Stream.concat(
              java.util.stream.Stream.of(name), java.util.Arrays.stream(aliases))
          .toList());
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "缺少微信支付环境变量 " + names);
    }
    return value.trim();
  }

  private String firstEnv(String name, String... aliases) {
    String value = env(name);
    if (StringUtils.hasText(value)) {
      return value;
    }
    for (String alias : aliases) {
      value = env(alias);
      if (StringUtils.hasText(value)) {
        return value;
      }
    }
    return "";
  }

  private String env(String name) {
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  private boolean featureEnabled(String name, String alias) {
    String value = firstEnv(name, alias);
    return List.of("1", "true", "yes", "on").contains(value.toLowerCase(java.util.Locale.ROOT));
  }

  private boolean fileExists(String pathValue) {
    try {
      return Files.exists(Path.of(pathValue));
    } catch (RuntimeException error) {
      return false;
    }
  }

  private List<String> signingMissing(
      boolean hasInlinePrivateKey,
      String privateKeyPath,
      boolean hasInlinePublicKey,
      String publicKeyPath) {
    List<String> missing = new ArrayList<>();
    String privateKey = hasInlinePrivateKey ? env("WECHAT_PAY_PRIVATE_KEY") : readFile(privateKeyPath);
    if (!StringUtils.hasText(privateKey) || !canParsePrivateKey(privateKey)) {
      missing.add("WECHAT_PAY_PRIVATE_KEY_PARSEABLE");
    }

    if (hasInlinePublicKey || StringUtils.hasText(publicKeyPath)) {
      String publicKey = hasInlinePublicKey ? env("WECHAT_PAY_PUBLIC_KEY") : readFile(publicKeyPath);
      if (!StringUtils.hasText(publicKey) || !canParsePublicKey(publicKey)) {
        missing.add("WECHAT_PAY_PUBLIC_KEY_PARSEABLE");
      }
    }
    return missing;
  }

  private List<String> notifyMissing(
      boolean notifySignatureVerifyEnabled,
      boolean notifyResourceDecryptEnabled,
      boolean hasInlinePublicKey,
      String publicKeyPath) {
    List<String> missing = new ArrayList<>();
    if (!notifySignatureVerifyEnabled) {
      missing.add("WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED");
    }
    if (!notifyResourceDecryptEnabled) {
      missing.add("WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED");
    }
    if (!StringUtils.hasText(env("WECHAT_PAY_PUBLIC_KEY_ID"))) {
      missing.add("WECHAT_PAY_PUBLIC_KEY_ID");
    }
    String publicKey = hasInlinePublicKey ? env("WECHAT_PAY_PUBLIC_KEY") : readFile(publicKeyPath);
    if (!StringUtils.hasText(publicKey) || !canParsePublicKey(publicKey)) {
      missing.add("WECHAT_PAY_PUBLIC_KEY_PARSEABLE");
    }
    String apiV3Key = env("WECHAT_PAY_API_V3_KEY");
    if (!StringUtils.hasText(apiV3Key)) {
      missing.add("WECHAT_PAY_API_V3_KEY");
    } else if (apiV3Key.getBytes(StandardCharsets.UTF_8).length != 32) {
      missing.add("WECHAT_PAY_API_V3_KEY_32_BYTES");
    }
    return missing;
  }

  private String readFile(String pathValue) {
    if (!StringUtils.hasText(pathValue)) {
      return "";
    }
    try {
      return Files.readString(Path.of(pathValue), StandardCharsets.UTF_8);
    } catch (RuntimeException | java.io.IOException error) {
      return "";
    }
  }

  private boolean canParsePrivateKey(String pem) {
    try {
      WechatPayPemSupport.parsePrivateKey(pem);
      return true;
    } catch (Exception error) {
      return false;
    }
  }

  private boolean canParsePublicKey(String pem) {
    try {
      WechatPayPemSupport.parsePublicKey(pem);
      return true;
    } catch (Exception error) {
      return false;
    }
  }

  private String blankToNull(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }
}
