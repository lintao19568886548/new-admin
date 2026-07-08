package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;

import cn.yizuw.magic.backend.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 组织开通完成 Redis 刷新计划测试；确认安全门和缓存前缀边界。 */
class OrganizationProvisioningCompletedRedisRefreshPlanServiceTest {

  @Test
  void buildPlanReturnsPreviewOnlyRedisRefreshPlan() {
    Map<String, Object> plan = service(false).buildPlan(31, "org001", "tenant_org001");

    assertThat(plan)
        .containsEntry(
            "planType", OrganizationProvisioningCompletedRedisRefreshPlanService.PLAN_TYPE)
        .containsEntry("planStatus", "preview_only")
        .containsEntry("jobId", 31)
        .containsEntry("targetCustomerId", "org001")
        .containsEntry("targetDbName", "tenant_org001")
        .containsEntry(
            "idempotencyKey", "organization-provisioning-completed-redis-refresh:31")
        .containsEntry("refreshEnabled", false)
        .containsEntry("redisWriteEnabled", false)
        .containsEntry("cacheEvictEnabled", false)
        .containsEntry("cacheEvictRequested", false)
        .containsEntry("cacheEvictExecuted", false)
        .containsEntry("nextExplicitSwitch", "refreshOrganizationProvisioningCompletedCaches");
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("REDIS_ORGANIZATION_PROVISIONING_REFRESH_ENABLED 未开启");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> prefixes =
        (List<Map<String, Object>>) plan.get("targetCachePrefixes");
    assertThat(prefixes)
        .hasSize(5)
        .extracting(item -> item.get("prefix"))
        .containsExactly(
            "tenant:org001:route-menus:",
            "tenant:org001:system-menu-list:",
            "tenant:org001:parent-role-menus:",
            "tenant:org001:permission-codes:",
            "tenant:org001:user-info:");
    assertThat(prefixes)
        .allSatisfy(
            item ->
                assertThat(item)
                    .containsEntry("operation", "evict_by_prefix")
                    .containsEntry("executeEnabled", false)
                    .containsEntry("executed", false));
  }

  @Test
  void buildPlanEnablesLimitedCacheEvictWhenSafetyGateEnabled() {
    Map<String, Object> plan = service(true).buildPlan(31, "org001", "tenant_org001");

    assertThat(plan)
        .containsEntry("refreshEnabled", true)
        .containsEntry("redisWriteEnabled", false)
        .containsEntry("cacheEvictEnabled", true)
        .containsEntry("cacheEvictRequested", false)
        .containsEntry("cacheEvictExecuted", false);
    assertThat((List<Object>) plan.get("blockedReasons"))
        .containsExactly("本批只清理组织开通完成相关的限定缓存前缀");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> prefixes =
        (List<Map<String, Object>>) plan.get("targetCachePrefixes");
    assertThat(prefixes)
        .hasSize(5)
        .allSatisfy(
            item ->
                assertThat(item)
                    .containsEntry("operation", "evict_by_prefix")
                    .containsEntry("executeEnabled", true)
                    .containsEntry("executed", false));
  }

  private OrganizationProvisioningCompletedRedisRefreshPlanService service(
      boolean refreshEnabled) {
    AppProperties appProperties = new AppProperties();
    appProperties.getRedis().setOrganizationProvisioningRefreshEnabled(refreshEnabled);
    return new OrganizationProvisioningCompletedRedisRefreshPlanService(appProperties);
  }
}
