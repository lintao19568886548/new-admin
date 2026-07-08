package cn.yizuw.magic.backend.tenant;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantRequiredTest {

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void currentUserRejectsBlankCustomerId() {
    TenantContext.set(
        new UserTokenPayload(1L, " ", "tenant_db", 2L, List.of(), 0, 0, List.of(), 1L, "tester"));

    assertThatThrownBy(TenantRequired::currentUser)
        .isInstanceOf(BusinessException.class)
        .hasMessage("验证失败");
  }
}
