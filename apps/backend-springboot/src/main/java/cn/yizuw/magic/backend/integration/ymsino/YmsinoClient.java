package cn.yizuw.magic.backend.integration.ymsino;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** 亿玛表计平台客户端；只接入只读设备和日冻结数据接口。 */
@Component
public class YmsinoClient {

  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;
  private final AppProperties.Ymsino properties;
  private TokenRecord currentToken;

  public YmsinoClient(AppProperties appProperties, ObjectMapper objectMapper) {
    this.properties = appProperties.getYmsino();
    this.objectMapper = objectMapper;
    this.httpClient =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(properties.getTimeoutMs()))
            .build();
  }

  /** 查询设备信息。 */
  public Map<String, Object> getInfo(Map<String, Object> params) {
    return authenticatedPost("/GetInfo", params);
  }

  /** 查询日冻结抄表数据。 */
  public Map<String, Object> getTranDay(Map<String, Object> params) {
    return authenticatedPost("/GetTranDay", params);
  }

  public Map<String, Object> runtimeConfig() {
    return Map.of("baseURL", properties.getBaseUrl(), "orgId", properties.getOrgId());
  }

  private Map<String, Object> authenticatedPost(String path, Map<String, Object> params) {
    Map<String, String> headers = Map.of("Token", token(), "Content-Type", "application/json");
    Map<String, Object> response = post(path, withOrgId(params), headers);
    if (isTokenFailure(response)) {
      invalidateToken();
      response =
          post(
              path,
              withOrgId(params),
              Map.of("Token", token(), "Content-Type", "application/json"));
    }
    return response;
  }

  private synchronized String token() {
    if (currentToken != null
        && currentToken.expiresAtMillis() - System.currentTimeMillis()
            > properties.getRefreshLeewayMs()) {
      return currentToken.token();
    }
    currentToken = login();
    return currentToken.token();
  }

  private synchronized void invalidateToken() {
    currentToken = null;
  }

  private TokenRecord login() {
    Map<String, Object> body =
        Map.of(
            "UserName",
            properties.getUsername(),
            "PassWord",
            properties.getPassword(),
            "OrgId",
            properties.getOrgId());
    Map<String, Object> response =
        post("/GetToken", body, Map.of("Content-Type", "application/json"));
    String token = stringValue(response.get("Token"));
    if (token.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "亿玛表计平台登录失败");
    }
    return new TokenRecord(token, System.currentTimeMillis() + 86_400_000);
  }

  private Map<String, Object> withOrgId(Map<String, Object> params) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("OrgId", properties.getOrgId());
    body.putAll(params);
    return body;
  }

  private boolean isTokenFailure(Map<String, Object> response) {
    String code = stringValue(response.get("Code"));
    String message = stringValue(response.get("Msg")).toLowerCase();
    return ("0".equals(code) || "401".equals(code) || "403".equals(code))
        && (message.contains("token")
            || message.contains("鉴权")
            || message.contains("授权")
            || message.contains("认证"));
  }

  private Map<String, Object> post(
      String path, Map<String, Object> body, Map<String, String> headers) {
    try {
      String rawBody = objectMapper.writeValueAsString(body);
      HttpRequest.Builder builder =
          HttpRequest.newBuilder(uri(path))
              .timeout(Duration.ofMillis(properties.getTimeoutMs()))
              .POST(HttpRequest.BodyPublishers.ofString(rawBody, StandardCharsets.UTF_8));
      headers.forEach(builder::header);
      HttpResponse<String> response =
          httpClient.send(
              builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new BusinessException(HttpStatus.BAD_GATEWAY, "亿玛表计平台请求失败");
      }
      Object parsed = objectMapper.readValue(response.body(), Object.class);
      if (parsed instanceof Map<?, ?> map) {
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) map;
        return result;
      }
      return Map.of("Date", parsed);
    } catch (BusinessException error) {
      throw error;
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "亿玛表计平台请求失败");
    }
  }

  private URI uri(String path) {
    String baseUrl = properties.getBaseUrl().replaceAll("/+$", "");
    return URI.create(baseUrl + path);
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private record TokenRecord(String token, long expiresAtMillis) {}
}
