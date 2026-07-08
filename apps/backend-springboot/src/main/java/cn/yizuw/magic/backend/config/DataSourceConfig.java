package cn.yizuw.magic.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StringUtils;

@Configuration
public class DataSourceConfig {

  @Bean(destroyMethod = "close")
  public DataSource centerDataSource(
      @Value("${spring.datasource.center.jdbc-url:}") String jdbcUrl,
      @Value("${spring.datasource.center.driver-class-name:com.mysql.cj.jdbc.Driver}")
          String driverClassName,
      @Value("${spring.datasource.center.maximum-pool-size:10}") int maximumPoolSize,
      @Value("${spring.datasource.center.minimum-idle:1}") int minimumIdle) {
    if (!StringUtils.hasText(jdbcUrl)) {
      throw new IllegalStateException("CENTER_DATABASE_URL is required for backend-springboot");
    }

    DatabaseUrl parsedUrl = DatabaseUrl.parse(jdbcUrl);
    HikariConfig config = new HikariConfig();
    config.setJdbcUrl(parsedUrl.jdbcUrl());
    config.setDriverClassName(driverClassName);
    if (StringUtils.hasText(parsedUrl.username())) {
      config.setUsername(parsedUrl.username());
    }
    if (parsedUrl.password() != null) {
      config.setPassword(parsedUrl.password());
    }
    config.setMaximumPoolSize(maximumPoolSize);
    config.setMinimumIdle(minimumIdle);
    config.setPoolName("center-db");
    return new HikariDataSource(config);
  }

  @Bean
  public JdbcTemplate centerJdbcTemplate(DataSource centerDataSource) {
    return new JdbcTemplate(centerDataSource);
  }
}
