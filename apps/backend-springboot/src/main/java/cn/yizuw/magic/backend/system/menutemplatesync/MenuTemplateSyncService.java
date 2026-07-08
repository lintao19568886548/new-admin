package cn.yizuw.magic.backend.system.menutemplatesync;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class MenuTemplateSyncService {

  private final AppProperties appProperties;
  private final MenuTemplateSyncRepository menuTemplateSyncRepository;

  public MenuTemplateSyncService(
      AppProperties appProperties, MenuTemplateSyncRepository menuTemplateSyncRepository) {
    this.appProperties = appProperties;
    this.menuTemplateSyncRepository = menuTemplateSyncRepository;
  }

  public List<Map<String, Object>> getJobs(Integer limit) {
    requireSuper();
    int normalizedLimit = limit == null ? 20 : Math.min(Math.max(limit, 1), 100);
    return menuTemplateSyncRepository.findJobs(normalizedLimit);
  }

  public List<Map<String, Object>> getJobLogs(int jobId) {
    requireSuper();
    if (jobId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "job id is required");
    }
    return menuTemplateSyncRepository.findJobLogs(jobId);
  }

  /** 只返回同步计划，不创建 job、不写任何租户库菜单模板。 */
  public Map<String, Object> dryRun(MenuTemplateSyncRunRequest request) {
    RunPlan plan = buildRunPlan(request);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("mode", "dry_run");
    result.put("execute", false);
    result.put("sourceCustomerId", appProperties.getDefaultCustomerId());
    result.put("targetScope", plan.apiTargetScope());
    result.put("targetCustomerId", plan.allTenants() ? null : plan.targetCustomerId());
    result.put("estimatedTargetCount", plan.targetCount());
    result.put("message", "dry-run 仅生成同步计划，未写入 menu_template_sync_job 或租户菜单表");
    return result;
  }

  /**
   * 兼容旧端 execute 入口，但第七十批只写中心库审计并返回 accepted。
   *
   * <p>真实跨租户菜单写入、Redis 权限缓存刷新和失败重试统一留给 XXL-Job 专项，避免 HTTP
   * 请求直接承担长事务和外部依赖。
   */
  public Map<String, Object> execute(MenuTemplateSyncRunRequest request) {
    RunPlan plan = buildRunPlan(request);
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("targets", plan.targetCount());
    summary.put("accepted", true);
    summary.put("deferred", true);
    summary.put("executeImmediately", false);

    Map<String, Object> details = new LinkedHashMap<>();
    details.put("xxlJobName", "menuTemplateSyncJob");
    details.put("executeParam", "execute=true");
    details.put("boundary", "HTTP 接口只登记执行请求，不直接写租户菜单、不刷新 Redis 权限缓存");
    details.put("targetScope", plan.apiTargetScope());
    details.put("targetCustomerId", plan.allTenants() ? null : plan.targetCustomerId());

    long jobId =
        menuTemplateSyncRepository.createAcceptedExecuteJob(
            appProperties.getDefaultCustomerId(),
            plan.storageTargetScope(),
            plan.allTenants() ? null : plan.targetCustomerId(),
            plan.allTenants() ? "all_tenants" : plan.targetCustomerId(),
            summary,
            details);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("jobId", jobId);
    result.put("mode", "execute");
    result.put("execute", true);
    result.put("executed", false);
    result.put("status", "accepted");
    result.put("sourceCustomerId", appProperties.getDefaultCustomerId());
    result.put("targetScope", plan.apiTargetScope());
    result.put("targetCustomerId", plan.allTenants() ? null : plan.targetCustomerId());
    result.put("estimatedTargetCount", plan.targetCount());
    result.put("summary", summary);
    result.put("message", "执行请求已写入中心库审计；真实菜单同步需通过 menuTemplateSyncJob 专项执行");
    return result;
  }

  private RunPlan buildRunPlan(MenuTemplateSyncRunRequest request) {
    UserTokenPayload payload = requireSuper();
    if (!appProperties.getDefaultCustomerId().equals(payload.customerId())) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "Forbidden");
    }
    boolean allTenants = truthy(request == null ? null : request.allTenants());
    String targetCustomerId = normalizeString(request == null ? null : request.targetCustomerId());
    if (allTenants && StringUtils.hasText(targetCustomerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "allTenants 不能和 targetCustomerId 同时传入");
    }
    if (!allTenants && !StringUtils.hasText(targetCustomerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请指定 targetCustomerId 或 allTenants");
    }

    int targetCount =
        allTenants
            ? menuTemplateSyncRepository.countActiveTargetCustomers(
                appProperties.getDefaultCustomerId())
            : menuTemplateSyncRepository.assertTargetCustomerExists(
                targetCustomerId, appProperties.getDefaultCustomerId());
    return new RunPlan(allTenants, targetCustomerId, targetCount);
  }

  private UserTokenPayload requireSuper() {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (payload.roles() == null || !payload.roles().contains("Super")) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "Forbidden");
    }
    return payload;
  }

  private boolean truthy(Object value) {
    if (value instanceof Boolean bool) {
      return bool;
    }
    if (value instanceof Number number) {
      return number.intValue() != 0;
    }
    String normalized = normalizeString(value).toLowerCase(java.util.Locale.ROOT);
    return "true".equals(normalized) || "1".equals(normalized);
  }

  private String normalizeString(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  /** 已校验过权限和目标范围的菜单模板同步执行计划。 */
  private record RunPlan(boolean allTenants, String targetCustomerId, int targetCount) {

    String apiTargetScope() {
      return allTenants ? "allTenants" : "singleTenant";
    }

    String storageTargetScope() {
      return allTenants ? "all_tenants" : targetCustomerId;
    }
  }
}
