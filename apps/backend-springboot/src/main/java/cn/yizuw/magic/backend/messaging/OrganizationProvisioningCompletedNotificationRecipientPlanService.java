package cn.yizuw.magic.backend.messaging;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 组织开通完成通知收件人解析预览；只读中心库，不调用通知 provider。 */
@Service
public class OrganizationProvisioningCompletedNotificationRecipientPlanService {

  private static final List<String> REQUIRED_TABLES =
      List.of("tenant_provisioning_job", "organization_member", "user");

  private final JdbcTemplate centerJdbcTemplate;

  public OrganizationProvisioningCompletedNotificationRecipientPlanService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 生成组织开通完成通知的真实收件人预览。
   *
   * <p>本方法只读取中心库 `tenant_provisioning_job`、`organization_member` 和 `user`，
   * 返回可发送对象的脱敏预览；不连接目标租户库、不写中心库、不发送短信/企微/站内信。
   */
  public Map<String, Object> buildPlan(
      int jobId, String targetCustomerId, String targetDbName, List<String> requestedChannels) {
    List<String> channels = normalizeChannels(requestedChannels);
    try {
      return buildPlanSafely(jobId, targetCustomerId, targetDbName, channels);
    } catch (Exception error) {
      return blockedPlan(
          jobId,
          targetCustomerId,
          targetDbName,
          channels,
          Map.of(),
          List.of("中心库收件人解析失败: " + error.getMessage()),
          null);
    }
  }

  private Map<String, Object> buildPlanSafely(
      int jobId, String targetCustomerId, String targetDbName, List<String> channels) {
    Map<String, Boolean> tableStatus = requiredTableStatus();
    List<String> missingTables =
        tableStatus.entrySet().stream()
            .filter(entry -> !Boolean.TRUE.equals(entry.getValue()))
            .map(Map.Entry::getKey)
            .toList();
    if (!missingTables.isEmpty()) {
      return blockedPlan(
          jobId,
          targetCustomerId,
          targetDbName,
          channels,
          tableStatus,
          List.of("中心库收件人解析表未就绪: " + String.join(",", missingTables)),
          null);
    }

    NotificationJob job = findJob(jobId);
    if (job == null) {
      return blockedPlan(
          jobId,
          targetCustomerId,
          targetDbName,
          channels,
          tableStatus,
          List.of("未找到 tenant_provisioning_job: jobId=" + jobId),
          null);
    }

    List<String> jobBlockedReasons = jobBlockedReasons(job, targetCustomerId, targetDbName);
    if (!jobBlockedReasons.isEmpty()) {
      return blockedPlan(
          jobId,
          targetCustomerId,
          targetDbName,
          channels,
          tableStatus,
          jobBlockedReasons,
          job);
    }

    List<CenterRecipient> members = findActiveMembers(job.sourceOrgId(), job.sourceCustomerId());
    List<CenterRecipient> sendableRecipients =
        members.stream().filter(CenterRecipient::sendable).toList();
    List<String> blockedReasons = memberBlockedReasons(members, sendableRecipients);
    if (sendableRecipients.isEmpty()) {
      Map<String, Object> plan =
          blockedPlan(
              jobId,
              targetCustomerId,
              targetDbName,
              channels,
              tableStatus,
              blockedReasons,
              job);
      plan.put("scannedMemberCount", members.size());
      plan.put("invalidRecipientCount", members.size());
      return plan;
    }

    Map<String, Object> plan =
        basePlan(
            "preview_only", jobId, targetCustomerId, targetDbName, channels, tableStatus, job);
    plan.put("recipientCount", sendableRecipients.size());
    plan.put("scannedMemberCount", members.size());
    plan.put("invalidRecipientCount", members.size() - sendableRecipients.size());
    plan.put("blockedReasons", blockedReasons);
    plan.put("recipients", recipients(sendableRecipients, channels));
    return plan;
  }

  private Map<String, Boolean> requiredTableStatus() {
    Map<String, Boolean> result = new LinkedHashMap<>();
    for (String tableName : REQUIRED_TABLES) {
      result.put(tableName, tableExists(tableName));
    }
    return result;
  }

  private NotificationJob findJob(int jobId) {
    List<NotificationJob> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, initiator_center_user_id, source_org_id, source_customer_id,
                   target_customer_id, target_db_name, status, step
            FROM tenant_provisioning_job
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> job(rs),
            jobId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private List<CenterRecipient> findActiveMembers(Long sourceOrgId, String sourceCustomerId) {
    return centerJdbcTemplate.query(
        """
        SELECT member.id AS member_id,
               member.center_user_id,
               member.member_role,
               member.source_user_id,
               center_user.username AS center_username,
               center_user.real_name AS center_real_name,
               center_user.status AS center_status,
               center_user.customer_type,
               center_user.phone AS center_phone,
               CASE WHEN center_user.id IS NULL THEN 0 ELSE 1 END AS center_user_exists
        FROM organization_member member
        LEFT JOIN `user` center_user
          ON center_user.id = member.center_user_id
        WHERE member.organization_id = ?
          AND member.source_customer_id = ?
          AND member.status = 'active'
        ORDER BY member.member_role DESC, member.id ASC
        """,
        (rs, rowNum) -> recipient(rs),
        sourceOrgId,
        sourceCustomerId);
  }

  private List<Map<String, Object>> recipients(
      List<CenterRecipient> recipients, List<String> channels) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (CenterRecipient recipient : recipients) {
      Map<String, Object> map = new LinkedHashMap<>();
      map.put("centerUserId", recipient.centerUserId());
      map.put("username", recipient.username());
      map.put("realName", recipient.realName());
      map.put("phoneMasked", maskPhone(recipient.phone()));
      map.put("memberRole", recipient.memberRole());
      map.put("recipientScope", recipientScope(recipient.memberRole()));
      map.put("channels", channels);
      map.put("sendEnabled", false);
      map.put("providerCallEnabled", false);
      result.add(map);
    }
    return result;
  }

  private List<String> jobBlockedReasons(
      NotificationJob job, String targetCustomerId, String targetDbName) {
    List<String> reasons = new ArrayList<>();
    if (job.sourceOrgId() == null || job.sourceOrgId() <= 0) {
      reasons.add("tenant_provisioning_job 缺少 sourceOrgId，无法解析组织成员");
    }
    if (!StringUtils.hasText(job.sourceCustomerId())) {
      reasons.add("tenant_provisioning_job 缺少 sourceCustomerId");
    }
    if (!StringUtils.hasText(job.targetCustomerId())) {
      reasons.add("tenant_provisioning_job 缺少 targetCustomerId");
    } else if (!job.targetCustomerId().equals(targetCustomerId)) {
      reasons.add("消息 targetCustomerId 与开通任务不一致");
    }
    if (!StringUtils.hasText(job.targetDbName())) {
      reasons.add("tenant_provisioning_job 缺少 targetDbName");
    } else if (!job.targetDbName().equals(targetDbName)) {
      reasons.add("消息 targetDbName 与开通任务不一致");
    }
    return reasons;
  }

  private List<String> memberBlockedReasons(
      List<CenterRecipient> members, List<CenterRecipient> sendableRecipients) {
    List<String> reasons = new ArrayList<>();
    if (members.isEmpty()) {
      reasons.add("组织 active 成员为空，无法生成收件人");
    }
    long invalidCount = members.size() - sendableRecipients.size();
    if (invalidCount > 0) {
      reasons.add("存在中心账号缺失或停用的组织成员: " + invalidCount);
    }
    if (sendableRecipients.isEmpty()) {
      reasons.add("没有可发送的 active 中心账号");
    }
    return reasons;
  }

  private Map<String, Object> blockedPlan(
      int jobId,
      String targetCustomerId,
      String targetDbName,
      List<String> channels,
      Map<String, Boolean> tableStatus,
      List<String> blockedReasons,
      NotificationJob job) {
    Map<String, Object> plan =
        basePlan("blocked", jobId, targetCustomerId, targetDbName, channels, tableStatus, job);
    plan.put("recipientCount", 0);
    plan.put("scannedMemberCount", 0);
    plan.put("invalidRecipientCount", 0);
    plan.put("blockedReasons", blockedReasons);
    plan.put("recipients", List.of());
    return plan;
  }

  private Map<String, Object> basePlan(
      String status,
      int jobId,
      String targetCustomerId,
      String targetDbName,
      List<String> channels,
      Map<String, Boolean> tableStatus,
      NotificationJob job) {
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", "organization.provisioning.completed.notification.recipient");
    plan.put("templateKey", OrganizationProvisioningCompletedNotificationPlanService.TEMPLATE_KEY);
    plan.put("jobId", jobId);
    plan.put("targetCustomerId", targetCustomerId);
    plan.put("targetDbName", targetDbName);
    plan.put("requestedChannels", channels);
    plan.put("recipientResolutionEnabled", true);
    plan.put("recipientResolutionStatus", status);
    plan.put("centerDbReadOnly", true);
    plan.put("targetDbAccessed", false);
    plan.put("sendEnabled", false);
    plan.put("providerCallEnabled", false);
    plan.put("requiredTableStatus", tableStatus);
    if (job != null) {
      plan.put("initiatorCenterUserId", job.initiatorCenterUserId());
      plan.put("sourceOrgId", job.sourceOrgId());
      plan.put("sourceCustomerId", job.sourceCustomerId());
      plan.put("jobStatus", job.status());
      plan.put("jobStep", job.step());
    }
    return plan;
  }

  private NotificationJob job(ResultSet rs) throws SQLException {
    return new NotificationJob(
        rs.getLong("id"),
        nullableLong(rs, "initiator_center_user_id"),
        nullableLong(rs, "source_org_id"),
        rs.getString("source_customer_id"),
        rs.getString("target_customer_id"),
        rs.getString("target_db_name"),
        rs.getString("status"),
        rs.getString("step"));
  }

  private CenterRecipient recipient(ResultSet rs) throws SQLException {
    return new CenterRecipient(
        rs.getLong("member_id"),
        rs.getLong("center_user_id"),
        rs.getString("member_role"),
        nullableLong(rs, "source_user_id"),
        rs.getString("center_username"),
        rs.getString("center_real_name"),
        nullableInteger(rs, "center_status"),
        rs.getString("customer_type"),
        rs.getString("center_phone"),
        nullableInteger(rs, "center_user_exists"));
  }

  private boolean tableExists(String tableName) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            Long.class,
            tableName);
    return count != null && count > 0;
  }

  private String recipientScope(String memberRole) {
    return "owner".equals(memberRole) ? "organization_owner" : "organization_member";
  }

  private List<String> normalizeChannels(List<String> channels) {
    if (channels == null || channels.isEmpty()) {
      return List.of();
    }
    return channels.stream().filter(StringUtils::hasText).map(String::trim).distinct().toList();
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

  private Long nullableLong(ResultSet rs, String column) throws SQLException {
    Object value = rs.getObject(column);
    return value instanceof Number number ? number.longValue() : null;
  }

  private Integer nullableInteger(ResultSet rs, String column) throws SQLException {
    Object value = rs.getObject(column);
    return value instanceof Number number ? number.intValue() : null;
  }

  private record NotificationJob(
      long id,
      Long initiatorCenterUserId,
      Long sourceOrgId,
      String sourceCustomerId,
      String targetCustomerId,
      String targetDbName,
      String status,
      String step) {}

  private record CenterRecipient(
      long memberId,
      long centerUserId,
      String memberRole,
      Long sourceUserId,
      String username,
      String realName,
      Integer centerStatus,
      String customerType,
      String phone,
      Integer centerUserExists) {

    private boolean sendable() {
      return Integer.valueOf(1).equals(centerUserExists) && Integer.valueOf(1).equals(centerStatus);
    }
  }
}
