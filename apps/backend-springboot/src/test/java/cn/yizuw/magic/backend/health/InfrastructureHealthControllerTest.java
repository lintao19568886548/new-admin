package cn.yizuw.magic.backend.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.config.AppProperties;
import java.sql.Connection;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaAdmin;

class InfrastructureHealthControllerTest {

  @SuppressWarnings("unchecked")
  @Test
  void infrastructureReportsCoreDependencyStatusesWithoutThrowing() throws Exception {
    DataSource dataSource = org.mockito.Mockito.mock(DataSource.class);
    Connection dbConnection = org.mockito.Mockito.mock(Connection.class);
    when(dataSource.getConnection()).thenReturn(dbConnection);
    when(dbConnection.isValid(3)).thenReturn(true);

    StringRedisTemplate redisTemplate = org.mockito.Mockito.mock(StringRedisTemplate.class);
    when(redisTemplate.execute(org.mockito.Mockito.any(RedisCallback.class))).thenReturn("PONG");

    ConnectionFactory rabbitConnectionFactory = org.mockito.Mockito.mock(ConnectionFactory.class);
    when(rabbitConnectionFactory.createConnection()).thenThrow(new IllegalStateException("rabbit down"));

    InfrastructureHealthController controller =
        new InfrastructureHealthController(
            dataSource,
            new AppProperties(),
            new KafkaAdmin(Map.of("bootstrap.servers", "127.0.0.1:1")),
            rabbitConnectionFactory,
            redisTemplate);

    ApiResponse<Map<String, Object>> response = controller.infrastructure();

    assertThat(response.code()).isZero();
    assertThat((Map<String, Object>) response.data().get("db")).containsEntry("status", "up");
    assertThat((Map<String, Object>) response.data().get("redis")).containsEntry("status", "up");
    assertThat((Map<String, Object>) response.data().get("rabbitmq"))
        .containsEntry("status", "down");
    assertThat((Map<String, Object>) response.data().get("kafka")).containsEntry("status", "down");
    assertThat((Map<String, Object>) response.data().get("xxlJob"))
        .containsEntry("status", "disabled");
  }
}
