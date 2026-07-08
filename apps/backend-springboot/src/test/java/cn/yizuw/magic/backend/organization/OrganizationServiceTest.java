package cn.yizuw.magic.backend.organization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.messaging.BusinessOutboxPublisher;
import cn.yizuw.magic.backend.messaging.OrganizationProvisioningRequeuedEvent;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantContext;
import cn.yizuw.magic.backend.tenant.TenantDataSourceRegistry;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 组织服务 outbox 联动测试；不连接真实中心库或租户库。 */
class OrganizationServiceTest {

  private BusinessOutboxPublisher businessOutboxPublisher;
  private OrganizationRepository organizationRepository;
  private OrganizationService organizationService;

  @BeforeEach
  void setUp() {
    businessOutboxPublisher = org.mockito.Mockito.mock(BusinessOutboxPublisher.class);
    organizationRepository = org.mockito.Mockito.mock(OrganizationRepository.class);
    organizationService =
        new OrganizationService(
            new AppProperties(),
            businessOutboxPublisher,
            organizationRepository,
            org.mockito.Mockito.mock(TenantDataSourceRegistry.class));
    TenantContext.set(
        new UserTokenPayload(
            1001L,
            "default",
            "default",
            2002L,
            List.of(),
            null,
            null,
            List.of("Super"),
            1L,
            "admin"));
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void requeueFailedManualJobPublishesOutboxWhenExecuted() {
    OrganizationProvisioningRequeueRequest request =
        new OrganizationProvisioningRequeueRequest(
            "requeue_failed_manual:31:org001", true, 31, "已修复配置");
    when(organizationRepository.requeueFailedManualJob(request, "admin"))
        .thenReturn(executedRequeueResult());
    when(businessOutboxPublisher.publishOrganizationProvisioningRequeued(
            org.mockito.ArgumentMatchers.any()))
        .thenReturn("evt_org_requeued_1");

    Map<String, Object> result = organizationService.requeueFailedManualJob(request);

    assertThat(result)
        .containsEntry("execute", true)
        .containsEntry("outboxEventId", "evt_org_requeued_1")
        .containsEntry("outboxEventQueued", true);
    ArgumentCaptor<OrganizationProvisioningRequeuedEvent> captor =
        ArgumentCaptor.forClass(OrganizationProvisioningRequeuedEvent.class);
    verify(businessOutboxPublisher).publishOrganizationProvisioningRequeued(captor.capture());
    OrganizationProvisioningRequeuedEvent event = captor.getValue();
    assertThat(event.initiatorCenterUserId()).isEqualTo(1001);
    assertThat(event.jobId()).isEqualTo(31);
    assertThat(event.lastPaymentOutTradeNo()).isEqualTo("wxapp_1");
    assertThat(event.operator()).isEqualTo("admin");
    assertThat(event.previousStatus()).isEqualTo("failed_manual");
    assertThat(event.requeuedAt()).isEqualTo("2026-07-02T11:00:00+08:00");
    assertThat(event.sourceCustomerId()).isEqualTo("public");
    assertThat(event.sourceOrgId()).isEqualTo(7);
    assertThat(event.status()).isEqualTo("pending");
    assertThat(event.step()).isEqualTo("manual_requeued");
    assertThat(event.targetCustomerId()).isEqualTo("org001");
    assertThat(event.targetDbName()).isEqualTo("tenant_org001");
  }

  @Test
  void requeueFailedManualJobDoesNotPublishOutboxInPreviewMode() {
    OrganizationProvisioningRequeueRequest request =
        new OrganizationProvisioningRequeueRequest(null, false, 31, "预览");
    when(organizationRepository.requeueFailedManualJob(request, "admin"))
        .thenReturn(
            Map.of(
                "confirmation",
                "requeue_failed_manual:31:org001",
                "execute",
                false,
                "job",
                Map.of("id", 31, "status", "failed_manual"),
                "message",
                "预览模式，未写入。"));

    Map<String, Object> result = organizationService.requeueFailedManualJob(request);

    assertThat(result).containsEntry("execute", false).doesNotContainKey("outboxEventId");
    verify(businessOutboxPublisher, never())
        .publishOrganizationProvisioningRequeued(org.mockito.ArgumentMatchers.any());
  }

  private Map<String, Object> executedRequeueResult() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("confirmation", "requeue_failed_manual:31:org001");
    result.put("execute", true);
    result.put("job", job("pending", "manual_requeued"));
    result.put("message", "任务已重置为 pending，worker 下一轮将全量重建目标库。");
    result.put("operator", "admin");
    result.put("organization", Map.of("id", 7, "name", "测试组织"));
    result.put("previousJob", job("failed_manual", "failed"));
    return result;
  }

  private Map<String, Object> job(String status, String step) {
    Map<String, Object> job = new LinkedHashMap<>();
    job.put("id", 31);
    job.put("initiatorCenterUserId", 1001);
    job.put("lastPaymentOutTradeNo", "wxapp_1");
    job.put("sourceCustomerId", "public");
    job.put("sourceOrgId", 7);
    job.put("status", status);
    job.put("step", step);
    job.put("targetCustomerId", "org001");
    job.put("targetDbName", "tenant_org001");
    job.put("updateTime", "2026-07-02T11:00:00+08:00");
    return job;
  }
}
