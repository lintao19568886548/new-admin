package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OutboxDispatcher {

  private final AppProperties appProperties;
  private final OutboxService outboxService;

  public OutboxDispatcher(AppProperties appProperties, OutboxService outboxService) {
    this.appProperties = appProperties;
    this.outboxService = outboxService;
  }

  @Scheduled(fixedDelayString = "${app.kafka.outbox-dispatch-interval-ms:5000}")
  public void dispatch() {
    if (!appProperties.getKafka().isOutboxDispatchEnabled()) {
      return;
    }
    outboxService.dispatchBatch(50);
  }
}
