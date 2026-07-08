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
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 组织空间开通 Super 权限闭包复制计划服务；本批只预览，不写目标库。 */
@Service
public class OrganizationProvisioningSuperPermissionClosurePlanService {

  private static final String SEEDING_BASE_DATA_STEP = "seeding_base_data";
  private static final Set<String> SYSTEM_DATABASE_NAMES =
      Set.of("information_schema", "mysql", "performance_schema", "sys");

  private final AppProperties appProperties;
  private final JdbcTemplate centerJdbcTemplate;
  private final OrganizationProvisioningSuperPermissionClosureCopyClient copyClient;
  private final Environment environment;
  private final OrganizationProvisioningSuperPermissionClosurePreviewClient previewClient;
  private final TenantDataSourceProperties tenantDataSourceProperties;

  public OrganizationProvisioningSuperPermissionClosurePlanService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate,
      AppProperties appProperties,
      TenantDataSourceProperties tenantDataSourceProperties,
      Environment environment,
      OrganizationProvisioningSuperPermissionClosureCopyClient copyClient,
      OrganizationProvisioningSuperPermissionClosurePreviewClient previewClient) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.appProperties = appProperties;
    this.tenantDataSourceProperties = tenantDataSourceProperties;
    this.environment = environment;
    this.copyClient = copyClient;
    this.previewClient = previewClient;
  }

  /**
   * 预览旧 worker 的 `copySuperPermissionClosure(...)` 复制计划。
   *
   * <p>本方法只读当前 worker 持有的 `seeding_base_data` 任务、public 模板库和目标租户库；
   * 不复制 `menu/menu_meta/role/code/role_menu/role_code`，不刷新 heartbeat，也不推进 step。
   */
  @Transactional(readOnly = true)
  public Map<String, Object> previewSuperPermissionClosure(
      long jobId, String workerId, Instant previewedAt) {
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通 Super 权限闭包预览缺少 jobId");
    }
    if (!StringUtils.hasText(workerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织开通 Super 权限闭包预览缺少 workerId");
    }
    String normalizedWorkerId = workerId.trim();
    Instant now = previewedAt == null ? Instant.now() : previewedAt;

    Map<String, Object> result = baseResult(jobId, normalizedWorkerId, now);
    if (!tableExists("tenant_provisioning_job")) {
      return result;
    }

    result.put("tableReady", true);
    ProvisioningSuperPermissionJob job = findSeedingBaseDataJob(jobId, normalizedWorkerId);
    if (job == null) {
      result.put("blockedReasons", List.of("任务不存在、租约已丢失或步骤不是 seeding_base_data"));
      result.put("superPermissionClosureStatus", "lease_lost");
      return result;
    }

    result.putAll(jobMap(job));
    result.put("leaseValid", true);
    List<String> blockedReasons = blockedReasons(job);
    if (!blockedReasons.isEmpty()) {
      result.put("blockedReasons", blockedReasons);
      result.put("superPermissionClosureStatus", "blocked");
      return result;
    }

    String sourceJdbcUrl = resolveSourceJdbcUrl(job);
    String targetJdbcUrl = resolveTargetJdbcUrl(job);
    OrganizationProvisioningSuperPermissionClosurePreviewClient.SuperPermissionClosureInspection
        inspection = previewClient.inspect(sourceJdbcUrl, targetJdbcUrl);
    result.put("sourceJdbcUrlPreview", jdbcUrlPreview(sourceJdbcUrl));
    result.put("targetJdbcUrlPreview", jdbcUrlPreview(targetJdbcUrl));
    result.put("missingSourceTables", inspection.missingSourceTables());
    result.put("missingTargetTables", inspection.missingTargetTables());
    result.put("sourceSuperClosure", sourceMap(inspection.source()));
    result.put("targetSuperClosure", targetMap(inspection.target()));
    result.put("targetAlreadyHasSuper", inspection.target().superRoleExists());
    if (!inspection.missingSourceTables().isEmpty() || !inspection.missingTargetTables().isEmpty()) {
      result.put(
          "blockedReasons",
          List.of("Super 权限闭包复制所需表未就绪，请先确认 schema clone 是否完整"));
      result.put("superPermissionClosureStatus", "blocked");
      return result;
    }
    if (inspection.source().superRoleId() <= 0) {
      result.put("blockedReasons", List.of("源模板库缺少 Super 角色"));
      result.put("superPermissionClosureStatus", "blocked");
      return result;
    }

    result.put("blockedReasons", List.of());
    result.put("nextExplicitSwitch", "executeSuperPermissionClosure");
    result.put("plannedCopyTables", List.of("menu", "menu_meta", "role", "code", "role_menu", "role_code"));
    result.put("superPermissionClosureStatus", "ready");
    return result;
  }

  /**
   * 显式执行旧 worker 的 Super 权限闭包复制。
   *
   * <p>执行前复用预览安全门，并要求 `confirmTargetDbName` 与任务目标库完全一致。
   * 本方法只复制 Super 闭包表并刷新 heartbeat，不推进后续基础数据复制。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> executeSuperPermissionClosure(
      long jobId, String workerId, String confirmTargetDbName, Instant executedAt) {
    Map<String, Object> result = previewSuperPermissionClosure(jobId, workerId, executedAt);
    result.put("confirmTargetDbName", string(confirmTargetDbName));
    result.put("heartbeatUpdatedRows", 0);
    result.put("superPermissionClosureCopied", false);
    result.put("superPermissionClosureExecuted", false);
    if (!"ready".equals(result.get("superPermissionClosureStatus"))) {
      return result;
    }

    String targetDbName = string(result.get("targetDbName"));
    if (!StringUtils.hasText(confirmTargetDbName)
        || !targetDbName.equals(confirmTargetDbName.trim())) {
      result.put(
          "blockedReasons",
          appendReason(result.get("blockedReasons"), "confirmTargetDbName 与任务 targetDbName 不一致"));
      result.put("executeCopy", false);
      result.put("superPermissionClosureStatus", "blocked");
      return result;
    }

    String sourceJdbcUrl = sourceJdbcUrlFromResult(result);
    String targetJdbcUrl = targetJdbcUrlFromResult(result);
    java.util.concurrent.atomic.AtomicInteger heartbeatRows = new java.util.concurrent.atomic.AtomicInteger();
    Instant now = executedAt == null ? Instant.now() : executedAt;
    OrganizationProvisioningSuperPermissionClosureCopyClient.SuperPermissionClosureCopyResult
        copyResult =
            copyClient.copySuperPermissionClosure(
                sourceJdbcUrl,
                targetJdbcUrl,
                () -> {
                  int rows = refreshHeartbeat(jobId, workerId.trim(), now);
                  if (rows <= 0) {
                    throw new BusinessException(
                        HttpStatus.CONFLICT, "租户开通任务租约已失效，停止 Super 权限闭包复制");
                  }
                  heartbeatRows.addAndGet(rows);
                  return rows;
                });
    result.put("copyResult", copyResultMap(copyResult));
    result.put("copiedTables", copyResult.copiedTables());
    result.put("executeCopy", true);
    result.put("heartbeatUpdatedRows", heartbeatRows.get());
    result.put("nextExplicitSwitch", "executeBaseDataTables");
    result.put("superPermissionClosureCopied", true);
    result.put("superPermissionClosureExecuted", true);
    result.put("superPermissionClosureStatus", "success");
    result.put("targetWriteExecuted", true);
    return result;
  }

  private Map<String, Object> baseResult(long jobId, String workerId, Instant previewedAt) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("blockedReasons", List.of());
    result.put("executeCopy", false);
    result.put("jobId", jobId);
    result.put("leaseValid", false);
    result.put("missingSourceTables", List.of());
    result.put("missingTargetTables", List.of());
    result.put("nextExplicitSwitch", "executeSuperPermissionClosure");
    result.put("plannedCopyTables", List.of());
    result.put("previewedAt", previewedAt.toString());
    result.put("requiredStep", SEEDING_BASE_DATA_STEP);
    result.put("sourceJdbcUrlPreview", Map.of());
    result.put("sourceSuperClosure", Map.of());
    result.put("superPermissionClosureStatus", "table_not_ready");
    result.put("tableReady", false);
    result.put("targetAlreadyHasSuper", false);
    result.put("targetJdbcUrlPreview", Map.of());
    result.put("targetSuperClosure", Map.of());
    result.put("targetTable", "tenant_provisioning_job");
    result.put("targetWriteExecuted", false);
    result.put("workerId", workerId);
    return result;
  }

  private ProvisioningSuperPermissionJob findSeedingBaseDataJob(long jobId, String workerId) {
    List<ProvisioningSuperPermissionJob> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, source_customer_id, target_customer_id, target_db_name,
                   status, step, lock_owner, locked_at, heartbeat_at, update_time
            FROM tenant_provisioning_job
            WHERE id = ?
              AND lock_owner = ?
              AND status = 'provisioning'
              AND step = 'seeding_base_data'
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
          AND step = 'seeding_base_data'
        """,
        Timestamp.from(now),
        Timestamp.from(now),
        jobId,
        workerId);
  }

  private List<String> blockedReasons(ProvisioningSuperPermissionJob job) {
    java.util.ArrayList<String> reasons = new java.util.ArrayList<>();
    if (!"public".equals(job.sourceCustomerId())) {
      reasons.add("组织开通 Super 权限闭包当前只支持 public 模板库");
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

  private String resolveSourceJdbcUrl(ProvisioningSuperPermissionJob job) {
    if ("public".equals(job.sourceCustomerId())) {
      return stripWrappingQuotes(string(tenantDataSourceProperties.getPublicJdbcUrl()).trim());
    }
    return "";
  }

  private String resolveTargetJdbcUrl(ProvisioningSuperPermissionJob job) {
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

  private String sourceJdbcUrlFromResult(Map<String, Object> result) {
    return resolveSourceJdbcUrl(
        new ProvisioningSuperPermissionJob(
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

  private String targetJdbcUrlFromResult(Map<String, Object> result) {
    return resolveTargetJdbcUrl(
        new ProvisioningSuperPermissionJob(
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

  private ProvisioningSuperPermissionJob job(ResultSet rs) throws SQLException {
    return new ProvisioningSuperPermissionJob(
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

  private Map<String, Object> jobMap(ProvisioningSuperPermissionJob job) {
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

  private Map<String, Object> sourceMap(
      OrganizationProvisioningSuperPermissionClosurePreviewClient.SourceSuperPermissionClosure
          source) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("codeRowsToCopy", source.codeRowsToCopy());
    map.put("menuMetaRowsToCopy", source.menuMetaRowsToCopy());
    map.put("menuRowsToCopy", source.menuRowsToCopy());
    map.put("roleCodeRowsToCopy", source.roleCodeRowsToCopy());
    map.put("roleMenuRowsToCopy", source.roleMenuRowsToCopy());
    map.put("superRoleId", source.superRoleId());
    map.put("uniqueCodeIdsToCopy", source.uniqueCodeIdsToCopy());
    return map;
  }

  private Map<String, Object> targetMap(
      OrganizationProvisioningSuperPermissionClosurePreviewClient.TargetSuperPermissionClosure
          target) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("existingCodeRows", target.existingCodeRows());
    map.put("existingMenuMetaRows", target.existingMenuMetaRows());
    map.put("existingMenuRows", target.existingMenuRows());
    map.put("existingRoleCodeRows", target.existingRoleCodeRows());
    map.put("existingRoleMenuRows", target.existingRoleMenuRows());
    map.put("superRoleExists", target.superRoleExists());
    map.put("superRoleId", target.superRoleId());
    return map;
  }

  private Map<String, Object> copyResultMap(
      OrganizationProvisioningSuperPermissionClosureCopyClient.SuperPermissionClosureCopyResult
          copyResult) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("codeRowsCopied", copyResult.codeRowsCopied());
    map.put("copiedTables", copyResult.copiedTables());
    map.put("foreignKeyChecksDisabled", copyResult.foreignKeyChecksDisabled());
    map.put("foreignKeyChecksRestored", copyResult.foreignKeyChecksRestored());
    map.put("menuMetaRowsCopied", copyResult.menuMetaRowsCopied());
    map.put("menuRowsCopied", copyResult.menuRowsCopied());
    map.put("roleCodeRowsCopied", copyResult.roleCodeRowsCopied());
    map.put("roleMenuRowsCopied", copyResult.roleMenuRowsCopied());
    map.put("roleRowsCopied", copyResult.roleRowsCopied());
    map.put("superRoleId", copyResult.superRoleId());
    map.put("totalRowsCopied", copyResult.totalRowsCopied());
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

  private Instant instant(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant();
  }

  private String iso(Instant instant) {
    return instant == null ? null : instant.toString();
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

  private record ProvisioningSuperPermissionJob(
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
