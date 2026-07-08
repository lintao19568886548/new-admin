package cn.yizuw.magic.backend.auth;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessagePublisher;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageRequest;
import cn.yizuw.magic.backend.security.JwtService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantDataSourceRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private final AppProperties appProperties;
  private final AuthRepository authRepository;
  private final Environment environment;
  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
  private final JwtService jwtService;
  private final RabbitMessagePublisher rabbitMessagePublisher;
  private final SmsCodeService smsCodeService;
  private final TenantDataSourceRegistry tenantDataSourceRegistry;

  public AuthService(
      AppProperties appProperties,
      AuthRepository authRepository,
      Environment environment,
      JwtService jwtService,
      RabbitMessagePublisher rabbitMessagePublisher,
      SmsCodeService smsCodeService,
      TenantDataSourceRegistry tenantDataSourceRegistry) {
    this.appProperties = appProperties;
    this.authRepository = authRepository;
    this.environment = environment;
    this.jwtService = jwtService;
    this.rabbitMessagePublisher = rabbitMessagePublisher;
    this.smsCodeService = smsCodeService;
    this.tenantDataSourceRegistry = tenantDataSourceRegistry;
  }

  public LoginResponse login(LoginRequest request, HttpServletResponse response) {
    CenterUserRecord centerUser = authRepository.findCenterUserForLogin(request.username().trim());
    if (centerUser == null || centerUser.status() == null || centerUser.status() != 1) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "用户名或密码错误");
    }
    if (centerUser.customerId() == null
        || centerUser.customerId().isBlank()
        || centerUser.customerStatus() == null
        || centerUser.customerStatus() == 0) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "用户名或密码错误");
    }
    if (!matchesPassword(request.password(), centerUser.password())) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "用户名或密码错误");
    }

    return issueLoginTokens(centerUser, response, "用户名或密码错误", false);
  }

  /**
   * 短信验证码登录。
   *
   * <p>旧 Nitro 在手机号不存在时会自动补齐中心账号、租户账号、默认角色和映射。这里保留这个兼容行为，
   * 但只写账号相关表，不触发组织生命周期、开通任务、短信外呼或第三方系统调用。
   */
  public LoginResponse codeLogin(AuthCodeLoginRequest request, HttpServletResponse response) {
    String phoneNumber = request == null ? "" : trim(request.phoneNumber());
    String code = request == null ? "" : trim(request.code());
    if (phoneNumber.isBlank() || code.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "手机号和验证码均不能为空");
    }
    phoneNumber = smsCodeService.normalizePhone(phoneNumber);
    smsCodeService.verifyCode(phoneNumber, code);

    CenterUserRecord centerUser = authRepository.findCenterUserForLogin(phoneNumber);
    if (centerUser == null) {
      tryCreatePhoneUserIfMissing(phoneNumber);
      centerUser = authRepository.findCenterUserForLogin(phoneNumber);
    }
    if (centerUser == null) {
      clearRefreshTokenCookie(response);
      throw new BusinessException(HttpStatus.FORBIDDEN, "手机号或验证码错误");
    }
    if (isPhoneUserMissingTenantMapping(centerUser, phoneNumber)) {
      tryEnsureTenantPhoneUser(centerUser, phoneNumber);
      centerUser = authRepository.findCenterUserForLogin(phoneNumber);
    }
    return issueLoginTokens(centerUser, response, "手机号或验证码错误", true);
  }

  private LoginResponse issueLoginTokens(
      CenterUserRecord centerUser,
      HttpServletResponse response,
      String rejectMessage,
      boolean clearCookieOnReject) {
    if (centerUser == null
        || centerUser.status() == null
        || centerUser.status() != 1
        || centerUser.customerId() == null
        || centerUser.customerId().isBlank()
        || centerUser.customerStatus() == null
        || centerUser.customerStatus() == 0) {
      throw rejectedLogin(response, rejectMessage, clearCookieOnReject);
    }

    TenantUserInfo tenantUser;
    try {
      tenantUser = resolveTenantUser(centerUser);
    } catch (RuntimeException error) {
      throw rejectedLogin(response, rejectMessage, clearCookieOnReject);
    }
    if (tenantUser == null) {
      throw rejectedLogin(response, rejectMessage, clearCookieOnReject);
    }

    UserTokenPayload payload = buildTokenPayload(centerUser, tenantUser);
    String accessToken = jwtService.generateAccessToken(payload);
    JwtService.RefreshTokenIssue refreshToken = jwtService.issueRefreshToken(payload);
    authRepository.persistRefreshToken(
        refreshToken.jti(), hashToken(refreshToken.token()), refreshToken.expiresAt(), centerUser.id());
    setRefreshTokenCookie(response, refreshToken.token());

    return toLoginResponse(payload, tenantUser, accessToken);
  }

  private BusinessException rejectedLogin(
      HttpServletResponse response, String message, boolean clearCookieOnReject) {
    if (clearCookieOnReject) {
      clearRefreshTokenCookie(response);
    }
    return new BusinessException(HttpStatus.FORBIDDEN, message);
  }

  private void tryCreatePhoneUserIfMissing(String phoneNumber) {
    try {
      String customerId = resolveSmsRegisterCustomerId();
      String passwordHash = passwordEncoder.encode(UUID.randomUUID().toString().replace("-", ""));
      long centerUserId = authRepository.createCenterPhoneUser(phoneNumber, passwordHash, customerId);
      CenterUserRecord createdUser = authRepository.findActiveCenterUserById(centerUserId);
      if (createdUser == null || createdUser.customerStatus() == null || createdUser.customerStatus() == 0) {
        return;
      }
      JdbcTemplate tenantJdbcTemplate =
          new JdbcTemplate(tenantDataSourceRegistry.getDataSource(customerId, createdUser.dbName()));
      long tenantUserId =
          authRepository.upsertTenantPhoneUser(
              tenantJdbcTemplate, phoneNumber, passwordHash, customerId);
      authRepository.createTenantUserMapping(
          centerUserId, customerId, tenantUserId, createdUser.dbName());
    } catch (RuntimeException ignored) {
      // 自动建号是迁移期兼容能力；失败后仍按验证码登录失败处理，避免暴露库结构细节。
    }
  }

  private boolean isPhoneUserMissingTenantMapping(CenterUserRecord centerUser, String phoneNumber) {
    if (centerUser == null || !phoneNumber.equals(centerUser.username())) {
      return false;
    }
    if (centerUser.customerId() == null || centerUser.customerId().isBlank()) {
      return false;
    }
    try {
      return resolveTenantUser(centerUser) == null;
    } catch (RuntimeException error) {
      return false;
    }
  }

  private void tryEnsureTenantPhoneUser(CenterUserRecord centerUser, String phoneNumber) {
    try {
      String passwordHash = passwordEncoder.encode(UUID.randomUUID().toString().replace("-", ""));
      JdbcTemplate tenantJdbcTemplate =
          new JdbcTemplate(
              tenantDataSourceRegistry.getDataSource(centerUser.customerId(), centerUser.dbName()));
      long tenantUserId =
          authRepository.upsertTenantPhoneUser(
              tenantJdbcTemplate, phoneNumber, passwordHash, centerUser.customerId());
      authRepository.createTenantUserMapping(
          centerUser.id(), centerUser.customerId(), tenantUserId, centerUser.dbName());
    } catch (RuntimeException ignored) {
      // 补齐失败仍按验证码登录失败处理，由人工检查租户库连接或基础角色。
    }
  }

  private String resolveSmsRegisterCustomerId() {
    if (hasTextSetting("spring.datasource.tenant.public-jdbc-url")
        || hasTextSetting("PUBLIC_DATABASE_URL")) {
      return "public";
    }
    return appProperties.getDefaultCustomerId();
  }

  private boolean hasTextSetting(String name) {
    String value = environment.getProperty(name);
    if (value == null || value.isBlank()) {
      value = System.getenv(name);
    }
    return value != null && !value.isBlank();
  }

  private String trim(String value) {
    return value == null ? "" : value.trim();
  }

  public String refresh(String refreshToken, HttpServletResponse response) {
    if (refreshToken == null || refreshToken.isBlank()) {
      clearRefreshTokenCookie(response);
      throw new BusinessException(
          HttpStatus.UNAUTHORIZED, "会话过期，请重新登录", "AUTH_REFRESH_TOKEN_MISSING");
    }

    try {
      JwtService.RefreshPayload refreshPayload = jwtService.verifyRefreshToken(refreshToken);
      RefreshTokenRecord stored = authRepository.findRefreshToken(refreshPayload.jti());
      if (stored == null || !hashToken(refreshToken).equals(stored.tokenHash())) {
        throw new IllegalStateException("Refresh token not found");
      }
      if (stored.revokedAt() != null) {
        authRepository.revokeAllUserRefreshTokensAndBumpVersion(stored.userId());
        throw new IllegalStateException("Refresh token reused");
      }
      if (stored.expiresAt().isBefore(OffsetDateTime.now())) {
        throw new IllegalStateException("Refresh token expired");
      }

      CenterUserRecord centerUser = authRepository.findActiveCenterUserById(stored.userId());
      if (centerUser == null
          || centerUser.status() == null
          || centerUser.status() != 1
          || centerUser.customerStatus() == null
          || centerUser.customerStatus() == 0
          || !centerUser.tokenVersion().equals(refreshPayload.payload().tokenVersion())) {
        authRepository.revokeRefreshToken(refreshPayload.jti());
        throw new IllegalStateException("Token version mismatch");
      }

      TenantUserInfo tenantUser = resolveTenantUser(centerUser);
      if (tenantUser == null) {
        throw new IllegalStateException("Customer user mapping missing");
      }

      UserTokenPayload newPayload = buildTokenPayload(centerUser, tenantUser);
      String accessToken = jwtService.generateAccessToken(newPayload);
      JwtService.RefreshTokenIssue newRefreshToken = jwtService.issueRefreshToken(newPayload);
      authRepository.persistRefreshToken(
          newRefreshToken.jti(),
          hashToken(newRefreshToken.token()),
          newRefreshToken.expiresAt(),
          centerUser.id());
      authRepository.revokeRefreshToken(refreshPayload.jti(), newRefreshToken.jti());
      setRefreshTokenCookie(response, newRefreshToken.token());
      return accessToken;
    } catch (Exception error) {
      clearRefreshTokenCookie(response);
      throw new BusinessException(
          HttpStatus.UNAUTHORIZED, "会话过期，请重新登录", resolveRefreshAuthErrorCode(error));
    }
  }

  public void logout(String refreshToken, HttpServletResponse response) {
    if (refreshToken != null && !refreshToken.isBlank()) {
      try {
        JwtService.RefreshPayload payload = jwtService.verifyRefreshToken(refreshToken);
        RefreshTokenRecord stored = authRepository.findRefreshToken(payload.jti());
        if (stored != null && hashToken(refreshToken).equals(stored.tokenHash())) {
          authRepository.revokeRefreshToken(payload.jti());
          authRepository.revokeAllUserRefreshTokensAndBumpVersion(stored.userId());
        }
      } catch (Exception ignored) {
        // Logout must be best-effort and always clear the client cookie.
      }
    }
    clearRefreshTokenCookie(response);
  }

  /**
   * 修改当前中心账号密码。
   *
   * <p>旧接口按 token 中的 username 查中心库用户，校验旧密码后更新密码、递增 tokenVersion，并撤销仍有效的
   * refresh token。这里优先使用 token 内 centerUserId 精准定位，缺失时回退 username。
   */
  public Map<String, Object> changePassword(PasswordUpdateRequest request) {
    UserTokenPayload payload = cn.yizuw.magic.backend.tenant.TenantRequired.currentUser();
    CenterUserRecord user =
        payload.centerUserId() == null
            ? authRepository.findCenterUserForLogin(payload.username())
            : authRepository.findActiveCenterUserById(payload.centerUserId());
    if (user == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "用户不存在");
    }
    if (!matchesPassword(request.oldPassword(), user.password())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "原密码错误");
    }

    authRepository.updatePasswordAndRevokeRefreshTokens(
        user.id(), passwordEncoder.encode(request.newPassword()));
    return Map.of("message", "密码修改成功");
  }

  /**
   * 旧 GET `/auth/password` 兼容说明。
   *
   * <p>旧 Nitro 文件名未带 `.post`，路由差异脚本会识别成 GET；Spring Boot 只允许 POST 真正修改密码。
   */
  public Map<String, Object> passwordCompatibilityInfo() {
    return Map.of(
        "method",
        "POST",
        "path",
        "/api/auth/password",
        "status",
        "compatibility_stub",
        "writeOnGet",
        false,
        "message",
        "请使用 POST /api/auth/password 修改密码，GET 仅用于迁移期兼容说明。");
  }

  /**
   * 发送登录验证码。
   *
   * <p>迁移期只把验证码任务投递到 RabbitMQ；真实短信供应商调用由后续消费者专项接管，避免 Controller 切流时直接外呼。
   */
  public Map<String, Object> sendLoginCode(SmsCodeRequest request) {
    String phoneNumber = smsCodeService.normalizePhone(request == null ? null : request.phoneNumber());
    String code = smsCodeService.issueCode(phoneNumber);
    String messageId = publishSmsCodeTask("login_sms_code", phoneNumber, code, null);
    return Map.of(
        "debugCode", code,
        "expiresIn", smsCodeService.ttlSeconds(),
        "messageId", messageId,
        "transport", "rabbitmq");
  }

  /** 为当前登录账号发送页面访问验证码，手机号从中心库/租户库账号信息解析。 */
  public Map<String, Object> sendPageAccessCode() {
    UserTokenPayload payload = cn.yizuw.magic.backend.tenant.TenantRequired.currentUser();
    String phoneNumber = resolveCurrentUserPhoneNumber(payload);
    String code = smsCodeService.issueCode(phoneNumber);
    String messageId = publishSmsCodeTask("page_access_sms_code", phoneNumber, code, payload.customerId());
    return Map.of(
        "debugCode", code,
        "expiresIn", smsCodeService.ttlSeconds(),
        "messageId", messageId,
        "transport", "rabbitmq");
  }

  /** 校验当前登录账号的页面访问验证码，成功后 Redis 中验证码会被删除。 */
  public Map<String, Object> verifyPageAccessCode(SmsCodeVerifyRequest request) {
    UserTokenPayload payload = cn.yizuw.magic.backend.tenant.TenantRequired.currentUser();
    String phoneNumber = resolveCurrentUserPhoneNumber(payload);
    smsCodeService.verifyCode(phoneNumber, request == null ? null : request.code());
    return Map.of("phoneNumber", phoneNumber, "verified", true);
  }

  private UserTokenPayload buildTokenPayload(CenterUserRecord centerUser, TenantUserInfo tenantUser) {
    return new UserTokenPayload(
        centerUser.id(),
        centerUser.customerId(),
        centerUser.dbName(),
        tenantUser.id(),
        tenantUser.parks(),
        tenantUser.rates(),
        tenantUser.reimbursementAuth(),
        tenantUser.roles(),
        centerUser.tokenVersion(),
        tenantUser.username());
  }

  private TenantUserInfo resolveTenantUser(CenterUserRecord centerUser) {
    JdbcTemplate tenantJdbcTemplate =
        new JdbcTemplate(
            tenantDataSourceRegistry.getDataSource(centerUser.customerId(), centerUser.dbName()));
    return authRepository.resolveTenantUserInfo(
        tenantJdbcTemplate,
        centerUser.id(),
        centerUser.customerId(),
        centerUser.dbName(),
        centerUser.username());
  }

  private String resolveCurrentUserPhoneNumber(UserTokenPayload payload) {
    String username = payload.username();
    if (username != null && username.matches("\\d{11}")) {
      return username;
    }
    if (payload.centerUserId() != null) {
      CenterUserRecord centerUser = authRepository.findActiveCenterUserById(payload.centerUserId());
      if (centerUser != null && centerUser.username() != null && centerUser.username().matches("\\d{11}")) {
        return centerUser.username();
      }
    }
    String tenantPhone = resolveTenantPhoneReadOnly(payload);
    if (tenantPhone != null && tenantPhone.matches("\\d{11}")) {
      return tenantPhone;
    }
    throw new BusinessException(HttpStatus.BAD_REQUEST, "当前登录账号未绑定有效手机号，请联系管理员");
  }

  private String resolveTenantPhoneReadOnly(UserTokenPayload payload) {
    if (payload.customerId() == null || payload.dbName() == null || payload.username() == null) {
      return null;
    }
    JdbcTemplate tenantJdbcTemplate =
        new JdbcTemplate(tenantDataSourceRegistry.getDataSource(payload.customerId(), payload.dbName()));
    return authRepository.findTenantUserPhone(tenantJdbcTemplate, payload.id(), payload.username());
  }

  private String publishSmsCodeTask(
      String aggregateType, String phoneNumber, String code, String customerId) {
    try {
      String payloadJson =
          OBJECT_MAPPER.writeValueAsString(
              Map.of(
                  "code", code,
                  "expiresIn", smsCodeService.ttlSeconds(),
                  "phoneNumber", phoneNumber,
                  "source", aggregateType));
      return rabbitMessagePublisher.publishNotification(
          new RabbitMessageRequest(
              phoneNumber,
              aggregateType,
              customerId == null ? appProperties.getDefaultCustomerId() : customerId,
              Map.of("source", "springboot_migration"),
              aggregateType + ":" + phoneNumber,
              null,
              payloadJson,
              null));
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "验证码短信任务投递失败");
    }
  }

  private LoginResponse toLoginResponse(
      UserTokenPayload payload, TenantUserInfo tenantUser, String accessToken) {
    return new LoginResponse(
        accessToken,
        payload.centerUserId(),
        tenantUser.codes(),
        payload.customerId(),
        tenantUser.homePath(),
        payload.id(),
        tenantUser.parks(),
        tenantUser.phone(),
        tenantUser.rates(),
        tenantUser.realName(),
        tenantUser.reimbursementAuth(),
        tenantUser.roles(),
        payload.tokenVersion(),
        payload.username());
  }

  private boolean matchesPassword(String rawPassword, String encodedOrRawPassword) {
    if (encodedOrRawPassword == null) {
      return false;
    }
    if (encodedOrRawPassword.startsWith("$2a$")
        || encodedOrRawPassword.startsWith("$2b$")
        || encodedOrRawPassword.startsWith("$2y$")) {
      return passwordEncoder.matches(rawPassword, encodedOrRawPassword);
    }
    return rawPassword.equals(encodedOrRawPassword);
  }

  private void setRefreshTokenCookie(HttpServletResponse response, String token) {
    AppProperties.RefreshCookie cookieProperties = appProperties.getRefreshCookie();
    String sameSite = cookieProperties.isSecure() ? "None" : "Lax";
    StringBuilder value =
        new StringBuilder()
            .append(cookieProperties.getName())
            .append('=')
            .append(token)
            .append("; Max-Age=")
            .append(cookieProperties.getMaxAgeSeconds())
            .append("; Path=/; HttpOnly; SameSite=")
            .append(sameSite);
    if (cookieProperties.isSecure()) {
      value.append("; Secure");
    }
    response.addHeader(HttpHeaders.SET_COOKIE, value.toString());
  }

  private void clearRefreshTokenCookie(HttpServletResponse response) {
    Cookie cookie = new Cookie(appProperties.getRefreshCookie().getName(), "");
    cookie.setHttpOnly(true);
    cookie.setMaxAge(0);
    cookie.setPath("/");
    cookie.setSecure(appProperties.getRefreshCookie().isSecure());
    response.addCookie(cookie);
    String sameSite = appProperties.getRefreshCookie().isSecure() ? "None" : "Lax";
    StringBuilder value =
        new StringBuilder()
            .append(appProperties.getRefreshCookie().getName())
            .append("=; Max-Age=0; Path=/; HttpOnly; SameSite=")
            .append(sameSite);
    if (appProperties.getRefreshCookie().isSecure()) {
      value.append("; Secure");
    }
    response.addHeader(HttpHeaders.SET_COOKIE, value.toString());
  }

  private String hashToken(String token) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception error) {
      throw new IllegalStateException("Unable to hash token", error);
    }
  }

  private String resolveRefreshAuthErrorCode(Exception error) {
    String message = error.getMessage();
    if ("Token version mismatch".equals(message)) {
      return "AUTH_TOKEN_VERSION_MISMATCH";
    }
    if ("Refresh token reused".equals(message)) {
      return "AUTH_REFRESH_TOKEN_REVOKED";
    }
    return "AUTH_REFRESH_TOKEN_INVALID";
  }
}
