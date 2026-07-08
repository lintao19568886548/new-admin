package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 组织开通完成通知 provider 发送前置计划；当前仍不调用短信/企微/站内信。 */
@Service
public class OrganizationProvisioningCompletedNotificationProviderPlanService {

  private final AppProperties appProperties;
  private final OrganizationProvisioningCompletedInAppProviderExecutionPlanService
      inAppProviderExecutionPlanService;

  public OrganizationProvisioningCompletedNotificationProviderPlanService(
      AppProperties appProperties,
      OrganizationProvisioningCompletedInAppProviderExecutionPlanService
          inAppProviderExecutionPlanService) {
    this.appProperties = appProperties;
    this.inAppProviderExecutionPlanService = inAppProviderExecutionPlanService;
  }

  /**
   * 基于收件人预览生成 provider 发送前置计划。
   *
   * <p>本方法只把下一步可能发送的渠道、收件人、幂等键和单渠道灰度条件列出来；
   * 即使安全门和渠道 guard 都满足，也不会调用任何 provider。
   */
  public Map<String, Object> buildPlan(
      int jobId,
      String targetCustomerId,
      String targetDbName,
      String eventId,
      Map<String, Object> recipientPlan,
      List<String> requestedChannels) {
    boolean providerSendEnabled =
        appProperties.getRabbitMq().isOrganizationProvisioningProviderSendEnabled();
    String channelGuard = providerChannelGuard();
    List<String> channels = normalizeChannels(requestedChannels);
    List<Map<String, Object>> recipients = recipients(recipientPlan);
    String recipientStatus = stringValue(recipientPlan.get("recipientResolutionStatus"));
    boolean recipientReady = "preview_only".equals(recipientStatus) && !recipients.isEmpty();
    List<Map<String, Object>> channelPlans =
        channelPlans(jobId, channels, recipients, providerSendEnabled, channelGuard);
    List<Map<String, Object>> readinessMatrix =
        providerReadinessMatrix(providerSendEnabled, recipientReady, channelPlans);

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "organization.provisioning.completed.notification.provider");
    plan.put("planStatus", readyChannels(channelPlans).isEmpty() ? "blocked" : "ready_for_dry_run");
    plan.put("jobId", jobId);
    plan.put("targetCustomerId", targetCustomerId);
    plan.put("targetDbName", targetDbName);
    plan.put("eventId", eventId);
    plan.put("templateKey", OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    plan.put("requestedChannels", channels);
    plan.put("recipientResolutionStatus", recipientStatus);
    plan.put("recipientCount", recipients.size());
    plan.put("providerSendEnabled", providerSendEnabled);
    plan.put("providerChannelGuard", channelGuard);
    plan.put("providerReadyChannels", readyChannels(channelPlans));
    plan.put("providerBlockedChannels", blockedChannels(channelPlans));
    plan.put("providerReadinessMatrix", readinessMatrix);
    plan.put("providerReadinessFailedChecks", failedReadinessChecks(readinessMatrix));
    plan.put("nextAction", nextAction(channelPlans));
    plan.put("providerCallRequested", false);
    plan.put("providerCallExecuted", false);
    plan.put("sendEnabled", false);
    plan.put("dryRun", true);
    plan.put("blockedReasons", blockedReasons(providerSendEnabled, recipientReady, recipientPlan));
    plan.put("channelPlans", channelPlans);
    plan.put("inAppExecutionPlan", inAppProviderExecutionPlanService.buildPlan(plan));
    return plan;
  }

  private List<Map<String, Object>> channelPlans(
      int jobId,
      List<String> channels,
      List<Map<String, Object>> recipients,
      boolean providerSendEnabled,
      String channelGuard) {
    List<Map<String, Object>> plans = new ArrayList<>();
    for (String channel : channels) {
      List<Map<String, Object>> channelRecipients = recipientsForChannel(recipients, channel);
      boolean channelSupported = supportedChannel(channel);
      boolean channelGuardMatched = channel.equals(channelGuard);
      boolean channelReady =
          providerSendEnabled
              && channelSupported
              && channelGuardMatched
              && !channelRecipients.isEmpty();
      Map<String, Object> plan = new LinkedHashMap<>();
      plan.put("channel", channel);
      plan.put("templateKey", OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
      plan.put("idempotencyKey", "organization-provisioning-completed-provider:" + jobId + ":" + channel);
      plan.put("recipientCount", channelRecipients.size());
      plan.put("recipients", channelRecipients);
      plan.put("provider", providerName(channel));
      plan.put("providerSendEnabled", providerSendEnabled);
      plan.put("providerChannelGuard", channelGuard);
      plan.put("channelSupported", channelSupported);
      plan.put("channelGuardMatched", channelGuardMatched);
      plan.put("channelReadyForProviderDryRun", channelReady);
      plan.put("providerCallRequested", false);
      plan.put("providerCallExecuted", false);
      plan.put("sendEnabled", false);
      plan.put(
          "readinessChecks",
          channelReadinessChecks(
              channel, channelRecipients, providerSendEnabled, channelSupported, channelGuardMatched));
      plan.put(
          "blockedReasons",
          channelBlockedReasons(
              channel,
              channelRecipients,
              providerSendEnabled,
              channelSupported,
              channelGuardMatched));
      plans.add(plan);
    }
    return plans;
  }

  private List<Map<String, Object>> providerReadinessMatrix(
      boolean providerSendEnabled,
      boolean recipientReady,
      List<Map<String, Object>> channelPlans) {
    List<Map<String, Object>> matrix = new ArrayList<>();
    matrix.add(
        readinessCheck(
            "provider_send_gate_enabled",
            providerSendEnabled,
            providerSendEnabled
                ? "provider 发送安全门已开启"
                : "RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED 未开启"));
    matrix.add(
        readinessCheck(
            "recipient_plan_ready",
            recipientReady,
            recipientReady ? "收件人解析可用于发送前置校验" : "收件人解析未就绪"));
    matrix.add(
        readinessCheck(
            "single_channel_guard_matched",
            !readyChannels(channelPlans).isEmpty(),
            !readyChannels(channelPlans).isEmpty()
                ? "已有渠道匹配单渠道 guard"
                : "没有渠道同时满足安全门、收件人和单渠道 guard"));
    matrix.add(
        readinessCheck(
            "provider_execution_disabled",
            true,
            "第 164 批仍不调用真实 provider，只输出发送前置矩阵"));
    return matrix;
  }

  private List<Map<String, Object>> channelReadinessChecks(
      String channel,
      List<Map<String, Object>> recipients,
      boolean providerSendEnabled,
      boolean channelSupported,
      boolean channelGuardMatched) {
    List<Map<String, Object>> checks = new ArrayList<>();
    checks.add(
        readinessCheck(
            "provider_send_gate_enabled",
            providerSendEnabled,
            providerSendEnabled ? "provider 发送安全门已开启" : "provider 发送安全门未开启"));
    checks.add(
        readinessCheck(
            "channel_supported",
            channelSupported,
            channelSupported ? "渠道已登记 provider: " + channel : "渠道暂未登记 provider: " + channel));
    checks.add(
        readinessCheck(
            "channel_guard_matched",
            channelGuardMatched,
            channelGuardMatched ? "渠道匹配单渠道 guard" : "渠道未匹配单渠道 guard"));
    checks.add(
        readinessCheck(
            "recipient_available",
            !recipients.isEmpty(),
            recipients.isEmpty() ? "渠道没有可发送收件人" : "渠道存在可发送收件人"));
    checks.add(
        readinessCheck(
            "provider_execution_disabled",
            true,
            "第 164 批仍固定 providerCallExecuted=false"));
    return checks;
  }

  private Map<String, Object> readinessCheck(String name, boolean passed, String note) {
    Map<String, Object> check = new LinkedHashMap<>();
    check.put("name", name);
    check.put("passed", passed);
    check.put("note", note);
    return check;
  }

  private List<String> readyChannels(List<Map<String, Object>> channelPlans) {
    return channelPlans.stream()
        .filter(plan -> Boolean.TRUE.equals(plan.get("channelReadyForProviderDryRun")))
        .map(plan -> stringValue(plan.get("channel")))
        .filter(StringUtils::hasText)
        .toList();
  }

  private List<String> blockedChannels(List<Map<String, Object>> channelPlans) {
    return channelPlans.stream()
        .filter(plan -> !Boolean.TRUE.equals(plan.get("channelReadyForProviderDryRun")))
        .map(plan -> stringValue(plan.get("channel")))
        .filter(StringUtils::hasText)
        .toList();
  }

  private List<String> failedReadinessChecks(List<Map<String, Object>> readinessMatrix) {
    return readinessMatrix.stream()
        .filter(check -> !Boolean.TRUE.equals(check.get("passed")))
        .map(check -> stringValue(check.get("name")))
        .filter(StringUtils::hasText)
        .toList();
  }

  private String nextAction(List<Map<String, Object>> channelPlans) {
    List<String> readyChannels = readyChannels(channelPlans);
    if (readyChannels.isEmpty()) {
      return "fix_provider_readiness_checks_before_single_channel_execution";
    }
    return "ready_for_single_channel_provider_execution_batch_but_current_plan_remains_dry_run";
  }

  private List<Map<String, Object>> recipientsForChannel(
      List<Map<String, Object>> recipients, String channel) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, Object> recipient : recipients) {
      if (!channels(recipient).contains(channel)) {
        continue;
      }
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("centerUserId", recipient.get("centerUserId"));
      item.put("username", recipient.get("username"));
      item.put("realName", recipient.get("realName"));
      item.put("phoneMasked", recipient.get("phoneMasked"));
      item.put("memberRole", recipient.get("memberRole"));
      item.put("recipientScope", recipient.get("recipientScope"));
      result.add(item);
    }
    return result;
  }

  private List<String> blockedReasons(
      boolean providerSendEnabled, boolean recipientReady, Map<String, Object> recipientPlan) {
    List<String> reasons = new ArrayList<>();
    if (!providerSendEnabled) {
      reasons.add("RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_SEND_ENABLED 未开启");
    }
    if (!recipientReady) {
      reasons.add("收件人解析未就绪，provider 发送保持 dry-run");
      reasons.addAll(stringList(recipientPlan.get("blockedReasons")));
    }
    reasons.add("provider 发送执行器尚未接入，本批只生成 dry-run 计划");
    return reasons.stream().filter(StringUtils::hasText).distinct().toList();
  }

  private List<String> channelBlockedReasons(
      String channel,
      List<Map<String, Object>> recipients,
      boolean providerSendEnabled,
      boolean channelSupported,
      boolean channelGuardMatched) {
    List<String> reasons = new ArrayList<>();
    if (!providerSendEnabled) {
      reasons.add("provider 发送安全门未开启");
    }
    if (!channelSupported) {
      reasons.add("渠道 " + channel + " 暂未登记 provider");
    }
    if (!channelGuardMatched) {
      reasons.add("渠道 " + channel + " 未匹配 RABBITMQ_ORGANIZATION_PROVISIONING_PROVIDER_CHANNEL_GUARD");
    }
    if (recipients.isEmpty()) {
      reasons.add("渠道 " + channel + " 没有可发送收件人");
    }
    reasons.add("第 164 批仍固定 providerCallExecuted=false");
    return reasons;
  }

  private boolean supportedChannel(String channel) {
    return "in_app".equals(channel) || "wechat_work".equals(channel) || "sms".equals(channel);
  }

  private String providerName(String channel) {
    return switch (channel) {
      case "in_app" -> "internal_notification";
      case "wechat_work" -> "wework";
      case "sms" -> "sms";
      default -> "unsupported";
    };
  }

  private String providerChannelGuard() {
    String configured =
        appProperties.getRabbitMq().getOrganizationProvisioningProviderChannelGuard();
    if (StringUtils.hasText(configured)) {
      return configured.trim();
    }
    return "in_app";
  }

  private List<Map<String, Object>> recipients(Map<String, Object> recipientPlan) {
    Object value = recipientPlan.get("recipients");
    if (!(value instanceof List<?> values)) {
      return List.of();
    }
    List<Map<String, Object>> result = new ArrayList<>();
    for (Object item : values) {
      if (item instanceof Map<?, ?> map) {
        Map<String, Object> recipient = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
          recipient.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        result.add(recipient);
      }
    }
    return result;
  }

  private List<String> normalizeChannels(List<String> channels) {
    if (channels == null || channels.isEmpty()) {
      return List.of();
    }
    return channels.stream().filter(StringUtils::hasText).map(String::trim).distinct().toList();
  }

  private List<String> channels(Map<String, Object> recipient) {
    return stringList(recipient.get("channels"));
  }

  private List<String> stringList(Object value) {
    if (!(value instanceof List<?> values)) {
      return List.of();
    }
    return values.stream()
        .map(this::stringValue)
        .filter(StringUtils::hasText)
        .map(String::trim)
        .distinct()
        .toList();
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}
