package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** Outbox 仓储幂等测试；不连接真实数据库，只验证重复业务键处理。 */
class OutboxRepositoryTest {

  @Test
  void createPendingEventReturnsGeneratedEventIdWhenInsertSucceeds() {
    InsertSuccessJdbcTemplate jdbcTemplate = new InsertSuccessJdbcTemplate();
    OutboxRepository repository = new OutboxRepository(jdbcTemplate);

    String eventId = repository.createPendingEvent(request());

    assertThat(eventId).isNotBlank();
    assertThat(jdbcTemplate.queryCalled).isFalse();
  }

  @Test
  void createPendingEventReturnsExistingEventIdWhenIdempotencyKeyAlreadyExists() {
    DuplicateWithExistingEventJdbcTemplate jdbcTemplate =
        new DuplicateWithExistingEventJdbcTemplate();
    OutboxRepository repository = new OutboxRepository(jdbcTemplate);

    String eventId = repository.createPendingEvent(request());

    assertThat(eventId).isEqualTo("evt_existing");
    assertThat(jdbcTemplate.queryCalled).isTrue();
  }

  @Test
  void createPendingEventRethrowsDuplicateWhenExistingEventCannotBeFound() {
    DuplicateWithoutExistingEventJdbcTemplate jdbcTemplate =
        new DuplicateWithoutExistingEventJdbcTemplate();
    OutboxRepository repository = new OutboxRepository(jdbcTemplate);

    assertThatThrownBy(() -> repository.createPendingEvent(request()))
        .isInstanceOf(DuplicateKeyException.class);
    assertThat(jdbcTemplate.queryCalled).isTrue();
  }

  private OutboxEventRequest request() {
    return new OutboxEventRequest(
        "wxapp_1",
        "vip_membership_payment",
        "customer_1",
        "vip.membership.payment.notified",
        "vip-membership-payment-notified:wxapp_1",
        "{\"outTradeNo\":\"wxapp_1\"}",
        "magic.vip-membership.payment");
  }

  private static final class InsertSuccessJdbcTemplate extends JdbcTemplate {

    boolean queryCalled;

    @Override
    public int update(String sql, Object... args) {
      return 1;
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      queryCalled = true;
      return List.of();
    }
  }

  private static class DuplicateWithExistingEventJdbcTemplate extends JdbcTemplate {

    boolean queryCalled;

    @Override
    public int update(String sql, Object... args) {
      throw new DuplicateKeyException("duplicate idempotency key");
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      queryCalled = true;
      return (List<T>) List.of("evt_existing");
    }
  }

  private static final class DuplicateWithoutExistingEventJdbcTemplate
      extends DuplicateWithExistingEventJdbcTemplate {

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
      super.query(sql, rowMapper, args);
      return List.of();
    }
  }
}
