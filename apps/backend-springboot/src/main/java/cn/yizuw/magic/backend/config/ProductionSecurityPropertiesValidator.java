package cn.yizuw.magic.backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.util.StringUtils;

@Configuration
public class ProductionSecurityPropertiesValidator {

  private final Environment environment;
  private final AppProperties appProperties;

  public ProductionSecurityPropertiesValidator(Environment environment, AppProperties appProperties) {
    this.environment = environment;
    this.appProperties = appProperties;
  }

  @PostConstruct
  public void validate() {
    if (!environment.acceptsProfiles(Profiles.of("prod"))) {
      return;
    }

    requireNotBlank("app.jwt.access-token-secret", appProperties.getJwt().getAccessTokenSecret());
    requireNotBlank(
        "app.jwt.refresh-token-secret", appProperties.getJwt().getRefreshTokenSecret());
    requireNotBlank(
        "app.hezhong.login-key", appProperties.getHezhong().getLoginKey());
    requireNotBlank(
        "app.xxl-job.access-token", appProperties.getXxlJob().getAccessToken());
    requireAllowedCorsOrigins(appProperties.getCors().getAllowedOrigins());
  }

  private void requireNotBlank(String propertyName, String value) {
    if (!StringUtils.hasText(value)) {
      throw new IllegalStateException("Production config missing required property: " + propertyName);
    }
  }

  private void requireAllowedCorsOrigins(String allowedOrigins) {
    if (!StringUtils.hasText(allowedOrigins)) {
      throw new IllegalStateException("Production config requires explicit app.cors.allowed-origins");
    }
    for (String origin : allowedOrigins.split(",")) {
      String trimmed = origin.trim();
      if (trimmed.isBlank()) {
        continue;
      }
      if ("*".equals(trimmed) || "*".equals(trimmed.toLowerCase())) {
        throw new IllegalStateException(
            "Production config forbids wildcard app.cors.allowed-origins");
      }
    }
  }
}
