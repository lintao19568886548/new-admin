package cn.yizuw.magic.backend.tenant;

import cn.yizuw.magic.backend.security.UserTokenPayload;

public final class TenantContext {

  private static final ThreadLocal<UserTokenPayload> CURRENT = new ThreadLocal<>();

  private TenantContext() {}

  public static void clear() {
    CURRENT.remove();
  }

  public static UserTokenPayload get() {
    return CURRENT.get();
  }

  public static void set(UserTokenPayload payload) {
    CURRENT.set(payload);
  }
}
