package cn.yizuw.magic.backend.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import cn.yizuw.magic.backend.cache.CacheService;
import cn.yizuw.magic.backend.common.BusinessException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 组织开通完成 Redis 刷新执行测试；确认只清理计划中的限定前缀。 */
class OrganizationProvisioningCompletedRedisRefreshExecutorTest {

  @Test
  void refreshEvictsOnlyEnabledPrefixesFromPlan() {
    CacheService cacheService = org.mockito.Mockito.mock(CacheService.class);
    OrganizationProvisioningCompletedRedisRefreshExecutor executor =
        new OrganizationProvisioningCompletedRedisRefreshExecutor(cacheService);
    Map<String, Object> plan = redisRefreshPlan(true);

    int executedCount = executor.refresh(plan);

    assertThat(executedCount).isEqualTo(2);
    verify(cacheService).evictByPrefix("tenant:org001:route-menus:");
    verify(cacheService).evictByPrefix("tenant:org001:user-info:");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> prefixes =
        (List<Map<String, Object>>) plan.get("targetCachePrefixes");
    assertThat(prefixes).allSatisfy(item -> assertThat(item).containsEntry("executed", true));
  }

  @Test
  void refreshSkipsWhenCacheEvictIsDisabled() {
    CacheService cacheService = org.mockito.Mockito.mock(CacheService.class);
    OrganizationProvisioningCompletedRedisRefreshExecutor executor =
        new OrganizationProvisioningCompletedRedisRefreshExecutor(cacheService);

    int executedCount = executor.refresh(redisRefreshPlan(false));

    assertThat(executedCount).isZero();
    verify(cacheService, never()).evictByPrefix(org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void refreshRejectsMissingTargetPrefixes() {
    CacheService cacheService = org.mockito.Mockito.mock(CacheService.class);
    OrganizationProvisioningCompletedRedisRefreshExecutor executor =
        new OrganizationProvisioningCompletedRedisRefreshExecutor(cacheService);

    assertThatThrownBy(() -> executor.refresh(Map.of("cacheEvictEnabled", true)))
        .isInstanceOf(BusinessException.class)
        .hasMessage("Redis 刷新计划缺失缓存前缀");
  }

  private Map<String, Object> redisRefreshPlan(boolean enabled) {
    Map<String, Object> routeMenus = new LinkedHashMap<>();
    routeMenus.put("prefix", "tenant:org001:route-menus:");
    routeMenus.put("executeEnabled", enabled);
    routeMenus.put("executed", false);

    Map<String, Object> userInfo = new LinkedHashMap<>();
    userInfo.put("prefix", "tenant:org001:user-info:");
    userInfo.put("executeEnabled", enabled);
    userInfo.put("executed", false);

    Map<String, Object> plan = new LinkedHashMap<>();
    plan.put("cacheEvictEnabled", enabled);
    plan.put("targetCachePrefixes", List.of(routeMenus, userInfo));
    return plan;
  }
}
