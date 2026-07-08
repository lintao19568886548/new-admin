package cn.yizuw.magic.backend.config;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public record DatabaseUrl(String jdbcUrl, String password, String username) {

  public static DatabaseUrl parse(String rawUrl) {
    if (rawUrl.startsWith("jdbc:")) {
      return new DatabaseUrl(rawUrl, null, null);
    }

    URI uri = URI.create(rawUrl);
    if (!"mysql".equalsIgnoreCase(uri.getScheme()) && !"mariadb".equalsIgnoreCase(uri.getScheme())) {
      throw new IllegalArgumentException("Unsupported database URL scheme: " + uri.getScheme());
    }

    String userInfo = uri.getRawUserInfo();
    String username = null;
    String password = null;
    if (userInfo != null) {
      String[] parts = userInfo.split(":", 2);
      username = decode(parts[0]);
      if (parts.length > 1) {
        password = decode(parts[1]);
      }
    }

    StringBuilder jdbcUrl = new StringBuilder("jdbc:mysql://");
    jdbcUrl.append(uri.getHost());
    if (uri.getPort() > 0) {
      jdbcUrl.append(':').append(uri.getPort());
    }
    jdbcUrl.append(uri.getRawPath() == null || uri.getRawPath().isBlank() ? "/" : uri.getRawPath());
    if (uri.getRawQuery() != null && !uri.getRawQuery().isBlank()) {
      String query = normalizeJdbcQuery(uri.getRawQuery());
      if (!query.isBlank()) {
        jdbcUrl.append('?').append(query);
      }
    }

    return new DatabaseUrl(jdbcUrl.toString(), password, username);
  }

  private static String normalizeJdbcQuery(String rawQuery) {
    List<String> supported = new ArrayList<>();
    for (String item : rawQuery.split("&")) {
      if (item.isBlank()) {
        continue;
      }
      String[] parts = item.split("=", 2);
      String key = decode(parts[0]);
      String value = parts.length > 1 ? decode(parts[1]) : "";
      switch (key) {
        case "connection_limit":
        case "connect_timeout":
        case "max_idle_connection_lifetime":
        case "pool_timeout":
          break;
        case "timezone":
          supported.add("serverTimezone=" + encode(value));
          break;
        default:
          supported.add(encode(key) + (parts.length > 1 ? "=" + encode(value) : ""));
      }
    }
    return String.join("&", supported);
  }

  private static String decode(String value) {
    return URLDecoder.decode(value, StandardCharsets.UTF_8);
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
  }
}
