package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 微信支付退款查询请求构造器；只生成签名请求材料，不发起 HTTP 请求。 */
@Service
public class WechatPayRefundQueryRequestFactory {

  private static final String METHOD = "GET";
  private static final String REFUND_QUERY_PATH = "/v3/refund/domestic/refunds/";

  private final WechatPaySigningService signingService;

  public WechatPayRefundQueryRequestFactory(WechatPaySigningService signingService) {
    this.signingService = signingService;
  }

  /** 使用当前时间和随机 nonce 构造退款查询请求材料。 */
  public WechatPayRefundQueryRequest build(String outRefundNo) {
    return build(outRefundNo, String.valueOf(Instant.now().getEpochSecond()), randomNonce());
  }

  /**
   * 构造退款查询请求材料。
   *
   * <p>本方法只生成 path、headers 和签名串，真实 HTTP 调用、响应验签、状态写回留给后续 worker 批次。
   */
  public WechatPayRefundQueryRequest build(String outRefundNo, String timestamp, String nonce) {
    String path = REFUND_QUERY_PATH + encodePathSegment(requiredText(outRefundNo, "outRefundNo"));
    WechatPaySigningService.WechatPayAuthorization authorization =
        signingService.buildAuthorization(METHOD, path, "", timestamp, nonce);
    Map<String, String> headers = new LinkedHashMap<>();
    headers.put("Accept", "application/json");
    headers.put("Authorization", authorization.authorization());
    headers.put("Content-Type", "application/json");
    headers.put("User-Agent", "magic-backend-springboot");
    return new WechatPayRefundQueryRequest(
        METHOD, path, headers, "", authorization.message(), authorization.nonce(), authorization.timestamp());
  }

  private String encodePathSegment(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
  }

  private String randomNonce() {
    return UUID.randomUUID().toString().replace("-", "");
  }

  private String requiredText(String value, String name) {
    if (!StringUtils.hasText(value)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付退款查询参数 " + name);
    }
    return value.trim();
  }

  public record WechatPayRefundQueryRequest(
      String method,
      String path,
      Map<String, String> headers,
      String body,
      String signatureMessage,
      String nonce,
      String timestamp) {}
}
