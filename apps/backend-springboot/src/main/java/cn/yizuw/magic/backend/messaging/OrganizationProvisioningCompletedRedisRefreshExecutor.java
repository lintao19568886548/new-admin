package cn.yizuw.magic.backend.messaging;

import cn.yizuw.magic.backend.cache.CacheService;
import cn.yizuw.magic.backend.common.BusinessException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** 组织开通完成 Redis 刷新执行器；只清理计划中列出的缓存前缀。 */
@Service
public class OrganizationProvisioningCompletedRedisRefreshExecutor {

  private final CacheService cacheService;

  public OrganizationProvisioningCompletedRedisRefreshExecutor(CacheService cacheService) {
    this.cacheService = cacheService;
  }

  /**
   * 执行计划中已显式允许的缓存前缀清理。
   *
   * <p>前缀由 `OrganizationProvisioningCompletedRedisRefreshPlanService` 生成，本执行器不扩展
   * 清理范围，避免误删其它租户或其它业务缓存。
   */
  public int refresh(Map<String, Object> redisRefreshPlan) {
    if (!Boolean.TRUE.equals(redisRefreshPlan.get("cacheEvictEnabled"))) {
      return 0;
    }
    int executedCount = 0;
    for (Map<String, Object> item : targetCachePrefixes(redisRefreshPlan)) {
      if (!Boolean.TRUE.equals(item.get("executeEnabled"))) {
        continue;
      }
      String prefix = string(item.get("prefix"));
      if (prefix.isBlank()) {
        throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "Redis 刷新前缀缺失");
      }
      cacheService.evictByPrefix(prefix);
      item.put("executed", true);
      executedCount++;
    }
    return executedCount;
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> targetCachePrefixes(Map<String, Object> redisRefreshPlan) {
    Object prefixes = redisRefreshPlan.get("targetCachePrefixes");
    if (prefixes instanceof List<?> list) {
      return (List<Map<String, Object>>) list;
    }
    throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "Redis 刷新计划缺失缓存前缀");
  }

  private String string(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}
