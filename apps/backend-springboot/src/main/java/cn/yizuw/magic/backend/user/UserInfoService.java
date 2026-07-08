package cn.yizuw.magic.backend.user;

import cn.yizuw.magic.backend.auth.TenantUserInfo;
import cn.yizuw.magic.backend.cache.CacheService;
import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class UserInfoService {

  private static final Duration USER_INFO_TTL = Duration.ofMinutes(5);

  private final CacheService cacheService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;
  private final UserInfoRepository userInfoRepository;

  public UserInfoService(
      CacheService cacheService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider,
      UserInfoRepository userInfoRepository) {
    this.cacheService = cacheService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
    this.userInfoRepository = userInfoRepository;
  }

  public UserInfoResponse getCurrentUserInfo() {
    UserTokenPayload payload = TenantRequired.currentUser();
    String cacheKey =
        "tenant:"
            + payload.customerId()
            + ":user-info:"
            + payload.id()
            + ":v"
            + payload.tokenVersion();
    return cacheService.getOrLoad(cacheKey, UserInfoResponse.class, USER_INFO_TTL, () -> load(payload));
  }

  private UserInfoResponse load(UserTokenPayload payload) {
    TenantUserInfo tenantUser =
        userInfoRepository.findTenantUserInfo(
            tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), payload.id());
    if (tenantUser == null) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "登录失效，请重新登录");
    }

    return new UserInfoResponse(
        payload.centerUserId(),
        tenantUser.codes(),
        payload.customerId(),
        "",
        tenantUser.homePath(),
        tenantUser.id(),
        tenantUser.parks(),
        tenantUser.phone(),
        tenantUser.rates(),
        tenantUser.realName(),
        tenantUser.reimbursementAuth(),
        tenantUser.roles(),
        "",
        payload.tokenVersion(),
        tenantUser.id(),
        tenantUser.username());
  }
}
