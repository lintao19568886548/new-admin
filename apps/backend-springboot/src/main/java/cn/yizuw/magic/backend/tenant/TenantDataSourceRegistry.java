package cn.yizuw.magic.backend.tenant;

import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.config.DatabaseUrl;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.sql.DataSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class TenantDataSourceRegistry {

  private final AppProperties appProperties;
  private final Map<String, HikariDataSource> cache = new ConcurrentHashMap<>();
  private final TenantDataSourceProperties properties;

  public TenantDataSourceRegistry(AppProperties appProperties, TenantDataSourceProperties properties) {
    this.appProperties = appProperties;
    this.properties = properties;
  }

  public DataSource getDataSource(String customerId, String dbName) {
    String normalizedCustomerId =
        StringUtils.hasText(customerId) ? customerId : appProperties.getDefaultCustomerId();
    String normalizedDbName = normalizeDatabaseName(dbName);
    String cacheKey =
        StringUtils.hasText(normalizedDbName)
            ? normalizedCustomerId + ":" + normalizedDbName
            : normalizedCustomerId;
    return cache.computeIfAbsent(
        cacheKey, ignored -> createDataSource(normalizedCustomerId, normalizedDbName));
  }

  private HikariDataSource createDataSource(String customerId, String dbName) {
    String rawUrl = resolveTenantJdbcUrl(customerId, dbName);
    DatabaseUrl parsedUrl = DatabaseUrl.parse(rawUrl);

    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(parsedUrl.jdbcUrl());
    if (StringUtils.hasText(parsedUrl.username())) {
      config.setUsername(parsedUrl.username());
    }
    if (parsedUrl.password() != null) {
      config.setPassword(parsedUrl.password());
    }
    config.setMaximumPoolSize(properties.getMaximumPoolSize());
    config.setMinimumIdle(properties.getMinimumIdle());
    config.setPoolName("tenant-db-" + customerId);
    return new HikariDataSource(config);
  }

  private String resolveTenantJdbcUrl(String customerId, String dbName) {
    String baseUrl;
    if ("public".equals(customerId)) {
      baseUrl = requireText(properties.getPublicJdbcUrl(), "PUBLIC_DATABASE_URL is required");
    } else if (StringUtils.hasText(properties.getJdbcUrlTemplate())) {
      baseUrl = properties.getJdbcUrlTemplate().replace("{customerId}", customerId);
    } else {
      baseUrl = requireText(properties.getDefaultJdbcUrl(), "DATABASE_URL is required");
      if (!customerId.equals(appProperties.getDefaultCustomerId())) {
        URI uri = URI.create(baseUrl);
        baseUrl = replaceDatabaseName(uri, properties.getDbPrefix() + customerId);
      }
    }

    if (StringUtils.hasText(dbName)) {
      return replaceDatabaseName(URI.create(baseUrl), dbName);
    }
    return baseUrl;
  }

  private String normalizeDatabaseName(String dbName) {
    if (!StringUtils.hasText(dbName)) {
      return null;
    }
    String normalized = dbName.trim();
    if (!normalized.matches("\\w+")) {
      throw new IllegalArgumentException("Invalid database name: " + normalized);
    }
    return normalized;
  }

  private String replaceDatabaseName(URI uri, String databaseName) {
    String raw = uri.toString();
    if (raw.startsWith("jdbc:mysql://") || raw.startsWith("jdbc:mariadb://")) {
      return replaceJdbcDatabaseName(raw, databaseName);
    }
    String path = uri.getRawPath();
    if (!StringUtils.hasText(path)) {
      int queryIndex = raw.indexOf('?');
      return queryIndex >= 0
          ? raw.substring(0, queryIndex) + "/" + databaseName + raw.substring(queryIndex)
          : raw + "/" + databaseName;
    }
    int pathIndex = raw.indexOf(path);
    return raw.substring(0, pathIndex) + "/" + databaseName + raw.substring(pathIndex + path.length());
  }

  private String replaceJdbcDatabaseName(String rawUrl, String databaseName) {
    int queryIndex = rawUrl.indexOf('?');
    String beforeQuery = queryIndex >= 0 ? rawUrl.substring(0, queryIndex) : rawUrl;
    String query = queryIndex >= 0 ? rawUrl.substring(queryIndex) : "";
    int hostStart = rawUrl.indexOf("//");
    int pathIndex = hostStart >= 0 ? beforeQuery.indexOf('/', hostStart + 2) : -1;
    if (pathIndex < 0) {
      return beforeQuery + "/" + databaseName + query;
    }
    return beforeQuery.substring(0, pathIndex) + "/" + databaseName + query;
  }

  private String requireText(String value, String message) {
    if (!StringUtils.hasText(value)) {
      throw new IllegalStateException(message);
    }
    return value;
  }
}
