package cn.yizuw.magic.backend.integration.hezhong;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.ObjectMapper;

/**
 * 合众表计平台客户端。
 *
 * <p>旧 Nitro 后端通过 axios + token-manager 访问合众平台；Spring Boot 侧保留同样的登录签名、token
 * 缓存、401/403 后刷新重试机制。
 */
@Component
public class HezhongClient {

  private final AppProperties.Hezhong properties;
  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;
  private TokenRecord currentToken;

  public HezhongClient(AppProperties appProperties, ObjectMapper objectMapper) {
    this.properties = appProperties.getHezhong();
    this.objectMapper = objectMapper;
    this.httpClient =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(properties.getTimeoutMs()))
            .build();
  }

  /** 获取计量设备列表。 */
  public Map<String, Object> getDevice(Map<String, String> params) {
    return authenticatedGet("/hzeb-push/app/meterinfo/getDevice", params);
  }

  /** 获取冻结抄表数据。 */
  public Map<String, Object> getHdmData(Map<String, String> params) {
    return authenticatedGet("/hzeb-push/app/meterinfo/getHDMData", params);
  }

  private synchronized String token() {
    if (currentToken != null
        && currentToken.expiresAtMillis() - System.currentTimeMillis()
            > properties.getTokenRefreshLeewayMs()) {
      return currentToken.token();
    }
    currentToken = login();
    return currentToken.token();
  }

  private synchronized void invalidateToken() {
    currentToken = null;
  }

  private TokenRecord login() {
    Map<String, String> signature = signature();
    Map<String, String> params = new LinkedHashMap<>();
    params.put("userName", properties.getLoginUsername());
    params.putAll(signature);
    Map<String, Object> response = post("/hzeb-push/app/xcx/login", params, Map.of());
    String token = stringValue(response.get("token"));
    long expireSeconds = longValue(response.get("expire"), 0);
    if (!StringUtils.hasText(token) || expireSeconds <= 0) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "合众平台登录失败");
    }
    return new TokenRecord(token, System.currentTimeMillis() + expireSeconds * 1000);
  }

  private Map<String, Object> authenticatedGet(String path, Map<String, String> params) {
    String token = token();
    Map<String, Object> response = get(path, params, Map.of("token", token));
    Object code = response.get("code");
    if (code instanceof Number number && (number.intValue() == 401 || number.intValue() == 403)) {
      invalidateToken();
      response = get(path, params, Map.of("token", token()));
    }
    return response;
  }

  private Map<String, Object> get(
      String path, Map<String, String> params, Map<String, String> headers) {
    URI uri = uri(path, params);
    HttpRequest.Builder builder =
        HttpRequest.newBuilder(uri)
            .timeout(Duration.ofMillis(properties.getTimeoutMs()))
            .GET();
    headers.forEach(builder::header);
    return send(builder.build());
  }

  private Map<String, Object> post(
      String path, Map<String, String> params, Map<String, String> headers) {
    URI uri = uri(path, params);
    HttpRequest.Builder builder =
        HttpRequest.newBuilder(uri)
            .timeout(Duration.ofMillis(properties.getTimeoutMs()))
            .POST(HttpRequest.BodyPublishers.noBody());
    headers.forEach(builder::header);
    return send(builder.build());
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> send(HttpRequest request) {
    try {
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new BusinessException(HttpStatus.BAD_GATEWAY, "合众平台请求失败");
      }
      Object parsed = objectMapper.readValue(response.body(), Object.class);
      if (parsed instanceof Map<?, ?> map) {
        return (Map<String, Object>) map;
      }
      return Map.of("data", parsed);
    } catch (BusinessException error) {
      throw error;
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "合众平台请求失败");
    }
  }

  private URI uri(String path, Map<String, String> params) {
    UriComponentsBuilder builder =
        UriComponentsBuilder.fromUriString(properties.getBaseUrl()).path(path);
    params.forEach(builder::queryParam);
    return builder.build(true).toUri();
  }

  private Map<String, String> signature() {
    String time = String.valueOf(System.currentTimeMillis() / 1000);
    String num = String.format("%07d", ThreadLocalRandom.current().nextInt(10_000_000));
    String raw =
        "userName="
            + properties.getLoginUsername()
            + "&time="
            + time
            + "&num="
            + num
            + "&key="
            + properties.getLoginKey();
    return Map.of("num", num, "sign", sha256(raw), "time", time);
  }

  private String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException(error);
    }
  }

  private long longValue(Object value, long fallback) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    try {
      return Long.parseLong(String.valueOf(value));
    } catch (NumberFormatException error) {
      return fallback;
    }
  }

  private String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private record TokenRecord(String token, long expiresAtMillis) {}
}
