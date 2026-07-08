package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.PrivateKey;
import java.security.Signature;
import java.util.Base64;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 微信支付请求签名生成器；只生成本地 Authorization 字符串，不发起 HTTP 请求。 */
@Service
public class WechatPaySigningService {

  private final Environment environment;

  public WechatPaySigningService(Environment environment) {
    this.environment = environment;
  }

  /**
   * 构建微信支付 v3 Authorization 头。
   *
   * <p>该方法只做离线签名，调用方仍需在后续专项中完成真实 HTTP 客户端、响应验签和错误状态机。
   */
  public WechatPayAuthorization buildAuthorization(
      String method, String pathWithQuery, String body, String timestamp, String nonce) {
    String normalizedMethod = requiredText(method, "HTTP method").toUpperCase(java.util.Locale.ROOT);
    String normalizedPath = requiredText(pathWithQuery, "pathWithQuery");
    String normalizedTimestamp = requiredText(timestamp, "timestamp");
    String normalizedNonce = requiredText(nonce, "nonce");
    String normalizedBody = body == null ? "" : body;
    String message =
        normalizedMethod
            + "\n"
            + normalizedPath
            + "\n"
            + normalizedTimestamp
            + "\n"
            + normalizedNonce
            + "\n"
            + normalizedBody
            + "\n";
    String signature = sign(message, loadPrivateKey());
    String authorization =
        "WECHATPAY2-SHA256-RSA2048 mchid=\""
            + requiredEnv("WECHAT_PAY_MERCHANT_ID")
            + "\",nonce_str=\""
            + normalizedNonce
            + "\",signature=\""
            + signature
            + "\",timestamp=\""
            + normalizedTimestamp
            + "\",serial_no=\""
            + requiredEnv("WECHAT_PAY_CERT_SERIAL_NO")
            + "\"";
    return new WechatPayAuthorization(authorization, message, normalizedNonce, signature, normalizedTimestamp);
  }

  private String sign(String message, PrivateKey privateKey) {
    try {
      Signature signer = Signature.getInstance("SHA256withRSA");
      signer.initSign(privateKey);
      signer.update(message.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(signer.sign());
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付请求签名生成失败");
    }
  }

  private PrivateKey loadPrivateKey() {
    String inlinePrivateKey = env("WECHAT_PAY_PRIVATE_KEY");
    String privateKeyPem =
        StringUtils.hasText(inlinePrivateKey)
            ? inlinePrivateKey
            : readFile(requiredEnv("WECHAT_PAY_PRIVATE_KEY_PATH"));
    try {
      return WechatPayPemSupport.parsePrivateKey(privateKeyPem);
    } catch (IllegalArgumentException error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付私钥不可解析");
    }
  }

  private String readFile(String pathValue) {
    try {
      return Files.readString(Path.of(pathValue), StandardCharsets.UTF_8);
    } catch (RuntimeException | java.io.IOException error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付私钥文件不可读取");
    }
  }

  private String requiredEnv(String name) {
    String value = env(name);
    if (!StringUtils.hasText(value)) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "缺少微信支付环境变量 " + name);
    }
    return value;
  }

  private String env(String name) {
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  private String requiredText(String value, String name) {
    if (!StringUtils.hasText(value)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付签名参数 " + name);
    }
    return value.trim();
  }

  public record WechatPayAuthorization(
      String authorization, String message, String nonce, String signature, String timestamp) {}
}
