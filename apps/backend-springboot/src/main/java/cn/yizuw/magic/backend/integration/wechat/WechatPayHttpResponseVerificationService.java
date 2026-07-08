package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 微信支付 HTTP 回包验签门面；只校验响应签名，不解析业务字段、不写数据库。 */
@Service
public class WechatPayHttpResponseVerificationService {

  private final WechatPaySignatureVerificationService signatureVerificationService;

  public WechatPayHttpResponseVerificationService(
      WechatPaySignatureVerificationService signatureVerificationService) {
    this.signatureVerificationService = signatureVerificationService;
  }

  /**
   * 校验微信支付 HTTP 响应签名。
   *
   * <p>本方法只从响应头提取 `Wechatpay-*` 签名字段并复用本地公钥离线验签；平台证书拉取、业务响应解析和状态写回
   * 留给后续批次。
   */
  public WechatPayHttpResponseVerification verify(WechatPayHttpClient.WechatPayHttpResponse response) {
    if (response == null) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "缺少微信支付 HTTP 响应");
    }
    String serial = requiredHeader(response.headers(), "Wechatpay-Serial");
    String timestamp = requiredHeader(response.headers(), "Wechatpay-Timestamp");
    String nonce = requiredHeader(response.headers(), "Wechatpay-Nonce");
    String signature = requiredHeader(response.headers(), "Wechatpay-Signature");
    WechatPaySignatureVerificationService.WechatPaySignatureVerification verification =
        signatureVerificationService.verify(serial, timestamp, nonce, response.body(), signature);
    if (!verification.verified()) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "微信支付 HTTP 响应验签失败");
    }
    return new WechatPayHttpResponseVerification(
        true, response.statusCode(), verification.message(), verification.serial());
  }

  private String requiredHeader(Map<String, List<String>> headers, String name) {
    String value = header(headers, name);
    if (!StringUtils.hasText(value)) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "缺少微信支付响应验签头 " + name);
    }
    return value.trim();
  }

  private String header(Map<String, List<String>> headers, String name) {
    if (headers == null || headers.isEmpty()) {
      return "";
    }
    for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
      if (name.equalsIgnoreCase(entry.getKey())) {
        List<String> values = entry.getValue();
        if (values != null && !values.isEmpty()) {
          return values.get(0);
        }
      }
    }
    return "";
  }

  public record WechatPayHttpResponseVerification(
      boolean verified, int statusCode, String message, String serial) {}
}
