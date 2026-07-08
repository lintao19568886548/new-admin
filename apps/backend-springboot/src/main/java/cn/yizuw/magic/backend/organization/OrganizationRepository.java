package cn.yizuw.magic.backend.organization;

import cn.yizuw.magic.backend.common.BusinessException;
import java.security.SecureRandom;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

/** 组织中心库只读数据访问层，所有查询均访问中心库。 */
@Repository
public class OrganizationRepository {

  private static final List<String> INVITATION_TABLES =
      List.of("customer", "organization", "organization_tenant_mapping", "tenant_invitation");
  private static final List<String> INVITATION_JOIN_TABLES =
      List.of(
          "customer",
          "organization",
          "organization_member",
          "organization_tenant_mapping",
          "tenant_invitation",
          "tenant_invitation_join_log",
          "user",
          "user_tenant_mapping");
  private static final List<String> PROVISIONING_TABLES =
      List.of("organization", "organization_member", "organization_tenant_mapping", "tenant_provisioning_job", "user");
  private static final List<String> FAILED_MANUAL_TABLES =
      List.of("organization", "tenant_provisioning_job", "user");
  private static final List<String> ORGANIZATION_CREATE_TABLES =
      List.of("organization", "organization_member", "user", "user_tenant_mapping");
  private static final int INVITATION_CODE_BYTES = 8;
  private static final int MAX_INVITATION_RETRY = 5;
  private static final int MAX_INVITATION_USES = 500;
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private final JdbcTemplate centerJdbcTemplate;

  public OrganizationRepository(@Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /** 查询当前组织空间的历史邀请码，旧接口固定最多返回 100 条。 */
  public Map<String, Object> findInvitations(String customerId, String defaultCustomerId) {
    ensureTables(INVITATION_TABLES, "组织邀请码表未初始化，请先执行中心库 db push");
    validateManageableCustomer(customerId, defaultCustomerId);
    List<Map<String, Object>> items =
        centerJdbcTemplate.query(
            """
            SELECT id, code, customer_id, created_by_center_user_id, role_ids, max_uses,
                   used_count, expires_at, status, remark, create_time, update_time
            FROM tenant_invitation
            WHERE customer_id = ?
            ORDER BY id DESC
            LIMIT 100
            """,
            (rs, rowNum) -> invitationMap(rs),
            customerId);
    return Map.of("items", items, "total", items.size());
  }

  /** 撤销当前组织空间的 active 邀请码，保持旧接口只返回 revoked=true。 */
  public Map<String, Object> revokeInvitation(
      String customerId, String defaultCustomerId, Object rawInvitationId) {
    ensureTables(INVITATION_TABLES, "组织邀请码表未初始化，请先执行中心库 db push");
    validateManageableCustomer(customerId, defaultCustomerId);
    Integer invitationId = objectInteger(rawInvitationId);
    if (invitationId == null || invitationId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码 ID 不合法");
    }
    int affected =
        centerJdbcTemplate.update(
            """
            UPDATE tenant_invitation
            SET status = 'revoked', update_time = NOW()
            WHERE id = ?
              AND customer_id = ?
              AND status = 'active'
            """,
            invitationId,
            customerId);
    if (affected == 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "邀请码不存在或已失效");
    }
    return Map.of("revoked", true);
  }

  /** 返回当前组织空间真实库名；创建邀请码前用于校验角色是否存在。 */
  public String findManageableCustomerDbName(String customerId, String defaultCustomerId) {
    ensureTables(INVITATION_TABLES, "组织邀请码表未初始化，请先执行中心库 db push");
    Map<String, Object> customer = validateManageableCustomer(customerId, defaultCustomerId);
    return defaultString(customer.get("dbName"));
  }

  /** 创建组织邀请码，按旧接口校验角色、次数、过期时间和备注。 */
  public Map<String, Object> createInvitation(
      JdbcTemplate tenantJdbcTemplate,
      String customerId,
      String defaultCustomerId,
      int createdByCenterUserId,
      OrganizationInvitationCreateRequest request) {
    ensureTables(INVITATION_TABLES, "组织邀请码表未初始化，请先执行中心库 db push");
    Map<String, Object> customer = validateManageableCustomer(customerId, defaultCustomerId);
    List<Integer> roleIds = normalizeRoleIds(request == null ? null : request.roleIds(), true);
    Integer maxUses = parseMaxUses(request == null ? null : request.maxUses());
    Timestamp expiresAt = parseFutureTimestamp(request == null ? null : request.expiresAt());
    String remark = parseRemark(request == null ? null : request.remark());
    validateTargetRoles(tenantJdbcTemplate, roleIds);

    for (int attempt = 0; attempt < MAX_INVITATION_RETRY; attempt++) {
      String code = generateInvitationCode();
      try {
        long invitationId =
            insertInvitation(code, customerId, createdByCenterUserId, roleIds, maxUses, expiresAt, remark);
        Map<String, Object> invitation = findInvitationById(invitationId);
        return Map.of("invitation", invitation, "organizationSpace", customer);
      } catch (RuntimeException error) {
        if (attempt == MAX_INVITATION_RETRY - 1) {
          throw error;
        }
      }
    }
    throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "邀请码创建失败");
  }

  /** 在中心库事务内锁定邀请码并准备加入计划；真正租户库写入由调用方传入目标数据源后执行。 */
  public JoinPlan prepareJoinInvitation(
      int centerUserId, String currentCustomerId, String rawCode, String defaultCustomerId) {
    ensureTables(INVITATION_JOIN_TABLES, "组织邀请码加入表未初始化，请先执行中心库 db push");
    String code = normalizeInvitationCode(rawCode);
    return new TransactionTemplate(new DataSourceTransactionManager(centerJdbcTemplate.getDataSource()))
        .execute(
            status -> {
              Map<String, Object> invitation = findInvitationByCodeForUpdate(code);
              if (invitation == null) {
                throw new BusinessException(HttpStatus.NOT_FOUND, "邀请码不存在或已失效");
              }
              assertInvitationUsable(invitation);
              List<Integer> roleIds = integerList(invitation.get("roleIds"));
              if (roleIds.isEmpty()) {
                throw new BusinessException(HttpStatus.CONFLICT, "邀请码未配置角色，请联系管理员重新创建");
              }
              String targetCustomerId = normalizeCustomerId(invitation.get("customerId"));
              Map<String, Object> customer = findActiveCustomer(targetCustomerId);
              Map<String, Object> centerUser = findCenterUserForJoin(centerUserId);
              if (customer == null) {
                throw new BusinessException(HttpStatus.NOT_FOUND, "目标组织空间不存在或已停用");
              }
              if (centerUser == null) {
                throw new BusinessException(HttpStatus.UNAUTHORIZED, "当前账号不存在或已停用");
              }
              String previousCustomerId = defaultString(centerUser.get("customerType"));
              if (StringUtils.hasText(previousCustomerId)
                  && !Objects.equals(previousCustomerId, targetCustomerId)
                  && !"public".equals(previousCustomerId)
                  && !Objects.equals(previousCustomerId, defaultCustomerId)) {
                throw new BusinessException(HttpStatus.CONFLICT, "当前账号已属于其他组织空间，不能直接加入新的组织");
              }
              if (Objects.equals(previousCustomerId, defaultCustomerId)) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "默认库账号不能通过邀请码加入组织");
              }
              Map<String, Object> targetOrganization =
                  findActiveTargetOrganization(targetCustomerId);
              boolean alreadyJoined = Objects.equals(previousCustomerId, targetCustomerId);
              return new JoinPlan(
                  integerValue(invitation.get("id")),
                  defaultString(invitation.get("code")),
                  targetCustomerId,
                  defaultString(customer.get("dbName")),
                  defaultString(customer.get("name")),
                  integerValue(targetOrganization.get("id")),
                  defaultString(targetOrganization.get("sourceCustomerId")),
                  centerUserId,
                  previousCustomerId,
                  defaultString(centerUser.get("username")),
                  defaultString(centerUser.get("password")),
                  defaultString(centerUser.get("phone")),
                  defaultString(centerUser.get("realName")),
                  roleIds,
                  alreadyJoined);
            });
  }

  /** 执行本地加入组织动作：租户账号/角色、中心映射、组织成员、邀请码计数和加入日志。 */
  public Map<String, Object> joinInvitation(
      JoinPlan plan, DataSource targetDataSource, JdbcTemplate targetJdbcTemplate) {
    validateTargetRoles(targetJdbcTemplate, plan.roleIds());
    TenantJoinUser tenantUser = prepareTenantUserForJoin(plan, targetDataSource, targetJdbcTemplate);
    try {
      return new TransactionTemplate(new DataSourceTransactionManager(centerJdbcTemplate.getDataSource()))
          .execute(status -> finalizeJoin(plan, tenantUser));
    } catch (RuntimeException error) {
      if (tenantUser.created()) {
        cleanupCreatedTenantUser(targetJdbcTemplate, tenantUser.customerUserId());
      }
      recordJoinFailureBestEffort(
          plan.invitationId(),
          plan.code(),
          plan.customerId(),
          plan.centerUserId(),
          plan.previousCustomerId(),
          error instanceof BusinessException ? error.getMessage() : String.valueOf(error.getMessage()));
      throw error;
    }
  }

  /** 查询当前账号的组织空间开通状态，兼容旧个人中心状态字段。 */
  public Map<String, Object> findProvisioningStatus(int centerUserId, String sourceCustomerId) {
    ensureTables(PROVISIONING_TABLES, "组织开通表未初始化，请先执行中心库 db push");
    Map<String, Object> centerUser = findCenterUser(centerUserId);
    if (centerUser == null) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "验证失败");
    }
    Map<String, Object> job = findProvisioningJobForProfile(centerUserId, sourceCustomerId);
    String rawStatus = defaultString(job == null ? null : job.get("status"));
    String status = "reserved".equals(rawStatus) || rawStatus.isBlank() ? "none" : rawStatus;
    boolean exposeJob = !"reserved".equals(rawStatus);
    OrganizationState organizationState = findSourceOrganizationState(centerUserId, sourceCustomerId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("currentCustomerId", defaultString(centerUser.get("customerType")));
    result.put("isOrganizationProvisioning", List.of("pending", "provisioning").contains(status));
    result.put("organizationProvisioningMessage", provisioningMessage(status));
    result.put("organizationProvisioningStatus", status);
    result.put(
        "requiresRelogin",
        StringUtils.hasText(defaultString(centerUser.get("customerType")))
            && StringUtils.hasText(sourceCustomerId)
            && !Objects.equals(defaultString(centerUser.get("customerType")), sourceCustomerId));
    result.put("sourceCustomerId", exposeJob && job != null ? job.get("sourceCustomerId") : null);
    result.put("sourceOrganization", organizationState.membership());
    result.put("sourceOrganizationCount", organizationState.total());
    result.put("targetCity", job == null ? null : job.get("targetCity"));
    result.put("targetCompanyShortName", job == null ? null : job.get("targetCompanyShortName"));
    result.put("targetCustomerId", exposeJob && job != null ? job.get("targetCustomerId") : null);
    return result;
  }

  /** 查询 failed_manual 开通任务，并补充组织、发起人和最近支付信息。 */
  public Map<String, Object> findFailedManualJobs(int limit) {
    ensureTables(FAILED_MANUAL_TABLES, "组织开通任务表未初始化，请先执行中心库 db push");
    List<Map<String, Object>> jobs =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM tenant_provisioning_job
            WHERE status = 'failed_manual'
            ORDER BY update_time DESC, id DESC
            LIMIT ?
            """,
            (rs, rowNum) -> jobMap(rs),
            limit);
    enrichFailedManualJobs(jobs);
    return Map.of("items", jobs, "total", jobs.size());
  }

  /**
   * 重排 failed_manual 开通任务。
   *
   * <p>execute=false 时只返回确认串；execute=true 时仅把任务重置为 pending，不直接执行开通 worker。
   */
  public Map<String, Object> requeueFailedManualJob(
      OrganizationProvisioningRequeueRequest request, String operator) {
    ensureTables(FAILED_MANUAL_TABLES, "组织开通任务表未初始化，请先执行中心库 db push");
    Integer jobId = objectInteger(request == null ? null : request.jobId());
    if (jobId == null || jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "jobId 必须是正整数");
    }

    Map<String, Object> job = findProvisioningJobById(jobId);
    if (job == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "组织空间开通任务不存在: " + jobId);
    }
    assertJobCanBeRequeued(job);
    Map<String, Object> organization = findActivePublicSourceOrganization(job);
    String confirmation = buildRequeueConfirmation(job);
    boolean execute = Boolean.TRUE.equals(request == null ? null : request.execute());

    if (!execute) {
      return Map.of(
          "confirmation",
          confirmation,
          "execute",
          false,
          "job",
          job,
          "message",
          "预览模式，未写入。确认已修复根因后，携带 execute=true 和 confirmation 重排任务。",
          "organization",
          organization);
    }

    String requestConfirmation = defaultString(request.confirmation()).trim();
    if (!confirmation.equals(requestConfirmation)) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "确认串不匹配，请使用 confirmation=" + confirmation);
    }

    int affected =
        centerJdbcTemplate.update(
            """
            UPDATE tenant_provisioning_job
            SET completed_at = NULL,
                error_message = NULL,
                heartbeat_at = NULL,
                locked_at = NULL,
                lock_owner = NULL,
                retry_count = 0,
                started_at = NULL,
                status = 'pending',
                step = 'manual_requeued',
                update_time = NOW()
            WHERE id = ?
              AND status = 'failed_manual'
            """,
            jobId);
    if (affected == 0) {
      throw new BusinessException(HttpStatus.CONFLICT, "任务状态已变化，重排未执行，请重新预览后再操作");
    }

    Map<String, Object> updatedJob = findProvisioningJobById(jobId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("confirmation", confirmation);
    result.put("execute", true);
    result.put("job", updatedJob);
    result.put("message", "任务已重置为 pending，worker 下一轮将全量重建目标库。");
    result.put("operator", StringUtils.hasText(operator) ? operator : "unknown");
    result.put("organization", organization);
    result.put("previousJob", job);
    return result;
  }

  /**
   * 创建或补齐 public 试用账号的 source organization。
   *
   * <p>该方法只写中心库 organization 与 organization_member；不创建 customer、不写开通任务、不连接目标租户库。
   */
  public Map<String, Object> ensureSingleOwnerSourceOrganization(
      int centerUserId,
      String sourceCustomerId,
      Long rawSourceUserId,
      String city,
      String companyShortName) {
    ensureTables(ORGANIZATION_CREATE_TABLES, "组织基础表未初始化，请先执行中心库 db push");
    String normalizedSourceCustomerId = normalizeCustomerId(sourceCustomerId);
    return new TransactionTemplate(new DataSourceTransactionManager(centerJdbcTemplate.getDataSource()))
        .execute(
            status -> {
              lockCenterUser(centerUserId);
              Map<String, Object> centerUser = findCenterUser(centerUserId);
              if (centerUser == null || inactiveStatus(centerUser.get("status"))) {
                throw new BusinessException(HttpStatus.UNAUTHORIZED, "组织 owner 中心账号不存在或已停用");
              }
              Long sourceUserId =
                  rawSourceUserId != null && rawSourceUserId > 0
                      ? rawSourceUserId
                      : findMappedSourceUserId(centerUserId, normalizedSourceCustomerId);
              if (sourceUserId == null || sourceUserId <= 0) {
                throw new BusinessException(HttpStatus.CONFLICT, "组织 owner 缺少可绑定的来源库账号");
              }

              List<Map<String, Object>> memberships =
                  listActiveOrganizationMemberships(centerUserId).stream()
                      .filter(
                          item ->
                              Objects.equals(
                                  defaultString(item.get("sourceCustomerId")),
                                  normalizedSourceCustomerId))
                      .toList();
              if (memberships.size() > 1) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "当前账号绑定多个 active 组织，请先选择要开通的组织");
              }
              if (memberships.size() == 1) {
                Map<String, Object> membership =
                    ensureExistingOwnerOrganizationIdentity(
                        memberships.get(0), centerUserId, sourceUserId, city, companyShortName);
                return sourceOrganization(membership);
              }

              int organizationId =
                  createSourceOrganization(
                      centerUserId,
                      normalizedSourceCustomerId,
                      city,
                      companyShortName,
                      buildOrganizationName(centerUser, city, companyShortName));
              createOwnerOrganizationMember(
                  organizationId, centerUserId, normalizedSourceCustomerId, sourceUserId);
              Map<String, Object> membership = new LinkedHashMap<>();
              membership.put("city", city);
              membership.put("companyShortName", companyShortName);
              membership.put("id", organizationId);
              membership.put("memberRole", "owner");
              membership.put("name", buildOrganizationName(centerUser, city, companyShortName));
              membership.put("sourceCustomerId", normalizedSourceCustomerId);
              membership.put("sourceUserId", sourceUserId);
              return sourceOrganization(membership);
            });
  }

  private void lockCenterUser(int centerUserId) {
    centerJdbcTemplate.queryForList("SELECT id FROM user WHERE id = ? FOR UPDATE", Integer.class, centerUserId);
  }

  private boolean inactiveStatus(Object status) {
    Integer parsed = objectInteger(status);
    return parsed != null && parsed == 0;
  }

  private Long findMappedSourceUserId(int centerUserId, String sourceCustomerId) {
    List<Long> rows =
        centerJdbcTemplate.queryForList(
            """
            SELECT customer_user_id
            FROM user_tenant_mapping
            WHERE center_user_id = ?
              AND customer_id = ?
            LIMIT 1
            """,
            Long.class,
            centerUserId,
            sourceCustomerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> ensureExistingOwnerOrganizationIdentity(
      Map<String, Object> membership,
      int centerUserId,
      Long sourceUserId,
      String city,
      String companyShortName) {
    if (!"owner".equals(defaultString(membership.get("memberRole")))) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "当前账号已加入组织，不能再创建新组织");
    }
    Integer organizationId = objectInteger(membership.get("id"));
    if (organizationId == null || organizationId <= 0) {
      throw new BusinessException(HttpStatus.CONFLICT, "组织数据异常，请联系管理员处理");
    }

    boolean hasCity = StringUtils.hasText(defaultString(membership.get("city")));
    boolean hasCompanyShortName = StringUtils.hasText(defaultString(membership.get("companyShortName")));
    if (!hasCity || !hasCompanyShortName) {
      centerJdbcTemplate.update(
          """
          UPDATE organization
          SET city = IF(? IS NULL OR ? = '', city, ?),
              company_short_name = IF(? IS NULL OR ? = '', company_short_name, ?),
              update_time = NOW()
          WHERE id = ?
          """,
          hasCity ? null : city,
          hasCity ? null : city,
          hasCity ? null : city,
          hasCompanyShortName ? null : companyShortName,
          hasCompanyShortName ? null : companyShortName,
          hasCompanyShortName ? null : companyShortName,
          organizationId);
      membership = findOrganizationMembership(organizationId, centerUserId);
    }
    centerJdbcTemplate.update(
        """
        UPDATE organization_member
        SET source_user_id = IFNULL(source_user_id, ?), update_time = NOW()
        WHERE organization_id = ?
          AND center_user_id = ?
        """,
        sourceUserId,
        organizationId,
        centerUserId);
    membership.put("sourceUserId", sourceUserId);
    return membership;
  }

  private int createSourceOrganization(
      int centerUserId,
      String sourceCustomerId,
      String city,
      String companyShortName,
      String organizationName) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    centerJdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO organization (
                    name, city, company_short_name, source_customer_id, status,
                    created_by_center_user_id, legacy, create_time, update_time
                  ) VALUES (
                    ?, ?, ?, ?, 'active', ?, false, NOW(), NOW()
                  )
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, organizationName);
          statement.setString(2, city);
          statement.setString(3, companyShortName);
          statement.setString(4, sourceCustomerId);
          statement.setInt(5, centerUserId);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "组织创建后读取失败");
    }
    return key.intValue();
  }

  private void createOwnerOrganizationMember(
      int organizationId, int centerUserId, String sourceCustomerId, Long sourceUserId) {
    centerJdbcTemplate.update(
        """
        INSERT INTO organization_member (
          organization_id, center_user_id, source_customer_id, source_user_id,
          member_role, status, joined_at, create_time, update_time
        ) VALUES (
          ?, ?, ?, ?, 'owner', 'active', NOW(), NOW(), NOW()
        )
        """,
        organizationId,
        centerUserId,
        sourceCustomerId,
        sourceUserId);
  }

  private String buildOrganizationName(
      Map<String, Object> centerUser, String city, String companyShortName) {
    String name =
        firstText(
            companyShortName,
            defaultString(centerUser.get("realName")),
            defaultString(centerUser.get("username")),
            city,
            "未命名组织");
    return name.length() > 100 ? name.substring(0, 100) : name;
  }

  private Map<String, Object> findOrganizationMembership(int organizationId, int centerUserId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT o.id, o.name, o.city, o.company_short_name, o.source_customer_id,
                   member.center_user_id, member.member_role
            FROM organization_member member
            INNER JOIN organization o ON o.id = member.organization_id
            WHERE o.id = ?
              AND member.center_user_id = ?
              AND member.status = 'active'
              AND o.status = 'active'
            LIMIT 1
            """,
            (rs, rowNum) -> organizationMembershipMap(rs),
            organizationId,
            centerUserId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.CONFLICT, "组织数据异常，请联系管理员处理");
    }
    return rows.get(0);
  }

  private String firstText(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value.trim();
      }
    }
    return "";
  }

  private Map<String, Object> validateManageableCustomer(String customerId, String defaultCustomerId) {
    List<Map<String, Object>> customers =
        centerJdbcTemplate.query(
            """
            SELECT customer_id, db_name, name, status
            FROM customer
            WHERE customer_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("customerId", rs.getString("customer_id"));
              row.put("dbName", rs.getString("db_name"));
              row.put("name", rs.getString("name"));
              row.put("status", rs.getObject("status", Integer.class));
              return row;
            },
            customerId);
    if (customers.isEmpty() || objectInteger(customers.get(0).get("status")) != null
        && objectInteger(customers.get(0).get("status")) == 0) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "组织空间不存在或已停用");
    }
    if ("public".equals(customerId) || Objects.equals(customerId, defaultCustomerId)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "公共库和默认库不能创建组织邀请码");
    }
    Long mappingCount =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM organization_tenant_mapping m
            INNER JOIN organization o ON o.id = m.organization_id
            WHERE m.target_customer_id = ?
              AND m.status = 'active'
              AND o.status = 'active'
            """,
            Long.class,
            customerId);
    if (mappingCount == null || mappingCount == 0) {
      throw new BusinessException(HttpStatus.CONFLICT, "目标组织空间未完成组织映射，请先回填组织关系");
    }
    return customers.get(0);
  }

  private void validateTargetRoles(JdbcTemplate tenantJdbcTemplate, List<Integer> roleIds) {
    if (roleIds == null || roleIds.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建邀请码必须指定至少一个组织角色");
    }
    if (!tableExists(tenantJdbcTemplate, "role")) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "目标租户 role 表未初始化");
    }
    String placeholders = placeholders(roleIds.size());
    List<Integer> existingRoleIds =
        tenantJdbcTemplate.queryForList(
            "SELECT role_id FROM role WHERE role_id IN ("
                + placeholders
                + ") AND (status IS NULL OR status <> 0)",
            Integer.class,
            roleIds.toArray());
    List<Integer> missing =
        roleIds.stream().filter(roleId -> !existingRoleIds.contains(roleId)).toList();
    if (!missing.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织角色不存在或已停用: " + joinInts(missing));
    }
  }

  private long insertInvitation(
      String code,
      String customerId,
      int createdByCenterUserId,
      List<Integer> roleIds,
      Integer maxUses,
      Timestamp expiresAt,
      String remark) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    centerJdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO tenant_invitation (
                    code, customer_id, created_by_center_user_id, role_ids, max_uses,
                    used_count, expires_at, status, remark, create_time, update_time
                  ) VALUES (
                    ?, ?, ?, ?, ?, 0, ?, 'active', ?, NOW(), NOW()
                  )
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, code);
          statement.setString(2, customerId);
          statement.setInt(3, createdByCenterUserId);
          statement.setString(4, joinInts(roleIds));
          if (maxUses == null) {
            statement.setNull(5, Types.INTEGER);
          } else {
            statement.setInt(5, maxUses);
          }
          if (expiresAt == null) {
            statement.setNull(6, Types.TIMESTAMP);
          } else {
            statement.setTimestamp(6, expiresAt);
          }
          statement.setString(7, remark);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "邀请码创建后读取失败");
    }
    return key.longValue();
  }

  private Map<String, Object> findInvitationById(long invitationId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, code, customer_id, created_by_center_user_id, role_ids, max_uses,
                   used_count, expires_at, status, remark, create_time, update_time
            FROM tenant_invitation
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> invitationMap(rs),
            invitationId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "邀请码创建后读取失败");
    }
    return rows.get(0);
  }

  private Map<String, Object> findInvitationByCodeForUpdate(String code) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, code, customer_id, created_by_center_user_id, role_ids, max_uses,
                   used_count, expires_at, status, remark, create_time, update_time
            FROM tenant_invitation
            WHERE code = ?
            LIMIT 1
            FOR UPDATE
            """,
            (rs, rowNum) -> invitationMap(rs),
            code);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findActiveCustomer(String customerId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT customer_id, db_name, name, status
            FROM customer
            WHERE customer_id = ?
              AND (status IS NULL OR status <> 0)
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("customerId", rs.getString("customer_id"));
              row.put("dbName", rs.getString("db_name"));
              row.put("name", rs.getString("name"));
              row.put("status", rs.getObject("status", Integer.class));
              return row;
            },
            customerId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findCenterUserForJoin(int centerUserId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, customer_type, password, phone, real_name, status, token_version, username
            FROM user
            WHERE id = ?
              AND (status IS NULL OR status <> 0)
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("customerType", rs.getString("customer_type"));
              row.put("id", rs.getInt("id"));
              row.put("password", rs.getString("password"));
              row.put("phone", rs.getString("phone"));
              row.put("realName", rs.getString("real_name"));
              row.put("status", rs.getObject("status", Integer.class));
              row.put("tokenVersion", rs.getObject("token_version"));
              row.put("username", rs.getString("username"));
              return row;
            },
            centerUserId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findActiveTargetOrganization(String customerId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT o.id, o.source_customer_id
            FROM organization_tenant_mapping m
            INNER JOIN organization o ON o.id = m.organization_id
            WHERE m.target_customer_id = ?
              AND m.status = 'active'
              AND o.status = 'active'
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("id", rs.getInt("id"));
              row.put("sourceCustomerId", rs.getString("source_customer_id"));
              return row;
            },
            customerId);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.CONFLICT, "目标组织空间未完成组织映射，请先回填组织关系");
    }
    return rows.get(0);
  }

  private TenantJoinUser prepareTenantUserForJoin(
      JoinPlan plan, DataSource targetDataSource, JdbcTemplate targetJdbcTemplate) {
    return new TransactionTemplate(new DataSourceTransactionManager(targetDataSource))
        .execute(
            status -> {
              TenantJoinUser mapped = findMappedTenantUser(plan, targetJdbcTemplate);
              if (mapped != null) {
                replaceUserRoles(targetJdbcTemplate, mapped.customerUserId(), plan.roleIds());
                return mapped;
              }
              TenantJoinUser existing = findExistingTenantUser(plan, targetJdbcTemplate);
              if (existing != null) {
                replaceUserRoles(targetJdbcTemplate, existing.customerUserId(), plan.roleIds());
                return existing;
              }
              if (plan.alreadyJoined()) {
                throw new BusinessException(HttpStatus.CONFLICT, "当前账号在目标组织空间的账号不存在或已停用，请联系管理员处理");
              }
              long createdId = createTenantUserForJoin(plan, targetJdbcTemplate);
              replaceUserRoles(targetJdbcTemplate, createdId, plan.roleIds());
              return new TenantJoinUser(createdId, true);
            });
  }

  private TenantJoinUser findMappedTenantUser(JoinPlan plan, JdbcTemplate targetJdbcTemplate) {
    List<Long> mappedIds =
        centerJdbcTemplate.queryForList(
            """
            SELECT customer_user_id
            FROM user_tenant_mapping
            WHERE center_user_id = ?
              AND customer_id = ?
            LIMIT 1
            """,
            Long.class,
            plan.centerUserId(),
            plan.customerId());
    if (mappedIds.isEmpty()) {
      return null;
    }
    Long customerUserId = mappedIds.get(0);
    if (customerUserId == null || !tenantUserActive(targetJdbcTemplate, customerUserId)) {
      throw new BusinessException(HttpStatus.CONFLICT, "当前账号在目标组织空间的映射异常，请联系管理员处理");
    }
    return new TenantJoinUser(customerUserId, false);
  }

  private TenantJoinUser findExistingTenantUser(JoinPlan plan, JdbcTemplate targetJdbcTemplate) {
    if (!StringUtils.hasText(plan.username())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "当前账号缺少用户名，不能加入组织");
    }
    List<Map<String, Object>> rows =
        targetJdbcTemplate.query(
            """
            SELECT id, status
            FROM user
            WHERE username = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("id", rs.getLong("id"));
              row.put("status", rs.getObject("status", Integer.class));
              return row;
            },
            plan.username());
    if (rows.isEmpty()) {
      return null;
    }
    Integer status = objectInteger(rows.get(0).get("status"));
    if (status != null && status == 0) {
      throw new BusinessException(HttpStatus.CONFLICT, "目标组织空间已存在同名停用账号，请联系管理员处理");
    }
    long customerUserId = ((Number) rows.get(0).get("id")).longValue();
    List<Long> mappedCenterIds =
        centerJdbcTemplate.queryForList(
            """
            SELECT center_user_id
            FROM user_tenant_mapping
            WHERE customer_id = ?
              AND customer_user_id = ?
            LIMIT 1
            """,
            Long.class,
            plan.customerId(),
            customerUserId);
    if (!mappedCenterIds.isEmpty()
        && mappedCenterIds.get(0) != null
        && mappedCenterIds.get(0) != plan.centerUserId()) {
      throw new BusinessException(HttpStatus.CONFLICT, "目标组织空间已存在同名账号，请联系管理员处理");
    }
    return new TenantJoinUser(customerUserId, false);
  }

  private long createTenantUserForJoin(JoinPlan plan, JdbcTemplate targetJdbcTemplate) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    targetJdbcTemplate.update(
        connection -> {
          PreparedStatement statement =
              connection.prepareStatement(
                  """
                  INSERT INTO user (
                    real_name, username, password, customer_type, status,
                    token_version, phone, create_time, update_time
                  ) VALUES (
                    ?, ?, ?, ?, 1, 1, ?, NOW(), NOW()
                  )
                  """,
                  Statement.RETURN_GENERATED_KEYS);
          statement.setString(1, plan.realName());
          statement.setString(2, plan.username());
          statement.setString(3, plan.password());
          statement.setString(4, plan.customerId());
          statement.setString(5, StringUtils.hasText(plan.phone()) ? plan.phone() : null);
          return statement;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "租户账号创建失败");
    }
    return key.longValue();
  }

  private Map<String, Object> finalizeJoin(JoinPlan plan, TenantJoinUser tenantUser) {
    if (plan.alreadyJoined()) {
      upsertUserTenantMapping(plan, tenantUser.customerUserId());
      upsertOrganizationMember(plan, tenantUser.customerUserId());
      return joinResult(plan, true, false);
    }
    consumeInvitationUse(plan);
    upsertUserTenantMapping(plan, tenantUser.customerUserId());
    upsertOrganizationMember(plan, tenantUser.customerUserId());
    centerJdbcTemplate.update(
        """
        UPDATE user
        SET customer_type = ?, token_version = token_version + 1, update_time = NOW()
        WHERE id = ?
        """,
        plan.customerId(),
        plan.centerUserId());
    centerJdbcTemplate.update(
        "UPDATE refresh_token SET revoked_at = NOW(), update_time = NOW() WHERE user_id = ? AND revoked_at IS NULL",
        plan.centerUserId());
    upsertJoinLog(plan, tenantUser.customerUserId(), "joined", null);
    return joinResult(plan, false, true);
  }

  private void consumeInvitationUse(JoinPlan plan) {
    int affected =
        centerJdbcTemplate.update(
            """
            UPDATE tenant_invitation
            SET used_count = used_count + 1, update_time = NOW()
            WHERE id = ?
              AND code = ?
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > NOW())
              AND (max_uses IS NULL OR used_count < max_uses)
            """,
            plan.invitationId(),
            plan.code());
    if (affected == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码已失效");
    }
  }

  private void upsertUserTenantMapping(JoinPlan plan, long customerUserId) {
    centerJdbcTemplate.update(
        """
        INSERT INTO user_tenant_mapping (
          center_user_id, customer_id, customer_user_id, db_name, create_time, update_time
        ) VALUES (
          ?, ?, ?, ?, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          customer_user_id = VALUES(customer_user_id),
          db_name = VALUES(db_name),
          update_time = NOW()
        """,
        plan.centerUserId(),
        plan.customerId(),
        customerUserId,
        StringUtils.hasText(plan.dbName()) ? plan.dbName() : null);
  }

  private void upsertOrganizationMember(JoinPlan plan, long customerUserId) {
    centerJdbcTemplate.update(
        """
        INSERT INTO organization_member (
          organization_id, center_user_id, source_customer_id, source_user_id,
          member_role, status, joined_at, create_time, update_time
        ) VALUES (
          ?, ?, ?, ?, 'member', 'active', NOW(), NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          source_customer_id = IFNULL(source_customer_id, VALUES(source_customer_id)),
          source_user_id = IFNULL(source_user_id, VALUES(source_user_id)),
          member_role = IF(member_role = 'owner', member_role, 'member'),
          status = 'active',
          joined_at = NOW(),
          update_time = NOW()
        """,
        plan.organizationId(),
        plan.centerUserId(),
        StringUtils.hasText(plan.organizationSourceCustomerId())
            ? plan.organizationSourceCustomerId()
            : plan.customerId(),
        customerUserId);
  }

  private void upsertJoinLog(
      JoinPlan plan, Long customerUserId, String status, String errorMessage) {
    centerJdbcTemplate.update(
        """
        INSERT INTO tenant_invitation_join_log (
          invitation_id, code, customer_id, center_user_id, customer_user_id,
          previous_customer_id, status, error_message, joined_at, create_time, update_time
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'joined', NOW(), NULL), NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          customer_user_id = VALUES(customer_user_id),
          previous_customer_id = VALUES(previous_customer_id),
          status = VALUES(status),
          error_message = VALUES(error_message),
          joined_at = VALUES(joined_at),
          update_time = NOW()
        """,
        plan.invitationId(),
        plan.code(),
        plan.customerId(),
        plan.centerUserId(),
        customerUserId,
        StringUtils.hasText(plan.previousCustomerId()) ? plan.previousCustomerId() : null,
        status,
        errorMessage,
        status);
  }

  private void recordJoinFailureBestEffort(
      int invitationId,
      String code,
      String customerId,
      int centerUserId,
      String previousCustomerId,
      String errorMessage) {
    try {
      JoinPlan failurePlan =
          new JoinPlan(
              invitationId,
              code,
              customerId,
              "",
              "",
              0,
              "",
              centerUserId,
              previousCustomerId,
              "",
              "",
              "",
              "",
              List.of(),
              false);
      upsertJoinLog(
          failurePlan,
          null,
          "failed",
          defaultString(errorMessage).length() > 2000
              ? defaultString(errorMessage).substring(0, 2000)
              : defaultString(errorMessage));
    } catch (RuntimeException ignored) {
      // 失败审计不能影响主错误返回。
    }
  }

  private Map<String, Object> joinResult(
      JoinPlan plan, boolean alreadyJoined, boolean requiresRelogin) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("alreadyJoined", alreadyJoined);
    result.put("customerId", plan.customerId());
    result.put("customerName", plan.customerName());
    result.put("joined", true);
    result.put("organizationSpaceId", plan.customerId());
    result.put("organizationSpaceName", plan.customerName());
    result.put("requiresRelogin", requiresRelogin);
    return result;
  }

  private void replaceUserRoles(
      JdbcTemplate targetJdbcTemplate, long customerUserId, List<Integer> roleIds) {
    targetJdbcTemplate.update("DELETE FROM user_role WHERE user_id = ?", customerUserId);
    for (Integer roleId : roleIds) {
      targetJdbcTemplate.update(
          "INSERT INTO user_role (user_id, role_id, create_time, update_time) VALUES (?, ?, NOW(), NOW())",
          customerUserId,
          roleId);
    }
  }

  private void cleanupCreatedTenantUser(JdbcTemplate targetJdbcTemplate, long customerUserId) {
    try {
      targetJdbcTemplate.update("DELETE FROM user_role WHERE user_id = ?", customerUserId);
      if (tableExists(targetJdbcTemplate, "user_code")) {
        targetJdbcTemplate.update("DELETE FROM user_code WHERE user_id = ?", customerUserId);
      }
      targetJdbcTemplate.update("DELETE FROM user WHERE id = ?", customerUserId);
    } catch (RuntimeException ignored) {
      // best-effort cleanup after a cross-database failure.
    }
  }

  private boolean tenantUserActive(JdbcTemplate targetJdbcTemplate, long customerUserId) {
    List<Integer> rows =
        targetJdbcTemplate.queryForList(
            "SELECT status FROM user WHERE id = ? LIMIT 1", Integer.class, customerUserId);
    if (rows.isEmpty()) {
      return false;
    }
    Integer status = rows.get(0);
    return status == null || status != 0;
  }

  private void assertInvitationUsable(Map<String, Object> invitation) {
    if (!"active".equals(defaultString(invitation.get("status")))) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码已失效");
    }
    String expiresAt = defaultString(invitation.get("expiresAt"));
    if (StringUtils.hasText(expiresAt)) {
      Instant expiresInstant = Instant.parse(expiresAt);
      if (!expiresInstant.isAfter(Instant.now())) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码已过期");
      }
    }
    Integer maxUses = objectInteger(invitation.get("maxUses"));
    Integer usedCount = objectInteger(invitation.get("usedCount"));
    if (maxUses != null && usedCount != null && usedCount >= maxUses) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码使用次数已用完");
    }
  }

  private List<Integer> normalizeRoleIds(Object value, boolean required) {
    List<Object> rawItems = new ArrayList<>();
    if (value instanceof Iterable<?> iterable) {
      for (Object item : iterable) {
        rawItems.add(item);
      }
    } else if (value instanceof String text) {
      rawItems.addAll(Arrays.asList(text.split(",")));
    }
    List<Integer> roleIds =
        rawItems.stream()
            .map(this::objectInteger)
            .filter(id -> id != null && id > 0)
            .distinct()
            .toList();
    if (required && roleIds.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "创建邀请码必须指定至少一个组织角色");
    }
    if (roleIds.size() > 20) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码角色数量不能超过 20 个");
    }
    return roleIds;
  }

  private Integer parseMaxUses(Object value) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    Integer maxUses = objectInteger(value);
    if (maxUses == null || maxUses <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "最大使用次数必须为正整数");
    }
    if (maxUses > MAX_INVITATION_USES) {
      throw new BusinessException(
          HttpStatus.BAD_REQUEST, "单个邀请码最多允许使用 " + MAX_INVITATION_USES + " 次");
    }
    return maxUses;
  }

  private Timestamp parseFutureTimestamp(Object value) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return null;
    }
    Instant instant;
    String text = String.valueOf(value).trim();
    try {
      instant = Instant.parse(text);
    } catch (DateTimeParseException firstError) {
      try {
        instant = OffsetDateTime.parse(text).toInstant();
      } catch (DateTimeParseException secondError) {
        try {
          instant = LocalDate.parse(text).atStartOfDay().toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException thirdError) {
          throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码过期时间格式不正确");
        }
      }
    }
    if (!instant.isAfter(Instant.now())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码过期时间必须晚于当前时间");
    }
    return Timestamp.from(instant);
  }

  private String parseRemark(Object value) {
    String remark = value == null ? "" : String.valueOf(value).trim();
    if (!StringUtils.hasText(remark)) {
      return null;
    }
    if (remark.length() > 200) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "备注不能超过 200 个字符");
    }
    return remark;
  }

  private String normalizeInvitationCode(String value) {
    String code =
        defaultString(value).trim().replaceAll("[\\s-]+", "").toUpperCase(Locale.ROOT);
    if (!StringUtils.hasText(code)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码不能为空");
    }
    if (!code.matches("[A-Z0-9]{6,32}")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "邀请码格式不正确");
    }
    return code;
  }

  private String normalizeCustomerId(Object value) {
    String customerId = defaultString(value).trim();
    if (!StringUtils.hasText(customerId) || !customerId.matches("\\w+")) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "组织 customerId 不合法");
    }
    return customerId;
  }

  private String generateInvitationCode() {
    byte[] bytes = new byte[INVITATION_CODE_BYTES];
    SECURE_RANDOM.nextBytes(bytes);
    return HexFormat.of().formatHex(bytes).toUpperCase(Locale.ROOT);
  }

  private List<Integer> integerList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream()
          .map(this::objectInteger)
          .filter(id -> id != null && id > 0)
          .toList();
    }
    return parseRoleIds(defaultString(value));
  }

  private int integerValue(Object value) {
    Integer parsed = objectInteger(value);
    return parsed == null ? 0 : parsed;
  }

  private String joinInts(List<Integer> values) {
    return values.stream().map(String::valueOf).collect(Collectors.joining(","));
  }

  private Map<String, Object> findCenterUser(int centerUserId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT id, customer_type, real_name, status, username
            FROM user
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("customerType", rs.getString("customer_type"));
              row.put("id", rs.getInt("id"));
              row.put("realName", rs.getString("real_name"));
              row.put("status", rs.getObject("status", Integer.class));
              row.put("username", rs.getString("username"));
              return row;
            },
            centerUserId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findProvisioningJobForProfile(
      int centerUserId, String sourceCustomerId) {
    if ("public".equals(sourceCustomerId)) {
      List<Integer> organizationIds =
          centerJdbcTemplate.queryForList(
              """
              SELECT organization_id
              FROM organization_member
              WHERE center_user_id = ?
                AND source_customer_id = 'public'
                AND status = 'active'
              ORDER BY id ASC
              """,
              Integer.class,
              centerUserId);
      List<Integer> distinctOrganizationIds =
          organizationIds.stream().filter(Objects::nonNull).distinct().toList();
      if (distinctOrganizationIds.size() == 1) {
        Map<String, Object> job = findLatestProvisioningJobBySourceOrgId(distinctOrganizationIds.get(0));
        if (job != null) {
          return job;
        }
      }
    }
    return findLatestProvisioningJobByInitiator(centerUserId);
  }

  private Map<String, Object> findLatestProvisioningJobByInitiator(int centerUserId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM tenant_provisioning_job
            WHERE initiator_center_user_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> jobMap(rs),
            centerUserId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findLatestProvisioningJobBySourceOrgId(int sourceOrgId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM tenant_provisioning_job
            WHERE source_org_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> jobMap(rs),
            sourceOrgId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findProvisioningJobById(int jobId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT *
            FROM tenant_provisioning_job
            WHERE id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> jobMap(rs),
            jobId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void assertJobCanBeRequeued(Map<String, Object> job) {
    String status = defaultString(job.get("status"));
    if (!"failed_manual".equals(status)) {
      throw new BusinessException(HttpStatus.CONFLICT, "仅允许重排 failed_manual 任务，当前状态为 " + status);
    }
    String sourceCustomerId = defaultString(job.get("sourceCustomerId"));
    if (!"public".equals(sourceCustomerId)) {
      throw new BusinessException(
          HttpStatus.CONFLICT,
          "仅允许重排 public -> 组织空间任务，当前 sourceCustomerId=" + sourceCustomerId);
    }
    if (!StringUtils.hasText(defaultString(job.get("targetCustomerId")))) {
      throw new BusinessException(HttpStatus.CONFLICT, "任务缺少 targetCustomerId，不能安全重排，请先定位根因");
    }
    if (objectInteger(job.get("sourceOrgId")) == null) {
      throw new BusinessException(HttpStatus.CONFLICT, "任务缺少 sourceOrgId，不能安全重排，请先按组织补齐开通任务");
    }
  }

  private Map<String, Object> findActivePublicSourceOrganization(Map<String, Object> job) {
    Integer sourceOrgId = objectInteger(job.get("sourceOrgId"));
    List<Map<String, Object>> organizations =
        centerJdbcTemplate.query(
            """
            SELECT id, name, source_customer_id, status
            FROM organization
            WHERE id = ?
              AND source_customer_id = ?
              AND status = 'active'
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("id", rs.getInt("id"));
              row.put("name", rs.getString("name"));
              row.put("sourceCustomerId", rs.getString("source_customer_id"));
              row.put("status", rs.getString("status"));
              return row;
            },
            sourceOrgId,
            job.get("sourceCustomerId"));
    if (organizations.isEmpty()) {
      throw new BusinessException(
          HttpStatus.CONFLICT, "任务关联组织不存在或不可用: sourceOrgId=" + sourceOrgId);
    }
    return organizations.get(0);
  }

  private String buildRequeueConfirmation(Map<String, Object> job) {
    String targetCustomerId = defaultString(job.get("targetCustomerId"));
    return "requeue_failed_manual:"
        + job.get("id")
        + ":"
        + (StringUtils.hasText(targetCustomerId) ? targetCustomerId : "missing_target");
  }

  private OrganizationState findSourceOrganizationState(int centerUserId, String sourceCustomerId) {
    if ("public".equals(sourceCustomerId)) {
      List<Map<String, Object>> memberships =
          listActiveOrganizationMemberships(centerUserId).stream()
              .filter(
                  row ->
                      Objects.equals(
                          defaultString(row.get("sourceCustomerId")), sourceCustomerId))
              .toList();
      return new OrganizationState(memberships.size() == 1 ? sourceOrganization(memberships.get(0)) : null, memberships.size());
    }
    Map<String, Object> membership =
        StringUtils.hasText(sourceCustomerId)
            ? findActiveOrganizationMembershipForTargetCustomer(centerUserId, sourceCustomerId)
            : null;
    return new OrganizationState(
        membership == null ? null : sourceOrganization(membership), membership == null ? 0 : 1);
  }

  private List<Map<String, Object>> listActiveOrganizationMemberships(int centerUserId) {
    return centerJdbcTemplate.query(
        """
        SELECT o.id, o.name, o.city, o.company_short_name, o.source_customer_id,
               member.member_role
        FROM organization_member member
        INNER JOIN organization o ON o.id = member.organization_id
        WHERE member.center_user_id = ?
          AND member.status = 'active'
          AND o.status = 'active'
        ORDER BY o.id ASC
        """,
        (rs, rowNum) -> organizationMembershipMap(rs),
        centerUserId);
  }

  private Map<String, Object> findActiveOrganizationMembershipForTargetCustomer(
      int centerUserId, String targetCustomerId) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT o.id, o.name, o.city, o.company_short_name, o.source_customer_id,
                   member.member_role
            FROM organization_tenant_mapping m
            INNER JOIN organization o ON o.id = m.organization_id
            INNER JOIN organization_member member ON member.organization_id = o.id
            WHERE m.target_customer_id = ?
              AND m.status = 'active'
              AND o.status = 'active'
              AND member.center_user_id = ?
              AND member.status = 'active'
            LIMIT 1
            """,
            (rs, rowNum) -> organizationMembershipMap(rs),
            targetCustomerId,
            centerUserId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void enrichFailedManualJobs(List<Map<String, Object>> jobs) {
    if (jobs.isEmpty()) {
      return;
    }
    Map<Integer, Map<String, Object>> organizations =
        findOrganizations(ids(jobs, "sourceOrgId"));
    Map<Integer, Map<String, Object>> initiators =
        findUsers(ids(jobs, "initiatorCenterUserId"));
    Map<String, Map<String, Object>> payments =
        findPayments(
            jobs.stream()
                .map(row -> defaultString(row.get("lastPaymentOutTradeNo")))
                .filter(StringUtils::hasText)
                .distinct()
                .toList());
    for (Map<String, Object> job : jobs) {
      Integer sourceOrgId = objectInteger(job.get("sourceOrgId"));
      Integer initiatorId = objectInteger(job.get("initiatorCenterUserId"));
      String outTradeNo = defaultString(job.get("lastPaymentOutTradeNo"));
      Map<String, Object> organization = sourceOrgId == null ? null : organizations.get(sourceOrgId);
      Map<String, Object> initiator = initiatorId == null ? null : initiators.get(initiatorId);
      Map<String, Object> payment = StringUtils.hasText(outTradeNo) ? payments.get(outTradeNo) : null;
      job.put("organization", organization);
      job.put("initiator", initiator);
      job.put("lastPayment", payment);
    }
  }

  private Map<Integer, Map<String, Object>> findOrganizations(List<Integer> ids) {
    List<Integer> organizationIds = positiveIds(ids);
    if (organizationIds.isEmpty()) {
      return Map.of();
    }
    Map<Integer, Map<String, Object>> result = new LinkedHashMap<>();
    centerJdbcTemplate.query(
        """
        SELECT id, name, source_customer_id, status
        FROM organization
        WHERE id IN (
        """
            + placeholders(organizationIds.size())
            + ")",
        rs -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("id", rs.getInt("id"));
          row.put("name", rs.getString("name"));
          row.put("sourceCustomerId", rs.getString("source_customer_id"));
          row.put("status", rs.getString("status"));
          result.put(rs.getInt("id"), row);
        },
        organizationIds.toArray());
    return result;
  }

  private Map<Integer, Map<String, Object>> findUsers(List<Integer> ids) {
    List<Integer> userIds = positiveIds(ids);
    if (userIds.isEmpty()) {
      return Map.of();
    }
    Map<Integer, Map<String, Object>> result = new LinkedHashMap<>();
    centerJdbcTemplate.query(
        """
        SELECT id, customer_type, real_name, status, username
        FROM user
        WHERE id IN (
        """
            + placeholders(userIds.size())
            + ")",
        rs -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("customerType", rs.getString("customer_type"));
          row.put("id", rs.getInt("id"));
          row.put("realName", rs.getString("real_name"));
          row.put("status", rs.getObject("status", Integer.class));
          row.put("username", rs.getString("username"));
          result.put(rs.getInt("id"), row);
        },
        userIds.toArray());
    return result;
  }

  private Map<String, Map<String, Object>> findPayments(List<String> outTradeNos) {
    if (outTradeNos.isEmpty() || !tableExists("vip_membership_payment")) {
      return Map.of();
    }
    Map<String, Map<String, Object>> result = new LinkedHashMap<>();
    centerJdbcTemplate.query(
        "SELECT amount_total, out_trade_no, paid_at, source_org_id, target_customer_id, trade_state, transaction_id "
            + "FROM vip_membership_payment WHERE out_trade_no IN ("
            + placeholders(outTradeNos.size())
            + ")",
        rs -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("amountTotal", rs.getObject("amount_total"));
          row.put("outTradeNo", rs.getString("out_trade_no"));
          row.put("paidAt", toIso(rs.getTimestamp("paid_at")));
          row.put("sourceOrgId", rs.getObject("source_org_id"));
          row.put("targetCustomerId", rs.getString("target_customer_id"));
          row.put("tradeState", rs.getString("trade_state"));
          row.put("transactionId", rs.getString("transaction_id"));
          result.put(rs.getString("out_trade_no"), row);
        },
        outTradeNos.toArray());
    return result;
  }

  private Map<String, Object> invitationMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("code", rs.getString("code"));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("createdByCenterUserId", rs.getInt("created_by_center_user_id"));
    map.put("customerId", rs.getString("customer_id"));
    map.put("expiresAt", toIso(rs.getTimestamp("expires_at")));
    map.put("id", rs.getInt("id"));
    map.put("maxUses", rs.getObject("max_uses"));
    map.put("remark", rs.getString("remark"));
    map.put("roleIds", parseRoleIds(rs.getString("role_ids")));
    map.put("status", rs.getString("status"));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    map.put("usedCount", rs.getInt("used_count"));
    return map;
  }

  private Map<String, Object> jobMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("completedAt", toIso(rs.getTimestamp("completed_at")));
    map.put("createTime", toIso(rs.getTimestamp("create_time")));
    map.put("errorMessage", rs.getString("error_message"));
    map.put("heartbeatAt", toIso(rs.getTimestamp("heartbeat_at")));
    map.put("id", rs.getInt("id"));
    map.put("initiatorCenterUserId", rs.getInt("initiator_center_user_id"));
    map.put("lastPaymentOutTradeNo", rs.getString("last_payment_out_trade_no"));
    map.put("lockedAt", toIso(rs.getTimestamp("locked_at")));
    map.put("lockOwner", rs.getString("lock_owner"));
    map.put("retryCount", rs.getInt("retry_count"));
    map.put("sourceCustomerId", rs.getString("source_customer_id"));
    map.put("sourceOrgId", rs.getObject("source_org_id"));
    map.put("startedAt", toIso(rs.getTimestamp("started_at")));
    map.put("status", rs.getString("status"));
    map.put("step", rs.getString("step"));
    map.put("targetCity", rs.getString("target_city"));
    map.put("targetCompanyShortName", rs.getString("target_company_short_name"));
    map.put("targetCustomerId", rs.getString("target_customer_id"));
    map.put("targetDbName", rs.getString("target_db_name"));
    map.put("updateTime", toIso(rs.getTimestamp("update_time")));
    return map;
  }

  private Map<String, Object> organizationMembershipMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("city", rs.getString("city"));
    map.put("companyShortName", rs.getString("company_short_name"));
    map.put("id", rs.getInt("id"));
    map.put("memberRole", rs.getString("member_role"));
    map.put("name", rs.getString("name"));
    map.put("sourceCustomerId", rs.getString("source_customer_id"));
    return map;
  }

  private Map<String, Object> sourceOrganization(Map<String, Object> membership) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("city", emptyToNull(membership.get("city")));
    map.put("companyShortName", emptyToNull(membership.get("companyShortName")));
    map.put("id", membership.get("id"));
    map.put("memberRole", defaultString(membership.get("memberRole")));
    map.put("name", defaultString(membership.get("name")));
    map.put("sourceCustomerId", defaultString(membership.get("sourceCustomerId")));
    return map;
  }

  private void ensureTables(List<String> tableNames, String message) {
    for (String tableName : tableNames) {
      if (!tableExists(tableName)) {
        throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, message);
      }
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

  private boolean tableExists(JdbcTemplate jdbcTemplate, String tableName) {
    Long count =
        jdbcTemplate.queryForObject(
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

  private List<Integer> parseRoleIds(String value) {
    if (!StringUtils.hasText(value)) {
      return List.of();
    }
    return Arrays.stream(value.split(","))
        .map(String::trim)
        .filter(StringUtils::hasText)
        .map(this::objectInteger)
        .filter(id -> id != null && id > 0)
        .collect(Collectors.toList());
  }

  private List<Integer> ids(List<Map<String, Object>> rows, String key) {
    return rows.stream().map(row -> objectInteger(row.get(key))).filter(Objects::nonNull).toList();
  }

  private List<Integer> positiveIds(List<Integer> rawIds) {
    if (rawIds == null || rawIds.isEmpty()) {
      return List.of();
    }
    return rawIds.stream().filter(id -> id != null && id > 0).distinct().toList();
  }

  private String placeholders(int count) {
    return String.join(",", Collections.nCopies(count, "?"));
  }

  private Integer objectInteger(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value == null) {
      return null;
    }
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private Object emptyToNull(Object value) {
    String text = defaultString(value);
    return StringUtils.hasText(text) ? text : null;
  }

  private String defaultString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String provisioningMessage(String status) {
    return switch (status) {
      case "pending" -> "组织空间等待开通";
      case "provisioning" -> "组织空间正在开通中";
      case "active" -> "组织空间已开通";
      case "failed_retryable" -> "组织空间开通失败，系统将自动重试";
      case "failed_manual" -> "组织空间开通失败，需要人工处理";
      default -> null;
    };
  }

  private String toIso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  public record JoinPlan(
      int invitationId,
      String code,
      String customerId,
      String dbName,
      String customerName,
      int organizationId,
      String organizationSourceCustomerId,
      int centerUserId,
      String previousCustomerId,
      String username,
      String password,
      String phone,
      String realName,
      List<Integer> roleIds,
      boolean alreadyJoined) {}

  private record TenantJoinUser(long customerUserId, boolean created) {}

  private record OrganizationState(Map<String, Object> membership, int total) {}
}
