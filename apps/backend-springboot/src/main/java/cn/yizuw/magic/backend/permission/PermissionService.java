package cn.yizuw.magic.backend.permission;

import cn.yizuw.magic.backend.cache.CacheService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.time.Duration;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PermissionService {

  private static final Duration PERMISSION_CODES_TTL = Duration.ofMinutes(10);

  private final CacheService cacheService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public PermissionService(
      CacheService cacheService, TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.cacheService = cacheService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  @SuppressWarnings("unchecked")
  public List<String> getCurrentPermissionCodes() {
    UserTokenPayload payload = TenantRequired.currentUser();
    String cacheKey =
        "tenant:"
            + payload.customerId()
            + ":permission-codes:"
            + payload.id()
            + ":v"
            + payload.tokenVersion();
    return cacheService.getOrLoad(cacheKey, List.class, PERMISSION_CODES_TTL, () -> loadCodes(payload));
  }

  private List<String> loadCodes(UserTokenPayload payload) {
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    return jdbcTemplate.query(
        """
        SELECT DISTINCT c.code
        FROM user_role ur
        INNER JOIN role_code rc ON rc.role_id = ur.role_id
        INNER JOIN code c ON c.code_id = rc.code_id
        WHERE ur.user_id = ?
          AND c.code IS NOT NULL
          AND c.template_deleted_at IS NULL
        ORDER BY c.code ASC
        """,
        (rs, rowNum) -> rs.getString("code"),
        payload.id());
  }
}
