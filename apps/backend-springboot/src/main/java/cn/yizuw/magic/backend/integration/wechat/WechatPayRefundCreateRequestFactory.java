package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 微信支付退款创建请求构造器；只生成签名请求材料，不发起 HTTP 请求。 */
@Service
public class WechatPayRefundCreateRequestFactory {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String METHOD = "POST";
  private static final String REFUND_CREATE_PATH = "/v3/refund/domestic/refunds";
  private static final String DEFAULT_CURRENCY = "CNY";

  private final WechatPaySigningService signingService;

  public WechatPayRefundCreateRequestFactory(WechatPaySigningService signingService) {
    this.signingService = signingService;
  }

  /** 使用当前时间和随机 nonce 构造退款创建请求材料。 */
  public WechatPayRefundCreateRequest build(WechatPayRefundCreateCommand command) {
    return build(command, String.valueOf(Instant.now().getEpochSecond()), randomNonce());
  }

  /**
   * 构造退款创建请求材料。
   *
   * <p>本方法只生成 JSON body、headers 和签名串，真实 HTTP 调用、响应验签、状态写回留给后续 worker 批次。
   */
  public WechatPayRefundCreateRequest build(
      WechatPayRefundCreateCommand command, String timestamp, String nonce) {
    WechatPayRefundCreateCommand normalized = requiredCommand(command);
    String body = refundBody(normalized);
    WechatPaySigningService.WechatPayAuthorization authorization =
        signingService.buildAuthorization(METHOD, REFUND_CREATE_PATH, body, timestamp, nonce);
    Map<String, String> headers = new LinkedHashMap<>();
    headers.put("Accept", "application/json");
    headers.put("Authorization", authorization.authorization());
    headers.put("Content-Type", "application/json");
    headers.put("User-Agent", "magic-backend-springboot");
    return new WechatPayRefundCreateRequest(
        METHOD,
        REFUND_CREATE_PATH,
        headers,
        body,
        authorization.message(),
        authorization.nonce(),
        authorization.timestamp());
  }

  private String refundBody(WechatPayRefundCreateCommand command) {
    Map<String, Object> body = new LinkedHashMap<>();
    String transactionId = clean(command.transactionId());
    if (StringUtils.hasText(transactionId)) {
      body.put("transaction_id", transactionId);
    } else {
      body.put("out_trade_no", requiredText(command.outTradeNo(), "outTradeNo"));
    }
    body.put("out_refund_no", requiredText(command.outRefundNo(), "outRefundNo"));
    putIfPresent(body, "reason", command.reason());
    putIfPresent(body, "notify_url", command.notifyUrl());
    body.put("amount", refundAmountBody(command));
    try {
      return JSON.writeValueAsString(body);
    } catch (JsonProcessingException error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付退款创建请求体序列化失败");
    }
  }

  private Map<String, Object> refundAmountBody(WechatPayRefundCreateCommand command) {
    int refundAmount = positiveAmount(command.refundAmount(), "refundAmount");
    int totalAmount = positiveAmount(command.totalAmount(), "totalAmount");
    if (refundAmount > totalAmount) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付退款金额不能大于订单金额");
    }
    Map<String, Object> amount = new LinkedHashMap<>();
    amount.put("refund", refundAmount);
    amount.put("total", totalAmount);
    amount.put("currency", defaultCurrency(command.currency()));
    return amount;
  }

  private WechatPayRefundCreateCommand requiredCommand(WechatPayRefundCreateCommand command) {
    if (command == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付退款创建参数 request");
    }
    return command;
  }

  private void putIfPresent(Map<String, Object> body, String key, String value) {
    String cleaned = clean(value);
    if (StringUtils.hasText(cleaned)) {
      body.put(key, cleaned);
    }
  }

  private int positiveAmount(Integer value, String name) {
    if (value == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付退款创建参数 " + name);
    }
    if (value <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付退款创建参数 " + name + " 必须大于 0");
    }
    return value;
  }

  private String defaultCurrency(String currency) {
    String value = clean(currency);
    return StringUtils.hasText(value) ? value : DEFAULT_CURRENCY;
  }

  private String randomNonce() {
    return UUID.randomUUID().toString().replace("-", "");
  }

  private String requiredText(String value, String name) {
    String cleaned = clean(value);
    if (!StringUtils.hasText(cleaned)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信支付退款创建参数 " + name);
    }
    return cleaned;
  }

  private String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  public record WechatPayRefundCreateCommand(
      String outTradeNo,
      String transactionId,
      String outRefundNo,
      Integer refundAmount,
      Integer totalAmount,
      String reason,
      String notifyUrl,
      String currency) {}

  public record WechatPayRefundCreateRequest(
      String method,
      String path,
      Map<String, String> headers,
      String body,
      String signatureMessage,
      String nonce,
      String timestamp) {}
}
