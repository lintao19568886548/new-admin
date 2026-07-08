package cn.yizuw.magic.backend.notices;

import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 公告链接有效性探测器。
 *
 * <p>旧 Nitro 接口在 `validOnly=true` 时会访问公告链接并过滤明确失效的页面。这里保留同样的只读探测边界，
 * 同时屏蔽本地/内网地址，避免 SSRF 风险。
 */
@Component
public class NoticeLinkValidator {

  private static final long DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000L;
  private static final long DEFAULT_TIMEOUT_MS = 5000L;
  private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
  private final Environment environment;
  private final HttpClient httpClient;

  public NoticeLinkValidator(Environment environment) {
    this.environment = environment;
    this.httpClient =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(timeoutMs()))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
  }

  /** 判断公告链接是否可展示；网络异常时按旧接口保守视为有效。 */
  public boolean isValid(String link, String title) {
    String href = normalizeLink(link);
    if (!StringUtils.hasText(href) || !safeUrl(href)) {
      return false;
    }
    long now = System.currentTimeMillis();
    CacheEntry cached = cache.get(href);
    if (cached != null && now - cached.checkedAt() < cacheTtlMs()) {
      return cached.valid();
    }
    boolean valid = probe(href, title);
    cache.put(href, new CacheEntry(now, valid));
    return valid;
  }

  private boolean probe(String href, String title) {
    try {
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(href))
              .timeout(Duration.ofMillis(timeoutMs()))
              .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
              .header("Range", "bytes=0-131071")
              .header(
                  "User-Agent",
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36")
              .GET()
              .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      int status = response.statusCode();
      if (status == 404 || status == 410) {
        return false;
      }
      if (status < 200 || status >= 300) {
        return true;
      }
      return !hasNoDataMessage(response.body());
    } catch (Exception error) {
      return true;
    }
  }

  private boolean hasNoDataMessage(String body) {
    String normalized = compact(body);
    return normalized.contains("暂无数据")
        || normalized.contains("没有数据")
        || normalized.contains("无数据")
        || normalized.contains("未查询到相关数据")
        || normalized.contains("信息不存在")
        || normalized.contains("公告不存在")
        || normalized.contains("页面不存在")
        || normalized.contains("内容不存在")
        || normalized.contains("notfound")
        || normalized.contains("nodata");
  }

  private String normalizeLink(String link) {
    String raw = link == null ? "" : link.trim();
    if (!StringUtils.hasText(raw)) {
      return "";
    }
    try {
      URI uri = URI.create(raw.startsWith("//") ? "https:" + raw : raw);
      String scheme = uri.getScheme();
      if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
        return "";
      }
      return uri.toString();
    } catch (RuntimeException error) {
      return "";
    }
  }

  private boolean safeUrl(String href) {
    try {
      String host = URI.create(href).getHost();
      if (!StringUtils.hasText(host)) {
        return false;
      }
      String lowerHost = host.toLowerCase(Locale.ROOT);
      if (lowerHost.equals("localhost")
          || lowerHost.endsWith(".localhost")
          || lowerHost.equals("0.0.0.0")) {
        return false;
      }
      InetAddress address = InetAddress.getByName(lowerHost);
      return !(address.isAnyLocalAddress()
          || address.isLoopbackAddress()
          || address.isLinkLocalAddress()
          || address.isSiteLocalAddress());
    } catch (Exception error) {
      return false;
    }
  }

  private String compact(String value) {
    return String.valueOf(value == null ? "" : value)
        .replaceAll("<script\\b[^>]*>[\\s\\S]*?</script>", " ")
        .replaceAll("<style\\b[^>]*>[\\s\\S]*?</style>", " ")
        .replaceAll("<[^>]+>", " ")
        .replaceAll("\\s+", "")
        .toLowerCase(Locale.ROOT);
  }

  private long cacheTtlMs() {
    return positiveLong("NOTICE_LINK_CHECK_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS);
  }

  private long timeoutMs() {
    return positiveLong("NOTICE_LINK_CHECK_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  }

  private long positiveLong(String key, long fallback) {
    String value = environment.getProperty(key);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(key);
    }
    try {
      long parsed = Long.parseLong(String.valueOf(value));
      return parsed > 0 ? parsed : fallback;
    } catch (RuntimeException error) {
      return fallback;
    }
  }

  private record CacheEntry(long checkedAt, boolean valid) {}
}
