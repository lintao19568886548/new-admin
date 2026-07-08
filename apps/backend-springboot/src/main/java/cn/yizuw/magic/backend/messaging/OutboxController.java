package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OutboxController {

  private final OutboxService outboxService;

  public OutboxController(OutboxService outboxService) {
    this.outboxService = outboxService;
  }

  @PostMapping("/internal/outbox/events")
  public ApiResponse<Map<String, String>> enqueue(@Valid @RequestBody OutboxEventRequest request) {
    return ApiResponse.ok(Map.of("eventId", outboxService.enqueue(request)));
  }
}
