package cn.yizuw.magic.backend.sms;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessagePublisher;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageRequest;
import cn.yizuw.magic.backend.park.ParkScopeService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 短信任务服务。
 *
 * <p>旧 Nitro 在接口内直接调用联麓短信并更新 `send_message`。Spring Boot 迁移期只把任务投递 RabbitMQ，
 * 不直接外呼、不写真实发送时间，避免切流时产生不可回滚的外部副作用。
 */
@Service
@Transactional(readOnly = true)
public class SmsService {

  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private final ParkScopeService parkScopeService;
  private final RabbitMessagePublisher rabbitMessagePublisher;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public SmsService(
      ParkScopeService parkScopeService,
      RabbitMessagePublisher rabbitMessagePublisher,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.parkScopeService = parkScopeService;
    this.rabbitMessagePublisher = rabbitMessagePublisher;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /** 单条合同提醒短信排队；只校验登录态、必要参数和租户园区权限。 */
  public Map<String, Object> enqueueContractReminder(SmsSendRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    String tenantName = requiredText(request == null ? null : request.tenantName(), "租户名称不能为空");
    String contractEndDate =
        requiredText(request == null ? null : request.contractEndDate(), "合同到期时间不能为空");
    String phoneNumber = normalizePhone(request == null ? null : request.phoneNumber());
    int rentalTenantId = positiveInt(request == null ? null : request.rentalTenantId(), "租户ID不能为空");

    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    Map<String, Object> tenant = findTenantForReminder(jdbcTemplate, rentalTenantId);
    Integer parkId = numberOrNull(tenant.get("parkId"));
    if (parkId != null && !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有查看权限");
    }

    Map<String, Object> task =
        contractReminderTask(
            rentalTenantId,
            tenantName,
            phoneNumber,
            textOrDefault(request.increaseDate(), ""),
            contractEndDate,
            parkId);
    String messageId = publishSmsTask(payload.customerId(), task);
    return Map.of(
        "data", Map.of("messageId", messageId, "transport", "rabbitmq"),
        "message", "短信已加入发送队列",
        "rentalTenantId", rentalTenantId,
        "tenantName", tenantName);
  }

  /** 批量扫描授权园区内合同即将到期或递增临近的租户，并把提醒短信逐条排队。 */
  public Map<String, Object> enqueueBulkContractReminders() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    List<Map<String, Object>> candidates = findBulkCandidates(jdbcTemplate, authorizedParkIds);
    List<Map<String, Object>> results = new ArrayList<>();
    List<Map<String, Object>> errors = new ArrayList<>();

    for (Map<String, Object> candidate : candidates) {
      try {
        String phoneNumber = normalizePhone(stringValue(candidate.get("phoneNumber")));
        int tenantId = number(candidate.get("rentalTenantId"));
        Map<String, Object> task =
            contractReminderTask(
                tenantId,
                stringValue(candidate.get("tenantName")),
                phoneNumber,
                nextIncreaseDate(candidate),
                stringValue(candidate.get("contractEndDate")),
                numberOrNull(candidate.get("parkId")));
        String messageId = publishSmsTask(payload.customerId(), task);
        results.add(
            Map.of(
                "messageId", messageId,
                "phoneNumber", phoneNumber,
                "success", true,
                "tenantId", tenantId,
                "tenantName", stringValue(candidate.get("tenantName"))));
      } catch (Exception error) {
        errors.add(
            Map.of(
                "error", error.getMessage() == null ? "短信任务排队失败" : error.getMessage(),
                "phoneNumber", stringValue(candidate.get("phoneNumber")),
                "success", false,
                "tenantId", candidate.getOrDefault("rentalTenantId", 0),
                "tenantName", stringValue(candidate.get("tenantName"))));
      }
    }

    return Map.of(
        "data",
        Map.of(
            "errors", errors,
            "failed", errors.size(),
            "results", results,
            "success", results.size(),
            "total", candidates.size(),
            "transport", "rabbitmq"),
        "message",
        candidates.isEmpty()
            ? "没有符合条件的租户需要发送短信"
            : "批量短信任务已加入发送队列，成功: " + results.size() + "，失败: " + errors.size());
  }

  private Map<String, Object> findTenantForReminder(JdbcTemplate jdbcTemplate, int rentalTenantId) {
    List<Map<String, Object>> rows =
        jdbcTemplate.queryForList(
            """
            SELECT rental_tenant_id AS rentalTenantId, tenant_name AS tenantName, phone_number AS phoneNumber,
                   park_id AS parkId
            FROM rental_tenant
            WHERE rental_tenant_id = ? AND is_deleted = false
            LIMIT 1
            """,
            rentalTenantId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "租户不存在");
    }
    return rows.get(0);
  }

  private List<Map<String, Object>> findBulkCandidates(
      JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {
    if (authorizedParkIds.isEmpty()) {
      return List.of();
    }
    LocalDate today = LocalDate.now();
    LocalDate contractDeadline = today.plusDays(90);
    List<Object> args = new ArrayList<>(authorizedParkIds);
    args.add(Timestamp.valueOf(today.atStartOfDay()));
    args.add(Timestamp.valueOf(contractDeadline.plusDays(1).atStartOfDay()));
    String sql =
        """
        SELECT rental_tenant_id AS rentalTenantId, tenant_name AS tenantName, phone_number AS phoneNumber,
               contract_start AS contractStart, contract_end AS contractEnd, increase_data AS increaseData,
               increase_date AS increaseDate, park_id AS parkId
        FROM rental_tenant
        WHERE is_deleted = false
          AND transaction_type = true
          AND park_id IN (
        """
            + placeholders(authorizedParkIds.size())
            + """
          )
          AND contract_end > ?
          AND contract_end <= ?
        ORDER BY contract_end ASC
        LIMIT 200
        """;
    return jdbcTemplate.query(sql, (rs, rowNum) -> bulkCandidateMap(rs), args.toArray());
  }

  private Map<String, Object> bulkCandidateMap(java.sql.ResultSet rs) throws java.sql.SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("contractEndDate", localDate(rs.getTimestamp("contractEnd")));
    map.put("contractStartDate", localDate(rs.getTimestamp("contractStart")));
    map.put("increaseData", rs.getString("increaseData"));
    map.put("increaseDate", localDate(rs.getTimestamp("increaseDate")));
    map.put("parkId", rs.getObject("parkId"));
    map.put("phoneNumber", rs.getString("phoneNumber"));
    map.put("rentalTenantId", rs.getInt("rentalTenantId"));
    map.put("tenantName", rs.getString("tenantName"));
    return map;
  }

  private Map<String, Object> contractReminderTask(
      int rentalTenantId,
      String tenantName,
      String phoneNumber,
      String increaseDate,
      String contractEndDate,
      Integer parkId) {
    Map<String, Object> task = new LinkedHashMap<>();
    task.put("contractEndDate", contractEndDate);
    task.put("increaseDate", increaseDate);
    task.put("phoneNumber", phoneNumber);
    task.put("rentalTenantId", rentalTenantId);
    task.put("parkId", parkId);
    task.put("source", "contract_reminder_sms");
    task.put("tenantName", tenantName);
    task.put(
        "template",
        "尊敬的{%1%}，您好！您的合同递增比例将于 {%2%} 进行变更，合同到期日是{%3%}，请留意查收。");
    return task;
  }

  private String publishSmsTask(String customerId, Map<String, Object> task) {
    try {
      String tenantId = String.valueOf(task.get("rentalTenantId"));
      return rabbitMessagePublisher.publishNotification(
          new RabbitMessageRequest(
              tenantId,
              "contract_reminder_sms",
              customerId,
              Map.of("source", "springboot_migration"),
              "contract-reminder-sms:" + tenantId,
              null,
              OBJECT_MAPPER.writeValueAsString(task),
              null));
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "短信任务投递失败");
    }
  }

  private String nextIncreaseDate(Map<String, Object> candidate) {
    Object explicit = candidate.get("increaseDate");
    return explicit == null ? "" : stringValue(explicit);
  }

  private String normalizePhone(String value) {
    String phone = value == null ? "" : value.trim();
    if (!phone.matches("\\d{11}")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请输入11位手机号");
    }
    return phone;
  }

  private String requiredText(String value, String message) {
    if (!StringUtils.hasText(value)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return value.trim();
  }

  private String textOrDefault(String value, String fallback) {
    return StringUtils.hasText(value) ? value.trim() : fallback;
  }

  private int positiveInt(Object value, String message) {
    int number = number(value);
    if (number <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return number;
  }

  private int number(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value != null && StringUtils.hasText(String.valueOf(value))) {
      try {
        return Integer.parseInt(String.valueOf(value).trim());
      } catch (NumberFormatException ignored) {
        return 0;
      }
    }
    return 0;
  }

  private Integer numberOrNull(Object value) {
    int number = number(value);
    return number > 0 ? number : null;
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String localDate(Timestamp timestamp) {
    if (timestamp == null) {
      return "";
    }
    return timestamp.toInstant().atZone(ZoneId.systemDefault()).toLocalDate().format(DATE_FORMATTER);
  }

  private String placeholders(int size) {
    return String.join(", ", java.util.Collections.nCopies(size, "?"));
  }
}
