package cn.yizuw.magic.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

class ProductionSecurityPropertiesValidatorTest {

  private final ApplicationContextRunner contextRunner =
      new ApplicationContextRunner()
          .withUserConfiguration(TestConfiguration.class)
          .withPropertyValues("spring.profiles.active=prod");

  @Test
  void prodProfileWithoutRequiredPropertiesFailsFast() {
    contextRunner
        .withPropertyValues(
            "app.jwt.access-token-secret=",
            "app.jwt.refresh-token-secret=",
            "app.hezhong.login-key=",
            "app.xxl-job.access-token=",
            "app.cors.allowed-origins=*",
            "app.internal-api.token=test-token")
        .run(
            context -> {
                assertThat(context.getStartupFailure())
                  .isInstanceOf(org.springframework.beans.factory.BeanCreationException.class);
              assertThat(context.getStartupFailure().getCause())
                  .isInstanceOf(IllegalStateException.class)
                  .hasMessageContaining("Production config missing required property")
                  .hasMessageContaining("app.jwt.access-token-secret");
            });
  }

  @Test
  void prodProfileWithRequiredPropertiesStarts() {
    contextRunner
        .withPropertyValues(
            "app.jwt.access-token-secret=access",
            "app.jwt.refresh-token-secret=refresh",
            "app.hezhong.login-key=third-party-key",
            "app.xxl-job.access-token=xxl-token",
            "app.cors.allowed-origins=https://prod.example.com,https://admin.example.com",
            "app.internal-api.token=test-token")
        .run(
            context -> {
              assertThat(context).hasNotFailed();
              assertThat(context.getBean(AppProperties.class)).isNotNull();
            });
  }

  @Configuration
  @EnableConfigurationProperties(AppProperties.class)
  @Import(ProductionSecurityPropertiesValidator.class)
  static class TestConfiguration {}
}
