package cn.yizuw.magic.backend.messaging;

import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** 中心库 Kafka 消费幂等日志仓储。 */
@Repository
public class EventConsumeLogRepository {

  private final JdbcTemplate centerJdbcTemplate;

  public EventConsumeLogRepository(JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 认领事件消费权。
   *
   * <p>首次消费插入 processing；历史 failed 记录允许重新认领，配合 Kafka 重试继续投递后续任务。
   */
  public EventConsumeClaimResult claimProcessing(EventConsumeLogEntry entry) {
    try {
      centerJdbcTemplate.update(
          """
          INSERT INTO event_consume_log
            (event_id, event_type, topic, consumer_group, idempotency_key,
             status, error_message, consumed_at)
          VALUES (?, ?, ?, ?, ?, 'processing', NULL, NOW())
          """,
          entry.eventId(),
          entry.eventType(),
          entry.topic(),
          entry.consumerGroup(),
          entry.idempotencyKey());
      return EventConsumeClaimResult.CLAIMED;
    } catch (DuplicateKeyException duplicate) {
      return existingClaimResult(entry);
    }
  }

  /** 记录成功消费；同一 eventId + consumerGroup 已存在时返回 false。 */
  public boolean recordSuccess(EventConsumeLogEntry entry) {
    return insert(entry, "success", null);
  }

  /** 记录消费失败；用于合法事件解析失败时落表，避免坏消息反复无审计地重试。 */
  public boolean recordFailure(EventConsumeLogEntry entry, String errorMessage) {
    return insert(entry, "failed", truncate(errorMessage, 1000));
  }

  /** 把已认领的消费日志标记为成功。 */
  public void markSuccess(EventConsumeLogEntry entry) {
    centerJdbcTemplate.update(
        """
        UPDATE event_consume_log
        SET status = 'success',
            error_message = NULL,
            consumed_at = NOW()
        WHERE event_id = ? AND consumer_group = ?
        """,
        entry.eventId(),
        entry.consumerGroup());
  }

  /** 把已认领的消费日志标记为失败，保留错误摘要供后续重试和人工排查。 */
  public void markFailure(EventConsumeLogEntry entry, String errorMessage) {
    centerJdbcTemplate.update(
        """
        UPDATE event_consume_log
        SET status = 'failed',
            error_message = ?,
            consumed_at = NOW()
        WHERE event_id = ? AND consumer_group = ?
        """,
        truncate(errorMessage, 1000),
        entry.eventId(),
        entry.consumerGroup());
  }

  private boolean insert(EventConsumeLogEntry entry, String status, String errorMessage) {
    try {
      centerJdbcTemplate.update(
          """
          INSERT INTO event_consume_log
            (event_id, event_type, topic, consumer_group, idempotency_key,
             status, error_message, consumed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
          """,
          entry.eventId(),
          entry.eventType(),
          entry.topic(),
          entry.consumerGroup(),
          entry.idempotencyKey(),
          status,
          errorMessage);
      return true;
    } catch (DuplicateKeyException duplicate) {
      return false;
    }
  }

  private EventConsumeClaimResult existingClaimResult(EventConsumeLogEntry entry) {
    String status = findStatus(entry);
    if ("success".equals(status)) {
      return EventConsumeClaimResult.DUPLICATE_SUCCESS;
    }
    if ("failed".equals(status) && reclaimFailed(entry)) {
      return EventConsumeClaimResult.CLAIMED;
    }
    return EventConsumeClaimResult.IN_PROGRESS;
  }

  private String findStatus(EventConsumeLogEntry entry) {
    List<String> rows =
        centerJdbcTemplate.query(
            """
            SELECT status
            FROM event_consume_log
            WHERE event_id = ? AND consumer_group = ?
            LIMIT 1
            """,
            statusMapper(),
            entry.eventId(),
            entry.consumerGroup());
    return rows.isEmpty() ? null : rows.get(0);
  }

  private boolean reclaimFailed(EventConsumeLogEntry entry) {
    int updated =
        centerJdbcTemplate.update(
            """
            UPDATE event_consume_log
            SET status = 'processing',
                error_message = NULL,
                consumed_at = NOW()
            WHERE event_id = ? AND consumer_group = ? AND status = 'failed'
            """,
            entry.eventId(),
            entry.consumerGroup());
    return updated == 1;
  }

  private RowMapper<String> statusMapper() {
    return (rs, rowNum) -> rs.getString("status");
  }

  private String truncate(String value, int maxLength) {
    if (value == null || value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength);
  }
}
