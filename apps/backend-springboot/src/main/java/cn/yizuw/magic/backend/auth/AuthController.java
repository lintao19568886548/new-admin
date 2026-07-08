package cn.yizuw.magic.backend.auth;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.permission.PermissionService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

  private final AuthService authService;
  private final PermissionService permissionService;

  public AuthController(AuthService authService, PermissionService permissionService) {
    this.authService = authService;
    this.permissionService = permissionService;
  }

  @PostMapping("/auth/login")
  public ApiResponse<LoginResponse> login(
      @Valid @RequestBody LoginRequest request, HttpServletResponse response) {
    return ApiResponse.ok(authService.login(request, response));
  }

  /** 短信验证码登录；验证码存储在 Redis，账号补齐保持旧端受控兼容。 */
  @PostMapping("/auth/code-login")
  public ApiResponse<LoginResponse> codeLogin(
      @RequestBody(required = false) AuthCodeLoginRequest request, HttpServletResponse response) {
    return ApiResponse.ok(authService.codeLogin(request, response));
  }

  @PostMapping("/auth/refresh")
  public String refresh(HttpServletRequest request, HttpServletResponse response) {
    return authService.refresh(resolveRefreshToken(request), response);
  }

  @PostMapping("/auth/logout")
  public ApiResponse<String> logout(HttpServletRequest request, HttpServletResponse response) {
    authService.logout(resolveRefreshToken(request), response);
    return ApiResponse.ok("");
  }

  /** 修改当前登录用户密码，并撤销该用户仍有效的刷新令牌。 */
  @PostMapping("/auth/password")
  public ApiResponse<Map<String, Object>> password(
      @Valid @RequestBody PasswordUpdateRequest request) {
    return ApiResponse.ok(authService.changePassword(request));
  }

  /** 旧端 GET 密码接口兼容说明；真实改密只允许 POST，避免 GET 产生写库副作用。 */
  @GetMapping("/auth/password")
  public ApiResponse<Map<String, Object>> passwordCompatibility() {
    return ApiResponse.ok(authService.passwordCompatibilityInfo());
  }

  /** 发送登录短信验证码；迁移期只投递 RabbitMQ 通知任务。 */
  @PostMapping("/auth/send-login-code")
  public ApiResponse<Map<String, Object>> sendLoginCode(
      @RequestBody(required = false) SmsCodeRequest request) {
    return ApiResponse.ok(authService.sendLoginCode(request), "验证码发送成功");
  }

  /** 为当前登录账号发送页面访问验证码。 */
  @PostMapping("/auth/send-page-access-code")
  public ApiResponse<Map<String, Object>> sendPageAccessCode() {
    return ApiResponse.ok(authService.sendPageAccessCode(), "验证码发送成功");
  }

  /** 校验当前登录账号页面访问验证码。 */
  @PostMapping("/auth/verify-page-access-code")
  public ApiResponse<Map<String, Object>> verifyPageAccessCode(
      @RequestBody(required = false) SmsCodeVerifyRequest request) {
    return ApiResponse.ok(authService.verifyPageAccessCode(request), "验证码校验成功");
  }

  @GetMapping("/auth/codes")
  public ApiResponse<List<String>> codes() {
    return ApiResponse.ok(permissionService.getCurrentPermissionCodes());
  }

  private String resolveRefreshToken(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies == null) {
      return null;
    }
    for (Cookie cookie : cookies) {
      if ("jwt".equals(cookie.getName())) {
        return cookie.getValue();
      }
    }
    return null;
  }
}
