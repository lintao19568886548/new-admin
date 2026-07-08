package cn.yizuw.magic.backend.messaging;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class OutboxService {

  private static final int MAX_BATCH_SIZE = 100;
  private static final Duration SEND_TIMEOUT = Duration.ofSeconds(10);

  private final KafkaTemplate<String, String> kafkaTemplate;
  private final OutboxRepository outboxRepository;

  public OutboxService(KafkaTemplate<String, String> kafkaTemplate, OutboxRepository outboxRepository) {
    this.kafkaTemplate = kafkaTemplate;
    this.outboxRepository = outboxRepository;
  }

  public String enqueue(OutboxEventRequest request) {
    return outboxRepository.createPendingEvent(request);
  }

  /**
   * 派发一批 outbox 事件到 Kafka。
   *
   * <p>每条事件先通过数据库条件更新认领为 dispatching，避免多个 Spring Boot 实例同时扫描时重复投递。
   */
  public int dispatchBatch(int limit) {
    if (limit <= 0) {
      return 0;
    }
    List<OutboxEvent> events = outboxRepository.findDispatchable(Math.min(limit, MAX_BATCH_SIZE));
    int processed = 0;
    for (OutboxEvent event : events) {
      if (!outboxRepository.markDispatching(event.id())) {
        continue;
      }
      processed++;
      try {
        ProducerRecord<String, String> record =
            new ProducerRecord<>(event.topic(), event.idempotencyKey(), event.payload());
        record.headers().add(new RecordHeader("eventId", bytes(event.eventId())));
        record.headers().add(new RecordHeader("eventType", bytes(event.eventType())));
        record.headers().add(new RecordHeader("customerId", bytes(event.customerId())));
        record.headers().add(new RecordHeader("idempotencyKey", bytes(event.idempotencyKey())));

        kafkaTemplate.send(record).get(SEND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
        outboxRepository.markSent(event.id());
      } catch (Exception error) {
        if (error instanceof InterruptedException) {
          Thread.currentThread().interrupt();
        }
        outboxRepository.markRetry(event.id(), error.getMessage());
      }
    }
    return processed;
  }

  private byte[] bytes(String value) {
    return String.valueOf(value).getBytes(StandardCharsets.UTF_8);
  }
}
