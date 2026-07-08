package cn.yizuw.magic.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.messaging.OutboxController;
import cn.yizuw.magic.backend.messaging.OutboxEventRequest;
import cn.yizuw.magic.backend.messaging.OutboxService;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageController;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessagePublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class InternalApiFilterTest {

  private MockMvc mockMvc;
  private OutboxService outboxService;
  private RabbitMessagePublisher rabbitMessagePublisher;
  private AppProperties appProperties;

  @BeforeEach
  void setUp() {
    outboxService = org.mockito.Mockito.mock(OutboxService.class);
    rabbitMessagePublisher = org.mockito.Mockito.mock(RabbitMessagePublisher.class);
    appProperties = new AppProperties();
    appProperties.getInternalApi().setToken("secret-token");

    InternalApiFilter internalApiFilter = new InternalApiFilter(appProperties);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new OutboxController(outboxService),
                new RabbitMessageController(rabbitMessagePublisher, appProperties))
            .addFilters(internalApiFilter)
            .build();
  }

  @Test
  void outboxEndpointRejectsUnauthorizedRequestWithoutInternalAccess() throws Exception {
    mockMvc
        .perform(
            post("/internal/outbox/events")
                .with(remoteAddress("198.51.100.10"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"aggregateId\":\"a\",\"aggregateType\":\"b\",\"customerId\":\"c\",\"eventType\":\"organization.provisioning.completed\",\"idempotencyKey\":\"evt-1\",\"payload\":\"{}\",\"topic\":\"magic.organization.provisioning\"}")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isForbidden());

    verify(outboxService, never()).enqueue(any(OutboxEventRequest.class));
  }

  @Test
  void outboxEndpointAllowsPrivateIpRequestWithoutToken() throws Exception {
    org.mockito.Mockito.when(outboxService.enqueue(any(OutboxEventRequest.class))).thenReturn("evt_id");

    mockMvc
        .perform(
            post("/internal/outbox/events")
                .with(remoteAddress("10.0.0.11"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"aggregateId\":\"a\",\"aggregateType\":\"b\",\"customerId\":\"c\",\"eventType\":\"organization.provisioning.completed\",\"idempotencyKey\":\"evt-1\",\"payload\":\"{}\",\"topic\":\"magic.organization.provisioning\"}")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());
  }

  @Test
  void outboxEndpointAllowsAuthorizedPublicRequestWithInternalToken() throws Exception {
    org.mockito.Mockito.when(outboxService.enqueue(any(OutboxEventRequest.class))).thenReturn("evt_id");

    mockMvc
        .perform(
            post("/internal/outbox/events")
                .with(remoteAddress("198.51.100.10"))
                .header(HttpHeaders.AUTHORIZATION, "ignore")
                .header("X-Internal-API-Token", "secret-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"aggregateId\":\"a\",\"aggregateType\":\"b\",\"customerId\":\"c\",\"eventType\":\"organization.provisioning.completed\",\"idempotencyKey\":\"evt-1\",\"payload\":\"{}\",\"topic\":\"magic.organization.provisioning\"}")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());
  }

  @Test
  void rabbitEndpointRejectsUnauthorizedRequestAndDoesNotPublish() throws Exception {
    mockMvc
        .perform(
            post("/internal/rabbit/light-tasks")
                .with(remoteAddress("198.51.100.10"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"customerId\":\"c\",\"payload\":\"{\\\"type\\\":\\\"test\\\"}\",\"aggregateType\":\"a\",\"aggregateId\":\"a\",\"idempotencyKey\":\"id-1\",\"messageId\":\"m-1\"}"))
        .andExpect(status().isForbidden());

    verify(rabbitMessagePublisher, never())
        .publishLightTask(ArgumentMatchers.any(cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageRequest.class));
  }

  @Test
  void rabbitEndpointAllowsAuthorizedPublicRequestWithInternalToken() throws Exception {
    org.mockito.Mockito.when(rabbitMessagePublisher.publishLightTask(any()))
        .thenReturn("msg-1");

    var response =
        mockMvc
            .perform(
                post("/internal/rabbit/light-tasks")
                    .with(remoteAddress("198.51.100.10"))
                    .header("X-Internal-API-Token", "secret-token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"customerId\":\"c\",\"payload\":\"{\\\"type\\\":\\\"test\\\"}\",\"aggregateType\":\"a\",\"aggregateId\":\"a\",\"idempotencyKey\":\"id-1\",\"messageId\":\"m-1\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(response).contains("msg-1");
  }

  private RequestPostProcessor remoteAddress(String address) {
    return request -> {
      request.setRemoteAddr(address);
      return request;
    };
  }
}
