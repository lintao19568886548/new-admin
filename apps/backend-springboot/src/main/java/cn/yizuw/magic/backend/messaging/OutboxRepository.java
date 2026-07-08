package cn.yizuw.magic.backend.messaging;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class OutboxRepository {

  private final JdbcTemplate centerJdbcTemplate;

  public OutboxRepository(JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  public String createPendingEvent(OutboxEventRequest request) {
    String eventId = UUID.randomUUID().toString();
    try {
      centerJdbcTemplate.update(
          """
          INSERT INTO event_outbox
            (event_id, event_type, topic, customer_id, aggregate_type, aggregate_id,
             idempotency_key, payload, status, attempts, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NOW(), NOW())
          """,
          eventId,
          request.eventType(),
          request.topic(),
          request.customerId(),
          request.aggregateType(),
          request.aggregateId(),
          request.idempotencyKey(),
          request.payload());
    } catch (DuplicateKeyException duplicate) {
      String existingEventId = findEventIdByIdempotencyKey(request.idempotencyKey());
      if (StringUtils.hasText(existingEventId)) {
        return existingEventId;
      }
      throw duplicate;
    }
    return eventId;
  }

  private String findEventIdByIdempotencyKey(String idempotencyKey) {
    List<String> rows =
        centerJdbcTemplate.query(
            """
            SELECT event_id
            FROM event_outbox
            WHERE idempotency_key = ?
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getString("event_id"),
            idempotencyKey);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public List<OutboxEvent> findDispatchable(int limit) {
    return centerJdbcTemplate.query(
        """
        SELECT id, event_id, event_type, topic, customer_id, aggregate_type, aggregate_id,
               idempotency_key, payload, status, attempts, next_attempt_at, created_at, updated_at
        FROM event_outbox
        WHERE status IN ('pending', 'retry')
          AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
        ORDER BY id ASC
        LIMIT ?
        """,
        (rs, rowNum) -> mapEvent(rs),
        limit);
  }

  /** 条件认领待派发事件，避免多实例 dispatcher 重复发送同一条 Kafka 事件。 */
  public boolean markDispatching(long id) {
    int updated =
        centerJdbcTemplate.update(
            """
            UPDATE event_outbox
            SET status = 'dispatching',
                attempts = attempts + 1,
                updated_at = NOW()
            WHERE id = ?
              AND status IN ('pending', 'retry')
              AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
            """,
            id);
    return updated == 1;
  }

  public void markSent(long id) {
    centerJdbcTemplate.update(
        """
        UPDATE event_outbox
        SET status = 'sent', updated_at = NOW(), sent_at = NOW()
        WHERE id = ? AND status = 'dispatching'
        """,
        id);
  }

  public void markRetry(long id, String errorMessage) {
    centerJdbcTemplate.update(
        """
        UPDATE event_outbox
        SET status = CASE WHEN attempts >= 10 THEN 'dead' ELSE 'retry' END,
            last_error = ?,
            next_attempt_at =
              CASE
                WHEN attempts >= 10 THEN NULL
                ELSE DATE_ADD(NOW(), INTERVAL LEAST(300, POW(2, attempts)) SECOND)
              END,
            updated_at = NOW()
        WHERE id = ? AND status = 'dispatching'
        """,
        truncate(errorMessage, 1000),
        id);
  }

  private OutboxEvent mapEvent(ResultSet rs) throws SQLException {
    return new OutboxEvent(
        rs.getLong("id"),
        rs.getString("aggregate_id"),
        rs.getString("aggregate_type"),
        rs.getInt("attempts"),
        toOffsetDateTime(rs, "created_at"),
        rs.getString("customer_id"),
        rs.getString("event_id"),
        rs.getString("event_type"),
        rs.getString("idempotency_key"),
        toOffsetDateTime(rs, "next_attempt_at"),
        rs.getString("payload"),
        rs.getString("status"),
        rs.getString("topic"),
        toOffsetDateTime(rs, "updated_at"));
  }

  private OffsetDateTime toOffsetDateTime(ResultSet rs, String columnName) throws SQLException {
    var timestamp = rs.getTimestamp(columnName);
    if (timestamp == null) {
      return null;
    }
    return timestamp.toInstant().atZone(ZoneId.systemDefault()).toOffsetDateTime();
  }

  private String truncate(String value, int maxLength) {
    if (value == null) {
      return null;
    }
    return value.length() <= maxLength ? value : value.substring(0, maxLength);
  }
}
