package cn.yizuw.magic.backend.integration.wework;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.crm.CrmRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 企业微信回调 URL 验证服务，复刻旧 GET 的 SHA1 签名和可选 AES 解密逻辑。 */
@Service
public class WeworkCallbackService {

  private final CrmRepository crmRepository;
  private final Environment environment;

  public WeworkCallbackService(CrmRepository crmRepository, Environment environment) {
    this.crmRepository = crmRepository;
    this.environment = environment;
  }

  public String verifyCallback(String echostr, String signature, String nonce, String timestamp) {
    if (!StringUtils.hasText(echostr)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少 echostr");
    }
    String token = setting("WEWORK_CALLBACK_TOKEN");
    if (StringUtils.hasText(token) && !verifySignature(token, timestamp, nonce, echostr, signature)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "企业微信回调签名校验失败");
    }
    return decryptEcho(echostr);
  }

  /**
   * 处理企业微信 POST 事件回调。
   *
   * <p>本接口只做签名/解密和 CRM 本地回调日志记录，不调用企微外部接口，不发送欢迎语。
   */
  public String recordCallback(
      String rawBody,
      String msgSignature,
      String nonce,
      String signature,
      String timestamp) {
    String safeBody = rawBody == null ? "" : rawBody;
    String encryptedPayload = extractXmlTag(safeBody, "Encrypt");
    String token = setting("WEWORK_CALLBACK_TOKEN");
    if (StringUtils.hasText(token)) {
      String effectiveSignature = StringUtils.hasText(msgSignature) ? msgSignature : signature;
      boolean signatureOk =
          StringUtils.hasText(encryptedPayload)
              ? verifySignature(token, timestamp, nonce, encryptedPayload, effectiveSignature)
              : verifySignature(token, timestamp, nonce, "", effectiveSignature);
      if (!signatureOk) {
        throw new BusinessException(HttpStatus.FORBIDDEN, "企业微信回调签名校验失败");
      }
    }

    String plainBody = safeBody;
    if (StringUtils.hasText(encryptedPayload)) {
      plainBody = decryptEcho(encryptedPayload);
    }

    String eventType = extractXmlTag(plainBody, "Event");
    String changeType = extractXmlTag(plainBody, "ChangeType");
    String externalUserId = extractXmlTag(plainBody, "ExternalUserID");
    String weworkUserId = extractXmlTag(plainBody, "UserID");
    String state = extractXmlTag(plainBody, "State");
    String welcomeCode = extractXmlTag(plainBody, "WelcomeCode");
    Map<String, Object> rawPayload = new LinkedHashMap<>();
    rawPayload.put("encrypted", StringUtils.hasText(encryptedPayload));
    rawPayload.put("plainBody", plainBody);
    rawPayload.put("rawBody", safeBody);
    rawPayload.put(
        "query",
        Map.of(
            "msg_signature", msgSignature == null ? "" : msgSignature,
            "nonce", nonce == null ? "" : nonce,
            "signature", signature == null ? "" : signature,
            "timestamp", timestamp == null ? "" : timestamp));

    crmRepository.recordExternalContactEvent(
        changeType, eventType, externalUserId, rawPayload, state, welcomeCode, weworkUserId);
    return "success";
  }

  private boolean verifySignature(
      String token, String timestamp, String nonce, String echostr, String signature) {
    if (!StringUtils.hasText(timestamp)
        || !StringUtils.hasText(nonce)
        || !StringUtils.hasText(signature)) {
      return false;
    }
    String[] values = {token, timestamp, nonce, echostr};
    Arrays.sort(values);
    return sha1(String.join("", values)).equals(signature);
  }

  private String extractXmlTag(String raw, String tagName) {
    if (!StringUtils.hasText(raw)) {
      return "";
    }
    java.util.regex.Pattern pattern =
        java.util.regex.Pattern.compile(
            "<"
                + tagName
                + "><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></"
                + tagName
                + ">|<"
                + tagName
                + ">([\\s\\S]*?)</"
                + tagName
                + ">",
            java.util.regex.Pattern.CASE_INSENSITIVE);
    java.util.regex.Matcher matcher = pattern.matcher(raw);
    if (!matcher.find()) {
      return "";
    }
    String first = matcher.group(1);
    String second = matcher.group(2);
    return (first == null ? second == null ? "" : second : first).trim();
  }

  private String decryptEcho(String echostr) {
    String aesKey = setting("WEWORK_CALLBACK_AES_KEY");
    if (!StringUtils.hasText(aesKey)) {
      return echostr;
    }
    try {
      byte[] key = Base64.getDecoder().decode(aesKey.trim() + "=");
      if (key.length != 32) {
        throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "企业微信回调 EncodingAESKey 不合法");
      }
      Cipher cipher = Cipher.getInstance("AES/CBC/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(key, 0, 16));
      byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(echostr));
      int pad = decrypted[decrypted.length - 1] & 0xff;
      int plainLength = decrypted.length - pad;
      int messageLength =
          ((decrypted[16] & 0xff) << 24)
              | ((decrypted[17] & 0xff) << 16)
              | ((decrypted[18] & 0xff) << 8)
              | (decrypted[19] & 0xff);
      if (plainLength < 20 || messageLength < 0 || 20 + messageLength > plainLength) {
        throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "企业微信回调验证解密失败");
      }
      return new String(decrypted, 20, messageLength, StandardCharsets.UTF_8);
    } catch (BusinessException error) {
      throw error;
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "企业微信回调验证解密失败");
    }
  }

  private String sha1(String value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "企业微信回调签名计算失败");
    }
  }

  private String setting(String name) {
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return value == null ? "" : value.trim();
  }
}
