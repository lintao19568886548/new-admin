package cn.yizuw.magic.backend.agent;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import cn.yizuw.magic.backend.common.BusinessException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/** Agent 工作台数据访问层；本批只读任务表，不执行 Agent 计划。 */
@Repository
public class AgentRepository {

  private static final String AGENT_SCHEMA_NOT_READY_MESSAGE =
      "Agent 数据表未创建，请先由用户确认后手动执行 Prisma db push";
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final TypeReference<Map<String, Object>> JSON_OBJECT_TYPE = new TypeReference<>() {};

  /** 返回与旧端内置注册表一致的 Skill 列表。 */
  public Map<String, Object> listSkills() {
    return Map.of(
        "items",
        List.of(
            skillMap(
                "llm_chat_response",
                "工作台业务回复",
                "将 Agent 工作台消息发送给统一 LLM Adapter 并返回业务回复",
                null,
                "low",
                false,
                true)));
  }

  /** 查询当前用户 Agent 任务列表，保持旧接口只看本人任务的权限边界。 */
  public Map<String, Object> listTasks(
      JdbcTemplate jdbcTemplate, Long userId, int currentPage, int pageSize, String status) {
    ensureAgentTaskTable(jdbcTemplate);
    List<Object> args = new ArrayList<>();
    StringBuilder where = new StringBuilder("WHERE user_id = ?");
    args.add(userId);
    if (StringUtils.hasText(status)) {
      where.append(" AND status = ?");
      args.add(status.trim());
    }

    Long total =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM agent_task " + where, Long.class, args.toArray());
    List<Object> pageArgs = new ArrayList<>(args);
    pageArgs.add(pageSize);
    pageArgs.add((currentPage - 1) * pageSize);
    List<Map<String, Object>> items =
        jdbcTemplate.query(
            "SELECT * FROM agent_task " + where + " ORDER BY create_time DESC LIMIT ? OFFSET ?",
            (rs, rowNum) -> taskMap(rs),
            pageArgs.toArray());
    return Map.of("items", items, "total", total == null ? 0 : total);
  }

  /** 查询任务详情和步骤；找不到本人任务时返回 null，由 Service 转成旧端 404。 */
  public Map<String, Object> findTaskDetail(
      JdbcTemplate jdbcTemplate, String taskId, Long userId) {
    ensureAgentTaskTable(jdbcTemplate);
    ensureAgentTaskStepTable(jdbcTemplate);
    List<Map<String, Object>> taskRows =
        jdbcTemplate.query(
            """
            SELECT *
            FROM agent_task
            WHERE id = ? AND user_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> taskMap(rs),
            taskId,
            userId);
    if (taskRows.isEmpty()) {
      return null;
    }
    List<Map<String, Object>> steps =
        jdbcTemplate.query(
            """
            SELECT *
            FROM agent_task_step
            WHERE task_id = ?
            ORDER BY step_no ASC
            """,
            (rs, rowNum) -> stepMap(rs),
            taskId);
    return Map.of("steps", steps, "task", taskRows.get(0));
  }

  private Map<String, Object> skillMap(
      String name,
      String title,
      String description,
      String permissionCode,
      String riskLevel,
      boolean requiresApproval,
      boolean enabled) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("description", description);
    map.put("enabled", enabled);
    map.put("name", name);
    map.put("permissionCode", permissionCode);
    map.put("requiresApproval", requiresApproval);
    map.put("riskLevel", riskLevel);
    map.put("title", title);
    return map;
  }

  private void ensureAgentTaskTable(JdbcTemplate jdbcTemplate) {
    Set<String> columns = columnSet(jdbcTemplate, "agent_task");
    if (!columns.contains("id") || !columns.contains("user_id")) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, AGENT_SCHEMA_NOT_READY_MESSAGE);
    }
  }

  private void ensureAgentTaskStepTable(JdbcTemplate jdbcTemplate) {
    Set<String> columns = columnSet(jdbcTemplate, "agent_task_step");
    if (!columns.contains("id") || !columns.contains("task_id")) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, AGENT_SCHEMA_NOT_READY_MESSAGE);
    }
  }

  private Set<String> columnSet(JdbcTemplate jdbcTemplate, String tableName) {
    return jdbcTemplate
        .queryForList(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            String.class,
            tableName)
        .stream()
        .map(name -> name.toLowerCase(Locale.ROOT))
        .collect(Collectors.toUnmodifiableSet());
  }

  private Map<String, Object> taskMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("agentCode", safeString(rs, "agent_code"));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("currentStepNo", safeInteger(rs, "current_step_no"));
    map.put("errorMessage", safeString(rs, "error_message"));
    map.put("finishedAt", toIso(safeTimestamp(rs, "finished_at")));
    map.put("id", safeString(rs, "id"));
    map.put("input", jsonObject(safeObject(rs, "input"), Map.of()));
    map.put("organizationId", safeInteger(rs, "organization_id"));
    map.put("parkId", safeInteger(rs, "park_id"));
    map.put("plan", jsonObject(safeObject(rs, "plan"), null));
    map.put("result", jsonObject(safeObject(rs, "result"), null));
    map.put("sourceModule", safeString(rs, "source_module"));
    map.put("sourcePage", safeString(rs, "source_page"));
    map.put("sourceRecordId", safeString(rs, "source_record_id"));
    map.put("startedAt", toIso(safeTimestamp(rs, "started_at")));
    map.put("status", defaultString(safeString(rs, "status"), "pending"));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    map.put("userId", safeInteger(rs, "user_id"));
    return map;
  }

  private Map<String, Object> stepMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("approvalId", safeString(rs, "approval_id"));
    map.put("createTime", toIso(safeTimestamp(rs, "create_time")));
    map.put("durationMs", safeInteger(rs, "duration_ms"));
    map.put("errorMessage", safeString(rs, "error_message"));
    map.put("finishedAt", toIso(safeTimestamp(rs, "finished_at")));
    map.put("id", safeString(rs, "id"));
    map.put("input", jsonObject(safeObject(rs, "input"), null));
    map.put("output", jsonObject(safeObject(rs, "output"), null));
    map.put("requiresApproval", toBoolean(safeObject(rs, "requires_approval")));
    map.put("riskLevel", defaultString(safeString(rs, "risk_level"), "low"));
    map.put("skillName", safeString(rs, "skill_name"));
    map.put("startedAt", toIso(safeTimestamp(rs, "started_at")));
    map.put("status", defaultString(safeString(rs, "status"), "pending"));
    map.put("stepName", defaultString(safeString(rs, "step_name"), ""));
    map.put("stepNo", safeInteger(rs, "step_no"));
    map.put("taskId", safeString(rs, "task_id"));
    map.put("updateTime", toIso(safeTimestamp(rs, "update_time")));
    return map;
  }

  private Map<String, Object> jsonObject(Object value, Map<String, Object> fallback) {
    if (value == null) {
      return fallback;
    }
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> result = new LinkedHashMap<>();
      map.forEach((key, rawValue) -> result.put(String.valueOf(key), rawValue));
      return result;
    }
    try {
      Map<String, Object> parsed = OBJECT_MAPPER.readValue(String.valueOf(value), JSON_OBJECT_TYPE);
      return parsed == null ? fallback : parsed;
    } catch (Exception ignored) {
      return fallback;
    }
  }

  private Object safeObject(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getObject(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private Integer safeInteger(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getObject(columnName, Integer.class);
    } catch (SQLException error) {
      return null;
    }
  }

  private String safeString(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getString(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private Timestamp safeTimestamp(ResultSet rs, String columnName) throws SQLException {
    try {
      return rs.getTimestamp(columnName);
    } catch (SQLException error) {
      return null;
    }
  }

  private Boolean toBoolean(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    if (value == null) {
      return false;
    }
    String text = String.valueOf(value).trim();
    return "true".equalsIgnoreCase(text) || "1".equals(text);
  }

  private String defaultString(String value, String fallback) {
    return value == null ? fallback : value;
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
