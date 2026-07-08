package cn.yizuw.magic.backend.integration.wechat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** 微信支付 HTTP 客户端安全门测试；默认不允许真实外呼。 */
class WechatPayHttpClientTest {

  @Test
  void executeRejectsWhenExternalHttpDisabled() {
    AtomicReference<WechatPayHttpClient.WechatPayHttpRequest> sent = new AtomicReference<>();
    WechatPayHttpClient client =
        new WechatPayHttpClient(
            new MockEnvironment(),
            request -> {
              sent.set(request);
              return okResponse();
            });

    assertThatThrownBy(() -> client.execute(queryRequest()))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付外部 HTTP 调用未开启");
    assertThat(sent).hasValue(null);
  }

  @Test
  void executeSendsRefundQueryRequestWhenEnabled() {
    AtomicReference<WechatPayHttpClient.WechatPayHttpRequest> sent = new AtomicReference<>();
    WechatPayHttpClient client =
        new WechatPayHttpClient(
            new MockEnvironment().withProperty("WECHAT_PAY_EXTERNAL_HTTP_ENABLED", "true"),
            request -> {
              sent.set(request);
              return new WechatPayHttpClient.WechatPayHttpResponse(
                  200, "{\"status\":\"SUCCESS\"}", Map.of("Wechatpay-Serial", List.of("serial-no")));
            });

    WechatPayHttpClient.WechatPayHttpResponse response = client.execute(queryRequest());

    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body()).contains("SUCCESS");
    assertThat(sent.get().method()).isEqualTo("GET");
    assertThat(sent.get().uri().toString())
        .isEqualTo("https://api.mch.weixin.qq.com/v3/refund/domestic/refunds/vip_refund_wxapp_1");
    assertThat(sent.get().headers()).containsEntry("Authorization", "WECHATPAY2-SHA256-RSA2048 mock");
    assertThat(sent.get().body()).isEmpty();
  }

  @Test
  void executeSendsRefundCreateRequestToConfiguredBaseUrl() {
    AtomicReference<WechatPayHttpClient.WechatPayHttpRequest> sent = new AtomicReference<>();
    WechatPayHttpClient client =
        new WechatPayHttpClient(
            new MockEnvironment()
                .withProperty("WECHAT_PAY_EXTERNAL_HTTP_ENABLED", "true")
                .withProperty("WECHAT_PAY_API_BASE_URL", "https://pay.example.test/"),
            request -> {
              sent.set(request);
              return okResponse();
            });

    client.execute(createRequest());

    assertThat(sent.get().method()).isEqualTo("POST");
    assertThat(sent.get().uri().toString()).isEqualTo("https://pay.example.test/v3/refund/domestic/refunds");
    assertThat(sent.get().body()).contains("\"out_refund_no\":\"vip_refund_wxapp_1\"");
  }

  @Test
  void executeRejectsUnsupportedPathBeforeTransport() {
    AtomicReference<WechatPayHttpClient.WechatPayHttpRequest> sent = new AtomicReference<>();
    WechatPayHttpClient client =
        new WechatPayHttpClient(
            new MockEnvironment().withProperty("WECHAT_PAY_EXTERNAL_HTTP_ENABLED", "true"),
            request -> {
              sent.set(request);
              return okResponse();
            });
    WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest request =
        new WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest(
            "GET", "https://evil.example/v3/refund", Map.of(), "", "", "nonce-1", "1780000000");

    assertThatThrownBy(() -> client.execute(request))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("不支持的微信支付 HTTP 路径");
    assertThat(sent).hasValue(null);
  }

  @Test
  void executeWrapsTransportFailure() {
    WechatPayHttpClient client =
        new WechatPayHttpClient(
            new MockEnvironment().withProperty("WECHAT_PAY_EXTERNAL_HTTP_ENABLED", "true"),
            request -> {
              throw new java.io.IOException("network unavailable");
            });

    assertThatThrownBy(() -> client.execute(queryRequest()))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信支付 HTTP 请求失败");
  }

  private WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest queryRequest() {
    return new WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest(
        "GET",
        "/v3/refund/domestic/refunds/vip_refund_wxapp_1",
        Map.of(
            "Accept",
            "application/json",
            "Authorization",
            "WECHATPAY2-SHA256-RSA2048 mock",
            "Content-Type",
            "application/json"),
        "",
        "message",
        "nonce-1",
        "1780000000");
  }

  private WechatPayRefundCreateRequestFactory.WechatPayRefundCreateRequest createRequest() {
    return new WechatPayRefundCreateRequestFactory.WechatPayRefundCreateRequest(
        "POST",
        "/v3/refund/domestic/refunds",
        Map.of(
            "Accept",
            "application/json",
            "Authorization",
            "WECHATPAY2-SHA256-RSA2048 mock",
            "Content-Type",
            "application/json"),
        "{\"out_refund_no\":\"vip_refund_wxapp_1\"}",
        "message",
        "nonce-1",
        "1780000000");
  }

  private WechatPayHttpClient.WechatPayHttpResponse okResponse() {
    return new WechatPayHttpClient.WechatPayHttpResponse(200, "{}", Map.of());
  }
}
