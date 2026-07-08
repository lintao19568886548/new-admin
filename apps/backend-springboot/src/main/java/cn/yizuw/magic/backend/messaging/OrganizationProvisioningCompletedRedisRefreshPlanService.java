package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 组织开通完成 Redis 刷新计划服务；安全门开启后 followup 可清理限定缓存前缀。 */
@Service
public class OrganizationProvisioningCompletedRedisRefreshPlanService {

  public static final String PLAN_TYPE = "organization.provisioning.completed.redis-refresh";

  private final AppProperties appProperties;

  public OrganizationProvisioningCompletedRedisRefreshPlanService(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  /**
   * 生成组织开通完成后的 Redis 缓存刷新计划。
   *
   * <p>默认只列出后续需要清理的缓存前缀，便于灰度验收范围；安全门开启后只允许通过
   * CacheService 清理这些前缀，不直接调用 RedisTemplate。
   */
  public Map<String, Object> buildPlan(
      int jobId, String targetCustomerId, String targetDbName) {
    boolean refreshEnabled =
        appProperties.getRedis().isOrganizationProvisioningRefreshEnabled();
    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("planType", PLAN_TYPE);
    plan.put("planStatus", "preview_only");
    plan.put("jobId", jobId);
    plan.put("targetCustomerId", targetCustomerId);
    plan.put("targetDbName", targetDbName);
    plan.put("idempotencyKey", "organization-provisioning-completed-redis-refresh:" + jobId);
    plan.put("refreshEnabled", refreshEnabled);
    plan.put("redisWriteEnabled", false);
    plan.put("cacheEvictEnabled", refreshEnabled);
    plan.put("cacheEvictRequested", false);
    plan.put("cacheEvictExecuted", false);
    plan.put("blockedReasons", blockedReasons(refreshEnabled));
    plan.put("targetCachePrefixes", targetCachePrefixes(targetCustomerId, refreshEnabled));
    plan.put("nextExplicitSwitch", "refreshOrganizationProvisioningCompletedCaches");
    return plan;
  }

  private List<String> blockedReasons(boolean refreshEnabled) {
    if (refreshEnabled) {
      return List.of("本批只清理组织开通完成相关的限定缓存前缀");
    }
    return List.of("REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED 未开启");
  }

  private List<Map<String, Object>> targetCachePrefixes(
      String targetCustomerId, boolean refreshEnabled) {
    return List.of(
        cachePrefix("route_menus", "tenant:" + targetCustomerId + ":route-menus:", refreshEnabled),
        cachePrefix(
            "system_menu_list",
            "tenant:" + targetCustomerId + ":system-menu-list:",
            refreshEnabled),
        cachePrefix(
            "parent_role_menus",
            "tenant:" + targetCustomerId + ":parent-role-menus:",
            refreshEnabled),
        cachePrefix(
            "permission_codes",
            "tenant:" + targetCustomerId + ":permission-codes:",
            refreshEnabled),
        cachePrefix("user_info", "tenant:" + targetCustomerId + ":user-info:", refreshEnabled));
  }

  private Map<String, Object> cachePrefix(
      String cacheName, String prefix, boolean refreshEnabled) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("cacheName", cacheName);
    item.put("prefix", prefix);
    item.put("operation", "evict_by_prefix");
    item.put("executeEnabled", refreshEnabled);
    item.put("executed", false);
    return item;
  }
}
