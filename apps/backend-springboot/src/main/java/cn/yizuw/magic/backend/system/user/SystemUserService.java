package cn.yizuw.magic.backend.system.user;

import cn.yizuw.magic.backend.cache.CacheService;
import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

@Service
public class SystemUserService {

  private final AppProperties appProperties;
  private final CacheService cacheService;
  private final JdbcTemplate centerJdbcTemplate;
  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
  private final SystemUserRepository systemUserRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public SystemUserService(
      AppProperties appProperties,
      CacheService cacheService,
      JdbcTemplate centerJdbcTemplate,
      SystemUserRepository systemUserRepository,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.appProperties = appProperties;
    this.cacheService = cacheService;
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.systemUserRepository = systemUserRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getUserList(
      Integer currentPage,
      Integer pageSize,
      String phone,
      String realName,
      String status,
      String username) {
    UserTokenPayload payload = TenantRequired.currentUser();
    SystemUserQuery query =
        new SystemUserQuery(
            PageRequestParams.normalizePage(currentPage, 1),
            PageRequestParams.normalizePageSize(pageSize, 20),
            phone,
            realName,
            normalizeStatus(status),
            username);
    JdbcTemplate tenantJdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    PageResult<Map<String, Object>> page =
        systemUserRepository.findUsers(tenantJdbcTemplate, query, payload.customerId());
    enrichUsers(tenantJdbcTemplate, payload.customerId(), page.items());
    return page;
  }

  /**
   * 创建账号。
   *
   * <p>迁移期只同步中心库账号、租户库账号、角色和园区范围；旧端组织成员自动开通策略留到组织生命周期专项。
   */
  public Map<String, Object> createUser(UserWriteRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    UserWriteCommand command = toCreateCommand(request);
    JdbcTemplate tenantJdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    DataSource tenantDataSource = tenantJdbcTemplateProvider.currentTenantDataSource();
    systemUserRepository.assertWritableUserSchema(tenantJdbcTemplate);
    systemUserRepository.assertCustomerAvailable(centerJdbcTemplate, payload.customerId());
    systemUserRepository.assertTenantUsernameAvailable(tenantJdbcTemplate, command.username());

    Map<String, Object> existingCenterUser =
        systemUserRepository.findCenterUserByUsername(centerJdbcTemplate, command.username());
    if (existingCenterUser != null) {
      String ownerCustomerId = Objects.toString(existingCenterUser.get("customerType"), "");
      if (StringUtils.hasText(ownerCustomerId) && !ownerCustomerId.equals(payload.customerId())) {
        throw new BusinessException(
            HttpStatus.CONFLICT, "中心库账号已被租户 " + ownerCustomerId + " 占用");
      }
    }

    String passwordHash = passwordEncoder.encode(command.password());
    Long tenantUserId =
        new TransactionTemplate(new DataSourceTransactionManager(tenantDataSource))
            .execute(
                ignored -> {
                  long createdId =
                      systemUserRepository.insertTenantUser(
                          tenantJdbcTemplate,
                          payload.customerId(),
                          passwordHash,
                          command.phone(),
                          command.realName(),
                          command.status(),
                          command.username());
                  systemUserRepository.replaceUserRoles(
                      tenantJdbcTemplate, createdId, command.roleIds());
                  systemUserRepository.syncUserParks(
                      tenantJdbcTemplate, createdId, command.parkIds(), true);
                  return createdId;
                });
    if (tenantUserId == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "创建账号失败");
    }

    Long centerUserId;
    try {
      centerUserId =
          systemUserRepository.upsertCenterUserForTenant(
              centerJdbcTemplate,
              payload.customerId(),
              payload.dbName(),
              existingCenterUser,
              passwordHash,
              command.phone(),
              command.realName(),
              command.status(),
              tenantUserId,
              command.username(),
              true);
    } catch (Exception error) {
      systemUserRepository.cleanupCreatedTenantUser(tenantJdbcTemplate, tenantUserId);
      throw error;
    }
    evictUserAuthCaches(payload.customerId(), tenantUserId);
    return accountResult(centerUserId, tenantUserId, "created");
  }

  /** 更新账号基础资料、角色和园区范围。 */
  public Map<String, Object> updateUser(int id, UserWriteRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "账号ID不合法");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    UserWriteCommand command = toUpdateCommand(request);
    JdbcTemplate tenantJdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    DataSource tenantDataSource = tenantJdbcTemplateProvider.currentTenantDataSource();
    systemUserRepository.assertWritableUserSchema(tenantJdbcTemplate);

    Map<String, Object> tenantUser = systemUserRepository.findTenantUserById(tenantJdbcTemplate, id);
    if (tenantUser == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "账号不存在");
    }
    String currentUsername = Objects.toString(tenantUser.get("username"), "");
    if (StringUtils.hasText(command.username()) && !command.username().equals(currentUsername)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "暂不支持修改账号名");
    }
    if (payload.id() != null && payload.id() == id && command.status() != null && command.status() == 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "不能禁用当前登录账号");
    }

    Map<String, Object> centerUser =
        systemUserRepository.resolveCenterUser(
            centerJdbcTemplate, payload.customerId(), id, currentUsername);
    if (centerUser != null) {
      String ownerCustomerId = Objects.toString(centerUser.get("customerType"), "");
      if (StringUtils.hasText(ownerCustomerId) && !ownerCustomerId.equals(payload.customerId())) {
        throw new BusinessException(
            HttpStatus.CONFLICT, "中心库账号归属租户为 " + ownerCustomerId + "，无法修改");
      }
    }

    String passwordHash =
        StringUtils.hasText(command.password()) ? passwordEncoder.encode(command.password()) : null;
    Integer currentStatus = asInteger(tenantUser.get("status"));
    Integer statusToWrite =
        command.status() == null
            ? currentStatus == null ? 1 : currentStatus
            : command.status();
    new TransactionTemplate(new DataSourceTransactionManager(tenantDataSource))
        .executeWithoutResult(
            ignored -> {
              systemUserRepository.updateTenantUser(
                  tenantJdbcTemplate,
                  id,
                  passwordHash,
                  command.phone(),
                  command.realName(),
                  statusToWrite);
              if (command.roleIds() != null) {
                systemUserRepository.replaceUserRoles(
                    tenantJdbcTemplate, id, command.roleIds());
              }
              if (command.parkIds() != null) {
                systemUserRepository.syncUserParks(
                    tenantJdbcTemplate, id, command.parkIds(), false);
              }
            });

    Long centerUserId =
        systemUserRepository.upsertCenterUserForTenant(
            centerJdbcTemplate,
            payload.customerId(),
            payload.dbName(),
            centerUser,
            passwordHash,
            command.phone(),
            command.realName(),
            statusToWrite,
            (long) id,
            currentUsername,
            shouldBumpTokenVersion(passwordHash, command.parkIds(), command.roleIds(), statusToWrite));
    evictUserAuthCaches(payload.customerId(), (long) id);
    return accountResult(centerUserId, (long) id, "updated");
  }

  /** 软删除指定账号并撤销该账号中心库 refresh token。 */
  public Map<String, Object> deleteUser(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "账号ID不合法");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    if (payload.id() != null && payload.id() == id) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "不能删除当前登录账号");
    }
    return softDeleteUser(payload, id, false, null);
  }

  /** 注销当前登录账号并清理 refresh token cookie。 */
  public Map<String, Object> cancelCurrentUser(HttpServletResponse response) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (payload.id() == null || payload.id() <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "当前账号信息无效");
    }
    Map<String, Object> result = softDeleteUser(payload, payload.id().intValue(), true, response);
    clearRefreshTokenCookie(response);
    return result;
  }

  private void enrichUsers(
      JdbcTemplate tenantJdbcTemplate, String customerId, List<Map<String, Object>> users) {
    if (users.isEmpty()) {
      return;
    }
    List<Integer> userIds =
        users.stream()
            .map(user -> ((Number) user.get("id")).intValue())
            .distinct()
            .toList();
    Map<Integer, List<Map<String, Object>>> rolesByUserId =
        systemUserRepository.findUserRoles(tenantJdbcTemplate, userIds);
    Map<Integer, List<Map<String, Object>>> directParksByUserId =
        systemUserRepository.findUserDirectParks(tenantJdbcTemplate, userIds);
    Map<Integer, List<Map<String, Object>>> legacyParksByUserId =
        systemUserRepository.findLegacyUserParks(tenantJdbcTemplate, userIds);
    Map<Integer, Integer> centerUserIds =
        systemUserRepository.findCenterUserIds(centerJdbcTemplate, customerId, userIds);
    Map<Integer, Map<String, Object>> centerUsers =
        systemUserRepository.findCenterUsers(
            centerJdbcTemplate,
            centerUserIds.values().stream().distinct().toList());

    for (Map<String, Object> user : users) {
      int userId = ((Number) user.get("id")).intValue();
      List<Map<String, Object>> roleRows = rolesByUserId.getOrDefault(userId, List.of());
      List<Integer> roleIds =
          roleRows.stream()
              .map(role -> ((Number) role.get("roleId")).intValue())
              .distinct()
              .toList();
      List<String> roleNames =
          roleRows.stream()
              .map(role -> String.valueOf(role.get("name") == null ? "" : role.get("name")).trim())
              .filter(name -> !name.isEmpty())
              .distinct()
              .toList();
      List<Map<String, Object>> parks =
          directParksByUserId.getOrDefault(userId, legacyParksByUserId.getOrDefault(userId, List.of()));
      Integer centerUserId = centerUserIds.get(userId);
      Map<String, Object> centerUser = centerUserId == null ? null : centerUsers.get(centerUserId);

      user.put("centerUserId", centerUserId);
      user.put("roleIds", roleIds);
      user.put("roles", roleNames);
      user.put("parks", dedupeParks(parks));
      user.put(
          "parkIds",
          dedupeParks(parks).stream().map(park -> ((Number) park.get("parkId")).intValue()).toList());
      user.put(
          "tokenVersion",
          centerUser == null ? user.get("tokenVersion") : centerUser.get("tokenVersion"));
    }
  }

  private List<Map<String, Object>> dedupeParks(List<Map<String, Object>> parks) {
    List<Map<String, Object>> result = new ArrayList<>();
    LinkedHashSet<Integer> seen = new LinkedHashSet<>();
    for (Map<String, Object> park : parks) {
      Object rawId = park.get("parkId");
      if (rawId instanceof Number number && seen.add(number.intValue())) {
        result.add(park);
      }
    }
    return result;
  }

  private Integer normalizeStatus(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    String normalized = value.trim().toLowerCase();
    if ("1".equals(normalized) || "true".equals(normalized)) {
      return 1;
    }
    if ("0".equals(normalized) || "false".equals(normalized)) {
      return 0;
    }
    return null;
  }

  private Map<String, Object> softDeleteUser(
      UserTokenPayload payload, int tenantUserId, boolean selfCancel, HttpServletResponse response) {
    JdbcTemplate tenantJdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    DataSource tenantDataSource = tenantJdbcTemplateProvider.currentTenantDataSource();
    systemUserRepository.assertWritableUserSchema(tenantJdbcTemplate);

    Map<String, Object> tenantUser =
        systemUserRepository.findTenantUserById(tenantJdbcTemplate, tenantUserId);
    if (tenantUser == null) {
      throw new BusinessException(
          selfCancel ? HttpStatus.BAD_REQUEST : HttpStatus.NOT_FOUND,
          selfCancel ? "当前账号不存在" : "账号不存在");
    }

    String username = Objects.toString(tenantUser.get("username"), "");
    Map<String, Object> centerUser =
        systemUserRepository.resolveCenterUser(
            centerJdbcTemplate, payload.customerId(), tenantUserId, username);
    Long centerUserId = centerUser == null ? null : asLong(centerUser.get("id"));

    new TransactionTemplate(new DataSourceTransactionManager(tenantDataSource))
        .executeWithoutResult(
            ignored -> {
              systemUserRepository.detachEmployees(tenantJdbcTemplate, tenantUserId);
              systemUserRepository.softDeleteTenantUser(tenantJdbcTemplate, tenantUserId);
              systemUserRepository.deleteUserRolesAndCodes(tenantJdbcTemplate, tenantUserId);
              systemUserRepository.softDeleteUserParks(tenantJdbcTemplate, tenantUserId);
            });

    if (centerUserId != null) {
      systemUserRepository.deleteTenantMapping(
          centerJdbcTemplate, centerUserId, payload.customerId(), tenantUserId);
      if (!systemUserRepository.hasAnyTenantMapping(centerJdbcTemplate, centerUserId)) {
        systemUserRepository.softDeleteCenterUserAndRevokeTokens(centerJdbcTemplate, centerUserId);
      }
    }
    evictUserAuthCaches(payload.customerId(), (long) tenantUserId);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("centerUserId", centerUserId);
    result.put("id", tenantUserId);
    result.put("mode", "soft");
    result.put("tenantUserId", tenantUserId);
    if (selfCancel) {
      result.put("self", true);
    }
    return result;
  }

  private void evictUserAuthCaches(String customerId, Long tenantUserId) {
    if (customerId == null || customerId.isBlank() || tenantUserId == null) {
      return;
    }
    String tenantPrefix = "tenant:" + customerId + ":";
    cacheService.evictByPrefix(tenantPrefix + "route-menus:" + tenantUserId + ":");
    cacheService.evictByPrefix(tenantPrefix + "permission-codes:" + tenantUserId + ":");
    cacheService.evictByPrefix(tenantPrefix + "user-info:" + tenantUserId + ":");
  }

  private UserWriteCommand toCreateCommand(UserWriteRequest request) {
    UserWriteCommand command = toCommand(request, true);
    if (!StringUtils.hasText(command.username())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "账号不能为空");
    }
    if (!StringUtils.hasText(command.password())) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "密码不能为空");
    }
    return command;
  }

  private UserWriteCommand toUpdateCommand(UserWriteRequest request) {
    return toCommand(request, false);
  }

  private UserWriteCommand toCommand(UserWriteRequest request, boolean create) {
    if (request == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请求参数不能为空");
    }
    String realName = trim(request.realName());
    if (!StringUtils.hasText(realName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "姓名不能为空");
    }
    return new UserWriteCommand(
        create ? normalizeIds(request.parkIds(), "园区必须是数组") : normalizeNullableIds(request.parkIds(), "园区必须是数组"),
        trim(request.password()),
        trim(request.phone()),
        realName,
        create ? normalizeIds(request.roleIds(), "角色必须是数组") : normalizeNullableIds(request.roleIds(), "角色必须是数组"),
        normalizeStatusValue(request.status(), create ? 1 : null),
        trim(request.username()));
  }

  private List<Integer> normalizeIds(Object rawValues, String message) {
    if (rawValues == null) {
      return List.of();
    }
    if (!(rawValues instanceof List<?> values)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return values.stream()
        .map(this::toPositiveInteger)
        .filter(Objects::nonNull)
        .distinct()
        .collect(Collectors.toList());
  }

  private List<Integer> normalizeNullableIds(Object rawValues, String message) {
    if (rawValues == null) {
      return null;
    }
    return normalizeIds(rawValues, message);
  }

  private Integer toPositiveInteger(Object value) {
    if (value == null) {
      return null;
    }
    try {
      double parsed = Double.parseDouble(String.valueOf(value));
      int asInt = (int) parsed;
      return parsed == asInt && asInt > 0 ? asInt : null;
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  private Integer normalizeStatusValue(Object value, Integer fallback) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return fallback;
    }
    return "0".equals(String.valueOf(value).trim()) ? 0 : 1;
  }

  private boolean shouldBumpTokenVersion(
      String passwordHash, List<Integer> parkIds, List<Integer> roleIds, Integer status) {
    return passwordHash != null || parkIds != null || roleIds != null || status != null && status == 0;
  }

  private Map<String, Object> accountResult(Long centerUserId, Long tenantUserId, String mode) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("centerUserId", centerUserId);
    result.put("id", tenantUserId);
    result.put("mode", mode);
    result.put("tenantUserId", tenantUserId);
    return result;
  }

  private String trim(String value) {
    return value == null ? "" : value.trim();
  }

  private Integer asInteger(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value == null) {
      return null;
    }
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  private Long asLong(Object value) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    if (value == null) {
      return null;
    }
    try {
      return Long.parseLong(String.valueOf(value));
    } catch (NumberFormatException ignored) {
      return null;
    }
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

  private record UserWriteCommand(
      List<Integer> parkIds,
      String password,
      String phone,
      String realName,
      List<Integer> roleIds,
      Integer status,
      String username) {}
}
