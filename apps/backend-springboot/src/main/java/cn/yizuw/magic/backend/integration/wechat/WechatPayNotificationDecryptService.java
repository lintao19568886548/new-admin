package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 微信支付回调 resource 离线解密器；只使用本地 API v3 key，不请求微信、不写数据库。 */
@Service
public class WechatPayNotificationDecryptService {

  private static final String ALGORITHM = "AEAD_AES_256_GCM";
  private static final ObjectMapper JSON = new ObjectMapper();

  private final Environment environment;

  public WechatPayNotificationDecryptService(Environment environment) {
    this.environment = environment;
  }

  /**
   * 解密微信支付通知原文里的 `resource`。
   *
   * <p>本方法只解析并解密原文，不校验回调签名、不接入业务写库；调用方应先完成验签再调用。
   */
  public WechatPayDecryptedResource decrypt(String rawBody) {
    Map<String, Object> body = parseJsonObject(rawBody);
    Object resource = body.get("resource");
    if (!(resource instanceof Map<?, ?> resourceMap)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付回调 resource");
    }
    return decryptResource(toStringObjectMap(resourceMap));
  }

  /** 直接解密已解析的 resource 对象，便于后续通知处理链路复用。 */
  public WechatPayDecryptedResource decryptResource(Map<String, Object> resource) {
    String algorithm = requiredText(resource.get("algorithm"), "resource.algorithm");
    if (!ALGORITHM.equals(algorithm)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "不支持的微信支付 resource 加密算法");
    }
    String ciphertext = requiredText(resource.get("ciphertext"), "resource.ciphertext");
    String nonce = requiredText(resource.get("nonce"), "resource.nonce");
    String associatedData = clean(string(resource.get("associated_data")));
    String plaintext = decryptCiphertext(ciphertext, nonce, associatedData);
    return new WechatPayDecryptedResource(plaintext, parseJsonObject(plaintext), algorithm);
  }

  private String decryptCiphertext(String ciphertext, String nonce, String associatedData) {
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(
          Cipher.DECRYPT_MODE,
          new SecretKeySpec(apiV3KeyBytes(), "AES"),
          new GCMParameterSpec(128, nonce.getBytes(StandardCharsets.UTF_8)));
      if (StringUtils.hasText(associatedData)) {
        cipher.updateAAD(associatedData.getBytes(StandardCharsets.UTF_8));
      }
      byte[] plaintext = cipher.doFinal(Base64.getDecoder().decode(ciphertext));
      return new String(plaintext, StandardCharsets.UTF_8);
    } catch (BusinessException error) {
      throw error;
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付回调 resource 解密失败");
    }
  }

  private byte[] apiV3KeyBytes() {
    String key = env("WECHAT_PAY_API_V3_KEY");
    if (!StringUtils.hasText(key)) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "缺少微信支付环境变量 WECHAT_PAY_API_V3_KEY");
    }
    byte[] bytes = key.getBytes(StandardCharsets.UTF_8);
    if (bytes.length != 32) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付 API v3 key 必须为 32 字节");
    }
    return bytes;
  }

  private Map<String, Object> parseJsonObject(String rawBody) {
    if (!StringUtils.hasText(rawBody)) {
      return Map.of();
    }
    try {
      return JSON.readValue(rawBody, new TypeReference<>() {});
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付回调 JSON 解析失败");
    }
  }

  private Map<String, Object> toStringObjectMap(Map<?, ?> raw) {
    Map<String, Object> result = new LinkedHashMap<>();
    raw.forEach((key, value) -> result.put(String.valueOf(key), value));
    return result;
  }

  private String requiredText(Object value, String name) {
    String text = clean(string(value));
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付回调参数 " + name);
    }
    return text;
  }

  private String env(String name) {
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  private String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private String string(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  public record WechatPayDecryptedResource(
      String plaintext, Map<String, Object> data, String algorithm) {}
}
