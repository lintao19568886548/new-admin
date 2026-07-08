package cn.yizuw.magic.backend.messaging;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import cn.yizuw.magic.backend.config.AppProperties;
import org.junit.jupiter.api.Test;

/** Kafka outbox 调度开关测试，避免本地环境误触发真实 Kafka 派发。 */
class OutboxDispatcherTest {

  @Test
  void dispatchDoesNothingWhenOutboxDispatcherDisabled() {
    AppProperties appProperties = new AppProperties();
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);

    new OutboxDispatcher(appProperties, outboxService).dispatch();

    verify(outboxService, never()).dispatchBatch(50);
  }

  @Test
  void dispatchUsesDefaultBatchSizeWhenEnabled() {
    AppProperties appProperties = new AppProperties();
    appProperties.getKafka().setOutboxDispatchEnabled(true);
    OutboxService outboxService = org.mockito.Mockito.mock(OutboxService.class);

    new OutboxDispatcher(appProperties, outboxService).dispatch();

    verify(outboxService).dispatchBatch(50);
  }
}
