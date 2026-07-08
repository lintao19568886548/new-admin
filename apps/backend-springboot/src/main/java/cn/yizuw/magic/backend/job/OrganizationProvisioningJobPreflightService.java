package cn.yizuw.magic.backend.job;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/** 组织空间开通 worker 的执行前预检；只读检查，不建库、不复制数据、不改变任务状态。 */
@Service
public class OrganizationProvisioningJobPreflightService {

  private static final List<String> REQUIRED_TABLES =
      List.of(
          "tenant_provisioning_job",
          "organization",
          "organization_member",
          "organization_tenant_mapping",
          "user");
  private static final Set<String> SYSTEM_DATABASE_NAMES =
      Set.of("information_schema", "mysql", "performance_schema", "sys");

  private final AppProperties appProperties;
  private final JdbcTemplate centerJdbcTemplate;
  private final Environment environment;
  private final TenantDataSourceProperties tenantDataSourceProperties;

  public OrganizationProvisioningJobPreflightService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate,
      AppProperties appProperties,
      TenantDataSourceProperties tenantDataSourceProperties,
      Environment environment) {
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.appProperties = appProperties;
    this.tenantDataSourceProperties = tenantDataSourceProperties;
    this.environment = environment;
  }

  /**
   * 预检已认领的组织开通任务。
   *
   * <p>本方法面向 `status=provisioning/step=claimed` 的任务，输出后续执行计划和阻塞原因；
   * 不执行旧 worker 中的 `DROP/CREATE DATABASE`、schema clone、数据复制或中心用户切租户动作。
   */
  public Map<String, Object> preflightClaimedJobs(
      int requestedLimit, String workerId, Long jobId, Instant preflightedAt) {
    int normalizedLimit = Math.max(1, Math.min(requestedLimit, 10));
    Instant now = preflightedAt == null ? Instant.now() : preflightedAt;
    Map<String, Boolean> tableStatus = tableStatus();
    boolean tableReady = tableStatus.values().stream().allMatch(Boolean.TRUE::equals);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("items", List.of());
    result.put("preflightedAt", now.toString());
    result.put("preflightedCount", 0);
    result.put("readyCount", 0L);
    result.put("requestedLimit", normalizedLimit);
    result.put("tableReady", tableReady);
    result.put("tableStatus", tableStatus);
    result.put("workerId", string(workerId));
    if (!Boolean.TRUE.equals(tableStatus.get("tenant_provisioning_job"))) {
      return result;
    }

    List<ProvisioningPreflightJob> jobs = findClaimedJobs(normalizedLimit, workerId, jobId);
    List<Map<String, Object>> items = jobs.stream().map(job -> preflightJob(job, tableReady)).toList();
    long readyCount = items.stream().filter(item -> Boolean.TRUE.equals(item.get("ready"))).count();
    result.put("items", items);
    result.put("preflightedCount", items.size());
    result.put("readyCount", readyCount);
    return result;
  }

  private Map<String, Object> preflightJob(ProvisioningPreflightJob job, boolean tableReady) {
    List<String> blockedReasons = new ArrayList<>();
    if (!tableReady) {
      blockedReasons.add("中心库组织开通相关表未就绪");
    }
    validateJobShape(job, blockedReasons);

    CenterUser initiator = null;
    SourceOrganization organization = null;
    List<MemberSwitchCheck> members = List.of();
    String activeMappingTarget = "";
    if (tableReady) {
      initiator = findCenterUser(job.initiatorCenterUserId());
      validateInitiator(job, initiator, blockedReasons);
      organization = findSourceOrganization(job.sourceOrgId(), job.sourceCustomerId());
      if (organization == null) {
        blockedReasons.add(
            "源组织不存在或不可迁移: sourceOrgId="
                + string(job.sourceOrgId())
                + ", sourceCustomerId="
                + string(job.sourceCustomerId()));
      }
      activeMappingTarget = findActiveOrganizationTenantMapping(job.sourceOrgId());
      if (StringUtils.hasText(activeMappingTarget)) {
        blockedReasons.add("源组织已有 active 租户映射: targetCustomerId=" + activeMappingTarget);
      }
      validateInitiatorOwnership(job, blockedReasons);
      members = findOrganizationMembers(job.sourceOrgId(), job.sourceCustomerId());
      validateMembers(job, members, blockedReasons);
    }

    Map<String, Object> item = jobMap(job);
    item.put("activeMappingTargetCustomerId", activeMappingTarget);
    item.put("blockedReasons", blockedReasons);
    item.put("centerUser", initiator == null ? null : centerUserMap(initiator));
    item.put("memberSummary", memberSummary(members));
    item.put("organization", organization == null ? null : organizationMap(organization));
    item.put("plannedSteps", plannedSteps());
    item.put("ready", blockedReasons.isEmpty());
    item.put("targetDatabaseSafety", targetDatabaseSafety(job));
    return item;
  }

  private void validateJobShape(ProvisioningPreflightJob job, List<String> blockedReasons) {
    if (!"public".equals(job.sourceCustomerId())) {
      blockedReasons.add("组织开通 worker 当前只支持 public -> 专属租户");
    }
    if (job.initiatorCenterUserId() == null || job.initiatorCenterUserId() <= 0) {
      blockedReasons.add("缺少 initiatorCenterUserId");
    }
    if (job.sourceOrgId() == null || job.sourceOrgId() <= 0) {
      blockedReasons.add("缺少 sourceOrgId");
    }
    if (!StringUtils.hasText(job.targetCustomerId())) {
      blockedReasons.add("缺少 targetCustomerId");
    } else if (!job.targetCustomerId().trim().matches("\\w+")) {
      blockedReasons.add("targetCustomerId 不合法");
    } else if ("public".equals(job.targetCustomerId().trim())) {
      blockedReasons.add("拒绝把 public 作为自动开通目标租户");
    }
    if (!StringUtils.hasText(job.targetDbName())) {
      blockedReasons.add("缺少 targetDbName");
    } else if (!validDatabaseName(job.targetDbName())) {
      blockedReasons.add("targetDbName 不合法");
    } else if (protectedDatabaseNames().contains(job.targetDbName().trim())) {
      blockedReasons.add("拒绝使用受保护数据库作为目标库: " + job.targetDbName().trim());
    }
    if (!StringUtils.hasText(tenantDataSourceProperties.getPublicJdbcUrl())) {
      blockedReasons.add("缺少 PUBLIC_DATABASE_URL，无法读取 public 源库");
    }
    if (!StringUtils.hasText(tenantDataSourceProperties.getDefaultJdbcUrl())
        && !StringUtils.hasText(tenantDataSourceProperties.getJdbcUrlTemplate())) {
      blockedReasons.add("缺少 DATABASE_URL 或 CUSTOMER_DATABASE_URL_TEMPLATE，无法解析目标租户连接");
    }
  }

  private void validateInitiator(
      ProvisioningPreflightJob job, CenterUser initiator, List<String> blockedReasons) {
    if (initiator == null) {
      blockedReasons.add("中心用户不存在: " + string(job.initiatorCenterUserId()));
      return;
    }
    if (initiator.status() != null && initiator.status() != 1) {
      blockedReasons.add("中心用户已禁用: " + initiator.id());
    }
    String customerType = string(initiator.customerType());
    if (StringUtils.hasText(customerType)
        && !customerType.equals(job.sourceCustomerId())
        && !customerType.equals(job.targetCustomerId())) {
      blockedReasons.add("中心用户已归属到其他租户: " + customerType);
    }
  }

  private void validateInitiatorOwnership(
      ProvisioningPreflightJob job, List<String> blockedReasons) {
    if (job.sourceOrgId() == null || job.initiatorCenterUserId() == null) {
      return;
    }
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM organization_member
            WHERE organization_id = ?
              AND source_customer_id = ?
              AND center_user_id = ?
              AND status = 'active'
              AND member_role = 'owner'
            """,
            Long.class,
            job.sourceOrgId(),
            job.sourceCustomerId(),
            job.initiatorCenterUserId());
    if (count == null || count <= 0) {
      blockedReasons.add(
          "开通发起人不是组织 active owner: centerUserId="
              + job.initiatorCenterUserId()
              + ", sourceOrgId="
              + job.sourceOrgId());
    }
  }

  private void validateMembers(
      ProvisioningPreflightJob job, List<MemberSwitchCheck> members, List<String> blockedReasons) {
    if (members.isEmpty()) {
      blockedReasons.add("组织缺少 active 成员: sourceOrgId=" + string(job.sourceOrgId()));
      return;
    }
    for (MemberSwitchCheck member : members) {
      if (member.centerUserId() == null) {
        blockedReasons.add("组织成员缺少 centerUserId");
        continue;
      }
      if (!member.centerUserExists()) {
        blockedReasons.add("组织成员中心用户不存在: " + member.centerUserId());
        continue;
      }
      if (member.status() != null && member.status() != 1) {
        blockedReasons.add("组织成员中心用户已禁用: " + member.centerUserId());
      }
      String customerType = string(member.customerType());
      if (StringUtils.hasText(customerType)
          && !customerType.equals(job.sourceCustomerId())
          && !customerType.equals(job.targetCustomerId())) {
        blockedReasons.add(
            "组织成员已归属到其他租户: centerUserId="
                + member.centerUserId()
                + ", customerType="
                + customerType);
      }
    }
  }

  private List<ProvisioningPreflightJob> findClaimedJobs(
      int limit, String workerId, Long jobId) {
    List<Object> args = new ArrayList<>();
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT id, initiator_center_user_id, source_org_id, source_customer_id,
                   target_customer_id, target_db_name, target_city,
                   target_company_short_name, status, step, retry_count,
                   lock_owner, locked_at, heartbeat_at, started_at, create_time, update_time
            FROM tenant_provisioning_job
            WHERE status = 'provisioning'
              AND step = 'claimed'
            """);
    if (jobId != null && jobId > 0) {
      sql.append("  AND id = ?\n");
      args.add(jobId);
    }
    if (StringUtils.hasText(workerId)) {
      sql.append("  AND lock_owner = ?\n");
      args.add(workerId.trim());
    }
    sql.append("ORDER BY locked_at ASC, id ASC\nLIMIT ?");
    args.add(limit);
    return centerJdbcTemplate.query(sql.toString(), (rs, rowNum) -> job(rs), args.toArray());
  }

  private CenterUser findCenterUser(Long centerUserId) {
    if (centerUserId == null || centerUserId <= 0) {
      return null;
    }
    List<CenterUser> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, customer_type, real_name, status, username
            FROM `user`
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) ->
                new CenterUser(
                    rs.getLong("id"),
                    rs.getString("customer_type"),
                    rs.getString("real_name"),
                    integerObject(rs, "status"),
                    rs.getString("username")),
            centerUserId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private SourceOrganization findSourceOrganization(Long sourceOrgId, String sourceCustomerId) {
    if (sourceOrgId == null || sourceOrgId <= 0 || !StringUtils.hasText(sourceCustomerId)) {
      return null;
    }
    List<SourceOrganization> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, name, source_customer_id, status
            FROM organization
            WHERE id = ?
              AND source_customer_id = ?
              AND status = 'active'
            LIMIT 1
            """,
            (rs, rowNum) ->
                new SourceOrganization(
                    rs.getLong("id"),
                    rs.getString("name"),
                    rs.getString("source_customer_id"),
                    rs.getString("status")),
            sourceOrgId,
            sourceCustomerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private String findActiveOrganizationTenantMapping(Long sourceOrgId) {
    if (sourceOrgId == null || sourceOrgId <= 0) {
      return "";
    }
    List<String> rows =
        centerJdbcTemplate.query(
            """
            SELECT target_customer_id
            FROM organization_tenant_mapping
            WHERE organization_id = ?
              AND status = 'active'
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getString("target_customer_id"),
            sourceOrgId);
    return rows.isEmpty() ? "" : string(rows.get(0));
  }

  private List<MemberSwitchCheck> findOrganizationMembers(Long sourceOrgId, String sourceCustomerId) {
    if (sourceOrgId == null || sourceOrgId <= 0 || !StringUtils.hasText(sourceCustomerId)) {
      return List.of();
    }
    return centerJdbcTemplate.query(
        """
        SELECT member.center_user_id, member.member_role, u.customer_type, u.status,
               CASE WHEN u.id IS NULL THEN 0 ELSE 1 END AS center_user_exists
        FROM organization_member member
        LEFT JOIN `user` u ON u.id = member.center_user_id
        WHERE member.organization_id = ?
          AND member.source_customer_id = ?
          AND member.status = 'active'
        ORDER BY member.member_role DESC, member.id ASC
        """,
        (rs, rowNum) ->
            new MemberSwitchCheck(
                longObject(rs, "center_user_id"),
                rs.getString("member_role"),
                rs.getString("customer_type"),
                integerObject(rs, "status"),
                rs.getInt("center_user_exists") == 1),
        sourceOrgId,
        sourceCustomerId);
  }

  private Map<String, Boolean> tableStatus() {
    Map<String, Boolean> result = new LinkedHashMap<>();
    for (String tableName : REQUIRED_TABLES) {
      result.put(tableName, tableExists(tableName));
    }
    return result;
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

  private Set<String> protectedDatabaseNames() {
    Set<String> names = new LinkedHashSet<>(SYSTEM_DATABASE_NAMES);
    addDatabaseName(names, environment.getProperty("spring.datasource.center.jdbc-url"));
    addDatabaseName(names, environment.getProperty("CENTER_DATABASE_URL"));
    addDatabaseName(names, tenantDataSourceProperties.getDefaultJdbcUrl());
    addDatabaseName(names, tenantDataSourceProperties.getPublicJdbcUrl());
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
    String normalized = stripWrappingQuotes(rawUrl.trim());
    if (normalized.startsWith("jdbc:")) {
      normalized = normalized.substring("jdbc:".length());
    }
    try {
      URI uri = URI.create(normalized);
      String path = uri.getPath();
      if (!StringUtils.hasText(path) || "/".equals(path)) {
        return "";
      }
      String[] segments = path.split("/");
      return segments.length == 0 ? "" : segments[segments.length - 1];
    } catch (IllegalArgumentException error) {
      return "";
    }
  }

  private boolean validDatabaseName(String dbName) {
    String normalized = dbName == null ? "" : dbName.trim();
    return normalized.matches("\\w+") && normalized.length() <= 100;
  }

  private Map<String, Object> targetDatabaseSafety(ProvisioningPreflightJob job) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("protectedDatabaseNames", protectedDatabaseNames());
    map.put("targetCustomerId", job.targetCustomerId());
    map.put("targetDbName", job.targetDbName());
    map.put(
        "safe",
        StringUtils.hasText(job.targetCustomerId())
            && !"public".equals(job.targetCustomerId())
            && StringUtils.hasText(job.targetDbName())
            && validDatabaseName(job.targetDbName())
            && !protectedDatabaseNames().contains(job.targetDbName().trim()));
    return map;
  }

  private List<String> plannedSteps() {
    return List.of(
        "validate_lease",
        "validate_source_organization",
        "validate_initiator_owner",
        "validate_member_switch",
        "validate_target_database_safety",
        "stop_before_database_rebuild");
  }

  private Map<String, Object> jobMap(ProvisioningPreflightJob job) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("createTime", iso(job.createTime()));
    item.put("heartbeatAt", iso(job.heartbeatAt()));
    item.put("id", job.id());
    item.put("initiatorCenterUserId", job.initiatorCenterUserId());
    item.put("lockedAt", iso(job.lockedAt()));
    item.put("lockOwner", job.lockOwner());
    item.put("retryCount", job.retryCount());
    item.put("sourceCustomerId", job.sourceCustomerId());
    item.put("sourceOrgId", job.sourceOrgId());
    item.put("startedAt", iso(job.startedAt()));
    item.put("status", job.status());
    item.put("step", job.step());
    item.put("targetCity", job.targetCity());
    item.put("targetCompanyShortName", job.targetCompanyShortName());
    item.put("targetCustomerId", job.targetCustomerId());
    item.put("targetDbName", job.targetDbName());
    item.put("updateTime", iso(job.updateTime()));
    return item;
  }

  private Map<String, Object> centerUserMap(CenterUser user) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("customerType", user.customerType());
    map.put("id", user.id());
    map.put("realName", user.realName());
    map.put("status", user.status());
    map.put("username", user.username());
    return map;
  }

  private Map<String, Object> organizationMap(SourceOrganization organization) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", organization.id());
    map.put("name", organization.name());
    map.put("sourceCustomerId", organization.sourceCustomerId());
    map.put("status", organization.status());
    return map;
  }

  private Map<String, Object> memberSummary(List<MemberSwitchCheck> members) {
    long missingUsers = members.stream().filter(member -> !member.centerUserExists()).count();
    long disabledUsers =
        members.stream().filter(member -> member.status() != null && member.status() != 1).count();
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("activeMemberCount", members.size());
    map.put("disabledCenterUserCount", disabledUsers);
    map.put("missingCenterUserCount", missingUsers);
    map.put("members", members.stream().map(this::memberMap).toList());
    return map;
  }

  private Map<String, Object> memberMap(MemberSwitchCheck member) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("centerUserExists", member.centerUserExists());
    map.put("centerUserId", member.centerUserId());
    map.put("customerType", member.customerType());
    map.put("memberRole", member.memberRole());
    map.put("status", member.status());
    return map;
  }

  private ProvisioningPreflightJob job(ResultSet rs) throws SQLException {
    return new ProvisioningPreflightJob(
        rs.getLong("id"),
        longObject(rs, "initiator_center_user_id"),
        longObject(rs, "source_org_id"),
        rs.getString("source_customer_id"),
        rs.getString("target_customer_id"),
        rs.getString("target_db_name"),
        rs.getString("target_city"),
        rs.getString("target_company_short_name"),
        rs.getString("status"),
        rs.getString("step"),
        integerObject(rs, "retry_count"),
        rs.getString("lock_owner"),
        instant(rs.getTimestamp("locked_at")),
        instant(rs.getTimestamp("heartbeat_at")),
        instant(rs.getTimestamp("started_at")),
        instant(rs.getTimestamp("create_time")),
        instant(rs.getTimestamp("update_time")));
  }

  private Long longObject(ResultSet rs, String column) throws SQLException {
    Object value = rs.getObject(column);
    return value instanceof Number number ? number.longValue() : null;
  }

  private Integer integerObject(ResultSet rs, String column) throws SQLException {
    Object value = rs.getObject(column);
    return value instanceof Number number ? number.intValue() : null;
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
    if ((value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))) {
      return value.substring(1, value.length() - 1);
    }
    return value;
  }

  private record ProvisioningPreflightJob(
      long id,
      Long initiatorCenterUserId,
      Long sourceOrgId,
      String sourceCustomerId,
      String targetCustomerId,
      String targetDbName,
      String targetCity,
      String targetCompanyShortName,
      String status,
      String step,
      Integer retryCount,
      String lockOwner,
      Instant lockedAt,
      Instant heartbeatAt,
      Instant startedAt,
      Instant createTime,
      Instant updateTime) {}

  private record CenterUser(
      long id, String customerType, String realName, Integer status, String username) {}

  private record SourceOrganization(
      long id, String name, String sourceCustomerId, String status) {}

  private record MemberSwitchCheck(
      Long centerUserId,
      String memberRole,
      String customerType,
      Integer status,
      boolean centerUserExists) {}
}
