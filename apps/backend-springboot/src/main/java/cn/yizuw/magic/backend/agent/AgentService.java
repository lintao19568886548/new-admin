package cn.yizuw.magic.backend.agent;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** Agent 工作台只读服务，统一处理登录态、租户库和分页参数。 */
@Service
public class AgentService {

  private static final Set<String> ALLOWED_MODELS =
      Set.of("qwen3.5-plus", "qwen-long", "qwen-max", "qwen-plus", "qwen-turbo");
  private static final Map<String, String> AGENT_CODE_ALIASES =
      Map.ofEntries(
          Map.entry("bill", "bill_finance"),
          Map.entry("bill_finance", "bill_finance"),
          Map.entry("crm", "crm_sales"),
          Map.entry("crm_sales", "crm_sales"),
          Map.entry("investment_radar", "investment_radar"),
          Map.entry("maintenance", "maintenance"),
          Map.entry("operations", "operations"),
          Map.entry("rental_asset", "rental_asset"),
          Map.entry("system_ops", "system_ops"));
  private static final int MAX_MESSAGE_CHARS = 4000;

  private final AgentRepository agentRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public AgentService(
      AgentRepository agentRepository, TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.agentRepository = agentRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /** Skill 列表只来自本地注册定义，不访问模型供应商。 */
  public Map<String, Object> getSkills() {
    TenantRequired.currentUser();
    return agentRepository.listSkills();
  }

  /** 当前用户任务列表；page 兼容旧端 currentPage/page 两种入参。 */
  public Map<String, Object> getTasks(
      Integer currentPage, Integer page, Integer pageSize, String status) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    int normalizedPage = PageRequestParams.normalizePage(currentPage == null ? page : currentPage, 1);
    int normalizedPageSize = Math.min(PageRequestParams.normalizePageSize(pageSize, 20), 100);
    return agentRepository.listTasks(
        jdbcTemplate, payload.id(), normalizedPage, normalizedPageSize, blankToNull(status));
  }

  /** 当前用户任务详情；旧端不存在或无权限统一返回 404。 */
  public Map<String, Object> getTaskDetail(String taskId) {
    if (!StringUtils.hasText(taskId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "任务ID不能为空");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Map<String, Object> detail =
        agentRepository.findTaskDetail(jdbcTemplate, taskId.trim(), payload.id());
    if (detail == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "任务不存在或无权访问");
    }
    return detail;
  }

  /**
   * Agent Chat 本地兼容响应。
   *
   * <p>旧端会执行 Agent runner 并调用 LLM；这里只校验入参并返回任务形态的本地回复，避免切流后产生模型费用、
   * 长耗时和任务副作用。
   */
  public Map<String, Object> chat(AgentChatRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    List<Map<String, Object>> messages = normalizedMessages(request == null ? null : request.messages());
    if (messages.isEmpty() || !"user".equals(messages.get(messages.size() - 1).get("role"))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请输入要发送给 Agent 的内容");
    }
    String requestedAgentId = text(request == null ? null : request.agentId());
    String agentCode =
        AGENT_CODE_ALIASES.getOrDefault(StringUtils.hasText(requestedAgentId) ? requestedAgentId : "", "operations");
    String model = normalizedModel(request == null ? null : request.model());
    String taskId = "local_agt_" + UUID.randomUUID().toString().replace("-", "");
    String createdAt = Instant.now().toString();
    String latestQuestion = String.valueOf(messages.get(messages.size() - 1).get("content"));
    String reply =
        "已收到你的 Agent 请求。当前 Spring Boot 迁移期不会调用外部大模型或执行任务，"
            + "请先在对应业务模块核对数据；需要真实 Agent 执行时再切到后续专项接口。"
            + (StringUtils.hasText(latestQuestion) ? "\n\n问题摘要：" + latestQuestion : "");

    Map<String, Object> task = new LinkedHashMap<>();
    task.put("agentCode", agentCode);
    task.put("createTime", createdAt);
    task.put("currentStepNo", null);
    task.put("errorMessage", null);
    task.put("finishedAt", createdAt);
    task.put("id", taskId);
    task.put("input", Map.of("context", request == null || request.context() == null ? Map.of() : request.context()));
    task.put("organizationId", null);
    task.put("parkId", null);
    task.put("plan", Map.of("agentCode", agentCode, "steps", List.of(), "summary", "local_stub"));
    task.put("result", Map.of("externalCall", false, "reply", reply));
    task.put("sourceModule", "agent");
    task.put("sourcePage", "dashboard-agent-workbench");
    task.put("sourceRecordId", null);
    task.put("startedAt", createdAt);
    task.put("status", "succeeded");
    task.put("updateTime", createdAt);
    task.put("userId", payload.id());

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("agentId", StringUtils.hasText(requestedAgentId) ? requestedAgentId : agentCode);
    result.put("agentCode", agentCode);
    result.put("createdAt", createdAt);
    result.put("model", model);
    result.put("reply", reply);
    result.put("result", Map.of("externalCall", false, "mode", "local_stub", "reply", reply));
    result.put("status", "succeeded");
    result.put("steps", List.of());
    result.put("task", task);
    result.put("taskId", taskId);
    result.put("usage", null);
    return result;
  }

  private String blankToNull(String value) {
    String text = value == null ? "" : value.trim();
    return StringUtils.hasText(text) ? text : null;
  }

  private List<Map<String, Object>> normalizedMessages(List<Map<String, Object>> messages) {
    if (messages == null) {
      return List.of();
    }
    return messages.stream()
        .map(
            item -> {
              String content = text(item == null ? null : item.get("content")).replace("\u0000", "").trim();
              if (!StringUtils.hasText(content)) {
                return null;
              }
              String role = text(item.get("role"));
              if (!Set.of("assistant", "system", "user").contains(role)) {
                role = "user";
              }
              return Map.<String, Object>of(
                  "content", content.substring(0, Math.min(content.length(), MAX_MESSAGE_CHARS)),
                  "role", role);
            })
        .filter(item -> item != null && StringUtils.hasText(String.valueOf(item.get("content"))))
        .skip(Math.max(0, messages.size() - 16L))
        .toList();
  }

  private String normalizedModel(Object value) {
    String model = text(value);
    return ALLOWED_MODELS.contains(model) ? model : "qwen3.5-plus";
  }

  private String text(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }
}
