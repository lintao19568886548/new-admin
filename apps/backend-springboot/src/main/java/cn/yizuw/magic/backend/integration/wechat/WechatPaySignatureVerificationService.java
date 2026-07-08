package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.PublicKey;
import java.security.Signature;
import java.util.Base64;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 微信支付回包/回调签名验签器；只做离线验签，不拉取平台证书、不发起网络请求。 */
@Service
public class WechatPaySignatureVerificationService {

  private final Environment environment;

  public WechatPaySignatureVerificationService(Environment environment) {
    this.environment = environment;
  }

  /**
   * 使用已配置的微信支付公钥离线校验签名。
   *
   * <p>平台证书自动拉取和证书缓存留给后续真实 HTTP 客户端批次，本方法只验证本地已配置公钥路径。
   */
  public WechatPaySignatureVerification verify(
      String serial, String timestamp, String nonce, String body, String signatureText) {
    String publicKeyId = requiredEnv("WECHAT_PAY_PUBLIC_KEY_ID");
    String normalizedSerial = requiredText(serial, "serial");
    if (!publicKeyId.equals(normalizedSerial)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付验签公钥序列号不匹配");
    }
    String normalizedTimestamp = requiredText(timestamp, "timestamp");
    String normalizedNonce = requiredText(nonce, "nonce");
    String normalizedBody = body == null ? "" : body;
    String message = normalizedTimestamp + "\n" + normalizedNonce + "\n" + normalizedBody + "\n";
    boolean verified = verifySignature(message, requiredText(signatureText, "signature"), loadPublicKey());
    return new WechatPaySignatureVerification(verified, message, normalizedSerial);
  }

  private boolean verifySignature(String message, String signatureText, PublicKey publicKey) {
    try {
      Signature verifier = Signature.getInstance("SHA256withRSA");
      verifier.initVerify(publicKey);
      verifier.update(message.getBytes(StandardCharsets.UTF_8));
      return verifier.verify(Base64.getDecoder().decode(signatureText));
    } catch (Exception error) {
      return false;
    }
  }

  private PublicKey loadPublicKey() {
    String inlinePublicKey = env("WECHAT_PAY_PUBLIC_KEY");
    String publicKeyPem =
        StringUtils.hasText(inlinePublicKey)
            ? inlinePublicKey
            : readFile(requiredEnv("WECHAT_PAY_PUBLIC_KEY_PATH"));
    try {
      return WechatPayPemSupport.parsePublicKey(publicKeyPem);
    } catch (IllegalArgumentException error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付公钥不可解析");
    }
  }

  private String readFile(String pathValue) {
    try {
      return Files.readString(Path.of(pathValue), StandardCharsets.UTF_8);
    } catch (RuntimeException | java.io.IOException error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付公钥文件不可读取");
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
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付验签参数 " + name);
    }
    return value.trim();
  }

  public record WechatPaySignatureVerification(boolean verified, String message, String serial) {}
}
