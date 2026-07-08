package cn.yizuw.magic.backend.system.menutemplatesync;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import cn.yizuw.magic.backend.common.BusinessException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class MenuTemplateSyncRepository {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private final JdbcTemplate centerJdbcTemplate;

  public MenuTemplateSyncRepository(JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  public List<Map<String, Object>> findJobs(int limit) {
    return centerJdbcTemplate.query(
        """
        SELECT id, mode, source_customer_id, target_scope, target_customer_id, status,
               summary, error_message, completed_at, create_time
        FROM menu_template_sync_job
        ORDER BY id DESC
        LIMIT ?
        """,
        (rs, rowNum) -> jobMap(rs),
        limit);
  }

  public List<Map<String, Object>> findJobLogs(int jobId) {
    return centerJdbcTemplate.query(
        """
        SELECT id, target_customer_id, target_db_name, status, summary, details,
               error_message, create_time
        FROM menu_template_sync_log
        WHERE job_id = ?
        ORDER BY id ASC
        """,
        (rs, rowNum) -> logMap(rs),
        jobId);
  }

  /** 统计 dry-run 可能影响的租户数；不创建同步任务。 */
  public int countActiveTargetCustomers(String defaultCustomerId) {
    if (!tableExists("customer")) {
      return 0;
    }
    Integer count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM customer
            WHERE customer_id NOT IN ('public', ?)
              AND (status IS NULL OR status <> 0)
            """,
            Integer.class,
            defaultCustomerId);
    return count == null ? 0 : count;
  }

  /** 校验单租户 dry-run 目标，返回兼容计划里的目标数量。 */
  public int assertTargetCustomerExists(String targetCustomerId, String defaultCustomerId) {
    if ("public".equals(targetCustomerId) || defaultCustomerId.equals(targetCustomerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "公共库和默认库不能作为菜单模板同步目标");
    }
    if (!tableExists("customer")) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "中心库 customer 表未初始化");
    }
    Integer count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM customer
            WHERE customer_id = ?
              AND (status IS NULL OR status <> 0)
            """,
            Integer.class,
            targetCustomerId);
    if (count == null || count == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "目标租户不存在或已停用");
    }
    return 1;
  }

  /** 创建 HTTP execute 兼容入口的本地审计任务；不执行真实租户菜单写入。 */
  public long createAcceptedExecuteJob(
      String sourceCustomerId,
      String storageTargetScope,
      String targetCustomerId,
      String logTargetCustomerId,
      Map<String, Object> summary,
      Map<String, Object> details) {
    assertTableExists("menu_template_sync_job", "中心库菜单模板同步任务表未初始化");
    assertTableExists("menu_template_sync_log", "中心库菜单模板同步日志表未初始化");
    TransactionTemplate transactionTemplate =
        new TransactionTemplate(new DataSourceTransactionManager(centerJdbcTemplate.getDataSource()));
    return transactionTemplate.execute(
        status -> {
          long jobId =
              insertAcceptedExecuteJob(
                  sourceCustomerId, storageTargetScope, targetCustomerId, summary);
          insertAcceptedExecuteLog(jobId, logTargetCustomerId, summary, details);
          return jobId;
        });
  }

  private long insertAcceptedExecuteJob(
      String sourceCustomerId,
      String storageTargetScope,
      String targetCustomerId,
      Map<String, Object> summary) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    centerJdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO menu_template_sync_job
                    (mode, source_customer_id, target_scope, target_customer_id,
                     status, summary, started_at)
                  VALUES
                    (?, ?, ?, ?, ?, ?, NOW(3))
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, "execute");
          statement.setString(2, sourceCustomerId);
          statement.setString(3, storageTargetScope);
          statement.setString(4, targetCustomerId);
          statement.setString(5, "accepted");
          statement.setString(6, toJson(summary));
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "菜单模板同步任务创建失败");
    }
    return key.longValue();
  }

  private void insertAcceptedExecuteLog(
      long jobId,
      String logTargetCustomerId,
      Map<String, Object> summary,
      Map<String, Object> details) {
    centerJdbcTemplate.update(
        """
        INSERT INTO menu_template_sync_log
          (job_id, target_customer_id, target_db_name, status, summary, details, error_message)
        VALUES
          (?, ?, ?, ?, ?, ?, ?)
        """,
        jobId,
        logTargetCustomerId,
        null,
        "accepted",
        toJson(summary),
        toJson(details),
        null);
  }

  private boolean tableExists(String tableName) {
    Integer count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            Integer.class,
            tableName);
    return count != null && count > 0;
  }

  private void assertTableExists(String tableName, String message) {
    if (!tableExists(tableName)) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }
  }

  private String toJson(Object value) {
    try {
      return OBJECT_MAPPER.writeValueAsString(value);
    } catch (JsonProcessingException error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "菜单模板同步审计 JSON 序列化失败");
    }
  }

  private Map<String, Object> jobMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", rs.getInt("id"));
    map.put("mode", rs.getString("mode"));
    map.put("sourceCustomerId", rs.getString("source_customer_id"));
    map.put("targetScope", rs.getString("target_scope"));
    map.put("targetCustomerId", rs.getString("target_customer_id"));
    map.put("status", rs.getString("status"));
    map.put("summary", rs.getString("summary"));
    map.put("errorMessage", rs.getString("error_message"));
    map.put("completedAt", toIso(rs.getTimestamp("completed_at")));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    return map;
  }

  private Map<String, Object> logMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", rs.getInt("id"));
    map.put("targetCustomerId", rs.getString("target_customer_id"));
    map.put("targetDbName", rs.getString("target_db_name"));
    map.put("status", rs.getString("status"));
    map.put("summary", rs.getString("summary"));
    map.put("details", rs.getString("details"));
    map.put("errorMessage", rs.getString("error_message"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    return map;
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }
}
