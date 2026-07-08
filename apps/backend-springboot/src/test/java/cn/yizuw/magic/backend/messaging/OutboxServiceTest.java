package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;

/** Kafka outbox worker 单元测试；不连接真实 Kafka，只验证派发和状态流转。 */
@SuppressWarnings({"rawtypes", "unchecked"})
class OutboxServiceTest {

  private KafkaTemplate<String, String> kafkaTemplate;
  private OutboxRepository outboxRepository;
  private OutboxService outboxService;

  @BeforeEach
  void setUp() {
    kafkaTemplate = org.mockito.Mockito.mock(KafkaTemplate.class);
    outboxRepository = org.mockito.Mockito.mock(OutboxRepository.class);
    outboxService = new OutboxService(kafkaTemplate, outboxRepository);
  }

  @Test
  void dispatchBatchClaimsAndSendsKafkaRecord() {
    OutboxEvent event = event(1L, "evt_1", "tenant.payment.created", "magic.payment");
    when(outboxRepository.findDispatchable(50)).thenReturn(List.of(event));
    when(outboxRepository.markDispatching(1L)).thenReturn(true);
    when(kafkaTemplate.send(any(ProducerRecord.class)))
        .thenReturn((CompletableFuture) CompletableFuture.completedFuture(null));

    int processed = outboxService.dispatchBatch(50);

    assertThat(processed).isEqualTo(1);
    ArgumentCaptor<ProducerRecord<String, String>> captor =
        ArgumentCaptor.forClass(ProducerRecord.class);
    verify(kafkaTemplate).send(captor.capture());
    ProducerRecord<String, String> record = captor.getValue();
    assertThat(record.topic()).isEqualTo("magic.payment");
    assertThat(record.key()).isEqualTo("pay_1");
    assertThat(record.value()).isEqualTo("{\"amount\":98000}");
    assertThat(header(record, "eventId")).isEqualTo("evt_1");
    assertThat(header(record, "eventType")).isEqualTo("tenant.payment.created");
    assertThat(header(record, "customerId")).isEqualTo("customer_1");
    assertThat(header(record, "idempotencyKey")).isEqualTo("pay_1");
    verify(outboxRepository).markSent(1L);
    verify(outboxRepository, never()).markRetry(anyLong(), any(String.class));
  }

  @Test
  void dispatchBatchMarksRetryWhenKafkaSendFails() {
    OutboxEvent event = event(2L, "evt_2", "tenant.payment.created", "magic.payment");
    CompletableFuture<Object> failedFuture = new CompletableFuture<>();
    failedFuture.completeExceptionally(new IllegalStateException("broker unavailable"));
    when(outboxRepository.findDispatchable(50)).thenReturn(List.of(event));
    when(outboxRepository.markDispatching(2L)).thenReturn(true);
    when(kafkaTemplate.send(any(ProducerRecord.class))).thenReturn((CompletableFuture) failedFuture);

    int processed = outboxService.dispatchBatch(50);

    assertThat(processed).isEqualTo(1);
    verify(outboxRepository).markRetry(2L, "java.lang.IllegalStateException: broker unavailable");
    verify(outboxRepository, never()).markSent(2L);
  }

  @Test
  void dispatchBatchSkipsEventWhenAnotherInstanceAlreadyClaimedIt() {
    OutboxEvent event = event(3L, "evt_3", "tenant.payment.created", "magic.payment");
    when(outboxRepository.findDispatchable(50)).thenReturn(List.of(event));
    when(outboxRepository.markDispatching(3L)).thenReturn(false);

    int processed = outboxService.dispatchBatch(50);

    assertThat(processed).isZero();
    verify(kafkaTemplate, never()).send(any(ProducerRecord.class));
    verify(outboxRepository, never()).markSent(3L);
    verify(outboxRepository, never()).markRetry(anyLong(), any(String.class));
  }

  @Test
  void dispatchBatchCapsLargeManualBatchSize() {
    when(outboxRepository.findDispatchable(100)).thenReturn(List.of());

    assertThat(outboxService.dispatchBatch(500)).isZero();

    verify(outboxRepository).findDispatchable(100);
  }

  private OutboxEvent event(long id, String eventId, String eventType, String topic) {
    return new OutboxEvent(
        id,
        "payment_1",
        "payment",
        0,
        OffsetDateTime.now(),
        "customer_1",
        eventId,
        eventType,
        "pay_1",
        null,
        "{\"amount\":98000}",
        "pending",
        topic,
        OffsetDateTime.now());
  }

  private String header(ProducerRecord<String, String> record, String name) {
    return new String(record.headers().lastHeader(name).value(), StandardCharsets.UTF_8);
  }
}
