package cn.yizuw.magic.backend.tenant;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;

public final class TenantRequired {

  private TenantRequired() {}

  public static UserTokenPayload currentUser() {
    UserTokenPayload payload = TenantContext.get();
    if (payload == null || payload.id() == null || !StringUtils.hasText(payload.customerId())) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, "验证失败");
    }
    return payload;
  }
}
