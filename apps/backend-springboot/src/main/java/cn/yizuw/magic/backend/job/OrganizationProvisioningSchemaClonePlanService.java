package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.tenant.TenantDataSourceProperties;
import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 组织空间开通 schema clone 预览服务；只读取模板库结构，不写目标库。 */
@Service
public class OrganizationProvisioningSchemaClonePlanService {

  private static final String CLONING_SCHEMA_STEP = "cloning_schema";
  private static final Set<String> SYSTEM_DATABASE_NAMES =
      Set.of("information_schema", "mysql", "performance_schema", "sys");

  private final AppProperties appProperties;
  private final JdbcTemplate centerJdbcTemplate;
  private final Environment environment;
  private final OrganizationProvisioningSchemaDdlClient schemaDdlClient;
  private final OrganizationProvisioningSchemaMetadataClient schemaMetadataClient;
  private final TenantDataSourceProperties tenantDataSourceProperties;

  public OrganizationProvisioningSchemaClonePlanService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate,
      AppProperties appProperties,
      TenantDataSourceProperties tenantDataSourceProperties,
      Environment environment,
      OrganizationProvisioningSchemaDdlClient schemaDdlClient,
      OrganizationProvisioningSchemaMetadataClient schemaMetadataClient) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.appProperties = appProperties;
    this.tenantDataSourceProperties = tenantDataSourceProperties;
    this.environment = environment;
    this.schemaDdlClient = schemaDdlClient;
    this.schemaMetadataClient = schemaMetadataClient;
  }

  /**
   * 预览旧 worker 的 `cloneSchemaFromTemplate(...)` 建表计划。
   *
   * <p>本方法只允许读取当前 worker 持有的 `cloning_schema` 任务和 public 模板库表结构。
   * 不执行 `SET FOREIGN_KEY_CHECKS`、不连接目标库、不执行 `CREATE TABLE`、不复制基础数据。
   */
  @Transactional(readOnly = true)
  public Map<String, Object> previewSchemaClone(
      long jobId, String workerId, int tableLimit, Instant previewedAt) {
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通 schema clone 预览缺少 jobId");
    }
    if (!StringUtils.hasText(workerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通 schema clone 预览缺少 workerId");
    }
    String normalizedWorkerId = workerId.trim();
    int normalizedTableLimit = tableLimit <= 0 ? 20 : Math.min(tableLimit, 200);
    Instant now = previewedAt == null ? Instant.now() : previewedAt;

    Map<String, Object> result = baseResult(jobId, normalizedWorkerId, normalizedTableLimit, now);
    if (!tableExists("tenant_provisioning_job")) {
      result.put("schemaCloneStatus", "table_not_ready");
      return result;
    }

    result.put("tableReady", true);
    ProvisioningSchemaCloneJob job = findCloningSchemaJob(jobId, normalizedWorkerId);
    if (job == null) {
      result.put("blockedReasons", List.of("任务不存在、租约已丢失或步骤不是 cloning_schema"));
      result.put("schemaCloneStatus", "lease_lost");
      return result;
    }

    result.putAll(jobMap(job));
    result.put("leaseValid", true);
    List<String> blockedReasons = blockedReasons(job);
    if (!blockedReasons.isEmpty()) {
      result.put("blockedReasons", blockedReasons);
      result.put("schemaCloneStatus", "blocked");
      return result;
    }

    String templateJdbcUrl = resolveTemplateJdbcUrl(job);
    String targetJdbcUrl = resolveTargetJdbcUrl(job);
    OrganizationProvisioningSchemaMetadataClient.SchemaInspection inspection =
        schemaMetadataClient.inspectBaseTableSchema(templateJdbcUrl, normalizedTableLimit);
    if (inspection.totalBaseTableCount() == 0) {
      result.put("blockedReasons", List.of("模板库没有可复制的基础表结构"));
      result.put("schemaCloneStatus", "blocked");
      result.put("templateJdbcUrlPreview", jdbcUrlPreview(templateJdbcUrl));
      result.put("targetJdbcUrlPreview", jdbcUrlPreview(targetJdbcUrl));
      return result;
    }

    List<Map<String, Object>> tablePlans =
        inspection.tables().stream().map(this::tablePlan).toList();
    result.put("blockedReasons", List.of());
    result.put("dataCopyStarted", false);
    result.put("executeDdl", false);
    result.put("foreignKeyChecksDisabledInPreview", false);
    result.put("limited", inspection.limited());
    result.put("nextExplicitSwitch", "executeSchemaClone");
    result.put("previewedTableCount", tablePlans.size());
    result.put("schemaCloneStatus", "ready");
    result.put("targetDdlExecuted", false);
    result.put("targetJdbcUrlPreview", jdbcUrlPreview(targetJdbcUrl));
    result.put("templateJdbcUrlPreview", jdbcUrlPreview(templateJdbcUrl));
    result.put("tablePlans", tablePlans);
    result.put("totalBaseTableCount", inspection.totalBaseTableCount());
    return result;
  }

  /**
   * 显式执行旧 worker 的 schema clone 建表阶段。
   *
   * <p>本方法只执行目标库建表，并在每张表建完后刷新 heartbeat；不会推进到
   * `seeding_base_data`，不会复制基础数据或成员数据。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> executeSchemaClone(
      long jobId,
      String workerId,
      String confirmTargetDbName,
      int tableLimit,
      Instant executedAt) {
    Map<String, Object> result = previewSchemaClone(jobId, workerId, tableLimit, executedAt);
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("executeDdl", false);
    result.put("heartbeatUpdatedRows", 0);
    result.put("schemaCloneExecuted", false);
    if (!"ready".equals(result.get("schemaCloneStatus"))) {
      return result;
    }

    String targetDbName = string(result.get("targetDbName"));
    if (!StringUtils.hasText(confirmTargetDbName)
        || !targetDbName.equals(confirmTargetDbName.trim())) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "confirmTargetDbName 与任务 targetDbName 不一致"));
      result.put("schemaCloneStatus", "blocked");
      return result;
    }
    if (Boolean.TRUE.equals(result.get("limited"))) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "schemaTableLimit 小于基础表总数，拒绝执行部分建表"));
      result.put("schemaCloneStatus", "blocked");
      return result;
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> tablePlans = (List<Map<String, Object>>) result.get("tablePlans");
    List<String> createTableStatements =
        tablePlans.stream().map(item -> string(item.get("createTableSqlPreview"))).toList();
    String targetJdbcUrl = targetJdbcUrlFromResult(result);
    AtomicInteger heartbeatRows = new AtomicInteger();
    Instant now = executedAt == null ? Instant.now() : executedAt;
    List<String> executedDdl =
        schemaDdlClient.createTables(
            targetJdbcUrl,
            createTableStatements,
            () -> {
              int rows = refreshHeartbeat(jobId, workerId.trim(), now);
              if (rows <= 0) {
                throw new BusinessException(HttpStatus.CONFLICT, "租户开通任务租约已失效，停止 schema clone");
              }
              heartbeatRows.addAndGet(rows);
              return rows;
            });
    result.put("executeDdl", true);
    result.put("heartbeatUpdatedRows", heartbeatRows.get());
    result.put("nextExplicitSwitch", "markSeedingBaseData");
    result.put("schemaCloneExecuted", true);
    result.put("schemaCloneStatus", "success");
    result.put("targetDdlExecuted", true);
    result.put("targetDdlExecutedCount", executedDdl.size());
    return result;
  }

  private Map<String, Object> baseResult(
      long jobId, String workerId, int tableLimit, Instant previewedAt) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("blockedReasons", List.of());
    result.put("dataCopyStarted", false);
    result.put("executeDdl", false);
    result.put("jobId", jobId);
    result.put("leaseValid", false);
    result.put("limited", false);
    result.put("nextExplicitSwitch", "executeSchemaClone");
    result.put("previewedAt", previewedAt.toString());
    result.put("previewedTableCount", 0);
    result.put("requiredStep", CLONING_SCHEMA_STEP);
    result.put("schemaCloneStatus", "table_not_ready");
    result.put("tableLimit", tableLimit);
    result.put("tablePlans", List.of());
    result.put("tableReady", false);
    result.put("targetDdlExecuted", false);
    result.put("targetJdbcUrlPreview", Map.of());
    result.put("targetTable", "tenant_provisioning_job");
    result.put("templateJdbcUrlPreview", Map.of());
    result.put("totalBaseTableCount", 0);
    result.put("workerId", workerId);
    return result;
  }

  private ProvisioningSchemaCloneJob findCloningSchemaJob(long jobId, String workerId) {
    List<ProvisioningSchemaCloneJob> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, source_customer_id, target_customer_id, target_db_name,
                   status, step, lock_owner, locked_at, heartbeat_at, update_time
            FROM tenant_provisioning_job
            WHERE id = ?
              AND lock_owner = ?
              AND status = 'provisioning'
              AND step = 'cloning_schema'
            LIMIT 1
            """,
            (rs, rowNum) -> job(rs),
            jobId,
            workerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private int refreshHeartbeat(long jobId, String workerId, Instant now) {
    return centerJdbcTemplate.update(
        """
        UPDATE tenant_provisioning_job
        SET heartbeat_at = ?,
            update_time = ?
        WHERE id = ?
          AND lock_owner = ?
          AND status = 'provisioning'
          AND step = 'cloning_schema'
        """,
        Timestamp.from(now),
        Timestamp.from(now),
        jobId,
        workerId);
  }

  private List<String> blockedReasons(ProvisioningSchemaCloneJob job) {
    java.util.ArrayList<String> reasons = new java.util.ArrayList<>();
    if (!"public".equals(job.sourceCustomerId())) {
      reasons.add("组织开通 schema clone 当前只支持 public 模板库");
    }
    if (!StringUtils.hasText(job.targetCustomerId())) {
      reasons.add("缺少 targetCustomerId");
    } else if (!job.targetCustomerId().trim().matches("\\w+")) {
      reasons.add("targetCustomerId 不合法");
    } else if ("public".equals(job.targetCustomerId().trim())) {
      reasons.add("拒绝把 public 作为自动开通目标租户");
    }
    if (!StringUtils.hasText(job.targetDbName())) {
      reasons.add("缺少 targetDbName");
    } else if (!validDatabaseName(job.targetDbName())) {
      reasons.add("targetDbName 不合法");
    } else if (protectedDatabaseNames().contains(job.targetDbName().trim())) {
      reasons.add("拒绝写入受保护数据库: " + job.targetDbName().trim());
    }
    if (!StringUtils.hasText(tenantDataSourceProperties.getPublicJdbcUrl())) {
      reasons.add("缺少 PUBLIC_DATABASE_URL，无法读取 public 模板库");
    }
    if (StringUtils.hasText(tenantDataSourceProperties.getJdbcUrlTemplate())
        && !tenantDataSourceProperties.getJdbcUrlTemplate().contains("{customerId}")) {
      reasons.add("CUSTOMER_DATABASE_URL_TEMPLATE 必须包含 {customerId} 占位符");
    }
    if (!StringUtils.hasText(tenantDataSourceProperties.getDefaultJdbcUrl())
        && !StringUtils.hasText(tenantDataSourceProperties.getJdbcUrlTemplate())) {
      reasons.add("缺少 DATABASE_URL 或 CUSTOMER_DATABASE_URL_TEMPLATE，无法解析目标租户连接");
    }
    if (reasons.isEmpty() && !StringUtils.hasText(resolveTargetJdbcUrl(job))) {
      reasons.add("无法解析目标租户 JDBC URL");
    }
    return reasons;
  }

  private Map<String, Object> tablePlan(
      OrganizationProvisioningSchemaMetadataClient.TableSchema schema) {
    Map<String, Object> map = new LinkedHashMap<>();
    boolean autoIncrementRemoved =
        schema.createTableSql().matches("(?is).*\\sAUTO_INCREMENT=\\d+\\b.*");
    map.put("tableName", schema.tableName());
    map.put("createTableSqlPreview", buildTargetCreateTableSql(schema.createTableSql(), schema.tableName()));
    map.put("sourceAutoIncrementRemoved", autoIncrementRemoved);
    return map;
  }

  private List<String> appendReason(Object currentReasons, String reason) {
    java.util.ArrayList<String> reasons = new java.util.ArrayList<>();
    if (currentReasons instanceof List<?> list) {
      for (Object item : list) {
        String text = string(item);
        if (StringUtils.hasText(text)) {
          reasons.add(text);
        }
      }
    }
    reasons.add(reason);
    return reasons;
  }

  private String buildTargetCreateTableSql(String createSql, String tableName) {
    String normalizedSql = createSql.stripLeading();
    String targetSql =
        normalizedSql
            .replaceFirst(
                "(?is)^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:`[^`]+`|\\S+)",
                "CREATE TABLE IF NOT EXISTS " + quoteIdentifier(tableName))
            .replaceAll("(?i)\\sAUTO_INCREMENT=\\d+\\b", "");
    if (targetSql.equals(normalizedSql)) {
      throw new BusinessException(HttpStatus.BAD_GATEWAY, "无法改写目标表结构 SQL: " + tableName);
    }
    return targetSql;
  }

  private String resolveTemplateJdbcUrl(ProvisioningSchemaCloneJob job) {
    if ("public".equals(job.sourceCustomerId())) {
      return stripWrappingQuotes(string(tenantDataSourceProperties.getPublicJdbcUrl()).trim());
    }
    return "";
  }

  private String resolveTargetJdbcUrl(ProvisioningSchemaCloneJob job) {
    String customerId = job.targetCustomerId().trim();
    String dbName = job.targetDbName().trim();
    String template = stripWrappingQuotes(string(tenantDataSourceProperties.getJdbcUrlTemplate()).trim());
    if (StringUtils.hasText(template)) {
      return applyDatabaseName(template.replace("{customerId}", customerId), dbName);
    }

    String defaultUrl = stripWrappingQuotes(string(tenantDataSourceProperties.getDefaultJdbcUrl()).trim());
    if (!StringUtils.hasText(defaultUrl)) {
      return "";
    }
    if (customerId.equals(appProperties.getDefaultCustomerId())) {
      return applyDatabaseName(defaultUrl, dbName);
    }
    String prefix =
        StringUtils.hasText(tenantDataSourceProperties.getDbPrefix())
            ? tenantDataSourceProperties.getDbPrefix()
            : "customer_";
    return applyDatabaseName(defaultUrl, prefix + customerId, dbName);
  }

  private String targetJdbcUrlFromResult(Map<String, Object> result) {
    return resolveTargetJdbcUrl(
        new ProvisioningSchemaCloneJob(
            ((Number) result.get("jobId")).longValue(),
            string(result.get("sourceCustomerId")),
            string(result.get("targetCustomerId")),
            string(result.get("targetDbName")),
            string(result.get("status")),
            string(result.get("step")),
            string(result.get("lockOwner")),
            null,
            null,
            null));
  }

  private String applyDatabaseName(String rawUrl, String dbName) {
    return applyDatabaseName(rawUrl, dbName, dbName);
  }

  private String applyDatabaseName(String rawUrl, String databasePathName, String plannedDbName) {
    ParsedUrl parsed = parseUrl(rawUrl);
    String prefix = parsed.jdbcPrefix() ? "jdbc:" : "";
    StringBuilder builder = new StringBuilder(prefix).append(parsed.scheme()).append("://");
    if (StringUtils.hasText(parsed.userInfo())) {
      builder.append(parsed.userInfo()).append('@');
    }
    builder.append(parsed.host());
    if (parsed.port() > 0) {
      builder.append(':').append(parsed.port());
    }
    builder.append('/').append(databasePathName);
    if (StringUtils.hasText(parsed.query())) {
      builder.append('?').append(parsed.query());
    }
    if (!plannedDbName.equals(databasePathName)) {
      return applyDatabaseName(builder.toString(), plannedDbName);
    }
    return builder.toString();
  }

  private ParsedUrl parseUrl(String rawUrl) {
    if (!StringUtils.hasText(rawUrl)) {
      throw new IllegalArgumentException("database url is blank");
    }
    String normalized = stripWrappingQuotes(rawUrl.trim());
    boolean jdbcPrefix = normalized.startsWith("jdbc:");
    if (jdbcPrefix) {
      normalized = normalized.substring("jdbc:".length());
    }
    URI uri = URI.create(normalized);
    if (!StringUtils.hasText(uri.getScheme()) || !StringUtils.hasText(uri.getHost())) {
      throw new IllegalArgumentException("database url is invalid");
    }
    return new ParsedUrl(
        jdbcPrefix,
        uri.getScheme(),
        uri.getRawUserInfo(),
        uri.getHost(),
        uri.getPort(),
        uri.getRawPath(),
        uri.getRawQuery());
  }

  private Map<String, Object> jdbcUrlPreview(String rawUrl) {
    if (!StringUtils.hasText(rawUrl)) {
      return Map.of();
    }
    try {
      ParsedUrl parsed = parseUrl(rawUrl);
      Map<String, Object> preview = new LinkedHashMap<>();
      preview.put("database", databaseName(rawUrl));
      preview.put("host", parsed.host());
      preview.put("jdbcPrefix", parsed.jdbcPrefix());
      preview.put("passwordRedacted", StringUtils.hasText(parsed.userInfo()));
      preview.put("port", parsed.port() > 0 ? parsed.port() : 3306);
      preview.put("queryPresent", StringUtils.hasText(parsed.query()));
      preview.put("scheme", parsed.scheme());
      preview.put("usernamePresent", usernamePresent(parsed.userInfo()));
      return preview;
    } catch (IllegalArgumentException error) {
      return Map.of("parseError", true);
    }
  }

  private Set<String> protectedDatabaseNames() {
    Set<String> names = new LinkedHashSet<>(SYSTEM_DATABASE_NAMES);
    addDatabaseName(names, environment.getProperty("spring.datasource.center.jdbc-url"));
    addDatabaseName(names, environment.getProperty("CENTER_DATABASE_URL"));
    addDatabaseName(names, tenantDataSourceProperties.getDefaultJdbcUrl());
    addDatabaseName(names, environment.getProperty("DATABASE_URL"));
    addDatabaseName(names, tenantDataSourceProperties.getPublicJdbcUrl());
    addDatabaseName(names, environment.getProperty("PUBLIC_DATABASE_URL"));
    if (StringUtils.hasText(appProperties.getDefaultCustomerId())
        && StringUtils.hasText(tenantDataSourceProperties.getDbPrefix())) {
      names.add(tenantDataSourceProperties.getDbPrefix() + appProperties.getDefaultCustomerId());
    }
    return names;
  }

  private void addDatabaseName(Set<String> names, String rawUrl) {
    String name = databaseName(rawUrl);
    if (StringUtils.hasText(name)) {
      names.add(name);
    }
  }

  private String databaseName(String rawUrl) {
    if (!StringUtils.hasText(rawUrl)) {
      return "";
    }
    try {
      ParsedUrl parsed = parseUrl(rawUrl);
      String path = parsed.path();
      if (!StringUtils.hasText(path) || "/".equals(path)) {
        return "";
      }
      String[] segments = path.split("/");
      return segments.length == 0 ? "" : segments[segments.length - 1];
    } catch (IllegalArgumentException error) {
      return "";
    }
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

  private ProvisioningSchemaCloneJob job(ResultSet rs) throws SQLException {
    return new ProvisioningSchemaCloneJob(
        rs.getLong("id"),
        rs.getString("source_customer_id"),
        rs.getString("target_customer_id"),
        rs.getString("target_db_name"),
        rs.getString("status"),
        rs.getString("step"),
        rs.getString("lock_owner"),
        instant(rs.getTimestamp("locked_at")),
        instant(rs.getTimestamp("heartbeat_at")),
        instant(rs.getTimestamp("update_time")));
  }

  private Map<String, Object> jobMap(ProvisioningSchemaCloneJob job) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("heartbeatAt", iso(job.heartbeatAt()));
    map.put("jobId", job.id());
    map.put("lockedAt", iso(job.lockedAt()));
    map.put("lockOwner", job.lockOwner());
    map.put("sourceCustomerId", job.sourceCustomerId());
    map.put("status", job.status());
    map.put("step", job.step());
    map.put("targetCustomerId", job.targetCustomerId());
    map.put("targetDbName", job.targetDbName());
    map.put("updateTime", iso(job.updateTime()));
    return map;
  }

  private Instant instant(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant();
  }

  private String iso(Instant instant) {
    return instant == null ? null : instant.toString();
  }

  private String quoteIdentifier(String value) {
    return "`" + value.replace("`", "``") + "`";
  }

  private String string(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String stripWrappingQuotes(String value) {
    if (value.length() >= 2
        && ((value.startsWith("\"") && value.endsWith("\""))
            || (value.startsWith("'") && value.endsWith("'")))) {
      return value.substring(1, value.length() - 1);
    }
    return value;
  }

  private boolean usernamePresent(String userInfo) {
    return StringUtils.hasText(userInfo) && StringUtils.hasText(userInfo.split(":", 2)[0]);
  }

  private boolean validDatabaseName(String dbName) {
    return StringUtils.hasText(dbName) && dbName.length() <= 100 && dbName.matches("\\w+");
  }

  private record ParsedUrl(
      boolean jdbcPrefix,
      String scheme,
      String userInfo,
      String host,
      int port,
      String path,
      String query) {}

  private record ProvisioningSchemaCloneJob(
      long id,
      String sourceCustomerId,
      String targetCustomerId,
      String targetDbName,
      String status,
      String step,
      String lockOwner,
      Instant lockedAt,
      Instant heartbeatAt,
      Instant updateTime) {}
}
