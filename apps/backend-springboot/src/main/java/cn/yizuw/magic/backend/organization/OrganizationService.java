package cn.yizuw.magic.backend.organization;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.messaging.BusinessOutboxPublisher;
import cn.yizuw.magic.backend.messaging.OrganizationProvisioningRequeuedEvent;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantDataSourceRegistry;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 组织模块只读业务层，集中处理旧接口的 Super 和默认空间权限边界。 */
@Service
@Transactional(readOnly = true)
public class OrganizationService {

  private final AppProperties appProperties;
  private final BusinessOutboxPublisher businessOutboxPublisher;
  private final OrganizationRepository organizationRepository;
  private final TenantDataSourceRegistry tenantDataSourceRegistry;

  public OrganizationService(
      AppProperties appProperties,
      BusinessOutboxPublisher businessOutboxPublisher,
      OrganizationRepository organizationRepository,
      TenantDataSourceRegistry tenantDataSourceRegistry) {
    this.appProperties = appProperties;
    this.businessOutboxPublisher = businessOutboxPublisher;
    this.organizationRepository = organizationRepository;
    this.tenantDataSourceRegistry = tenantDataSourceRegistry;
  }

  /**
   * 创建公开试用账号的 source organization。
   *
   * <p>该入口只写中心库 organization/organization_member，不创建 customer、租户库或开通任务；后续真实开通仍由
   * 支付确认、Kafka/RabbitMQ 事件和 XXL-Job worker 专项推进。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> createOrganization(OrganizationCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (!"public".equals(payload.customerId())) {
      throw new BusinessException(HttpStatus.CONFLICT, "只有公开试用空间账号可以创建组织空间");
    }
    Long centerUserId = payload.centerUserId() == null ? payload.id() : payload.centerUserId();
    if (centerUserId == null || centerUserId <= 0 || centerUserId > Integer.MAX_VALUE) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "验证失败");
    }
    OrganizationIdentity identity = normalizeOrganizationIdentity(request);
    Map<String, Object> membership =
        organizationRepository.ensureSingleOwnerSourceOrganization(
            centerUserId.intValue(),
            payload.customerId(),
            payload.id(),
            identity.city(),
            identity.companyShortName());
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("sourceOrganization", membership);
    result.put("sourceOrganizationCount", 1);
    return result;
  }

  /** 邀请码列表只允许当前组织空间的 Super 查看。 */
  public Map<String, Object> listInvitations() {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (!isSuper(payload)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "仅 Super 角色可查看组织邀请码");
    }
    return organizationRepository.findInvitations(payload.customerId(), appProperties.getDefaultCustomerId());
  }

  /** Super 撤销当前组织空间的 active 邀请码。 */
  @Transactional(readOnly = false)
  public Map<String, Object> revokeInvitation(OrganizationInvitationRevokeRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (!isSuper(payload)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "仅 Super 角色可撤销组织邀请码");
    }
    return organizationRepository.revokeInvitation(
        payload.customerId(), appProperties.getDefaultCustomerId(), request == null ? null : request.id());
  }

  /** Super 创建当前组织空间邀请码；只写中心库邀请码表。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createInvitation(OrganizationInvitationCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (!isSuper(payload)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "仅 Super 角色可创建组织邀请码");
    }
    Long centerUserId = payload.centerUserId() == null ? payload.id() : payload.centerUserId();
    if (centerUserId == null || centerUserId <= 0 || centerUserId > Integer.MAX_VALUE) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "验证失败");
    }
    String customerId = payload.customerId();
    String targetDbName =
        organizationRepository.findManageableCustomerDbName(
            customerId, appProperties.getDefaultCustomerId());
    JdbcTemplate tenantJdbcTemplate =
        new JdbcTemplate(tenantDataSourceRegistry.getDataSource(customerId, targetDbName));
    return organizationRepository.createInvitation(
        tenantJdbcTemplate,
        customerId,
        appProperties.getDefaultCustomerId(),
        centerUserId.intValue(),
        request);
  }

  /**
   * 通过邀请码加入已有组织空间。
   *
   * <p>该方法只处理本地账号、角色、中心映射、组织成员和加入日志，不触发新组织开通任务。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> joinInvitation(OrganizationInvitationJoinRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    Long centerUserId = payload.centerUserId() == null ? payload.id() : payload.centerUserId();
    if (centerUserId == null || centerUserId <= 0 || centerUserId > Integer.MAX_VALUE) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "登录状态异常");
    }
    String code = request == null ? "" : String.valueOf(request.code());
    OrganizationRepository.JoinPlan plan =
        organizationRepository.prepareJoinInvitation(
            centerUserId.intValue(), payload.customerId(), code, appProperties.getDefaultCustomerId());
    DataSource targetDataSource =
        tenantDataSourceRegistry.getDataSource(plan.customerId(), plan.dbName());
    JdbcTemplate targetJdbcTemplate = new JdbcTemplate(targetDataSource);
    return organizationRepository.joinInvitation(plan, targetDataSource, targetJdbcTemplate);
  }

  /** 当前账号的组织空间开通状态，保留旧接口字段用于个人中心展示。 */
  public Map<String, Object> getProvisioningStatus() {
    UserTokenPayload payload = TenantRequired.currentUser();
    Long centerUserId = payload.centerUserId() == null ? payload.id() : payload.centerUserId();
    if (centerUserId == null || centerUserId <= 0 || centerUserId > Integer.MAX_VALUE) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "验证失败");
    }
    return organizationRepository.findProvisioningStatus(
        centerUserId.intValue(), payload.customerId());
  }

  /** failed_manual 任务只允许默认客户空间的 Super 查看，避免普通租户看到平台任务。 */
  public Map<String, Object> listFailedManualJobs(Integer rawLimit) {
    UserTokenPayload payload = TenantRequired.currentUser();
    String defaultCustomerId =
        StringUtils.hasText(appProperties.getDefaultCustomerId())
            ? appProperties.getDefaultCustomerId()
            : "default";
    if (!isSuper(payload) || !defaultCustomerId.equals(payload.customerId())) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "仅平台 Super 可查看组织空间开通任务");
    }
    int limit = rawLimit == null ? 50 : Math.max(1, Math.min(rawLimit, 100));
    return organizationRepository.findFailedManualJobs(limit);
  }

  /**
   * 手动重排 failed_manual 组织开通任务。
   *
   * <p>该入口只重置中心库任务状态，不在 HTTP 请求内执行开通 worker；真实开通仍由 XXL-Job/worker
   * 后续消费，避免接口切流时出现跨租户建库副作用。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> requeueFailedManualJob(
      OrganizationProvisioningRequeueRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    String defaultCustomerId =
        StringUtils.hasText(appProperties.getDefaultCustomerId())
            ? appProperties.getDefaultCustomerId()
            : "default";
    if (!isSuper(payload) || !defaultCustomerId.equals(payload.customerId())) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "仅平台 Super 可重排组织空间开通任务");
    }
    String operator =
        StringUtils.hasText(payload.username()) ? payload.username() : String.valueOf(payload.id());
    Map<String, Object> result = organizationRepository.requeueFailedManualJob(request, operator);
    if (!Boolean.TRUE.equals(result.get("execute"))) {
      return result;
    }
    Map<String, Object> mutableResult = new LinkedHashMap<>(result);
    String outboxEventId =
        businessOutboxPublisher.publishOrganizationProvisioningRequeued(
            organizationProvisioningRequeuedEvent(mutableResult, operator));
    mutableResult.put("outboxEventQueued", StringUtils.hasText(outboxEventId));
    if (StringUtils.hasText(outboxEventId)) {
      mutableResult.put("outboxEventId", outboxEventId);
    }
    return mutableResult;
  }

  private OrganizationProvisioningRequeuedEvent organizationProvisioningRequeuedEvent(
      Map<String, Object> result, String operator) {
    Map<String, Object> job = mapValue(result.get("job"));
    Map<String, Object> previousJob = mapValue(result.get("previousJob"));
    Integer jobId = intValue(job.get("id"));
    if (jobId == null || jobId <= 0) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "组织开通任务重排结果缺少 jobId");
    }
    String targetCustomerId = string(job.get("targetCustomerId"));
    if (!StringUtils.hasText(targetCustomerId)) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "组织开通任务重排结果缺少目标客户空间");
    }
    return new OrganizationProvisioningRequeuedEvent(
        intValue(job.get("initiatorCenterUserId")),
        jobId,
        string(job.get("lastPaymentOutTradeNo")),
        operator,
        string(previousJob.get("status")),
        firstText(string(job.get("updateTime")), string(result.get("requeuedAt")), "unknown"),
        string(job.get("sourceCustomerId")),
        intValue(job.get("sourceOrgId")),
        string(job.get("status")),
        string(job.get("step")),
        targetCustomerId,
        string(job.get("targetDbName")));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> mapValue(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
  }

  private Integer intValue(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    try {
      return value == null ? null : Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private String string(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private boolean isSuper(UserTokenPayload payload) {
    return payload.roles() != null && payload.roles().contains("Super");
  }

  private OrganizationIdentity normalizeOrganizationIdentity(OrganizationCreateRequest request) {
    Map<String, Object> nested =
        request == null || request.organizationIdentity() == null ? Map.of() : request.organizationIdentity();
    String city =
        firstText(
            objectString(nested.get("city")),
            request == null ? null : request.organizationCity(),
            request == null ? null : request.city());
    String companyShortName =
        firstText(
            objectString(nested.get("companyShortName")),
            objectString(nested.get("companyName")),
            request == null ? null : request.organizationCompanyShortName(),
            request == null ? null : request.organizationCompanyName(),
            request == null ? null : request.companyShortName(),
            request == null ? null : request.companyName());
    city = compactIdentityText(city);
    companyShortName = compactIdentityText(companyShortName);
    if (!StringUtils.hasText(city)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请填写 组织/公司 所在城市");
    }
    if (!StringUtils.hasText(companyShortName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请填写 组织/公司 简称");
    }
    if (city.length() > 30) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "所在城市不能超过 30 个字符");
    }
    if (companyShortName.length() > 50) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "简称不能超过 50 个字符");
    }
    return new OrganizationIdentity(city, companyShortName);
  }

  private String firstText(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value.trim();
      }
    }
    return null;
  }

  private String compactIdentityText(String value) {
    return value == null ? "" : value.trim().replaceAll("\\s+", "");
  }

  private String objectString(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private record OrganizationIdentity(String city, String companyShortName) {}
}
