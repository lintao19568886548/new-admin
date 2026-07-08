package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 微信支付退款响应离线解析器；只归一化响应字段，不更新本地退款状态。 */
@Service
public class WechatPayRefundResponseMapper {

  private static final ObjectMapper JSON = new ObjectMapper();

  /** 解析微信退款查询或创建响应 JSON，供后续 worker 写库前做字段校验。 */
  public WechatPayRefundResponse parse(String rawBody) {
    if (!StringUtils.hasText(rawBody)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付退款响应 body");
    }
    try {
      Map<String, Object> body = JSON.readValue(rawBody, new TypeReference<>() {});
      return parse(body);
    } catch (JsonProcessingException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付退款响应 body 不是合法 JSON");
    }
  }

  /** 解析已解密或已反序列化的微信退款响应对象。 */
  public WechatPayRefundResponse parse(Map<String, Object> body) {
    if (body == null || body.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付退款响应 body");
    }
    String outRefundNo = requiredText(text(body.get("out_refund_no"), body.get("outRefundNo")), "outRefundNo");
    String providerStatus =
        requiredText(text(body.get("status"), body.get("refund_status"), body.get("refundStatus")), "status");
    Map<String, Object> amount = nestedMap(body.get("amount"));
    return new WechatPayRefundResponse(
        outRefundNo,
        clean(text(body.get("refund_id"), body.get("refundId"))),
        clean(text(body.get("out_trade_no"), body.get("outTradeNo"))),
        clean(text(body.get("transaction_id"), body.get("transactionId"))),
        providerStatus,
        localStatus(providerStatus),
        clean(text(body.get("success_time"), body.get("successTime"))),
        integer(amount.get("refund")),
        integer(amount.get("total")),
        clean(text(amount.get("currency"))));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> nestedMap(Object value) {
    return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
  }

  private String localStatus(String providerStatus) {
    String normalized = providerStatus.toUpperCase(Locale.ROOT);
    if ("SUCCESS".equals(normalized)
        || "CLOSED".equals(normalized)
        || "PROCESSING".equals(normalized)
        || "ABNORMAL".equals(normalized)) {
      return normalized;
    }
    return "UNKNOWN";
  }

  private Integer integer(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    String text = clean(text(value));
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      return Integer.parseInt(text);
    } catch (NumberFormatException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付退款响应金额不是合法整数");
    }
  }

  private String requiredText(String value, String name) {
    String cleaned = clean(value);
    if (!StringUtils.hasText(cleaned)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付退款响应字段 " + name);
    }
    return cleaned;
  }

  private String text(Object... values) {
    for (Object value : values) {
      if (value != null && StringUtils.hasText(String.valueOf(value))) {
        return String.valueOf(value);
      }
    }
    return "";
  }

  private String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  public record WechatPayRefundResponse(
      String outRefundNo,
      String refundId,
      String outTradeNo,
      String transactionId,
      String providerStatus,
      String localStatus,
      String successTime,
      Integer refundAmount,
      Integer totalAmount,
      String currency) {}
}
