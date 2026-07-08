package cn.yizuw.magic.backend.messaging;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 共享 notification 队列的通用路由 dry-run；不监听队列、不调用任何 provider。 */
@Service
public class NotificationRoutingPlanService {

  public static final String ROUTE_BILL_COLLECTION_SMS = "bill_collection_sms";
  public static final String ROUTE_CONTRACT_REMINDER_SMS = "contract_reminder_sms";
  public static final String ROUTE_LOGIN_SMS_CODE = "login_sms_code";
  public static final String ROUTE_ORGANIZATION_PROVISIONING_COMPLETED =
      "organization_provisioning_completed";
  public static final String ROUTE_PAGE_ACCESS_SMS_CODE = "page_access_sms_code";
  public static final String ROUTE_UNKNOWN = "unknown";

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  /**
   * 生成共享通知消息的路由计划。
   *
   * <p>本方法只根据 RabbitMQ headers 和 payload 解析消息归属，返回后续 consumer 应交给哪个专用服务；
   * 不 ack/nack 消息、不写消费日志、不发送短信/企微/站内信。
   */
  public Map<String, Object> buildPlan(
      String messageId, Map<String, Object> headers, String payload) {
    Map<String, Object> normalizedHeaders = normalizeHeaders(headers);
    Map<String, Object> body = parsePayload(payload);
    String route = route(normalizedHeaders, body);
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "notification.routing");
    plan.put("planStatus", "dry_run");
    plan.put("messageId", messageId);
    plan.put("route", route);
    plan.put("routeSupported", !ROUTE_UNKNOWN.equals(route));
    plan.put("ackStrategy", "defer_to_dedicated_consumer");
    plan.put("providerCallEnabled", false);
    plan.put("providerCallExecuted", false);
    plan.put("queueMutationExecuted", false);
    plan.put("consumerGroup", consumerGroup(route));
    plan.put("handlerBean", handlerBean(route));
    plan.put("blockedReasons", blockedReasons(route, normalizedHeaders, body));
    plan.put("headers", normalizedHeaders);
    plan.put("payloadPreview", payloadPreview(body));
    return plan;
  }

  private String route(Map<String, Object> headers, Map<String, Object> payload) {
    String eventType = stringValue(headers.get("eventType"));
    String templateKey = stringValue(headers.get("templateKey"));
    String source = stringValue(payload.get("source"));
    String payloadTemplateKey = stringValue(payload.get("templateKey"));
    if (OrganizationProvisioningCompletedNotificationPlanService.PLAN_TYPE.equals(eventType)
        && OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY.equals(
            templateKey)) {
      return ROUTE_ORGANIZATION_PROVISIONING_COMPLETED;
    }
    if ("contract_reminder_sms".equals(eventType) || "contract_reminder_sms".equals(source)) {
      return ROUTE_CONTRACT_REMINDER_SMS;
    }
    if ("amount.bill.collection.sms".equals(eventType)
        || "amount_bill_collection_sms".equals(templateKey)
        || "amount_bill_collection_sms".equals(payloadTemplateKey)) {
      return ROUTE_BILL_COLLECTION_SMS;
    }
    if ("login_sms_code".equals(eventType) || "login_sms_code".equals(source)) {
      return ROUTE_LOGIN_SMS_CODE;
    }
    if ("page_access_sms_code".equals(eventType) || "page_access_sms_code".equals(source)) {
      return ROUTE_PAGE_ACCESS_SMS_CODE;
    }
    return ROUTE_UNKNOWN;
  }

  private String consumerGroup(String route) {
    return switch (route) {
      case ROUTE_ORGANIZATION_PROVISIONING_COMPLETED ->
          OrganizationProvisioningCompletedNotificationConsumerService.CONSUMER_GROUP;
      case ROUTE_CONTRACT_REMINDER_SMS -> "notification-contract-reminder-sms";
      case ROUTE_BILL_COLLECTION_SMS -> "notification-bill-collection-sms";
      case ROUTE_LOGIN_SMS_CODE -> "notification-login-sms-code";
      case ROUTE_PAGE_ACCESS_SMS_CODE -> "notification-page-access-sms-code";
      default -> "";
    };
  }

  private String handlerBean(String route) {
    return switch (route) {
      case ROUTE_ORGANIZATION_PROVISIONING_COMPLETED ->
          "organizationProvisioningCompletedNotificationConsumerService";
      case ROUTE_CONTRACT_REMINDER_SMS -> "contractReminderSmsNotificationConsumer";
      case ROUTE_BILL_COLLECTION_SMS -> "billCollectionSmsNotificationConsumer";
      case ROUTE_LOGIN_SMS_CODE -> "loginSmsCodeNotificationConsumer";
      case ROUTE_PAGE_ACCESS_SMS_CODE -> "pageAccessSmsCodeNotificationConsumer";
      default -> "";
    };
  }

  private List<String> blockedReasons(
      String route, Map<String, Object> headers, Map<String, Object> payload) {
    if (ROUTE_UNKNOWN.equals(route)) {
      return List.of("无法识别 notification 消息类型，不能由通用 consumer 静默 ack");
    }
    if (ROUTE_ORGANIZATION_PROVISIONING_COMPLETED.equals(route)) {
      return List.of("组织开通完成通知仍由专用 consumer 单独灰度");
    }
    return List.of("专用 notification consumer 尚未接入，本批只生成路由 dry-run");
  }

  private Map<String, Object> payloadPreview(Map<String, Object> payload) {
    Map<String, Object> preview = new LinkedHashMap<>();
    putIfPresent(preview, "jobId", payload.get("jobId"));
    putIfPresent(preview, "targetCustomerId", payload.get("targetCustomerId"));
    putIfPresent(preview, "targetDbName", payload.get("targetDbName"));
    putIfPresent(preview, "source", payload.get("source"));
    putIfPresent(preview, "templateKey", payload.get("templateKey"));
    putIfPresent(preview, "phoneMasked", maskPhone(stringValue(payload.get("phoneNumber"))));
    return preview;
  }

  private Map<String, Object> normalizeHeaders(Map<String, Object> headers) {
    Map<String, Object> result = new LinkedHashMap<>();
    if (headers == null) {
      return result;
    }
    putIfPresent(result, "eventId", headers.get("eventId"));
    putIfPresent(result, "eventType", headers.get("eventType"));
    putIfPresent(result, "idempotencyKey", headers.get("idempotencyKey"));
    putIfPresent(result, "templateKey", headers.get("templateKey"));
    putIfPresent(result, "source", headers.get("source"));
    return result;
  }

  private Map<String, Object> parsePayload(String payload) {
    if (!StringUtils.hasText(payload)) {
      return Map.of();
    }
    try {
      Map<String, Object> result = JSON.readValue(payload, MAP_TYPE);
      return result == null ? Map.of() : result;
    } catch (Exception ignored) {
      return Map.of("payloadParseStatus", "invalid_json");
    }
  }

  private void putIfPresent(Map<String, Object> target, String key, Object value) {
    if (value == null) {
      return;
    }
    if (value instanceof String text && !StringUtils.hasText(text)) {
      return;
    }
    target.put(key, value);
  }

  private String maskPhone(String phone) {
    if (!StringUtils.hasText(phone)) {
      return "";
    }
    String text = phone.trim();
    if (text.length() >= 7) {
      return text.substring(0, 3) + "****" + text.substring(text.length() - 4);
    }
    if (text.length() <= 2) {
      return "*".repeat(text.length());
    }
    return text.charAt(0) + "****" + text.charAt(text.length() - 1);
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}
