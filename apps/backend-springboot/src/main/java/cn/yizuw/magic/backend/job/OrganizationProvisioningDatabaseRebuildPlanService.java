package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.tenant.TenantDataSourceProperties;
import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 组织空间开通目标库重建计划服务；只生成 DDL 预案，不执行 DROP/CREATE DATABASE。 */
@Service
public class OrganizationProvisioningDatabaseRebuildPlanService {

  private static final String REBUILDING_DATABASE_STEP = "rebuilding_database";
  private static final Set<String> SYSTEM_DATABASE_NAMES =
      Set.of("information_schema", "mysql", "performance_schema", "sys");

  private final AppProperties appProperties;
  private final OrganizationProvisioningDatabaseAdminClient databaseAdminClient;
  private final JdbcTemplate centerJdbcTemplate;
  private final Environment environment;
  private final TenantDataSourceProperties tenantDataSourceProperties;

  public OrganizationProvisioningDatabaseRebuildPlanService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate,
      AppProperties appProperties,
      TenantDataSourceProperties tenantDataSourceProperties,
      Environment environment,
      OrganizationProvisioningDatabaseAdminClient databaseAdminClient) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.appProperties = appProperties;
    this.tenantDataSourceProperties = tenantDataSourceProperties;
    this.environment = environment;
    this.databaseAdminClient = databaseAdminClient;
  }

  /**
   * 预览旧 worker 的目标库重建 DDL。
   *
   * <p>本方法只校验 `tenant_provisioning_job` 租约和数据库名安全边界，返回
   * `DROP DATABASE IF EXISTS` 与 `CREATE DATABASE` 预览；不会打开目标库连接，
   * 不执行 DDL，也不推进任务步骤。
   */
  @Transactional(readOnly = true)
  public Map<String, Object> previewRebuildDatabase(
      long jobId, String workerId, Instant previewedAt) {
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通目标库重建预览缺少 jobId");
    }
    if (!StringUtils.hasText(workerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通目标库重建预览缺少 workerId");
    }
    String normalizedWorkerId = workerId.trim();
    Instant now = previewedAt == null ? Instant.now() : previewedAt;

    Map<String, Object> result = baseResult(jobId, normalizedWorkerId, now);
    if (!tableExists("tenant_provisioning_job")) {
      result.put("planStatus", "table_not_ready");
      return result;
    }

    result.put("tableReady", true);
    ProvisioningDatabaseRebuildJob job = findRebuildingDatabaseJob(jobId, normalizedWorkerId);
    if (job == null) {
      result.put("blockedReasons", List.of("任务不存在、租约已丢失或步骤不是 rebuilding_database"));
      result.put("leaseValid", false);
      result.put("planStatus", "lease_lost");
      return result;
    }

    Map<String, Object> jobMap = jobMap(job);
    result.putAll(jobMap);
    result.put("leaseValid", true);

    List<String> blockedReasons = blockedReasons(job);
    String targetJdbcUrl = blockedReasons.isEmpty() ? resolveTargetJdbcUrl(job) : "";
    if (blockedReasons.isEmpty() && !StringUtils.hasText(targetJdbcUrl)) {
      blockedReasons = List.of("无法解析目标租户 JDBC URL");
    }

    result.put("blockedReasons", blockedReasons);
    result.put("ddlPreview", blockedReasons.isEmpty() ? ddlPreview(job.targetDbName()) : List.of());
    result.put("executeDdl", false);
    result.put("nextExplicitSwitch", "executeRebuildDatabase");
    result.put("planStatus", blockedReasons.isEmpty() ? "ready" : "blocked");
    result.put("ready", blockedReasons.isEmpty());
    result.put("targetJdbcUrlPreview", jdbcUrlPreview(targetJdbcUrl));
    result.put("adminJdbcUrlPreview", adminJdbcUrlPreview(targetJdbcUrl));
    result.put("targetDatabaseSafety", targetDatabaseSafety(job));
    return result;
  }

  /**
   * 显式执行目标库 DROP/CREATE。
   *
   * <p>本方法只允许处理当前 worker 持有的 `rebuilding_database` 任务，并要求
   * `confirmTargetDbName` 与任务目标库名完全一致。执行后只刷新任务 heartbeat，
   * 不推进到 `cloning_schema`，后续 schema clone 必须继续单独批次接入。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> executeRebuildDatabase(
      long jobId, String workerId, String confirmTargetDbName, Instant executedAt) {
    Map<String, Object> result = previewRebuildDatabase(jobId, workerId, executedAt);
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("executeDdl", false);
    result.put("rebuildStatus", result.get("planStatus"));
    result.put("heartbeatUpdatedRows", 0);
    if (!"ready".equals(result.get("planStatus"))) {
      return result;
    }

    String targetDbName = string(result.get("targetDbName"));
    if (!StringUtils.hasText(confirmTargetDbName)
        || !targetDbName.equals(confirmTargetDbName.trim())) {
      List<String> blockedReasons = new ArrayList<>();
      blockedReasons.addAll(castStringList(result.get("blockedReasons")));
      blockedReasons.add("confirmTargetDbName 与任务 targetDbName 不一致");
      result.put("blockedReasons", blockedReasons);
      result.put("ready", false);
      result.put("rebuildStatus", "blocked");
      return result;
    }

    String targetJdbcUrl =
        resolveTargetJdbcUrl(
            new ProvisioningDatabaseRebuildJob(
                jobId,
                string(result.get("sourceCustomerId")),
                string(result.get("targetCustomerId")),
                targetDbName,
                string(result.get("status")),
                string(result.get("step")),
                string(result.get("lockOwner")),
                null,
                null,
                null));
    @SuppressWarnings("unchecked")
    List<String> ddlStatements = (List<String>) result.get("ddlPreview");
    List<String> executedDdl = databaseAdminClient.rebuildDatabase(targetJdbcUrl, ddlStatements);
    int heartbeatRows = refreshHeartbeat(jobId, workerId.trim(), executedAt == null ? Instant.now() : executedAt);
    result.put("ddlExecuted", executedDdl);
    result.put("executeDdl", true);
    result.put("heartbeatUpdatedRows", heartbeatRows);
    result.put("nextExplicitSwitch", "markCloningSchema");
    result.put("rebuildStatus", "success");
    result.put("schemaCloneStarted", false);
    return result;
  }

  private Map<String, Object> baseResult(long jobId, String workerId, Instant now) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("adminJdbcUrlPreview", Map.of());
    result.put("blockedReasons", List.of());
    result.put("ddlPreview", List.of());
    result.put("executeDdl", false);
    result.put("jobId", jobId);
    result.put("leaseValid", false);
    result.put("nextExplicitSwitch", "executeRebuildDatabase");
    result.put("planStatus", "table_not_ready");
    result.put("previewedAt", now.toString());
    result.put("ready", false);
    result.put("requiredStep", REBUILDING_DATABASE_STEP);
    result.put("tableReady", false);
    result.put("targetJdbcUrlPreview", Map.of());
    result.put("targetTable", "tenant_provisioning_job");
    result.put("workerId", workerId);
    return result;
  }

  private ProvisioningDatabaseRebuildJob findRebuildingDatabaseJob(long jobId, String workerId) {
    List<ProvisioningDatabaseRebuildJob> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, source_customer_id, target_customer_id, target_db_name,
                   status, step, lock_owner, locked_at, heartbeat_at, update_time
            FROM tenant_provisioning_job
            WHERE id = ?
              AND lock_owner = ?
              AND status = 'provisioning'
              AND step = 'rebuilding_database'
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
          AND step = 'rebuilding_database'
        """,
        timestamp(now),
        timestamp(now),
        jobId,
        workerId);
  }

  private List<String> blockedReasons(ProvisioningDatabaseRebuildJob job) {
    java.util.ArrayList<String> reasons = new java.util.ArrayList<>();
    if (!"public".equals(job.sourceCustomerId())) {
      reasons.add("组织开通 worker 当前只支持 public -> 专属租户");
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
      reasons.add("拒绝重建受保护数据库: " + job.targetDbName().trim());
    }
    if (!StringUtils.hasText(tenantDataSourceProperties.getPublicJdbcUrl())) {
      reasons.add("缺少 PUBLIC_DATABASE_URL，无法读取 public 库");
    }
    if (StringUtils.hasText(tenantDataSourceProperties.getJdbcUrlTemplate())
        && !tenantDataSourceProperties.getJdbcUrlTemplate().contains("{customerId}")) {
      reasons.add("CUSTOMER_DATABASE_URL_TEMPLATE 必须包含 {customerId} 占位符");
    }
    if (!StringUtils.hasText(tenantDataSourceProperties.getDefaultJdbcUrl())
        && !StringUtils.hasText(tenantDataSourceProperties.getJdbcUrlTemplate())) {
      reasons.add("缺少 DATABASE_URL 或 CUSTOMER_DATABASE_URL_TEMPLATE，无法解析目标租户连接");
    }
    if (reasons.isEmpty() && !canResolveTargetJdbcUrl(job)) {
      reasons.add("无法解析目标租户 JDBC URL");
    }
    return reasons;
  }

  private boolean canResolveTargetJdbcUrl(ProvisioningDatabaseRebuildJob job) {
    try {
      return StringUtils.hasText(resolveTargetJdbcUrl(job));
    } catch (IllegalArgumentException error) {
      return false;
    }
  }

  private String resolveTargetJdbcUrl(ProvisioningDatabaseRebuildJob job) {
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

  private String applyDatabaseName(String rawUrl, String dbName) {
    return applyDatabaseName(rawUrl, dbName, dbName);
  }

  private String applyDatabaseName(String rawUrl, String databasePathName, String plannedDbName) {
    ParsedUrl parsed = parseUrl(rawUrl);
    String rawPath = "/" + databasePathName;
    String prefix = parsed.jdbcPrefix() ? "jdbc:" : "";
    StringBuilder builder = new StringBuilder(prefix).append(parsed.scheme()).append("://");
    if (StringUtils.hasText(parsed.userInfo())) {
      builder.append(parsed.userInfo()).append('@');
    }
    builder.append(parsed.host());
    if (parsed.port() > 0) {
      builder.append(':').append(parsed.port());
    }
    builder.append(rawPath);
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

  private Map<String, Object> adminJdbcUrlPreview(String rawUrl) {
    Map<String, Object> preview = new LinkedHashMap<>(jdbcUrlPreview(rawUrl));
    if (!preview.isEmpty()) {
      preview.put("database", null);
      preview.put("withoutDatabase", true);
    }
    return preview;
  }

  private List<String> ddlPreview(String targetDbName) {
    String quotedDbName = quoteIdentifier(targetDbName.trim());
    return List.of(
        "DROP DATABASE IF EXISTS " + quotedDbName,
        "CREATE DATABASE " + quotedDbName + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  }

  private Map<String, Object> targetDatabaseSafety(ProvisioningDatabaseRebuildJob job) {
    Map<String, Object> map = new LinkedHashMap<>();
    Set<String> protectedNames = protectedDatabaseNames();
    map.put("protectedDatabaseNames", protectedNames);
    map.put("sourceCustomerId", job.sourceCustomerId());
    map.put("targetCustomerId", job.targetCustomerId());
    map.put("targetDbName", job.targetDbName());
    map.put(
        "safe",
        "public".equals(job.sourceCustomerId())
            && StringUtils.hasText(job.targetCustomerId())
            && !"public".equals(job.targetCustomerId().trim())
            && StringUtils.hasText(job.targetDbName())
            && validDatabaseName(job.targetDbName())
            && !protectedNames.contains(job.targetDbName().trim()));
    return map;
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

  private ProvisioningDatabaseRebuildJob job(ResultSet rs) throws SQLException {
    return new ProvisioningDatabaseRebuildJob(
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

  private Map<String, Object> jobMap(ProvisioningDatabaseRebuildJob job) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("heartbeatAt", iso(job.heartbeatAt()));
    map.put("id", job.id());
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

  private boolean validDatabaseName(String dbName) {
    String normalized = string(dbName).trim();
    return normalized.matches("\\w+") && normalized.length() <= 100;
  }

  private String quoteIdentifier(String value) {
    return "`" + value.replace("`", "``") + "`";
  }

  private boolean usernamePresent(String userInfo) {
    return StringUtils.hasText(userInfo) && !userInfo.startsWith(":");
  }

  private Instant instant(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant();
  }

  private Timestamp timestamp(Instant instant) {
    return instant == null ? null : Timestamp.from(instant);
  }

  private String iso(Instant instant) {
    return instant == null ? null : instant.toString();
  }

  private String string(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String stripWrappingQuotes(String value) {
    if ((value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))) {
      return value.substring(1, value.length() - 1);
    }
    return value;
  }

  private List<String> castStringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream().map(String::valueOf).toList();
  }

  private record ParsedUrl(
      boolean jdbcPrefix,
      String scheme,
      String userInfo,
      String host,
      int port,
      String path,
      String query) {}

  private record ProvisioningDatabaseRebuildJob(
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
