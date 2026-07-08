package cn.yizuw.magic.backend.tenant;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "spring.datasource.tenant")
public class TenantDataSourceProperties {

  private String dbPrefix = "customer_";
  private String defaultJdbcUrl;
  private String jdbcUrlTemplate;
  private int maximumPoolSize = 10;
  private int minimumIdle = 1;
  private String publicJdbcUrl;

  public String getDbPrefix() {
    return dbPrefix;
  }

  public void setDbPrefix(String dbPrefix) {
    this.dbPrefix = dbPrefix;
  }

  public String getDefaultJdbcUrl() {
    return defaultJdbcUrl;
  }

  public void setDefaultJdbcUrl(String defaultJdbcUrl) {
    this.defaultJdbcUrl = defaultJdbcUrl;
  }

  public String getJdbcUrlTemplate() {
    return jdbcUrlTemplate;
  }

  public void setJdbcUrlTemplate(String jdbcUrlTemplate) {
    this.jdbcUrlTemplate = jdbcUrlTemplate;
  }

  public int getMaximumPoolSize() {
    return maximumPoolSize;
  }

  public void setMaximumPoolSize(int maximumPoolSize) {
    this.maximumPoolSize = maximumPoolSize;
  }

  public int getMinimumIdle() {
    return minimumIdle;
  }

  public void setMinimumIdle(int minimumIdle) {
    this.minimumIdle = minimumIdle;
  }

  public String getPublicJdbcUrl() {
    return publicJdbcUrl;
  }

  public void setPublicJdbcUrl(String publicJdbcUrl) {
    this.publicJdbcUrl = publicJdbcUrl;
  }
}
