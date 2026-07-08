package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.auth.AuthController;
import cn.yizuw.magic.backend.auth.AuthService;
import cn.yizuw.magic.backend.auth.LoginResponse;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.permission.PermissionService;
import cn.yizuw.magic.backend.status.StatusController;
import cn.yizuw.magic.backend.system.version.AppVersion;
import cn.yizuw.magic.backend.system.version.VersionController;
import cn.yizuw.magic.backend.system.version.VersionService;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class FirstBatchControllerTest {

  private AuthService authService;
  private MockMvc mockMvc;
  private PermissionService permissionService;
  private VersionService versionService;

  @BeforeEach
  void setUp() {
    authService = org.mockito.Mockito.mock(AuthService.class);
    permissionService = org.mockito.Mockito.mock(PermissionService.class);
    versionService = org.mockito.Mockito.mock(VersionService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new StatusController(),
                new VersionController(versionService),
                new AuthController(authService, permissionService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void statusKeepsLegacyStatusResponseShape() throws Exception {
    mockMvc
        .perform(get("/status").param("status", "201"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.code").value(201))
        .andExpect(jsonPath("$.data").doesNotExist())
        .andExpect(jsonPath("$.error").value("201"))
        .andExpect(jsonPath("$.message").value("201"));
  }

  @Test
  void systemVersionWrapsLatestVersionInApiResponse() throws Exception {
    when(versionService.getLatestVersion())
        .thenReturn(
            new AppVersion(
                1,
                "1.0.0",
                "https://example.com/app.apk",
                "https://example.com/android.apk",
                "https://apps.apple.com/app",
                "Initial version.",
                null,
                null));

    mockMvc
        .perform(get("/system/version"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("ok"))
        .andExpect(jsonPath("$.data.id").value(1))
        .andExpect(jsonPath("$.data.version").value("1.0.0"))
        .andExpect(jsonPath("$.data.iosUrl").value("https://apps.apple.com/app"));
  }

  @Test
  void loginReturnsApiResponseAndRefreshCookie() throws Exception {
    when(authService.login(any(), any(HttpServletResponse.class)))
        .thenAnswer(
            invocation -> {
              HttpServletResponse response = invocation.getArgument(1);
              response.addHeader(
                  HttpHeaders.SET_COOKIE, "jwt=refresh-token; Max-Age=604800; Path=/; HttpOnly");
              return new LoginResponse(
                  "access-token",
                  100L,
                  List.of("system:user:list"),
                  "default",
                  "/workspace",
                  200L,
                  List.of(),
                  "13800000000",
                  1,
                  "管理员",
                  0,
                  List.of("admin"),
                  1L,
                  "admin");
            });

    mockMvc
        .perform(
            post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"123456\"}"))
        .andExpect(status().isOk())
        .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("jwt=")))
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.accessToken").value("access-token"))
        .andExpect(jsonPath("$.data.customerId").value("default"))
        .andExpect(jsonPath("$.data.roles[0]").value("admin"));
  }

  @Test
  void refreshReturnsRawAccessTokenString() throws Exception {
    when(authService.refresh(any(), any(HttpServletResponse.class))).thenReturn("new-access-token");

    mockMvc
        .perform(post("/auth/refresh").cookie(new jakarta.servlet.http.Cookie("jwt", "refresh-token")))
        .andExpect(status().isOk())
        .andExpect(content().string("new-access-token"));
  }

  @Test
  void logoutClearsCookieAndReturnsApiResponse() throws Exception {
    doNothing().when(authService).logout(any(), any(HttpServletResponse.class));

    mockMvc
        .perform(post("/auth/logout").cookie(new jakarta.servlet.http.Cookie("jwt", "refresh-token")))
        .andExpect(status().isOk())
        .andExpect(cookie().doesNotExist("jwt"))
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data").value(""))
        .andExpect(jsonPath("$.message").value("ok"));
  }

  public static void main(String[] args) throws Exception {
    FirstBatchControllerTest test = new FirstBatchControllerTest();
    run(test, "statusKeepsLegacyStatusResponseShape", test::statusKeepsLegacyStatusResponseShape);
    run(test, "systemVersionWrapsLatestVersionInApiResponse", test::systemVersionWrapsLatestVersionInApiResponse);
    run(test, "loginReturnsApiResponseAndRefreshCookie", test::loginReturnsApiResponseAndRefreshCookie);
    run(test, "refreshReturnsRawAccessTokenString", test::refreshReturnsRawAccessTokenString);
    run(test, "logoutClearsCookieAndReturnsApiResponse", test::logoutClearsCookieAndReturnsApiResponse);
  }

  private static void run(FirstBatchControllerTest test, String name, ThrowingRunnable runnable)
      throws Exception {
    test.setUp();
    runnable.run();
    System.out.println("PASS " + name);
  }

  @FunctionalInterface
  private interface ThrowingRunnable {
    void run() throws Exception;
  }
}
