package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.config.AppProperties;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;

/** Kafka outbox 生产-消费闭环场景测试：派发、幂等、失败和开关验证。 */
class OutboxKafkaConsumerFlowTest {

  private KafkaTemplate<String, String> kafkaTemplate;
  private OutboxRepository outboxRepository;
  private OutboxService outboxService;
  private EventConsumeLogRepository eventConsumeLogRepository;
  private OrganizationProvisioningCompletedFollowupPublisher followupPublisher;
  private OrganizationProvisioningCompletedConsumerService consumerService;
  private OrganizationProvisioningCompletedKafkaListener kafkaListener;

  @BeforeEach
  void setUp() {
    kafkaTemplate = org.mockito.Mockito.mock(KafkaTemplate.class);
    outboxRepository = org.mockito.Mockito.mock(OutboxRepository.class);
    outboxService = new OutboxService(kafkaTemplate, outboxRepository);

    eventConsumeLogRepository = org.mockito.Mockito.mock(EventConsumeLogRepository.class);
    followupPublisher =
        org.mockito.Mockito.mock(OrganizationProvisioningCompletedFollowupPublisher.class);
    consumerService =
        new OrganizationProvisioningCompletedConsumerService(
            eventConsumeLogRepository, followupPublisher);
    kafkaListener = new OrganizationProvisioningCompletedKafkaListener("backend-springboot", consumerService);
  }

  @Test
  void dispatchEnabledPublishesOutboxEventAndConsumerConsumesItOnce() {
    when(outboxRepository.findDispatchable(50)).thenReturn(List.of(outboxEvent()));
    when(outboxRepository.markDispatching(77L)).thenReturn(true);
    when(kafkaTemplate.send(any(ProducerRecord.class)))
        .thenReturn((CompletableFuture) CompletableFuture.completedFuture(null));
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED);
    when(followupPublisher.publish(
            any(),
            any(),
            anyInt(),
            any(String.class),
            any(String.class)))
        .thenReturn("msg-light-task");

    int processed = outboxService.dispatchBatch(50);
    assertThat(processed).isEqualTo(1);
    verify(outboxRepository).markSent(77L);

    ConsumerRecord<String, String> consumerRecord = toConsumerRecord(capturedKafkaRecord());
    kafkaListener.onMessage(consumerRecord);

    verify(followupPublisher)
        .publish(any(), any(), anyInt(), any(String.class), any(String.class));
    verify(eventConsumeLogRepository).markSuccess(any(EventConsumeLogEntry.class));
  }

  @Test
  void duplicateKafkaMessageKeepsConsumerIdempotent() {
    when(outboxRepository.findDispatchable(50)).thenReturn(List.of(outboxEvent()));
    when(outboxRepository.markDispatching(77L)).thenReturn(true);
    when(kafkaTemplate.send(any(ProducerRecord.class)))
        .thenReturn((CompletableFuture) CompletableFuture.completedFuture(null));
    when(eventConsumeLogRepository.claimProcessing(any()))
        .thenReturn(EventConsumeClaimResult.CLAIMED, EventConsumeClaimResult.DUPLICATE_SUCCESS);
    when(followupPublisher.publish(
            any(),
            any(),
            anyInt(),
            any(String.class),
            any(String.class)))
        .thenReturn("msg-light-task");

    outboxService.dispatchBatch(50);
    ConsumerRecord<String, String> consumerRecord = toConsumerRecord(capturedKafkaRecord());

    kafkaListener.onMessage(consumerRecord);
    kafkaListener.onMessage(consumerRecord);

    verify(followupPublisher).publish(any(), any(), anyInt(), any(String.class), any(String.class));
    verify(eventConsumeLogRepository).markSuccess(any(EventConsumeLogEntry.class));
    verify(eventConsumeLogRepository, never()).markFailure(any(EventConsumeLogEntry.class), any());
  }

  @Test
  void failedKafkaSendMarksRetryAndNoConsumerSideEffects() {
    CompletableFuture<Object> failedFuture = new CompletableFuture<>();
    failedFuture.completeExceptionally(new IllegalStateException("broker down"));

    when(outboxRepository.findDispatchable(50)).thenReturn(List.of(outboxEvent()));
    when(outboxRepository.markDispatching(77L)).thenReturn(true);
    when(kafkaTemplate.send(any(ProducerRecord.class))).thenReturn((CompletableFuture) failedFuture);

    int processed = outboxService.dispatchBatch(50);

    assertThat(processed).isEqualTo(1);
    verify(outboxRepository).markRetry(77L, "java.lang.IllegalStateException: broker down");
    verify(outboxRepository, never()).markSent(77L);
    verify(followupPublisher, never())
        .publish(any(), any(), anyInt(), any(String.class), any(String.class));
  }

  @Test
  void dispatcherSwitchControlsOutboxDispatchInvocation() {
    AppProperties appProperties = new AppProperties();
    OutboxService service = org.mockito.Mockito.mock(OutboxService.class);
    OutboxDispatcher dispatcher = new OutboxDispatcher(appProperties, service);

    dispatcher.dispatch();
    verify(service, never()).dispatchBatch(50);

    appProperties.getKafka().setOutboxDispatchEnabled(true);
    dispatcher.dispatch();
    verify(service).dispatchBatch(50);
  }

  private ProducerRecord<String, String> capturedKafkaRecord() {
    org.mockito.ArgumentCaptor<ProducerRecord> captor =
        org.mockito.ArgumentCaptor.forClass(ProducerRecord.class);
    verify(kafkaTemplate).send(captor.capture());
    return captor.getValue();
  }

  private ConsumerRecord<String, String> toConsumerRecord(ProducerRecord<String, String> record) {
    ConsumerRecord<String, String> consumerRecord =
        new ConsumerRecord<>(
            record.topic(),
            0,
            0L,
            record.key(),
            record.value());
    record.headers().forEach(header -> consumerRecord.headers().add(copyHeader(header)));
    return consumerRecord;
  }

  private Header copyHeader(Header header) {
    return new RecordHeader(header.key(), header.value());
  }

  private OutboxEvent outboxEvent() {
    return new OutboxEvent(
        77L,
        "tenant_31",
        "tenant",
        0,
        OffsetDateTime.now(),
        "org001",
        "evt_77",
        "organization.provisioning.completed",
        "organization-provisioning-completed:31",
        null,
        "{\"jobId\":31,\"targetCustomerId\":\"org001\",\"targetDbName\":\"tenant_org001\"}",
        "pending",
        "magic.organization.provisioning",
        OffsetDateTime.now());
  }

}
