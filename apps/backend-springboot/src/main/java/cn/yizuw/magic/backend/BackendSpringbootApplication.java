package cn.yizuw.magic.backend;

import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.tenant.TenantDataSourceProperties;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableKafka
@EnableRabbit
@EnableScheduling
@MapperScan("cn.yizuw.magic.backend.**.mapper")
@SpringBootApplication
@EnableConfigurationProperties({AppProperties.class, TenantDataSourceProperties.class})
public class BackendSpringbootApplication {

  public static void main(String[] args) {
    SpringApplication.run(BackendSpringbootApplication.class, args);
  }
}
