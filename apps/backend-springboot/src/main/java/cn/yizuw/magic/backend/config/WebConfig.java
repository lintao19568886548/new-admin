package cn.yizuw.magic.backend.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

  private final AppProperties appProperties;

  public WebConfig(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    List<String> origins =
        Arrays.stream(appProperties.getCors().getAllowedOrigins().split(","))
            .map(String::trim)
            .filter(item -> !item.isEmpty())
            .toList();

    registry
        .addMapping("/**")
        .allowedOriginPatterns(origins.isEmpty() ? List.of("*").toArray(String[]::new) : origins.toArray(String[]::new))
        .allowedMethods("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .exposedHeaders("*")
        .allowCredentials(true)
        .maxAge(3600);
  }
}
