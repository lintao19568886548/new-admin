package cn.yizuw.magic.backend.health;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.config.AppProperties;
import java.sql.Connection;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.apache.kafka.clients.admin.AdminClient;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InfrastructureHealthController {

  private final KafkaAdmin kafkaAdmin;
  private final AppProperties appProperties;
  private final DataSource centerDataSource;
  private final ConnectionFactory rabbitConnectionFactory;
  private final StringRedisTemplate redisTemplate;

  public InfrastructureHealthController(
      DataSource centerDataSource,
      AppProperties appProperties,
      KafkaAdmin kafkaAdmin,
      ConnectionFactory rabbitConnectionFactory,
      StringRedisTemplate redisTemplate) {
    this.centerDataSource = centerDataSource;
    this.appProperties = appProperties;
    this.kafkaAdmin = kafkaAdmin;
    this.rabbitConnectionFactory = rabbitConnectionFactory;
    this.redisTemplate = redisTemplate;
  }

  @GetMapping("/internal/health/infrastructure")
  public ApiResponse<Map<String, Object>> infrastructure() {
    return ApiResponse.ok(
        Map.of(
            "db", checkDb(),
            "kafka", checkKafka(),
            "rabbitmq", checkRabbitMq(),
            "redis", checkRedis(),
            "xxlJob", checkXxlJob()));
  }

  private Map<String, Object> checkDb() {
    try (Connection connection = centerDataSource.getConnection()) {
      return Map.of("status", connection.isValid(3) ? "up" : "down");
    } catch (Exception error) {
      return Map.of("message", error.getMessage() == null ? "" : error.getMessage(), "status", "down");
    }
  }

  private Map<String, Object> checkKafka() {
    AdminClient adminClient = AdminClient.create(kafkaHealthProperties());
    try {
      String clusterId =
          adminClient
              .describeCluster()
              .clusterId()
              .get(Duration.ofSeconds(3).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
      return Map.of("clusterId", clusterId == null ? "" : clusterId, "status", "up");
    } catch (Exception error) {
      return Map.of("message", error.getMessage() == null ? "" : error.getMessage(), "status", "down");
    } finally {
      adminClient.close(Duration.ZERO);
    }
  }

  private Map<String, Object> kafkaHealthProperties() {
    Map<String, Object> properties = new HashMap<>(kafkaAdmin.getConfigurationProperties());
    properties.putIfAbsent("default.api.timeout.ms", "3000");
    properties.putIfAbsent("request.timeout.ms", "3000");
    return properties;
  }

  private Map<String, Object> checkRedis() {
    try {
      String pong = redisTemplate.execute((RedisCallback<String>) connection -> connection.ping());
      return Map.of("message", pong == null ? "" : pong, "status", "up");
    } catch (Exception error) {
      return Map.of("message", error.getMessage() == null ? "" : error.getMessage(), "status", "down");
    }
  }

  private Map<String, Object> checkRabbitMq() {
    try (org.springframework.amqp.rabbit.connection.Connection connection =
        rabbitConnectionFactory.createConnection()) {
      return Map.of("localPort", connection.getLocalPort(), "status", "up");
    } catch (Exception error) {
      return Map.of(
          "message", error.getMessage() == null ? "" : error.getMessage(), "status", "down");
    }
  }

  private Map<String, Object> checkXxlJob() {
    AppProperties.XxlJob xxlJob = appProperties.getXxlJob();
    if (!xxlJob.isEnabled()) {
      return Map.of("enabled", false, "status", "disabled");
    }
    if (!org.springframework.util.StringUtils.hasText(xxlJob.getAdminAddresses())) {
      return Map.of("enabled", true, "message", "XXL_JOB_ADMIN_ADDRESSES is required", "status", "down");
    }
    return Map.of(
        "adminAddresses", xxlJob.getAdminAddresses(),
        "enabled", true,
        "executorAppname", xxlJob.getExecutorAppname(),
        "status", "configured");
  }
}
