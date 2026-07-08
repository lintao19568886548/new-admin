package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 微信支付外部 HTTP 客户端安全门。
 *
 * <p>默认关闭真实外呼，只有显式开启 `WECHAT_PAY_EXTERNAL_HTTP_ENABLED=true` 后才会发起请求；响应验签、业务解析和写库
 * 继续由后续批次处理。
 */
@Service
public class WechatPayHttpClient {

  private static final String DEFAULT_BASE_URL = "https://api.mch.weixin.qq.com";
  private static final long DEFAULT_TIMEOUT_MS = 5000L;

  private final Environment environment;
  private final Transport transport;

  public WechatPayHttpClient(Environment environment) {
    this(environment, new JavaNetTransport(timeoutMs(environment)));
  }

  WechatPayHttpClient(Environment environment, Transport transport) {
    this.environment = environment;
    this.transport = transport;
  }

  /** 执行退款查询请求；默认 feature flag 未开启时会直接拒绝，不触发 transport。 */
  public WechatPayHttpResponse execute(
      WechatPayRefundQueryRequestFactory.WechatPayRefundQueryRequest request) {
    return execute(request.method(), request.path(), request.headers(), request.body());
  }

  /** 执行退款创建请求；默认 feature flag 未开启时会直接拒绝，不触发 transport。 */
  public WechatPayHttpResponse execute(
      WechatPayRefundCreateRequestFactory.WechatPayRefundCreateRequest request) {
    return execute(request.method(), request.path(), request.headers(), request.body());
  }

  private WechatPayHttpResponse execute(
      String method, String path, Map<String, String> headers, String body) {
    if (!externalHttpEnabled()) {
      throw new BusinessException(HttpStatus.PRECONDITION_FAILED, "微信支付外部 HTTP 调用未开启");
    }
    WechatPayHttpRequest request =
        new WechatPayHttpRequest(
            requiredMethod(method),
            requestUri(path),
            headers == null ? Map.of() : new LinkedHashMap<>(headers),
            body == null ? "" : body);
    try {
      return transport.send(request);
    } catch (BusinessException error) {
      throw error;
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "微信支付 HTTP 请求失败");
    }
  }

  private URI requestUri(String path) {
    String normalizedPath = requiredPath(path);
    return URI.create(baseUrl() + normalizedPath);
  }

  private String requiredMethod(String method) {
    String value = method == null ? "" : method.trim().toUpperCase(Locale.ROOT);
    if (!List.of("GET", "POST").contains(value)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "不支持的微信支付 HTTP 方法");
    }
    return value;
  }

  private String requiredPath(String path) {
    String value = path == null ? "" : path.trim();
    if (!StringUtils.hasText(value) || !value.startsWith("/v3/") || value.contains("://")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "不支持的微信支付 HTTP 路径");
    }
    return value;
  }

  private String baseUrl() {
    String value = env("WECHAT_PAY_API_BASE_URL", "wechat.pay.api-base-url");
    if (!StringUtils.hasText(value)) {
      value = DEFAULT_BASE_URL;
    }
    String normalized = value.trim();
    if (normalized.endsWith("/")) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }
    URI uri = URI.create(normalized);
    String scheme = uri.getScheme();
    if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付 API 地址必须是 HTTP 或 HTTPS");
    }
    return normalized;
  }

  private boolean externalHttpEnabled() {
    String value = env("WECHAT_PAY_EXTERNAL_HTTP_ENABLED", "wechat.pay.external-http-enabled");
    return List.of("1", "true", "yes", "on").contains(value.toLowerCase(Locale.ROOT));
  }

  private String env(String name, String alias) {
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = environment.getProperty(alias);
    }
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  private static long timeoutMs(Environment environment) {
    String value = environment.getProperty("WECHAT_PAY_HTTP_TIMEOUT_MS");
    if (!StringUtils.hasText(value)) {
      value = environment.getProperty("wechat.pay.http-timeout-ms");
    }
    if (!StringUtils.hasText(value)) {
      value = System.getenv("WECHAT_PAY_HTTP_TIMEOUT_MS");
    }
    try {
      long parsed = Long.parseLong(String.valueOf(value));
      return parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
    } catch (RuntimeException error) {
      return DEFAULT_TIMEOUT_MS;
    }
  }

  @FunctionalInterface
  interface Transport {
    WechatPayHttpResponse send(WechatPayHttpRequest request) throws Exception;
  }

  static final class JavaNetTransport implements Transport {

    private final HttpClient httpClient;
    private final long timeoutMs;

    private JavaNetTransport(long timeoutMs) {
      this.timeoutMs = timeoutMs;
      this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(timeoutMs)).build();
    }

    @Override
    public WechatPayHttpResponse send(WechatPayHttpRequest request) throws Exception {
      HttpRequest.Builder builder =
          HttpRequest.newBuilder(request.uri()).timeout(Duration.ofMillis(timeoutMs));
      request.headers().forEach(builder::header);
      HttpRequest.BodyPublisher publisher =
          StringUtils.hasText(request.body())
              ? HttpRequest.BodyPublishers.ofString(request.body(), StandardCharsets.UTF_8)
              : HttpRequest.BodyPublishers.noBody();
      HttpResponse<String> response =
          httpClient.send(
              builder.method(request.method(), publisher).build(),
              HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      return new WechatPayHttpResponse(response.statusCode(), response.body(), response.headers().map());
    }
  }

  public record WechatPayHttpRequest(
      String method, URI uri, Map<String, String> headers, String body) {}

  public record WechatPayHttpResponse(
      int statusCode, String body, Map<String, List<String>> headers) {}
}
