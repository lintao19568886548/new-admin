package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/** 微信 JS-SDK 签名配置服务；只读获取票据，不写库、不发起支付。 */
@Service
public class WechatJsSdkConfigService {

  private static final long TICKET_LEEWAY_MILLIS = Duration.ofMinutes(1).toMillis();

  private final Environment environment;
  private final RestClient restClient;
  private volatile String accessToken;
  private volatile long accessTokenExpiresAt;
  private volatile String jsApiTicket;
  private volatile long jsApiTicketExpiresAt;

  public WechatJsSdkConfigService(Environment environment, RestClient.Builder restClientBuilder) {
    this.environment = environment;
    this.restClient = restClientBuilder.build();
  }

  /** 生成前端 wx.config 需要的签名；未配置微信变量时返回 disabled 结构。 */
  public Map<String, Object> buildConfig(String rawUrl, boolean debugMode) {
    String appId = env("WECHAT_APP_ID");
    String appSecret = env("WECHAT_APP_SECRET");
    if (!StringUtils.hasText(appId) || !StringUtils.hasText(appSecret)) {
      return Map.of("enabled", false, "reason", "wechat-js-sdk-not-configured");
    }
    String normalizedUrl = normalizeUrl(rawUrl);
    try {
      String nonceStr = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
      long timestamp = System.currentTimeMillis() / 1000;
      String ticket = jsApiTicket(appId, appSecret);
      String signature = sha1(
          "jsapi_ticket="
              + ticket
              + "&noncestr="
              + nonceStr
              + "&timestamp="
              + timestamp
              + "&url="
              + normalizedUrl);
      return Map.of(
          "appId", appId,
          "enabled", true,
          "nonceStr", nonceStr,
          "signature", signature,
          "timestamp", timestamp);
    } catch (RuntimeException error) {
      String message = debugMode ? error.getMessage() : "生成微信 JS-SDK 配置失败";
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }
  }

  private String normalizeUrl(String rawUrl) {
    if (!StringUtils.hasText(rawUrl)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少 url 参数");
    }
    try {
      URI uri = URI.create(rawUrl.trim());
      if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) {
        throw new IllegalArgumentException("invalid protocol");
      }
      return new URI(
              uri.getScheme(),
              uri.getAuthority(),
              uri.getPath(),
              uri.getQuery(),
              null)
          .toString();
    } catch (RuntimeException | java.net.URISyntaxException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "url 参数格式无效");
    }
  }

  private String jsApiTicket(String appId, String appSecret) {
    if (StringUtils.hasText(jsApiTicket) && jsApiTicketExpiresAt > System.currentTimeMillis() + TICKET_LEEWAY_MILLIS) {
      return jsApiTicket;
    }
    synchronized (this) {
      if (StringUtils.hasText(jsApiTicket)
          && jsApiTicketExpiresAt > System.currentTimeMillis() + TICKET_LEEWAY_MILLIS) {
        return jsApiTicket;
      }
      WechatJsApiTicketResponse payload =
          restClient
              .get()
              .uri(
                  "https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token={accessToken}&type=jsapi",
                  accessToken(appId, appSecret))
              .retrieve()
              .body(WechatJsApiTicketResponse.class);
      if (payload == null || payload.errcode() != null && payload.errcode() != 0 || !StringUtils.hasText(payload.ticket())) {
        throw new IllegalStateException("获取 jsapi_ticket 失败: " + (payload == null ? "unknown error" : payload.errmsg()));
      }
      jsApiTicket = payload.ticket();
      jsApiTicketExpiresAt =
          System.currentTimeMillis() + Math.max((payload.expiresIn() == null ? 7200 : payload.expiresIn()) - 120, 60) * 1000L;
      return jsApiTicket;
    }
  }

  private String accessToken(String appId, String appSecret) {
    if (StringUtils.hasText(accessToken) && accessTokenExpiresAt > System.currentTimeMillis() + TICKET_LEEWAY_MILLIS) {
      return accessToken;
    }
    String appIdParam = URLEncoder.encode(appId, StandardCharsets.UTF_8);
    String secretParam = URLEncoder.encode(appSecret, StandardCharsets.UTF_8);
    WechatAccessTokenResponse payload =
        restClient
            .get()
            .uri(
                "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="
                    + appIdParam
                    + "&secret="
                    + secretParam)
            .retrieve()
            .body(WechatAccessTokenResponse.class);
    if (payload == null || !StringUtils.hasText(payload.accessToken())) {
      throw new IllegalStateException("获取 access_token 失败: " + (payload == null ? "unknown error" : payload.errmsg()));
    }
    accessToken = payload.accessToken();
    accessTokenExpiresAt =
        System.currentTimeMillis() + Math.max((payload.expiresIn() == null ? 7200 : payload.expiresIn()) - 120, 60) * 1000L;
    return accessToken;
  }

  private String env(String name) {
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return value == null ? "" : value.trim();
  }

  private String sha1(String raw) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-1");
      return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-1 not available", error);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record WechatAccessTokenResponse(
      @com.fasterxml.jackson.annotation.JsonProperty("access_token") String accessToken,
      Integer errcode,
      String errmsg,
      @com.fasterxml.jackson.annotation.JsonProperty("expires_in") Integer expiresIn) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record WechatJsApiTicketResponse(
      Integer errcode,
      String errmsg,
      @com.fasterxml.jackson.annotation.JsonProperty("expires_in") Integer expiresIn,
      String ticket) {}
}
