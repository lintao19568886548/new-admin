package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.system.user.SystemUserController;
import cn.yizuw.magic.backend.system.user.SystemUserService;
import cn.yizuw.magic.backend.system.user.UserWriteRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十九批用户账号本地生命周期接口路由测试。 */
class SixtyNinthBatchControllerTest {

  private MockMvc mockMvc;
  private SystemUserService systemUserService;

  @BeforeEach
  void setUp() {
    systemUserService = org.mockito.Mockito.mock(SystemUserService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new SystemUserController(systemUserService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void createUserReturnsTenantAndCenterUserIds() throws Exception {
    when(systemUserService.createUser(any(UserWriteRequest.class)))
        .thenReturn(Map.of("centerUserId", 70, "id", 7, "mode", "created", "tenantUserId", 7));

    mockMvc
        .perform(
            post("/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "username":"new-user",
                      "realName":"新用户",
                      "password":"123456",
                      "phone":"13800138000",
                      "status":1,
                      "roleIds":[1,2],
                      "parkIds":[3]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.centerUserId").value(70))
        .andExpect(jsonPath("$.data.tenantUserId").value(7))
        .andExpect(jsonPath("$.data.mode").value("created"));

    verify(systemUserService).createUser(any(UserWriteRequest.class));
  }

  @Test
  void updateUserReturnsUpdatedAccountPayload() throws Exception {
    when(systemUserService.updateUser(eq(7), any(UserWriteRequest.class)))
        .thenReturn(Map.of("centerUserId", 70, "id", 7, "mode", "updated", "tenantUserId", 7));

    mockMvc
        .perform(
            put("/user/7")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "username":"new-user",
                      "realName":"更新用户",
                      "phone":"13900139000",
                      "status":1,
                      "roleIds":[2],
                      "parkIds":[3,4]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.mode").value("updated"))
        .andExpect(jsonPath("$.data.id").value(7));

    verify(systemUserService).updateUser(eq(7), any(UserWriteRequest.class));
  }

  @Test
  void deleteUserReturnsSoftDeletePayload() throws Exception {
    when(systemUserService.deleteUser(7))
        .thenReturn(Map.of("centerUserId", 70, "id", 7, "mode", "soft", "tenantUserId", 7));

    mockMvc
        .perform(delete("/user/7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.mode").value("soft"))
        .andExpect(jsonPath("$.data.tenantUserId").value(7));

    verify(systemUserService).deleteUser(7);
  }

  @Test
  void cancelCurrentUserReturnsSelfSoftDeletePayload() throws Exception {
    when(systemUserService.cancelCurrentUser(any(HttpServletResponse.class)))
        .thenReturn(
            Map.of(
                "centerUserId", 70,
                "id", 7,
                "mode", "soft",
                "self", true,
                "tenantUserId", 7));

    mockMvc
        .perform(post("/user/cancel"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.self").value(true))
        .andExpect(jsonPath("$.data.mode").value("soft"));

    verify(systemUserService).cancelCurrentUser(any(HttpServletResponse.class));
  }
}
