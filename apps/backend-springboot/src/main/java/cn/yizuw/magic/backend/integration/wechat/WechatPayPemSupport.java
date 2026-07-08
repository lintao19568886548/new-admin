package cn.yizuw.magic.backend.integration.wechat;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/** 微信支付 PEM 密钥解析工具；只在内存中解析，不记录、不返回密钥内容。 */
final class WechatPayPemSupport {

  private WechatPayPemSupport() {}

  static PrivateKey parsePrivateKey(String pem) {
    try {
      return KeyFactory.getInstance("RSA")
          .generatePrivate(new PKCS8EncodedKeySpec(decodePem(pem)));
    } catch (Exception error) {
      throw new IllegalArgumentException("微信支付私钥不可解析", error);
    }
  }

  static PublicKey parsePublicKey(String pem) {
    try {
      return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decodePem(pem)));
    } catch (Exception error) {
      throw new IllegalArgumentException("微信支付公钥不可解析", error);
    }
  }

  private static byte[] decodePem(String pem) {
    String normalized =
        pem.replace("\\n", "\n")
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replace("-----BEGIN PUBLIC KEY-----", "")
            .replace("-----END PUBLIC KEY-----", "")
            .replaceAll("\\s", "");
    return Base64.getDecoder().decode(normalized);
  }
}
