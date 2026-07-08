package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessagePublisher;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** 组织空间开通完成后的轻任务投递器；只投递 RabbitMQ，不直接发送通知或刷新缓存。 */
@Service
public class OrganizationProvisioningCompletedFollowupPublisher {

  public static final String TASK_TYPE = "organization.provisioning.completed.followup";

  private static final ObjectMapper JSON = new ObjectMapper();

  private final RabbitMessagePublisher rabbitMessagePublisher;

  public OrganizationProvisioningCompletedFollowupPublisher(
      RabbitMessagePublisher rabbitMessagePublisher) {
    this.rabbitMessagePublisher = rabbitMessagePublisher;
  }

  /**
   * 投递完成事件后续轻任务。
   *
   * <p>队列消费者后续再拆分通知、Redis 缓存刷新或审计补偿；当前方法只负责把任务可靠放入 light-task 队列。
   */
  public String publish(
      OrganizationProvisioningCompletedConsumeRequest request,
      Map<String, Object> eventPayload,
      int jobId,
      String targetCustomerId,
      String targetDbName) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("event", eventPayload);
    payload.put("eventId", request.eventId());
    payload.put("eventType", request.eventType());
    payload.put("idempotencyKey", request.idempotencyKey());
    payload.put("jobId", jobId);
    payload.put("source", "organization_provisioning_completed_consumer");
    payload.put("taskType", TASK_TYPE);
    payload.put("targetCustomerId", targetCustomerId);
    payload.put("targetDbName", targetDbName);

    return rabbitMessagePublisher.publishLightTask(
        new RabbitMessageRequest(
            String.valueOf(jobId),
            "tenant_provisioning_job",
            targetCustomerId,
            Map.of(
                "eventId",
                request.eventId(),
                "eventType",
                request.eventType(),
                "source",
                "organization_provisioning_completed_consumer",
                "taskType",
                TASK_TYPE),
            "organization-provisioning-completed-followup:" + jobId,
            "organization-provisioning-completed-followup-" + jobId,
            toJson(payload),
            null));
  }

  private String toJson(Map<String, Object> payload) {
    try {
      return JSON.writeValueAsString(payload);
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "组织开通完成轻任务序列化失败");
    }
  }
}
